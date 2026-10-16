import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { synthesize, DEFAULT_VOICES, SONIOX_MODEL, type SonioxTag } from "./soniox";
import { probeDuration } from "@/lib/media/ffmpeg";

export interface NarrationLine {
  text: string;
  /** Optional delivery tag prepended to the line. */
  tone?: SonioxTag | null;
}

export interface NarratedLine {
  index: number;
  file: string;
  durationSec: number;
  text: string;
  cached: boolean;
}

function lineHash(text: string, voice: string, language: string): string {
  return createHash("sha1").update(`${SONIOX_MODEL}|${voice}|${language}|${text}`).digest("hex").slice(0, 16);
}

export function composeLineText(line: NarrationLine): string {
  const t = line.text.trim();
  if (!line.tone || /^\[[a-z -]+\]/i.test(t)) return t;
  return `[${line.tone}] ${t}`;
}

/**
 * Synthesize every line to its own MP3 (cached by content hash in `outDir`),
 * running up to 3 requests in parallel (Soniox concurrency limit).
 */
export async function narrateLines(params: {
  lines: NarrationLine[];
  language: string;
  voice?: string;
  outDir: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<NarratedLine[]> {
  const voice = params.voice ?? DEFAULT_VOICES[params.language] ?? DEFAULT_VOICES.en;
  await fs.promises.mkdir(params.outDir, { recursive: true });
  const results: NarratedLine[] = new Array(params.lines.length);
  let done = 0;
  let next = 0;

  async function worker() {
    while (next < params.lines.length) {
      const index = next++;
      const text = composeLineText(params.lines[index]);
      const file = path.join(params.outDir, `${lineHash(text, voice, params.language)}.mp3`);
      let cached = true;
      if (!fs.existsSync(file) || fs.statSync(file).size < 512) {
        cached = false;
        const audio = await synthesize({ text, voice, language: params.language, format: "mp3" });
        await fs.promises.writeFile(file, audio);
      }
      const durationSec = await probeDuration(file);
      results[index] = { index, file, durationSec, text, cached };
      done++;
      params.onProgress?.(done, params.lines.length);
    }
  }

  await Promise.all([worker(), worker(), worker()]);
  return results;
}
