import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execFileAsync = promisify(execFile);

function parseEnvInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const PINTEREST_DL_BIN = process.env.PINTEREST_DL_BIN;
const DEFAULT_BATCH_SIZE = parseEnvInt(process.env.PINTEREST_BATCH_SIZE, 60);
const DEFAULT_BATCH_PAUSE_MS = parseEnvInt(process.env.PINTEREST_BATCH_PAUSE_MS, 10_000);
const DEFAULT_CONCURRENCY = parseEnvInt(process.env.PINTEREST_CONCURRENCY, 6);

function getPinterestConfig() {
  return {
    batchSize: DEFAULT_BATCH_SIZE,
    batchPauseMs: DEFAULT_BATCH_PAUSE_MS,
    concurrency: DEFAULT_CONCURRENCY,
  };
}

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
  const allResults: Array<string | null | string[]> = [];
  for await (const batch of fetchAssetsBatched(keywords, projectId, count)) {
    allResults.push(...batch.results);
  }
  return allResults as (string | null)[] | string[][];
}

export type AssetBatchResult = {
  batchIndex: number;
  batchCount: number;
  startIndex: number;
  results: Array<string | null | string[]>;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* fetchAssetsBatched(
  keywords: (string | null)[],
  projectId: string,
  count: number = 1
): AsyncGenerator<AssetBatchResult> {
  const { batchSize, batchPauseMs, concurrency } = getPinterestConfig();
  const assetPath = process.env.TMP_ASSETS_PATH || "public/tmp_assets";
  const baseDir = path.join(process.cwd(), assetPath, "vws-assets", projectId);
  await fs.promises.mkdir(baseDir, { recursive: true });

  const batchId = Date.now();
  const totalBatches = Math.ceil(keywords.length / batchSize);
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * batchSize;
    const batchKeywords = keywords.slice(startIndex, startIndex + batchSize);
    console.log(`[fetch-assets] batch ${batchIndex + 1}/${totalBatches} (start=${startIndex}, size=${batchKeywords.length}) dispatched @ concurrency=${concurrency}`);
    const tasks = batchKeywords.map((keyword, localIdx) => {
      const i = startIndex + localIdx;
      return async () => {
        if (!keyword) return count > 1 ? [] : null;
        const sceneDir = path.join(baseDir, `batch-${batchId}-${i}`);
        const images = await fetchForKeyword(keyword, sceneDir, count, i);
        if (count > 1) return images;
        return images[0] ?? null;
      };
    });

    const results = await batchedPromiseAll(tasks, concurrency);
    yield {
      batchIndex,
      batchCount: totalBatches,
      startIndex,
      results: results as Array<string | null | string[]>,
    };

    if (batchIndex < totalBatches - 1) {
      await wait(batchPauseMs);
    }
  }
}
