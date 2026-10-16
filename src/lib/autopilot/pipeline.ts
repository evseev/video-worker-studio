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
import { narrateTranslations, assembleDub, buildMusicBed, mixDubbedTrack, translateLines, LOCALE_NAMES } from "@/lib/tts/localize";
import { normalizeMp4Metadata } from "@/lib/video/postprocess";
import { checkNarration, type VoiceCheck } from "@/lib/qa/soniox-stt";
import { getMusicTrack } from "@/lib/music-presets";
import { buildVerifiedPairs, writeNarration, writePackaging, writeShortHooks, type NarrationLineOut, type Packaging } from "./script";
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
  /** Face box in image pixels, kept so crops can be recomputed for other slot shapes (Shorts, thumbnails). */
  faceBox?: [number, number, number, number] | null;
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
  voice?: {
    lines: Array<{ file: string; durationSec: number; text: string }>;
    /** Speech-to-text check of the English lines (scene order: hook, pairs…, outro). */
    qa?: VoiceCheck[];
    /** Translated + voiced lines per locale (same order as `lines`). */
    dubs?: Record<string, Array<{ file: string; durationSec: number; text: string; translated: string }>>;
    timeline: Timeline;
  };
  dubs?: Record<string, { audioFile: string; srtFile: string; title: string; description: string }>;
  outputs?: { video?: string; thumbnails?: string[]; bundleDir?: string; shorts?: Array<{ file: string; title: string }> };
}

export type StageName = "script" | "images" | "voice" | "render" | "thumbnails" | "localize" | "bundle" | "shorts";
export const STAGES: StageName[] = ["script", "images", "voice", "render", "thumbnails", "localize", "bundle", "shorts"];

export interface PipelineOptions {
  topic: string;
  format: FormatSlug;
  pairs: number;
  outRoot: string;
  /** Explicit run directory (DB-backed runs use <root>/projects/<projectId>). Overrides outRoot/slug. */
  runDir?: string;
  musicId?: string;
  locales?: string[];
  quality?: "720p" | "1080p";
  /** Stop after this stage (inclusive). */
  until?: StageName;
  /** Number of vertical Shorts to cut (0 disables). Default 3. */
  shorts?: number;
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

/** Webpack-bundle the Remotion project once per process (bundling takes ~10–20 s). */
let serveUrlPromise: Promise<string> | null = null;
export function remotionServeUrl(): Promise<string> {
  if (!serveUrlPromise) {
    serveUrlPromise = import("@remotion/bundler").then(({ bundle }) =>
      bundle({
        entryPoint: path.join(/* turbopackIgnore: true */ process.cwd(), "src/remotion/index.ts"),
        webpackOverride: (config) => ({
          ...config,
          resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), "@": path.join(/* turbopackIgnore: true */ process.cwd(), "src") } },
        }),
      })
    );
    serveUrlPromise.catch(() => (serveUrlPromise = null));
  }
  return serveUrlPromise;
}

/** URL for a file inside the run directory, served by the local static server. */
function runFileUrl(baseUrl: string, runDir: string, file: string): string {
  const rel = path.relative(runDir, file);
  if (rel.startsWith("..")) throw new Error(`Asset outside run directory: ${file}`);
  return `${baseUrl}/files/${rel.split(path.sep).map(encodeURIComponent).join("/")}`;
}

export function statePath(dir: string) {
  return path.join(/* turbopackIgnore: true */ dir, "state.json");
}

export function saveState(dir: string, state: PipelineState) {
  const tmp = `${statePath(dir)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, statePath(dir));
}

export function loadState(dir: string): PipelineState | null {
  const p = statePath(dir);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as PipelineState) : null;
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
    faceBox: a.faceBox ?? null,
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
  const slug = opts.runDir ? path.basename(opts.runDir) : slugify(`${opts.format}-${opts.topic}`);
  const dir = opts.runDir ? path.resolve(/* turbopackIgnore: true */ opts.runDir) : path.resolve(/* turbopackIgnore: true */ opts.outRoot, slug);
  const workDir = path.join(/* turbopackIgnore: true */ dir, "work");
  const bundleDir = path.join(/* turbopackIgnore: true */ dir, "bundle");
  fs.mkdirSync(workDir, { recursive: true });

  let state: PipelineState = loadState(dir) ?? {
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
    // Over-generate ~20%: pairs whose photos cannot be verified are dropped after the images stage.
    const { pairs, rejected } = await buildVerifiedPairs({
      topic: opts.topic,
      format: opts.format,
      count: Math.ceil(opts.pairs * 1.2) + 1,
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
      const res = await sourcePersonSlots({ person: person.facts.name, facts: person.facts, slots: person.slots, workDir: path.join(/* turbopackIgnore: true */ workDir, "images") });
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
    // Keep the target number of pairs, preferring pairs whose photos are all verified (medium/high),
    // preserving the original (fame) order. Low-confidence pairs only fill gaps and get flagged in review.
    const quality = (i: number) => {
      const v = images[String(i)];
      if (!v.left.chosen || !v.right.chosen) return 0;
      return v.left.chosen.confidence === "low" || v.right.chosen.confidence === "low" ? 1 : 2;
    };
    const all = pairs.map((_, i) => i);
    const good = all.filter((i) => quality(i) === 2);
    const weak = all.filter((i) => quality(i) === 1);
    const keep = [...good, ...weak].slice(0, state.pairsTarget).sort((a, b) => a - b);
    const dropped = all.filter((i) => !keep.includes(i));
    if (dropped.length) {
      log(`  dropping ${dropped.length} pair(s): ${dropped.map((i) => `${pairs[i].left.name}/${pairs[i].right.name} (${quality(i) === 0 ? "no photo" : quality(i) === 1 ? "unverified photo" : "surplus"})`).join(", ")}`);
      state.rejected = [
        ...(state.rejected ?? []),
        ...dropped.filter((i) => quality(i) < 2).map((i) => ({ left: pairs[i].left.name, right: pairs[i].right.name, reason: quality(i) === 0 ? "no usable photo" : "photo identity not confirmed" })),
      ];
    }
    const remapped: NonNullable<PipelineState["images"]> = {};
    keep.forEach((oldI, newI) => (remapped[String(newI)] = images[String(oldI)]));
    state.pairs = keep.map((i) => state.pairs![i]);
    state.narration = keep.map((i) => state.narration![i]);
    state.images = remapped;
    const low = keep.filter((i) => quality(i) === 1).length;
    log(`  kept ${keep.length} pair(s); ${low} still need a photo check in review`);
    if (keep.length !== pairs.length) {
      // Titles and hook mention the pair count and the leading names; rewrite them for the final list.
      state.packaging = await writePackaging({
        topic: state.topic,
        format: state.format,
        pairs: state.pairs!.map(toVerified),
        seriesName: opts.seriesName,
        publishSlot: opts.publishSlot,
      });
    }
    done("images");
  }
  if (stopAfter("images")) return state;

  // ---------------------------------------------------------------- voice
  if (shouldRun("voice")) {
    log(`▶ voice: narrating ${state.narration!.length + 2} lines with Soniox`);
    const lines = sceneLines(state);
    const narrated = await narrateLines({
      lines,
      language: "en",
      outDir: path.join(/* turbopackIgnore: true */ workDir, "voice-en"),
      onProgress: (d, t) => d % 10 === 0 && log(`  voice ${d}/${t}`),
    });
    // Narration QA: transcribe what the TTS said; re-voice failing lines once with a different delivery tag.
    let qa: VoiceCheck[] | undefined;
    try {
      qa = await checkNarration({ files: narrated.map((x) => x.file), scripts: narrated.map((x) => x.text), workDir });
      const bad = qa.filter((q) => !q.ok);
      if (bad.length) {
        log(`  voice check: ${bad.length} line(s) did not match the script; re-voicing once`);
        const redo = await narrateLines({
          lines: bad.map((b) => ({ text: lines[b.index].text, tone: lines[b.index].tone === "calm" ? "warm" : "calm" })),
          language: "en",
          outDir: path.join(workDir, "voice-en"),
        });
        bad.forEach((b, k) => (narrated[b.index] = { ...redo[k], index: b.index }));
        qa = await checkNarration({ files: narrated.map((x) => x.file), scripts: narrated.map((x) => x.text), workDir });
      }
      log(`  voice check: ${qa.filter((q) => q.ok).length}/${qa.length} lines match the script`);
    } catch (err) {
      log(`  voice check skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Voice every dub language now, so each scene is long enough for the longest language.
    const dubs: NonNullable<NonNullable<PipelineState["voice"]>["dubs"]> = {};
    for (const locale of state.locales) {
      const t = await narrateTranslations({
        locale,
        sourceLines: lines,
        englishDurations: narrated.map((x) => x.durationSec),
        outDir: path.join(/* turbopackIgnore: true */ workDir, "dubs"),
        onLog: (m) => log(`  ${m}`),
      });
      dubs[locale] = t.map((x) => ({ file: x.file, durationSec: x.durationSec, text: x.text, translated: x.translated }));
      log(`  ${locale}: ${t.length} lines voiced`);
    }
    const longest = narrated.map((x, i) => Math.max(x.durationSec, ...Object.values(dubs).map((d) => d[i]?.durationSec ?? 0)));
    const timeline = buildTimeline(longest, { fps: FPS, transitionFrames: TRANSITION_FRAMES, leadInSec: LEAD_IN_FRAMES / FPS });
    // English audio windows use the English durations (music ducks only while Emma speaks).
    timeline.scenes.forEach((s, i) => (s.audioDurationSec = narrated[i].durationSec));
    state.voice = { lines: narrated.map((x) => ({ file: x.file, durationSec: x.durationSec, text: x.text })), qa, dubs, timeline };
    log(`  video length ${(timeline.totalSec / 60).toFixed(1)} min`);
    done("voice");
  }
  if (stopAfter("voice")) return state;

  const pairs = state.pairs!.map(toVerified);
  const timeline = state.voice!.timeline;
  const musicTrack = getMusicTrack(state.musicId);
  const musicFile = musicTrack ? path.join(/* turbopackIgnore: true */ process.cwd(), "public", musicTrack.url) : null;
  const narrationWindows = (base: number = FPS): Array<[number, number]> =>
    timeline.scenes.map((s) => [Math.round(s.audioStartSec * base), Math.round((s.audioStartSec + s.audioDurationSec) * base)]);

  // ---------------------------------------------------------------- render
  if (shouldRun("render")) {
    log(`▶ render: ${timeline.scenes.length} scenes, ${video.width}x${video.height}`);
    const assetDir = path.join(/* turbopackIgnore: true */ workDir, "render-assets");
    fs.mkdirSync(assetDir, { recursive: true });
    const server = await startStaticServer({
      "/files": dir,
      "/music": path.join(/* turbopackIgnore: true */ process.cwd(), "public", "music"),
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
        textScale: (Math.min(video.width, video.height) / 1080) * 1.8,
        watermark: { logoUrl: null, position: "none", opacity: 0.7 },
      };
      fs.writeFileSync(path.join(/* turbopackIgnore: true */ workDir, "render-props.json"), JSON.stringify(inputProps, null, 1));

      const { renderMedia, selectComposition } = await import("@remotion/renderer");
      const serveUrl = await remotionServeUrl();
      const composition = await selectComposition({ serveUrl, id: "VideoWorker", inputProps });
      composition.width = video.width;
      composition.height = video.height;
      composition.durationInFrames = timeline.totalFrames;
      const raw = path.join(/* turbopackIgnore: true */ workDir, "render-raw.mp4");
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
      const final = path.join(/* turbopackIgnore: true */ bundleDir, "video.mp4");
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
      const { renderStill, selectComposition } = await import("@remotion/renderer");
      const serveUrl = await remotionServeUrl();
      fs.mkdirSync(bundleDir, { recursive: true });
      const files: string[] = [];
      for (const variant of ["labels", "banner", "names"] as const) {
        const inputProps = { ...base, variant };
        const composition = await selectComposition({ serveUrl, id: "Thumbnail", inputProps });
        composition.width = thumbSize.width;
        composition.height = thumbSize.height;
        const out = path.join(/* turbopackIgnore: true */ bundleDir, `thumbnail-${variant}.png`);
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
    const bedFile = path.join(/* turbopackIgnore: true */ workDir, "music-bed.wav");
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
      const voiced = state.voice!.dubs?.[locale];
      if (!voiced) {
        log(`  ${locale}: not voiced (locale added after the voice stage; re-run with --force voice)`);
        continue;
      }
      // Dub windows use the dub durations.
      const dubTimeline = { ...timeline, scenes: timeline.scenes.map((s, i) => ({ ...s, audioDurationSec: voiced[i].durationSec })) };
      const { voiceFile, tempoed } = await assembleDub({
        locale,
        lines: voiced.map((v, index) => ({ file: v.file, durationSec: v.durationSec, index })),
        timeline: dubTimeline,
        outDir: path.join(/* turbopackIgnore: true */ workDir, "dubs"),
      });
      const audioFile = path.join(/* turbopackIgnore: true */ bundleDir, `audio.${locale}.mp3`);
      const dur = await mixDubbedTrack({ voiceFile, musicBedFile: fs.existsSync(bedFile) ? bedFile : null, outFile: audioFile });
      const cues = cuesForTimeline(voiced.map((v) => stripDeliveryMarkup(v.translated)), dubTimeline);
      const srtFile = path.join(/* turbopackIgnore: true */ bundleDir, `captions.${locale}.srt`);
      fs.writeFileSync(srtFile, toSrt(cues));
      const meta = await translateLines({
        locale,
        lines: [
          { index: 0, text: state.packaging!.titles[0], maxChars: 100 },
          { index: 1, text: state.packaging!.description },
        ],
      });
      dubs[locale] = { audioFile, srtFile, title: meta.get(0) ?? "", description: meta.get(1) ?? "" };
      log(`  ${locale}: ${dur.toFixed(1)}s track${tempoed ? `, ${tempoed} line(s) sped up ≤8%` : ""}`);
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
    fs.writeFileSync(path.join(/* turbopackIgnore: true */ bundleDir, "captions.en.srt"), toSrt(cues));
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
    fs.writeFileSync(path.join(/* turbopackIgnore: true */ bundleDir, "metadata.txt"), metadata);
    fs.writeFileSync(path.join(/* turbopackIgnore: true */ bundleDir, "chapters.txt"), chaptersToText(chapters));
    fs.writeFileSync(path.join(/* turbopackIgnore: true */ dir, "review.html"), renderReviewHtml(state, dir));
    state.outputs = { ...(state.outputs ?? {}), bundleDir };
    done("bundle");
  }
  // ---------------------------------------------------------------- shorts
  const shortCount = opts.shorts ?? 3;
  if (shouldRun("shorts") && shortCount > 0 && pairs.length >= 4) {
    log(`▶ shorts: ${shortCount} vertical clips`);
    const perShort = 4;
    // Use the best-verified pairs, spread across the video, never the same pair twice.
    const order = pairs
      .map((_, i) => i)
      .sort((a, b) => {
        const sc = (i: number) => (state.images![String(i)].left.chosen?.score ?? 0) + (state.images![String(i)].right.chosen?.score ?? 0);
        return sc(b) - sc(a);
      });
    const groups: number[][] = [];
    for (let k = 0; k < shortCount && (k + 1) * perShort <= order.length; k++) {
      groups.push(order.slice(k * perShort, (k + 1) * perShort).sort((a, b) => a - b));
    }
    const hooks = await writeShortHooks({ topic: state.topic, groups: groups.map((g) => g.map((i) => pairCaption(pairs[i]))) });
    const shortsDir = path.join(/* turbopackIgnore: true */ bundleDir, "shorts");
    fs.mkdirSync(shortsDir, { recursive: true });
    const portrait = { width: 1080, height: 1920 };
    const server = await startStaticServer({ "/files": dir, "/music": path.join(/* turbopackIgnore: true */ process.cwd(), "public", "music") });
    const outputs: Array<{ file: string; title: string }> = [];
    try {
      const fileUrl = (p: string) => runFileUrl(server.baseUrl, dir, p);
      const { renderMedia, selectComposition } = await import("@remotion/renderer");
      const serveUrl = await remotionServeUrl();
      for (let k = 0; k < groups.length; k++) {
        const hook = await narrateLines({ lines: [{ text: hooks[k]?.hook ?? state.packaging!.hook, tone: "warm" }], language: "en", outDir: path.join(/* turbopackIgnore: true */ workDir, "voice-en") });
        const voiced = [hook[0], ...groups[k].map((i) => state.voice!.lines[i + 1])];
        const tl = buildTimeline(voiced.map((v) => v.durationSec), { fps: FPS, transitionFrames: TRANSITION_FRAMES, leadInSec: LEAD_IN_FRAMES / FPS, minSceneSec: 3 });
        if (tl.totalSec > 59) log(`  short ${k + 1} is ${tl.totalSec.toFixed(1)}s (>59s); YouTube may not classify it as a Short`);
        const slotPos = (p: PickedImage, slot: number) => {
          const size = slotSize("comparison", slot, portrait);
          return p.faceBox && p.width && p.height
            ? faceObjectPosition({ imageWidth: p.width, imageHeight: p.height, faceBox: p.faceBox, targetWidth: size.width, targetHeight: size.height })
            : "50% 35%";
        };
        const sceneFor = (i: number, alt: boolean) => {
          const img = state.images![String(i)];
          const l = alt ? img.left.alternatives[0] ?? img.left.chosen! : img.left.chosen!;
          const r = alt ? img.right.alternatives[0] ?? img.right.chosen! : img.right.chosen!;
          const labels = pairLabels(pairs[i]);
          return {
            template: "comparison",
            assets: [
              { url: fileUrl(l.path), objectPosition: slotPos(l, 0) },
              { url: fileUrl(r.path), objectPosition: slotPos(r, 1) },
            ],
            leftLabel: labels.leftLabel,
            rightLabel: labels.rightLabel,
          };
        };
        const scenes = [
          { ...sceneFor(groups[k][0], true), captionText: state.packaging!.thumbnailText, scriptText: stripDeliveryMarkup(voiced[0].text), narrationUrl: fileUrl(voiced[0].file) },
          ...groups[k].map((i, j) => ({ ...sceneFor(i, false), captionText: pairCaption(pairs[i]), scriptText: stripDeliveryMarkup(voiced[j + 1].text), narrationUrl: fileUrl(voiced[j + 1].file) })),
        ];
        const inputProps = {
          scenes,
          sceneDurationFrames: tl.scenes[0].durationFrames,
          sceneDurationsFrames: tl.scenes.map((x) => x.durationFrames),
          narrationLeadInFrames: LEAD_IN_FRAMES,
          narrationWindows: tl.scenes.map((x) => [Math.round(x.audioStartSec * FPS), Math.round((x.audioStartSec + x.audioDurationSec) * FPS)] as [number, number]),
          transitionFrames: TRANSITION_FRAMES,
          musicUrl: musicTrack ? `${server.baseUrl}${musicTrack.url}` : null,
          musicVolume: MUSIC_VOLUME,
          musicDuckedVolume: MUSIC_DUCKED,
          voiceoverUrl: null,
          sceneTransitions: Array(scenes.length - 1).fill("fade"),
          imageMotions: scenes.map((_, i) => (i % 2 === 0 ? "zoom-in" : "zoom-out")),
          textAnimations: Array(scenes.length).fill("fade-in"),
          captionStyle: "bold",
          comparisonOverlayMode: "both",
          textScale: 1.5,
          stackComparisonInPortrait: true,
          watermark: { logoUrl: null, position: "none", opacity: 0.7 },
        };
        const composition = await selectComposition({ serveUrl, id: "VideoWorker", inputProps });
        composition.width = portrait.width;
        composition.height = portrait.height;
        composition.durationInFrames = tl.totalFrames;
        const raw = path.join(/* turbopackIgnore: true */ workDir, `short-${k + 1}-raw.mp4`);
        await renderMedia({ composition, serveUrl, codec: "h264", crf: 20, audioBitrate: "192k", outputLocation: raw, inputProps, concurrency: Math.max(2, Math.floor(os.cpus().length / 2)) });
        const out = path.join(/* turbopackIgnore: true */ shortsDir, `short-${k + 1}.mp4`);
        if (fs.existsSync(out)) fs.unlinkSync(out);
        const title = hooks[k]?.title ?? `${pairCaption(pairs[groups[k][0]])} #Shorts`;
        await normalizeMp4Metadata({ input: raw, output: out, title });
        outputs.push({ file: out, title });
        log(`  short ${k + 1}: ${tl.totalSec.toFixed(1)}s`);
      }
    } finally {
      await server.close();
    }
    fs.writeFileSync(
      path.join(/* turbopackIgnore: true */ shortsDir, "shorts.txt"),
      outputs
        .map((o) => `${path.basename(o.file)}
TITLE: ${o.title}
DESCRIPTION: Full video: "${state.packaging!.titles[0]}" on the channel. Link it as the Short's related video in Studio.
`)
        .join(`\n`)
    );
    state.outputs = { ...(state.outputs ?? {}), shorts: outputs };
    done("shorts");
  }
  return state;
}
