import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { runFfmpeg } from "@/lib/media/ffmpeg";
import { probeDuration } from "@/lib/media/ffmpeg";
import { narrationSimilarity, tokensToLines, NARRATION_SIMILARITY_THRESHOLD, type SttToken } from "./narration-check";

/**
 * Soniox async speech-to-text (≈ $0.10 per hour of audio) used for narration QA.
 * Flow: upload file → create transcription → poll → fetch transcript with token timings → delete.
 */
const API = "https://api.soniox.com/v1";
const STT_MODEL = process.env.SONIOX_STT_MODEL ?? "stt-async-v4";

function auth() {
  const key = process.env.SONIOX_API_KEY;
  if (!key) throw new Error("SONIOX_API_KEY is not set");
  return { Authorization: `Bearer ${key}` };
}

const Id = z.object({ id: z.string() });
const Status = z.object({ status: z.string(), error_message: z.string().nullable().optional() });
const Transcript = z.object({
  text: z.string(),
  tokens: z.array(z.object({ text: z.string(), start_ms: z.number(), end_ms: z.number() })).default([]),
});

export async function transcribeFile(file: string, language = "en"): Promise<{ text: string; tokens: SttToken[] }> {
  const form = new FormData();
  form.append("file", new Blob([await fs.promises.readFile(file)]), path.basename(file));
  const uploaded = Id.parse(await (await fetch(`${API}/files`, { method: "POST", headers: auth(), body: form })).json());
  try {
    const created = Id.parse(
      await (
        await fetch(`${API}/transcriptions`, {
          method: "POST",
          headers: { ...auth(), "Content-Type": "application/json" },
          body: JSON.stringify({ model: STT_MODEL, file_id: uploaded.id, language_hints: [language.split("-")[0]] }),
        })
      ).json()
    );
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const st = Status.parse(await (await fetch(`${API}/transcriptions/${created.id}`, { headers: auth() })).json());
      if (st.status === "completed") break;
      if (st.status === "error") throw new Error(`Soniox STT error: ${st.error_message ?? "unknown"}`);
    }
    const t = Transcript.parse(await (await fetch(`${API}/transcriptions/${created.id}/transcript`, { headers: auth() })).json());
    await fetch(`${API}/transcriptions/${created.id}`, { method: "DELETE", headers: auth() }).catch(() => undefined);
    return t;
  } finally {
    await fetch(`${API}/files/${uploaded.id}`, { method: "DELETE", headers: auth() }).catch(() => undefined);
  }
}

export interface VoiceCheck {
  index: number;
  similarity: number;
  transcript: string;
  ok: boolean;
}

/**
 * Join all narration clips with 1 s gaps, transcribe once, split tokens back per line and score each line.
 */
export async function checkNarration(params: { files: string[]; scripts: string[]; workDir: string; language?: string }): Promise<VoiceCheck[]> {
  const gap = 1.0;
  const offsets: Array<{ start: number; end: number }> = [];
  let t = 0;
  for (const f of params.files) {
    const d = await probeDuration(f);
    // Windows meet in the middle of each 1 s gap so no token falls between lines.
    offsets.push({ start: Math.max(0, t - gap / 2) * 1000, end: (t + d + gap / 2) * 1000 });
    t += d + gap;
  }
  const joined = path.join(params.workDir, "narration-qa.mp3");
  const inputs = params.files.flatMap((f) => ["-i", f]);
  const filter =
    params.files.map((_, i) => `[${i}:a]aresample=16000,aformat=channel_layouts=mono,apad=pad_dur=${gap}[a${i}]`).join(";") +
    `;${params.files.map((_, i) => `[a${i}]`).join("")}concat=n=${params.files.length}:v=0:a=1[out]`;
  const script = path.join(params.workDir, "narration-qa.filter");
  await fs.promises.writeFile(script, filter);
  await runFfmpeg([...inputs, "-filter_complex_script", script, "-map", "[out]", "-b:a", "48k", joined]);
  const result = await transcribeFile(joined, params.language ?? "en");
  const lines = tokensToLines(result.tokens, offsets);
  return lines.map((transcript, index) => {
    const similarity = narrationSimilarity(params.scripts[index] ?? "", transcript);
    return { index, similarity: Number(similarity.toFixed(3)), transcript, ok: similarity >= NARRATION_SIMILARITY_THRESHOLD };
  });
}
