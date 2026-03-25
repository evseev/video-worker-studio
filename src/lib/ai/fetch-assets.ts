import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execFileAsync = promisify(execFile);

const PINTEREST_DL_BIN = process.env.PINTEREST_DL_BIN;
const MAX_CONCURRENCY = 4;

/** Run tasks in batches with a concurrency limit */
async function batchedPromiseAll<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

/** Fetch images from Pinterest for a single keyword */
async function fetchForKeyword(
  keyword: string,
  sceneDir: string,
  count: number,
  sceneIndex: number
): Promise<string[]> {
  // Clear stale images from previous fetches to prevent accumulation
  await fs.promises.rm(sceneDir, { recursive: true, force: true });
  await fs.promises.mkdir(sceneDir, { recursive: true });

  if (!PINTEREST_DL_BIN) {
    console.warn(`[fetch-assets] Scene ${sceneIndex}: PINTEREST_DL_BIN not set`);
    return [];
  }

  try {
    console.log(`[fetch-assets] Scene ${sceneIndex}: searching for "${keyword}" (n=${count})`);

    const { stdout, stderr } = await execFileAsync(
      PINTEREST_DL_BIN,
      ["search", keyword, "-n", String(count), "-o", sceneDir, "--client", "api", "--timeout", "15"],
      { timeout: 30000 }
    );

    if (stdout) console.log(`[fetch-assets] Scene ${sceneIndex} stdout: ${stdout.slice(0, 200)}`);
    if (stderr) console.log(`[fetch-assets] Scene ${sceneIndex} stderr: ${stderr.slice(0, 200)}`);

    const files = await fs.promises.readdir(sceneDir);
    const imageFiles = files
      .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
      .sort()
      .map((f) => path.join(sceneDir, f));

    console.log(`[fetch-assets] Scene ${sceneIndex}: found ${imageFiles.length} images`);
    return imageFiles;
  } catch (err) {
    console.error(`[fetch-assets] Scene ${sceneIndex}: Error fetching "${keyword}":`, err);
    return [];
  }
}

/**
 * Fetches Pinterest images per search keyword using pinterest-dl CLI.
 *
 * @param keywords - Search keyword per scene (null to skip)
 * @param projectId - Project ID for directory namespacing
 * @param count - Number of images to fetch per keyword (default: 1)
 * @returns Array of results per scene. Each result is an array of local file paths.
 */
/**
 * When count=1 (default), returns (string | null)[] — one path per keyword.
 * When count>1, returns string[][] — array of paths per keyword.
 */
export async function fetchAssets(
  keywords: (string | null)[],
  projectId: string,
  count: number = 1
): Promise<(string | null)[] | string[][]> {
  const assetPath = process.env.TMP_ASSETS_PATH || "public/tmp_assets";
  const baseDir = path.join(process.cwd(), assetPath, "vws-assets", projectId);
  await fs.promises.mkdir(baseDir, { recursive: true });

  const tasks = keywords.map((keyword, i) => {
    return async () => {
      if (!keyword) return count > 1 ? [] : null;
      const sceneDir = path.join(baseDir, `scene-${i}`);
      const images = await fetchForKeyword(keyword, sceneDir, count, i);

      if (count > 1) return images;
      return images[0] ?? null;
    };
  });

  return batchedPromiseAll(tasks, MAX_CONCURRENCY) as Promise<(string | null)[] | string[][]>;
}
