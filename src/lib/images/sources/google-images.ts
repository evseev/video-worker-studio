import { z } from "zod";
import type { ImageCandidate } from "../types";
import { downloadImage, shortHash } from "../download";

/**
 * Google Images via DataForSEO Live API (one task per call, ≈ $0.002 per query, results in seconds).
 * Docs: https://docs.dataforseo.com/v3/serp/google/images/live/advanced/
 * Enabled when DataForSEO_API_LOGIN / DataForSEO_API_PASSWORD (or DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD) are set.
 * Items of type "images_search": `source_url` = original image, `url` = hosting page.
 */
const LIVE_URL = "https://api.dataforseo.com/v3/serp/google/images/live/advanced";

function credentials(): { login: string; password: string } | null {
  const login = process.env.DataForSEO_API_LOGIN ?? process.env.DATAFORSEO_LOGIN;
  const password = process.env.DataForSEO_API_PASSWORD ?? process.env.DATAFORSEO_PASSWORD;
  return login && password ? { login, password } : null;
}

export function isGoogleImagesEnabled(): boolean {
  return credentials() !== null;
}

const LiveResponse = z.object({
  status_code: z.number(),
  status_message: z.string().optional(),
  tasks: z
    .array(
      z.object({
        status_code: z.number(),
        status_message: z.string().optional(),
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
    )
    .default([]),
});

/** Skip sources that are almost always watermarked or tiny (stock agencies, thumbnails). */
const SKIP_HOSTS = /(gettyimages|shutterstock|alamy|dreamstime|123rf|istockphoto|depositphotos|wireimage|fbsbx|lookaside)\./i;

export function pickImageItems(
  items: Array<{ type?: string; source_url?: string | null; url?: string | null }>,
  count: number
): Array<{ source: string; page: string | null }> {
  const out: Array<{ source: string; page: string | null }> = [];
  for (const it of items) {
    if (out.length >= count) break;
    if (it.type && it.type !== "images_search") continue;
    const src = it.source_url ?? "";
    if (!/^https?:\/\//.test(src) || SKIP_HOSTS.test(src)) continue;
    out.push({ source: src, page: it.url ?? null });
  }
  return out;
}

export async function searchGoogleImages(
  query: string,
  dir: string,
  count = 8,
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<ImageCandidate[]> {
  const cred = credentials();
  if (!cred) return [];
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(LIVE_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${cred.login}:${cred.password}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ keyword: query, location_code: 2840, language_code: "en", depth: 100 }]),
    });
    const body = LiveResponse.parse(await res.json());
    const task = body.tasks[0];
    if (!task || task.status_code !== 20000) {
      console.warn(`[images/google] "${query}": ${task?.status_code ?? body.status_code} ${task?.status_message ?? body.status_message ?? ""}`);
      return [];
    }
    const picked = pickImageItems(task.result?.[0]?.items ?? [], count * 2);
    const out: ImageCandidate[] = [];
    for (const it of picked) {
      if (out.length >= count) break;
      const localPath = await downloadImage(it.source, dir, { fetchImpl: f, timeoutMs: 12_000 });
      if (!localPath) continue;
      out.push({
        id: `ggl-${shortHash(it.source)}`,
        localPath,
        source: "google-images",
        sourceUrl: it.page ?? it.source,
        license: null,
        attribution: null,
        query,
      });
    }
    return out;
  } catch (err) {
    console.warn(`[images/google] "${query}" failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}
