import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

/**
 * fal.ai queue client for the Phase 3 host experiment (Kling / Wan / Seedance image-to-video,
 * LatentSync lip-sync). Disabled unless FAL_KEY is set. Model ids change often — they are env
 * configurable; verify each on its fal.ai model page before the bake-off:
 *   HOST_I2V_MODEL      default "fal-ai/kling-video/v2.6/pro/image-to-video"  (Kling uses start_image_url on newer versions)
 *   HOST_LIPSYNC_MODEL  default "fal-ai/latentsync"  (≈ $0.20 per clip ≤ 40 s)
 * Queue protocol: POST https://queue.fal.run/<model> → {status_url, response_url}; poll status; GET response.
 */
export function isHostProviderConfigured(): boolean {
  return Boolean(process.env.FAL_KEY);
}

const QUEUE = "https://queue.fal.run";

const Submit = z.object({ request_id: z.string(), status_url: z.string(), response_url: z.string() });
const Status = z.object({ status: z.string() });
const VideoResult = z.object({ video: z.object({ url: z.string() }) });

async function falRun(model: string, input: Record<string, unknown>, opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<unknown> {
  const f = opts.fetchImpl ?? fetch;
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
  const submitted = Submit.parse(await (await f(`${QUEUE}/${model}`, { method: "POST", headers, body: JSON.stringify(input) })).json());
  const deadline = Date.now() + (opts.timeoutMs ?? 15 * 60_000);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = Status.parse(await (await f(submitted.status_url, { headers })).json());
    if (st.status === "COMPLETED") return (await f(submitted.response_url, { headers })).json();
    if (st.status === "FAILED" || st.status === "ERROR") throw new Error(`fal ${model} failed`);
  }
  throw new Error(`fal ${model} timed out`);
}

async function download(url: string, file: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/** Animate the host reference image with a motion prompt. */
export async function generateHostClip(params: { imageUrl: string; prompt: string; seconds: 5 | 10; outFile: string }): Promise<string> {
  const model = process.env.HOST_I2V_MODEL ?? "fal-ai/kling-video/v2.6/pro/image-to-video";
  const isKling3 = /kling-video\/(v3|o)/.test(model);
  const result = VideoResult.parse(
    await falRun(model, {
      prompt: params.prompt,
      [isKling3 ? "start_image_url" : "image_url"]: params.imageUrl,
      duration: String(params.seconds),
      aspect_ratio: "16:9",
      negative_prompt: "photorealistic, real person, celebrity, text, watermark, distorted face",
    })
  );
  return download(result.video.url, params.outFile);
}

/** Lip-sync a library clip to a narration line (both must be reachable URLs). */
export async function lipSyncClip(params: { videoUrl: string; audioUrl: string; outFile: string }): Promise<string> {
  const model = process.env.HOST_LIPSYNC_MODEL ?? "fal-ai/latentsync";
  const result = VideoResult.parse(await falRun(model, { video_url: params.videoUrl, audio_url: params.audioUrl, loop_mode: "loop" }));
  return download(result.video.url, params.outFile);
}
