import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

const USER_AGENT =
  process.env.WIKIMEDIA_USER_AGENT ?? "VideoWorkerStudio/0.5 (autopilot; contact via repository owner)";

export function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 12);
}

function extensionFor(contentType: string | null, url: string): string {
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("gif")) return ".gif";
  const m = /\.(jpe?g|png|webp|gif)(?:$|\?)/i.exec(url);
  if (m) return `.${m[1].toLowerCase().replace("jpeg", "jpg")}`;
  return ".jpg";
}

/**
 * Download a remote image into `dir`. Returns the local path or null on failure.
 * Skips files larger than `maxBytes` and non-image responses.
 */
export async function downloadImage(
  url: string,
  dir: string,
  opts: { maxBytes?: number; timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<string | null> {
  const maxBytes = opts.maxBytes ?? 15 * 1024 * 1024;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type");
    if (type && !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > maxBytes) return null;
    await fs.promises.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${shortHash(url)}${extensionFor(type, url)}`);
    await fs.promises.writeFile(file, buf);
    return file;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
