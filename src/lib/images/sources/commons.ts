import { z } from "zod";
import type { ImageCandidate } from "../types";
import { downloadImage, shortHash } from "../download";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT =
  process.env.WIKIMEDIA_USER_AGENT ?? "VideoWorkerStudio/0.5 (autopilot; contact via repository owner)";

const ImageInfo = z.object({
  thumburl: z.string().optional(),
  url: z.string().optional(),
  descriptionurl: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  extmetadata: z
    .record(z.string(), z.object({ value: z.unknown() }).partial())
    .optional(),
});

const QueryResponse = z.object({
  query: z
    .object({
      pages: z.record(
        z.string(),
        z.object({
          title: z.string(),
          imageinfo: z.array(ImageInfo).optional(),
        })
      ),
    })
    .optional(),
});

function stripHtml(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return text.length ? text.slice(0, 200) : null;
}

/** Licenses we accept for reuse in videos (attribution goes in the description). */
const ACCEPTED_LICENSE = /^(cc[- ]by(-sa)?|cc0|public domain|pd)/i;

/**
 * Search Wikimedia Commons for photos of a person. Free-licensed, attribution captured.
 * Commons coverage of "young" photos is thin, so this mostly helps the "now" slots
 * and as extra reference faces.
 */
export async function searchCommons(
  query: string,
  dir: string,
  count = 6,
  fetchImpl: typeof fetch = fetch
): Promise<ImageCandidate[]> {
  const url = new URL(COMMONS_API);
  const params: Record<string, string> = {
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `${query} filetype:bitmap`,
    gsrlimit: String(Math.min(20, count * 3)),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1200",
    origin: "*",
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let parsed: z.infer<typeof QueryResponse>;
  try {
    const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return [];
    parsed = QueryResponse.parse(await res.json());
  } catch {
    return [];
  }

  const pages = Object.values(parsed.query?.pages ?? {});
  const out: ImageCandidate[] = [];
  for (const page of pages) {
    if (out.length >= count) break;
    const info = page.imageinfo?.[0];
    const fileUrl = info?.thumburl ?? info?.url;
    if (!info || !fileUrl) continue;
    if ((info.width ?? 0) < 400 || (info.height ?? 0) < 400) continue;
    const license = stripHtml(info.extmetadata?.LicenseShortName?.value);
    if (!license || !ACCEPTED_LICENSE.test(license)) continue;
    const localPath = await downloadImage(fileUrl, dir, { fetchImpl });
    if (!localPath) continue;
    const artist = stripHtml(info.extmetadata?.Artist?.value);
    out.push({
      id: `com-${shortHash(fileUrl)}`,
      localPath,
      source: "commons",
      sourceUrl: info.descriptionurl ?? fileUrl,
      license,
      attribution: `${page.title.replace(/^File:/, "")}${artist ? ` by ${artist}` : ""}, ${license}, via Wikimedia Commons`,
      query,
    });
  }
  return out;
}
