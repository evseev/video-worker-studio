import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import type { ImageCandidate } from "../types";
import { shortHash } from "../download";

const execFileAsync = promisify(execFile);

/**
 * Pinterest search via the pinterest-dl CLI (same binary as src/lib/ai/fetch-assets.ts).
 * Returns up to `count` downloaded candidates. Never throws: an empty array means no results.
 */
export async function searchPinterest(
  query: string,
  dir: string,
  count = 8,
  bin = process.env.PINTEREST_DL_BIN
): Promise<ImageCandidate[]> {
  if (!bin) return [];
  await fs.promises.mkdir(dir, { recursive: true });
  try {
    await execFileAsync(
      bin,
      ["search", query, "-n", String(count), "-o", dir, "--client", "api", "--timeout", "15"],
      { timeout: 60_000 }
    );
  } catch (err) {
    console.warn(`[images/pinterest] "${query}" failed:`, err instanceof Error ? err.message : err);
  }
  const files = (await fs.promises.readdir(dir).catch(() => [] as string[]))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  return files.slice(0, count).map((f) => {
    const localPath = path.join(dir, f);
    return {
      id: `pin-${shortHash(localPath)}`,
      localPath,
      source: "pinterest" as const,
      sourceUrl: null,
      license: null,
      attribution: null,
      query,
    };
  });
}
