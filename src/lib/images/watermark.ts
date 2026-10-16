import * as fs from "fs";
import * as path from "path";
import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { createGeminiClient, getTextModel } from "@/lib/ai/gemini";
import { runFfmpeg } from "@/lib/media/ffmpeg";
import { shortHash } from "./download";

/**
 * Stock-agency watermarks (Getty Images, WireImage, Shutterstock, Alamy…) look unprofessional and
 * invite copyright claims. Gemini vision checks downscaled copies in batches of 8.
 */
const BATCH = 8;

const ResultSchema = z.object({ results: z.array(z.object({ index: z.number().int(), watermark: z.boolean() })) });
const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    results: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { index: { type: SchemaType.INTEGER }, watermark: { type: SchemaType.BOOLEAN } },
        required: ["index", "watermark"],
      },
    },
  },
  required: ["results"],
};

const PROMPT = `For each numbered photo, answer whether it shows a visible watermark: a stock-photo or agency mark
(e.g. "gettyimages", "Getty Images", "WireImage", "Shutterstock", "Alamy", "Dreamstime", "123RF", "AP", "Reuters"),
a semi-transparent logo or text stamped over the image, or a credit line printed on the photo itself.
Text that is part of the scene (event backdrops, posters, signs, clothing) is NOT a watermark.
Return {"results":[{"index":n,"watermark":true|false}, …]} with one entry per photo.`;

async function thumbnail(file: string, dir: string): Promise<string> {
  const out = path.join(dir, `${shortHash(file)}.jpg`);
  if (!fs.existsSync(out)) await runFfmpeg(["-i", file, "-vf", "scale='min(640,iw)':-2", "-frames:v", "1", "-q:v", "4", out]);
  return out;
}

/** Map of file → has watermark. Files that fail analysis are reported as `false` (not blocked). */
export async function detectWatermarks(files: string[], workDir: string, cache: Record<string, boolean> = {}): Promise<Record<string, boolean>> {
  const todo = Array.from(new Set(files)).filter((f) => !(f in cache));
  const thumbsDir = path.join(workDir, "wm-thumbs");
  await fs.promises.mkdir(thumbsDir, { recursive: true });
  const genAI = createGeminiClient(process.env.GEMINI_API_KEY);
  const model = getTextModel({ genAI, generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0 } });

  const batches: string[][] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const batch = batches[next++];
      try {
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: PROMPT }];
        for (let k = 0; k < batch.length; k++) {
          const thumb = await thumbnail(batch[k], thumbsDir);
          parts.push({ text: `Photo ${k}:` }, { inlineData: { mimeType: "image/jpeg", data: (await fs.promises.readFile(thumb)).toString("base64") } });
        }
        const res = await model.generateContent(parts);
        const parsed = ResultSchema.parse(JSON.parse(res.response.text()));
        for (const r of parsed.results) if (batch[r.index]) cache[batch[r.index]] = r.watermark;
      } catch (err) {
        console.warn("[watermark] batch failed:", err instanceof Error ? err.message : err);
      }
      for (const f of batch) if (!(f in cache)) cache[f] = false;
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return cache;
}
