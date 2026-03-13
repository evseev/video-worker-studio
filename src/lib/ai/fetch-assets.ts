import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

const PINTEREST_DL_BIN =
  process.env.PINTEREST_DL_BIN || "/Users/evs/www/pinscrape/.venv/bin/pinterest-dl";

/**
 * Fetches one Pinterest image per search keyword using pinterest-dl CLI.
 * Returns an array of local file paths (or null if fetch failed).
 */
export async function fetchAssets(
  keywords: string[],
  projectId: string
): Promise<(string | null)[]> {
  const baseDir = path.join(os.tmpdir(), "vws-assets", projectId);
  await fs.promises.mkdir(baseDir, { recursive: true });

  const results: (string | null)[] = [];

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    const sceneDir = path.join(baseDir, `scene-${i}`);
    await fs.promises.mkdir(sceneDir, { recursive: true });

    try {
      // Search Pinterest for 1 image matching the keyword
      const cmd = `"${PINTEREST_DL_BIN}" search "${keyword.replace(/"/g, '\\"')}" -n 1 -o "${sceneDir}" --client api --timeout 15 2>&1`;
      console.log(`[fetch-assets] Scene ${i}: ${cmd}`);

      const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
      console.log(`[fetch-assets] Scene ${i} stdout: ${stdout.slice(0, 200)}`);
      if (stderr) console.log(`[fetch-assets] Scene ${i} stderr: ${stderr.slice(0, 200)}`);

      // Find the downloaded image file
      const files = await fs.promises.readdir(sceneDir);
      const imageFile = files.find((f) =>
        /\.(jpg|jpeg|png|webp|gif)$/i.test(f)
      );

      if (imageFile) {
        const filePath = path.join(sceneDir, imageFile);
        console.log(`[fetch-assets] Scene ${i}: Found asset ${filePath}`);
        results.push(filePath);
      } else {
        console.warn(`[fetch-assets] Scene ${i}: No image found for "${keyword}"`);
        results.push(null);
      }
    } catch (err) {
      console.error(`[fetch-assets] Scene ${i}: Error fetching "${keyword}":`, err);
      results.push(null);
    }
  }

  return results;
}
