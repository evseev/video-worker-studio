import { z } from "zod";
import type { ImageCandidate } from "../types";
import { downloadImage, shortHash } from "../download";

/**
 * Google Images via DataForSEO (task-based, standard queue ≈ $0.0006 per SERP).
 * Disabled unless DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are set.
 * Docs: https://docs.dataforseo.com/v3/serp/google/images/task_post/
 */
const BASE = "https://api.dataforseo.com/v3/serp/google/images";

export function isGoogleImagesEnabled(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

function authHeader(): string {
  const token = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64");
  return `Basic ${token}`;
}

const TaskPostResponse = z.object({
  tasks: z.array(z.object({ id: z.string(), status_code: z.number(), status_message: z.string().optional() })),
});

const TaskGetResponse = z.object({
  tasks: z.array(
    z.object({
      status_code: z.number(),
      result: z
        .array(
          z.object({
            items: z
              .array(
                z.object({
                  type: z.string().optional(),
                  source_url: z.string().nullable().optional(),
                  url: z.string().nullable().optional(),
                  title: z.string().nullable().optional(),
                })
              )
              .nullable()
              .optional(),
          })
        )
        .nullable()
        .optional(),
    })
  ),
});

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Post a Google Images task, poll until ready (standard queue averages ~5 min),
 * then download the first `count` images. Returns [] when disabled or on failure.
 */
export async function searchGoogleImages(
  query: string,
  dir: string,
  count = 8,
  opts: { fetchImpl?: typeof fetch; pollMs?: number; timeoutMs?: number } = {}
): Promise<ImageCandidate[]> {
  if (!isGoogleImagesEnabled()) return [];
  const f = opts.fetchImpl ?? fetch;
  try {
    const post = await f(`${BASE}/task_post`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify([{ keyword: query, language_code: "en", location_code: 2840, depth: 100 }]),
    });
    const posted = TaskPostResponse.parse(await post.json());
    const id = posted.tasks[0]?.id;
    if (!id) return [];

    const deadline = Date.now() + (opts.timeoutMs ?? 15 * 60_000);
    while (Date.now() < deadline) {
      await sleep(opts.pollMs ?? 20_000);
      const get = await f(`${BASE}/task_get/advanced/${id}`, { headers: { Authorization: authHeader() } });
      const body = TaskGetResponse.parse(await get.json());
      const task = body.tasks[0];
      if (!task || task.status_code === 40602 || task.status_code === 40601) continue; // in queue / in progress
      if (task.status_code !== 20000) return [];
      const items = (task.result?.[0]?.items ?? []).filter((i) => i.source_url);
      const out: ImageCandidate[] = [];
      for (const item of items) {
        if (out.length >= count) break;
        const localPath = await downloadImage(item.source_url!, dir, { fetchImpl: f });
        if (!localPath) continue;
        out.push({
          id: `ggl-${shortHash(item.source_url!)}`,
          localPath,
          source: "google-images",
          sourceUrl: item.url ?? item.source_url ?? null,
          license: null,
          attribution: null,
          query,
        });
      }
      return out;
    }
  } catch (err) {
    console.warn(`[images/google] "${query}" failed:`, err instanceof Error ? err.message : err);
  }
  return [];
}
