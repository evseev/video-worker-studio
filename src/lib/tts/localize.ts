import * as fs from "fs";
import * as path from "path";
import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { createGeminiClient, getTextModel, generateTextOrThrow } from "@/lib/ai/gemini";
import { runFfmpeg, probeDuration } from "@/lib/media/ffmpeg";
import { narrateLines, type NarratedLine } from "./narration";
import { stripDeliveryMarkup, DEFAULT_VOICES, SONIOX_TAGS, type SonioxTag } from "./soniox";
import type { Timeline } from "./timeline";

export const LOCALE_NAMES: Record<string, string> = {
  "pt-BR": "Brazilian Portuguese",
  es: "Latin American Spanish",
  de: "German",
  ru: "Russian",
};

const TranslationSchema = z.object({
  lines: z.array(z.object({ index: z.number().int(), text: z.string().min(1) })),
});
const translationResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    lines: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { index: { type: SchemaType.INTEGER }, text: { type: SchemaType.STRING } },
        required: ["index", "text"],
      },
    },
  },
  required: ["lines"],
};

/**
 * Translate narration lines for dubbing. Names, years and film titles stay as in the source;
 * delivery tags ([warm], [softly]…) stay in English (Soniox requires English tags).
 * `maxChars` asks for a tighter version when the first dub is too long for its slot.
 */
export async function translateLines(params: {
  lines: Array<{ index: number; text: string; maxChars?: number }>;
  locale: string;
}): Promise<Map<number, string>> {
  const language = LOCALE_NAMES[params.locale] ?? params.locale;
  const genAI = createGeminiClient(process.env.GEMINI_API_KEY);
  const model = getTextModel({
    genAI,
    systemInstruction: `You translate warm, spoken documentary narration into natural ${language} for dubbing.
Rules: keep every person's name exactly as written; keep years and numbers as digits; keep any bracketed English tags such as ${SONIOX_TAGS.map((t) => `[${t}]`).join(" ")} unchanged and in place; keep *asterisk emphasis* on the matching word; sound native and conversational, not literal. When maxChars is given, the translation MUST be at most that many characters (shorten wording, never drop facts or names).`,
    generationConfig: { responseMimeType: "application/json", responseSchema: translationResponseSchema, temperature: 0.3 },
  });
  const out = new Map<number, string>();
  for (let i = 0; i < params.lines.length; i += 25) {
    const chunk = params.lines.slice(i, i + 25);
    const user = chunk
      .map((l) => `#${l.index}${l.maxChars ? ` (maxChars ${l.maxChars})` : ""}: ${l.text}`)
      .join("\n");
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const parsed = TranslationSchema.parse(JSON.parse(await generateTextOrThrow(model, user)));
        for (const l of parsed.lines) out.set(l.index, l.text);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) throw lastErr;
  }
  return out;
}

export interface DubbedTrack {
  locale: string;
  lines: Array<NarratedLine & { translated: string; tempo: number; slotSec: number }>;
  /** Voice-only track, full video length (wav). */
  voiceFile: string;
}

/** Seconds available for line i before the next line starts (keeps a small gap). */
export function slotSeconds(timeline: Timeline, i: number, gapSec = 0.3): number {
  const s = timeline.scenes[i];
  const next = timeline.scenes[i + 1];
  const end = next ? next.audioStartSec - gapSec : timeline.totalSec - 0.5;
  return Math.max(0.5, end - s.audioStartSec);
}

/**
 * Dub every line into `locale`, fitting each dubbed line into the English line's slot:
 *  1) translate; 2) synthesize; 3) if too long, ask for a tighter translation once;
 *  4) if still long, speed up with atempo (≤ 1.08); anything left over is trimmed with a fade.
 */
export async function dubLines(params: {
  locale: string;
  sourceLines: Array<{ text: string; tone?: SonioxTag | null }>;
  timeline: Timeline;
  outDir: string;
  voice?: string;
  onLog?: (m: string) => void;
}): Promise<DubbedTrack> {
  const log = params.onLog ?? (() => {});
  const { locale, timeline } = params;
  const voice = params.voice ?? DEFAULT_VOICES[locale] ?? DEFAULT_VOICES.en;
  const dir = path.join(params.outDir, locale);
  await fs.promises.mkdir(dir, { recursive: true });

  const withTags = params.sourceLines.map((l, index) => ({
    index,
    text: l.tone && !/^\[[a-z -]+\]/i.test(l.text) ? `[${l.tone}] ${l.text}` : l.text,
  }));
  const translated = await translateLines({ lines: withTags, locale });
  const texts = withTags.map((l) => translated.get(l.index) ?? l.text);

  let narrated = await narrateLines({ lines: texts.map((text) => ({ text })), language: locale, voice, outDir: dir });

  // Tighten lines that overflow their slot by more than 8 %.
  const overflow = narrated.filter((n) => n.durationSec > slotSeconds(timeline, n.index) * 1.08);
  if (overflow.length) {
    log(`[${locale}] ${overflow.length} line(s) too long, requesting tighter translations`);
    const tighter = await translateLines({
      locale,
      lines: overflow.map((n) => ({
        index: n.index,
        text: withTags[n.index].text,
        maxChars: Math.max(20, Math.floor(stripDeliveryMarkup(texts[n.index]).length * (slotSeconds(timeline, n.index) / n.durationSec) * 0.95)),
      })),
    });
    for (const [i, t] of tighter) texts[i] = t;
    const redo = await narrateLines({
      lines: overflow.map((n) => ({ text: texts[n.index] })),
      language: locale,
      voice,
      outDir: dir,
    });
    narrated = narrated.map((n) => {
      const k = overflow.findIndex((o) => o.index === n.index);
      return k >= 0 ? { ...redo[k], index: n.index } : n;
    });
  }

  const lines: DubbedTrack["lines"] = narrated.map((n) => {
    const slot = slotSeconds(timeline, n.index);
    const tempo = n.durationSec > slot ? Math.min(1.08, n.durationSec / slot) : 1;
    return { ...n, translated: texts[n.index], tempo, slotSec: slot };
  });

  const voiceFile = path.join(dir, `voice-${locale}.wav`);
  await assembleVoiceTrack({
    clips: lines.map((l) => ({ file: l.file, startSec: timeline.scenes[l.index].audioStartSec, tempo: l.tempo, maxSec: l.slotSec })),
    totalSec: timeline.totalSec,
    outFile: voiceFile,
    workDir: dir,
  });
  return { locale, lines, voiceFile };
}

/** Place clips on a silent timeline (adelay + amix) and write a full-length wav. */
export async function assembleVoiceTrack(params: {
  clips: Array<{ file: string; startSec: number; tempo?: number; maxSec?: number }>;
  totalSec: number;
  outFile: string;
  workDir: string;
}): Promise<void> {
  const inputs: string[] = [];
  const filters: string[] = [];
  params.clips.forEach((c, i) => {
    inputs.push("-i", c.file);
    const chain: string[] = ["aresample=48000", "aformat=channel_layouts=stereo"];
    if (c.tempo && c.tempo > 1.001) chain.push(`atempo=${c.tempo.toFixed(3)}`);
    if (c.maxSec) chain.push(`atrim=0:${c.maxSec.toFixed(3)}`, `afade=t=out:st=${Math.max(0, c.maxSec - 0.15).toFixed(3)}:d=0.15`);
    const ms = Math.max(0, Math.round(c.startSec * 1000));
    chain.push(`adelay=${ms}|${ms}`);
    filters.push(`[${i}:a]${chain.join(",")}[a${i}]`);
  });
  filters.push(
    `${params.clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${params.clips.length}:normalize=0:dropout_transition=0,apad,atrim=0:${params.totalSec.toFixed(3)}[out]`
  );
  const script = path.join(params.workDir, `${path.basename(params.outFile)}.filter`);
  await fs.promises.writeFile(script, filters.join(";\n"));
  await runFfmpeg([...inputs, "-filter_complex_script", script, "-map", "[out]", "-c:a", "pcm_s16le", params.outFile], 20 * 60_000);
}

/**
 * Music bed matching the composition: looped, faded in/out, ducked inside narration windows.
 * Used under dubbed voice tracks (YouTube audio tracks replace the whole soundtrack).
 */
export async function buildMusicBed(params: {
  musicFile: string;
  totalSec: number;
  windows: Array<[number, number]>;
  volume: number;
  duckedVolume: number;
  outFile: string;
  workDir: string;
}): Promise<void> {
  const { totalSec } = params;
  const fade = Math.min(2, totalSec / 4);
  const duckRatio = params.duckedVolume / params.volume;
  // Piecewise volume: base volume, multiplied by duckRatio inside windows (with 0.25 s ramps).
  const terms = params.windows
    .map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`)
    .join("+");
  const duckExpr = terms ? `if(gt(${terms},0),${duckRatio.toFixed(4)},1)` : "1";
  const filter = [
    `[0:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${totalSec.toFixed(3)}`,
    `volume='${params.volume.toFixed(4)}*${duckExpr}':eval=frame`,
    `afade=t=in:st=0:d=${fade.toFixed(2)}`,
    `afade=t=out:st=${Math.max(0, totalSec - fade).toFixed(2)}:d=${fade.toFixed(2)}[out]`,
  ].join(",");
  const script = path.join(params.workDir, "music-bed.filter");
  await fs.promises.writeFile(script, filter);
  await runFfmpeg(["-stream_loop", "-1", "-i", params.musicFile, "-filter_complex_script", script, "-map", "[out]", "-t", totalSec.toFixed(3), "-c:a", "pcm_s16le", params.outFile], 20 * 60_000);
}

/** Final dubbed soundtrack (voice + music bed) as 192 kbps MP3, ready for YouTube Studio. */
export async function mixDubbedTrack(params: { voiceFile: string; musicBedFile: string | null; outFile: string }): Promise<number> {
  if (params.musicBedFile) {
    await runFfmpeg([
      "-i",
      params.voiceFile,
      "-i",
      params.musicBedFile,
      "-filter_complex",
      "[0:a][1:a]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95[out]",
      "-map",
      "[out]",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      params.outFile,
    ]);
  } else {
    await runFfmpeg(["-i", params.voiceFile, "-c:a", "libmp3lame", "-b:a", "192k", params.outFile]);
  }
  return probeDuration(params.outFile);
}
