import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execFileAsync = promisify(execFile);

const PINTEREST_DL_BIN = process.env.PINTEREST_DL_BIN;

/**
 * Fetches one Pinterest image per search keyword using pinterest-dl CLI.
 * Returns an array of local file paths (or null if fetch failed).
 */
export async function fetchAssets(
  keywords: string[],
  projectId: string
): Promise<(string | null)[]> {
  if (!PINTEREST_DL_BIN) {
    console.warn("[fetch-assets] PINTEREST_DL_BIN is not set, asset fetching will fail.");
  }

  const assetPath = process.env.TMP_ASSETS_PATH || "public/tmp_assets";
  const baseDir = path.join(process.cwd(), assetPath, "vws-assets", projectId);
  await fs.promises.mkdir(baseDir, { recursive: true });

  const results: (string | null)[] = [];

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    if (!keyword) {
      results.push(null);
      continue;
    }

    const sceneDir = path.join(baseDir, `scene-${i}`);
    await fs.promises.mkdir(sceneDir, { recursive: true });

    try {
      if (!PINTEREST_DL_BIN) {
        throw new Error("PINTEREST_DL_BIN is not configured");
      }

      console.log(`[fetch-assets] Scene ${i}: searching for "${keyword}"`);

      // Use execFile to prevent command injection from LLM-generated keywords
      const { stdout, stderr } = await execFileAsync(
        PINTEREST_DL_BIN,
        ["search", keyword, "-n", "1", "-o", sceneDir, "--client", "api", "--timeout", "15"],
        { timeout: 30000 }
      );
      
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
