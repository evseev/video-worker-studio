/**
 * Soniox Text-to-Speech (REST). Docs: https://soniox.com/docs/tts/rest-api/generate-speech
 *  - POST https://tts-rt.soniox.com/tts, Bearer SONIOX_API_KEY, JSON body, raw audio response.
 *  - Limits: 100 req/min, 3 concurrent requests, 2 minutes of audio per request.
 *  - Delivery is steered with English audio tags in the text, e.g. "[warm] ...", "[softly] ...",
 *    plus punctuation ("...", "—") and *stress* markers. Unknown tags may be read aloud,
 *    so only tags from SONIOX_TAGS are emitted by this codebase.
 */

export const SONIOX_TTS_URL = "https://tts-rt.soniox.com/tts";
export const SONIOX_MODEL = process.env.SONIOX_TTS_MODEL ?? "tts-rt-v2";

/** Documented tags we allow the script writer to request. */
export const SONIOX_TAGS = [
  "warm",
  "happy",
  "calm",
  "excited",
  "playful",
  "softly",
  "sad",
  "slowly",
] as const;
export type SonioxTag = (typeof SONIOX_TAGS)[number];

/** Default voices per language (Soniox catalog, Oct 2026). Every voice can speak every language. */
export const DEFAULT_VOICES: Record<string, string> = {
  en: process.env.NARRATION_VOICE_EN ?? "Sloane",
  "pt-BR": process.env.NARRATION_VOICE_PT ?? "Larissa",
  es: process.env.NARRATION_VOICE_ES ?? "Lucia",
};

/** Soniox language code for our locale ids. */
export function sonioxLanguage(locale: string): string {
  return locale.split("-")[0].toLowerCase();
}

export interface SynthesizeOptions {
  text: string;
  voice: string;
  /** Locale such as "en", "pt-BR", "es". */
  language: string;
  format?: "mp3" | "wav";
  sampleRate?: 24000 | 44100 | 48000;
  /** Speaking-rate multiplier, if supported by the model (1 = normal). */
  speed?: number;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class SonioxError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorType?: string,
    readonly requestId?: string
  ) {
    super(message);
    this.name = "SonioxError";
  }
}

// --- concurrency gate (Soniox allows 3 simultaneous requests per key) ---
const MAX_CONCURRENT = 3;
let active = 0;
const waiters: Array<() => void> = [];
async function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
}
function release() {
  active--;
  const next = waiters.shift();
  if (next) next();
}

/** Remove our tags and markdown stress markers — for subtitles and character counts. */
export function stripDeliveryMarkup(text: string): string {
  return text
    .replace(/\[[a-z -]+\]\s*/gi, "")
    .replace(/\*(\S[^*]*\S|\S)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keep only allowed tags; anything else in brackets is dropped so it is never read aloud. */
export function sanitizeTags(text: string): string {
  const allowed = new Set<string>(SONIOX_TAGS);
  return text.replace(/\[([a-z -]+)\]\s*/gi, (m, tag: string) => (allowed.has(tag.trim().toLowerCase()) ? `[${tag.trim().toLowerCase()}] ` : ""));
}

export async function synthesize(opts: SynthesizeOptions): Promise<Buffer> {
  const apiKey = opts.apiKey ?? process.env.SONIOX_API_KEY;
  if (!apiKey) throw new Error("SONIOX_API_KEY is not set");
  const body: Record<string, unknown> = {
    model: SONIOX_MODEL,
    language: sonioxLanguage(opts.language),
    voice: opts.voice,
    audio_format: opts.format ?? "mp3",
    sample_rate: opts.sampleRate ?? 44100,
    text: sanitizeTags(opts.text),
  };
  if (opts.format !== "wav") body.bitrate = 128000;
  if (opts.speed && opts.speed !== 1) body.speed = opts.speed;

  const f = opts.fetchImpl ?? fetch;
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    await acquire();
    try {
      const res = await f(SONIOX_TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 512) throw new SonioxError("Soniox returned an empty audio body", res.status);
        return buf;
      }
      let errType: string | undefined;
      let requestId: string | undefined;
      let message = `Soniox TTS HTTP ${res.status}`;
      try {
        const j = (await res.json()) as { error_type?: string; error_message?: string; request_id?: string };
        errType = j.error_type;
        requestId = j.request_id;
        if (j.error_message) message += `: ${j.error_message}`;
      } catch {
        /* non-JSON error body */
      }
      lastError = new SonioxError(message, res.status, errType, requestId);
      if (res.status !== 429 && res.status < 500) throw lastError;
    } catch (err) {
      lastError = err;
      if (err instanceof SonioxError && err.status !== 429 && err.status < 500) throw err;
    } finally {
      release();
    }
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error("Soniox TTS failed");
}
