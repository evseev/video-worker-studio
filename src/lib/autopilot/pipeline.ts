import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { PersonFacts, Relation } from "@/lib/facts/wikidata";
import { sourcePersonSlots, type PersonSlotRequest } from "@/lib/images/source-person";
import { faceObjectPosition, slotSize } from "@/lib/images/crop";
import type { RankedCandidate } from "@/lib/images/types";
import { narrateLines } from "@/lib/tts/narration";
import { stripDeliveryMarkup, type SonioxTag } from "@/lib/tts/soniox";
import { buildTimeline, cuesForTimeline, toSrt, buildChapters, chaptersToText, type Timeline } from "@/lib/tts/timeline";
import { dubLines, buildMusicBed, mixDubbedTrack, translateLines, LOCALE_NAMES } from "@/lib/tts/localize";
import { normalizeMp4Metadata } from "@/lib/video/postprocess";
import { getMusicTrack } from "@/lib/music-presets";
import { buildVerifiedPairs, writeNarration, writePackaging, type NarrationLineOut, type Packaging } from "./script";
import { pairCaption, pairEras, pairLabels, type FormatSlug, type VerifiedPair } from "./formats";
import { startStaticServer } from "./static-server";
import { renderReviewHtml } from "./review-html";

export const PIPELINE_VERSION = 1;

export interface SlotPick {
  chosen: PickedImage | null;
  alternatives: PickedImage[];
}

export interface PickedImage {
  path: string;
  objectPosition: string;
  confidence: RankedCandidate["confidence"];
  score: number;
  identityScore: number;
  flags: string[];
  source: string;
  sourceUrl: string | null;
  attribution: string | null;
  width: number;
  height: number;
}

export interface PipelineState {
  version: number;
  slug: string;
  topic: string;
  format: FormatSlug;
  pairsTarget: number;
  musicId: string;
  locales: string[];
  createdAt: string;
  stages: Partial<Record<StageName, string>>;
  pairs?: Array<{ left: PersonFacts; right: PersonFacts; relation: Relation | null; relationKind: VerifiedPair["relationKind"] }>;
  rejected?: Array<{ left: string; right: string; reason: string }>;
  narration?: NarrationLineOut[];
  packaging?: Packaging;
  images?: Record<string, { left: SlotPick; right: SlotPick }>;
  voice?: { lines: Array<{ file: string; durationSec: number; text: string }>; timeline: Timeline };
  dubs?: Record<string, { audioFile: string; srtFile: string; title: string; description: string }>;
  outputs?: { video?: string; thumbnails?: string[]; bundleDir?: string };
}

export type StageName = "script" | "images" | "voice" | "render" | "thumbnails" | "localize" | "bundle";
export const STAGES: StageName[] = ["script", "images", "voice", "render", "thumbnails", "localize", "bundle"];

export interface PipelineOptions {
  topic: string;
  format: FormatSlug;
  pairs: number;
  outRoot: string;
  musicId?: string;
  locales?: string[];
  quality?: "720p" | "1080p";
  /** Stop after this stage (inclusive). */
  until?: StageName;
  /** Re-run these stages even if done. */
  force?: StageName[];
  exclude?: string[];
  seriesName?: string;
  publishSlot?: string;
  log?: (msg: string) => void;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

const FPS = 30;
const TRANSITION_FRAMES = 15;
const LEAD_IN_FRAMES = 10;
const MUSIC_VOLUME = 0.22;
const MUSIC_DUCKED = 0.045; // ≈ -14 dB under narration

/** URL for a file inside the run directory, served by the local static server. */
function runFileUrl(baseUrl: string, runDir: string, file: string): string {
  const rel = path.relative(runDir, file);
  if (rel.startsWith("..")) throw new Error(`Asset outside run directory: ${file}`);
  return `${baseUrl}/files/${rel.split(path.sep).map(encodeURIComponent).join("/")}`;
}

function statePath(dir: string) {
  return path.join(dir, "state.json");
}

function saveState(dir: string, state: PipelineState) {
  fs.writeFileSync(statePath(dir), JSON.stringify(state, null, 2));
}

function toVerified(p: NonNullable<PipelineState["pairs"]>[number]): VerifiedPair {
  return { left: p.left, right: p.right, relation: p.relation, relationKind: p.relationKind };
}

function pick(c: RankedCandidate, template: string, slot: number, video: { width: number; height: number }): PickedImage {
  const size = slotSize(template, slot, video);
  const a = c.analysis;
  const objectPosition =
    a.faceBox && a.width && a.height
      ? faceObjectPosition({ imageWidth: a.width, imageHeight: a.height, faceBox: a.faceBox, targetWidth: size.width, targetHeight: size.height })
      : "50% 35%";
  return {
    path: c.localPath,
    objectPosition,
    confidence: c.confidence,
    score: Number(c.score.toFixed(3)),
    identityScore: Number(c.identityScore.toFixed(3)),
    flags: c.flags,
    source: c.source,
    sourceUrl: c.sourceUrl,
    attribution: c.attribution,
    width: a.width ?? 0,
    height: a.height ?? 0,
  };
}

/** Lines in scene order: hook, one per pair, outro. */
export function sceneLines(state: PipelineState): Array<{ text: string; tone: SonioxTag | null }> {
  const pk = state.packaging!;
  return [
    { text: pk.hook, tone: "warm" as SonioxTag },
    ...state.narration!.map((n) => ({ text: n.scriptText, tone: n.tone })),
    { text: pk.outro, tone: "warm" as SonioxTag },
  ];
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function runPipeline(opts: PipelineOptions): Promise<PipelineState> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const slug = slugify(`${opts.format}-${opts.topic}`);
  const dir = path.resolve(opts.outRoot, slug);
  const workDir = path.join(dir, "work");
  const bundleDir = path.join(dir, "bundle");
  fs.mkdirSync(workDir, { recursive: true });

  let state: PipelineState = fs.existsSync(statePath(dir))
    ? (JSON.parse(fs.readFileSync(statePath(dir), "utf8")) as PipelineState)
    : {
        version: PIPELINE_VERSION,
        slug,
        topic: opts.topic,
        format: opts.format,
        pairsTarget: opts.pairs,
        musicId: opts.musicId ?? "lifting-dreams",
        locales: opts.locales ?? ["pt-BR", "es"],
        createdAt: new Date().toISOString(),
        stages: {},
      };
  if (opts.musicId) state.musicId = opts.musicId;
  if (opts.locales) state.locales = opts.locales;

  const video = opts.quality === "720p" ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
  const shouldRun = (stage: StageName) => !state.stages[stage] || (opts.force ?? []).includes(stage);
  const done = (stage: StageName) => {
    state.stages[stage] = new Date().toISOString();
    saveState(dir, state);
    log(`✓ stage ${stage} done`);
  };
  const stopAfter = (stage: StageName) => opts.until === stage;

  // ---------------------------------------------------------------- script
  if (shouldRun("script")) {
    log(`▶ script: ${opts.pairs} ${opts.format} pairs for "${opts.topic}"`);
    const { pairs, rejected } = await buildVerifiedPairs({
      topic: opts.topic,
      format: opts.format,
      count: opts.pairs,
      exclude: opts.exclude,
      onLog: (m) => log(`  ${m}`),
    });
    if (pairs.length < Math.min(6, opts.pairs)) throw new Error(`Only ${pairs.length} verified pairs; topic too narrow`);
    const narration = await writeNarration({ topic: opts.topic, format: opts.format, pairs, onLog: (m) => log(`  ${m}`) });
    const packaging = await writePackaging({ topic: opts.topic, format: opts.format, pairs, seriesName: opts.seriesName, publishSlot: opts.publishSlot });
    state = {
      ...state,
      pairs: pairs.map((p) => ({ left: p.left, right: p.right, relation: p.relation, relationKind: p.relationKind })),
      rejected,
      narration,
      packaging,
    };
    done("script");
  }
  if (stopAfter("script")) return state;

  // ---------------------------------------------------------------- images
  if (shouldRun("images")) {
    const pairs = state.pairs!.map(toVerified);
    log(`▶ images: sourcing and verifying photos for ${pairs.length} pairs`);
    // Group slots by person so each person is verified once with all their candidates.
    const byPerson = new Map<string, { facts: PersonFacts; slots: PersonSlotRequest[] }>();
    pairs.forEach((p, i) => {
      const eras = pairEras(p);
      const add = (facts: PersonFacts, key: string, era: { era: PersonSlotRequest["era"]; year: number | null }) => {
        const entry = byPerson.get(facts.qid) ?? { facts, slots: [] };
        entry.slots.push({ key, era: era.era, year: era.year });
        byPerson.set(facts.qid, entry);
      };
      add(p.left, `${i}:L`, eras.left);
      add(p.right, `${i}:R`, eras.right);
    });
    const people = Array.from(byPerson.values());
    const ranked = new Map<string, RankedCandidate[]>();
    let n = 0;
    await mapLimit(people, 2, async (person) => {
      const res = await sourcePersonSlots({ person: person.facts.name, facts: person.facts, slots: person.slots, workDir: path.join(workDir, "images") });
      for (const [key, list] of Object.entries(res.slots)) ranked.set(key, list);
      n++;
      log(`  photos ${n}/${people.length}: ${person.facts.name} (${res.referenceCount} ref)`);
    });

    // Choose per slot; then-now uses distinct photos for left and right.
    const usedPaths = new Set<string>();
    const images: NonNullable<PipelineState["images"]> = {};
    pairs.forEach((_, i) => {
      const choose = (key: string, slot: number): SlotPick => {
        const list = (ranked.get(key) ?? []).filter((c) => !c.rejected);
        const fresh = list.filter((c) => !usedPaths.has(c.localPath));
        const chosen = fresh[0] ?? list[0] ?? null;
        if (chosen) usedPaths.add(chosen.localPath);
        return {
          chosen: chosen ? pick(chosen, "comparison", slot, video) : null,
          alternatives: list.filter((c) => c !== chosen).slice(0, 5).map((c) => pick(c, "comparison", slot, video)),
        };
      };
      images[String(i)] = { left: choose(`${i}:L`, 0), right: choose(`${i}:R`, 1) };
    });
    state.images = images;
    const missing = Object.values(images).filter((v) => !v.left.chosen || !v.right.chosen).length;
    const low = Object.values(images).flatMap((v) => [v.left.chosen, v.right.chosen]).filter((c) => c && c.confidence === "low").length;
    log(`  ${missing} pair(s) missing a photo, ${low} low-confidence photo(s)`);
    done("images");
  }
  if (stopAfter("images")) return state;

  // Drop pairs without both photos (keeps narration and images aligned).
  const usable = state.pairs!.map((_, i) => i).filter((i) => state.images![String(i)]?.left.chosen && state.images![String(i)]?.right.chosen);

  // ---------------------------------------------------------------- voice
  if (shouldRun("voice")) {
    if (usable.length !== state.pairs!.length) {
      log(`  dropping ${state.pairs!.length - usable.length} pair(s) without photos`);
      const keep = (arr: unknown[]) => usable.map((i) => arr[i]);
      const remapImages: NonNullable<PipelineState["images"]> = {};
      usable.forEach((oldI, newI) => (remapImages[String(newI)] = state.images![String(oldI)]));
      state.pairs = keep(state.pairs!) as PipelineState["pairs"];
      state.narration = keep(state.narration!) as NarrationLineOut[];
      state.images = remapImages;
    }
    log(`▶ voice: narrating ${state.narration!.length + 2} lines with Soniox`);
    const lines = sceneLines(state);
    const narrated = await narrateLines({
      lines,
      language: "en",
      outDir: path.join(workDir, "voice-en"),
      onProgress: (d, t) => d % 10 === 0 && log(`  voice ${d}/${t}`),
    });
    const timeline = buildTimeline(narrated.map((x) => x.durationSec), { fps: FPS, transitionFrames: TRANSITION_FRAMES, leadInSec: LEAD_IN_FRAMES / FPS });
    state.voice = { lines: narrated.map((x) => ({ file: x.file, durationSec: x.durationSec, text: x.text })), timeline };
    log(`  video length ${(timeline.totalSec / 60).toFixed(1)} min`);
    done("voice");
  }
  if (stopAfter("voice")) return state;

  const pairs = state.pairs!.map(toVerified);
  const timeline = state.voice!.timeline;
  const musicTrack = getMusicTrack(state.musicId);
  const musicFile = musicTrack ? path.join(process.cwd(), "public", musicTrack.url) : null;
  const narrationWindows = (base: number = FPS): Array<[number, number]> =>
    timeline.scenes.map((s) => [Math.round(s.audioStartSec * base), Math.round((s.audioStartSec + s.audioDurationSec) * base)]);

  // ---------------------------------------------------------------- render
  if (shouldRun("render")) {
    log(`▶ render: ${timeline.scenes.length} scenes, ${video.width}x${video.height}`);
    const assetDir = path.join(workDir, "render-assets");
    fs.mkdirSync(assetDir, { recursive: true });
    const server = await startStaticServer({
      "/files": dir,
      "/music": path.join(process.cwd(), "public", "music"),
    });
    const fileUrl = (p: string) => runFileUrl(server.baseUrl, dir, p);
    try {
      const pairScene = (i: number, useAlt = false) => {
        const img = state.images![String(i)];
        const l = useAlt ? img.left.alternatives[0] ?? img.left.chosen! : img.left.chosen!;
        const r = useAlt ? img.right.alternatives[0] ?? img.right.chosen! : img.right.chosen!;
        const labels = pairLabels(pairs[i]);
        return {
          template: "comparison",
          assets: [
            { url: fileUrl(l.path), objectPosition: l.objectPosition },
            { url: fileUrl(r.path), objectPosition: r.objectPosition },
          ],
          leftLabel: labels.leftLabel,
          rightLabel: labels.rightLabel,
        };
      };
      const lines = sceneLines(state);
      const pk = state.packaging!;
      const scenes = [
        { ...pairScene(0, true), captionText: pk.thumbnailText, scriptText: stripDeliveryMarkup(lines[0].text) },
        ...pairs.map((p, i) => ({ ...pairScene(i), captionText: pairCaption(p), scriptText: stripDeliveryMarkup(lines[i + 1].text) })),
        {
          ...pairScene(Math.min(1, pairs.length - 1), true),
          captionText: "Subscribe for a new story every weekday",
          scriptText: stripDeliveryMarkup(lines[lines.length - 1].text),
        },
      ].map((s, i) => ({ ...s, narrationUrl: fileUrl(state.voice!.lines[i].file) }));

      const inputProps = {
        scenes,
        sceneDurationFrames: timeline.scenes[0].durationFrames,
        sceneDurationsFrames: timeline.scenes.map((s) => s.durationFrames),
        narrationLeadInFrames: LEAD_IN_FRAMES,
        narrationWindows: narrationWindows(),
        transitionFrames: TRANSITION_FRAMES,
        musicUrl: musicTrack ? `${server.baseUrl}${musicTrack.url}` : null,
        musicVolume: MUSIC_VOLUME,
        musicDuckedVolume: MUSIC_DUCKED,
        voiceoverUrl: null,
        sceneTransitions: Array(Math.max(0, scenes.length - 1)).fill("fade"),
        imageMotions: scenes.map((_, i) => (i % 2 === 0 ? "zoom-in" : "zoom-out")),
        textAnimations: Array(scenes.length).fill("fade-in"),
        captionStyle: "bold",
        comparisonOverlayMode: "both",
        textScale: (Math.min(video.width, video.height) / 1080) * 1.45,
        watermark: { logoUrl: null, position: "none", opacity: 0.7 },
      };
      fs.writeFileSync(path.join(workDir, "render-props.json"), JSON.stringify(inputProps, null, 1));

      const { bundle } = await import("@remotion/bundler");
      const { renderMedia, selectComposition } = await import("@remotion/renderer");
      const serveUrl = await bundle({
        entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
        webpackOverride: (config) => ({
          ...config,
          resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), "@": path.join(process.cwd(), "src") } },
        }),
      });
      const composition = await selectComposition({ serveUrl, id: "VideoWorker", inputProps });
      composition.width = video.width;
      composition.height = video.height;
      composition.durationInFrames = timeline.totalFrames;
      const raw = path.join(workDir, "render-raw.mp4");
      let lastPct = -1;
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        crf: 20,
        audioBitrate: "192k",
        outputLocation: raw,
        inputProps,
        concurrency: Math.max(2, Math.floor(os.cpus().length / 2)),
        onProgress: ({ progress }) => {
          const pct = Math.floor(progress * 20) * 5;
          if (pct !== lastPct) {
            lastPct = pct;
            log(`  render ${pct}%`);
          }
        },
      });
      fs.mkdirSync(bundleDir, { recursive: true });
      const final = path.join(bundleDir, "video.mp4");
      if (fs.existsSync(final)) fs.unlinkSync(final);
      await normalizeMp4Metadata({ input: raw, output: final, title: pk.titles[0] });
      state.outputs = { ...(state.outputs ?? {}), video: final, bundleDir };
      done("render");
    } finally {
      await server.close();
    }
  }
  if (stopAfter("render")) return state;

  // ---------------------------------------------------------------- thumbnails
  if (shouldRun("thumbnails")) {
    log("▶ thumbnails: 3 variants");
    const server = await startStaticServer({ "/files": dir });
    try {
      const fileUrl = (p: string) => runFileUrl(server.baseUrl, dir, p);
      // Best-confidence pair among the first five (the most famous ones lead the list).
      const ranking = pairs
        .slice(0, 5)
        .map((p, i) => {
          const img = state.images![String(i)];
          return { i, s: (img.left.chosen?.score ?? 0) + (img.right.chosen?.score ?? 0) };
        })
        .sort((a, b) => b.s - a.s);
      const i = ranking[0]?.i ?? 0;
      const img = state.images![String(i)];
      const thumbSize = { width: 1280, height: 720 };
      // Thumbnail halves (≈636×600) are close to the video halves, so the video crop is reused.
      const reposition = (p: PickedImage) => (p.width && p.height ? p.objectPosition : "50% 35%");
      const labels = pairLabels(pairs[i]);
      const base = {
        leftUrl: fileUrl(img.left.chosen!.path),
        rightUrl: fileUrl(img.right.chosen!.path),
        leftObjectPosition: reposition(img.left.chosen!),
        rightObjectPosition: reposition(img.right.chosen!),
        leftLabel: labels.leftLabel,
        rightLabel: labels.rightLabel,
        leftName: pairs[i].left.name.split(" ").slice(-1)[0].toUpperCase(),
        rightName: pairs[i].right.name.split(" ").slice(-1)[0].toUpperCase(),
        headline: state.packaging!.thumbnailText,
      };
      const { bundle } = await import("@remotion/bundler");
      const { renderStill, selectComposition } = await import("@remotion/renderer");
      const serveUrl = await bundle({
        entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
        webpackOverride: (config) => ({
          ...config,
          resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), "@": path.join(process.cwd(), "src") } },
        }),
      });
      fs.mkdirSync(bundleDir, { recursive: true });
      const files: string[] = [];
      for (const variant of ["labels", "banner", "names"] as const) {
        const inputProps = { ...base, variant };
        const composition = await selectComposition({ serveUrl, id: "Thumbnail", inputProps });
        composition.width = thumbSize.width;
        composition.height = thumbSize.height;
        const out = path.join(bundleDir, `thumbnail-${variant}.png`);
        await renderStill({ composition, serveUrl, output: out, inputProps, imageFormat: "png" });
        files.push(out);
      }
      state.outputs = { ...(state.outputs ?? {}), thumbnails: files };
      done("thumbnails");
    } finally {
      await server.close();
    }
  }
  if (stopAfter("thumbnails")) return state;

  // ---------------------------------------------------------------- localize
  if (shouldRun("localize") && state.locales.length > 0) {
    log(`▶ localize: ${state.locales.join(", ")}`);
    const lines = sceneLines(state);
    const bedFile = path.join(workDir, "music-bed.wav");
    if (musicFile && fs.existsSync(musicFile) && !fs.existsSync(bedFile)) {
      await buildMusicBed({
        musicFile,
        totalSec: timeline.totalSec,
        windows: timeline.scenes.map((s) => [s.audioStartSec, s.audioStartSec + s.audioDurationSec] as [number, number]),
        volume: MUSIC_VOLUME,
        duckedVolume: MUSIC_DUCKED,
        outFile: bedFile,
        workDir,
      });
    }
    fs.mkdirSync(bundleDir, { recursive: true });
    const dubs: NonNullable<PipelineState["dubs"]> = state.dubs ?? {};
    for (const locale of state.locales) {
      const dub = await dubLines({ locale, sourceLines: lines, timeline, outDir: path.join(workDir, "dubs"), onLog: (m) => log(`  ${m}`) });
      const audioFile = path.join(bundleDir, `audio.${locale}.mp3`);
      const dur = await mixDubbedTrack({ voiceFile: dub.voiceFile, musicBedFile: fs.existsSync(bedFile) ? bedFile : null, outFile: audioFile });
      const cues = cuesForTimeline(dub.lines.map((l) => stripDeliveryMarkup(l.translated)), timeline);
      const srtFile = path.join(bundleDir, `captions.${locale}.srt`);
      fs.writeFileSync(srtFile, toSrt(cues));
      const meta = await translateLines({
        locale,
        lines: [
          { index: 0, text: state.packaging!.titles[0], maxChars: 100 },
          { index: 1, text: state.packaging!.description },
        ],
      });
      dubs[locale] = { audioFile, srtFile, title: meta.get(0) ?? "", description: meta.get(1) ?? "" };
      const tempoed = dub.lines.filter((l) => l.tempo > 1.001).length;
      log(`  ${locale}: ${dur.toFixed(1)}s track, ${tempoed} line(s) sped up ≤8%`);
    }
    state.dubs = dubs;
    done("localize");
  }
  if (stopAfter("localize")) return state;

  // ---------------------------------------------------------------- bundle
  if (shouldRun("bundle")) {
    log("▶ bundle: captions, chapters, metadata, review page");
    fs.mkdirSync(bundleDir, { recursive: true });
    const lines = sceneLines(state);
    const cues = cuesForTimeline(lines.map((l) => stripDeliveryMarkup(l.text)), timeline);
    fs.writeFileSync(path.join(bundleDir, "captions.en.srt"), toSrt(cues));
    const chapterTitles = ["Intro", ...pairs.map((p) => pairCaption(p)), "Thank you"];
    const chapters = buildChapters(chapterTitles, timeline, { introTitle: "Intro" });
    const credits = Array.from(
      new Set(
        Object.values(state.images!)
          .flatMap((v) => [v.left.chosen, v.right.chosen])
          .map((c) => c?.attribution)
          .filter((a): a is string => Boolean(a))
      )
    );
    const pk = state.packaging!;
    const description = [
      pk.description.trim(),
      chapters.length ? `\nChapters:\n${chaptersToText(chapters)}` : "",
      "\nFacts in this video come from Wikidata (CC0) and are checked before publishing.",
      credits.length ? `\nPhoto credits:\n${credits.map((c) => `- ${c}`).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const metadata = [
      `TITLE OPTIONS:\n${pk.titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
      `\nDESCRIPTION:\n${description}`,
      `\nTAGS:\n${pk.tags.join(", ")}`,
      ...Object.entries(state.dubs ?? {}).map(
        ([loc, d]) => `\nLOCALIZED (${LOCALE_NAMES[loc] ?? loc}) TITLE:\n${d.title}\nDESCRIPTION:\n${d.description}`
      ),
      `\nSTUDIO CHECKLIST:
1. Upload video.mp4, set title (option 1 is recommended), paste description and tags.
2. Thumbnail: pick one of thumbnail-*.png.
3. Subtitles: add captions.en.srt${Object.keys(state.dubs ?? {}).map((l) => `, captions.${l}.srt`).join("")}.
4. Audio tracks (Subtitles → Audio): add ${Object.keys(state.dubs ?? {}).map((l) => `audio.${l}.mp3 (${LOCALE_NAMES[l] ?? l})`).join(", ") || "(none)"}.
5. Translations: add the localized titles and descriptions above.
6. Schedule for the next free weekday slot at 5:00 PM Eastern; add the end screen and pin a comment question.`,
    ].join("\n");
    fs.writeFileSync(path.join(bundleDir, "metadata.txt"), metadata);
    fs.writeFileSync(path.join(bundleDir, "chapters.txt"), chaptersToText(chapters));
    fs.writeFileSync(path.join(dir, "review.html"), renderReviewHtml(state, dir));
    state.outputs = { ...(state.outputs ?? {}), bundleDir };
    done("bundle");
  }
  return state;
}
