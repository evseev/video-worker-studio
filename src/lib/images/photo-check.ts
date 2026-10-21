import * as fs from "fs";
import * as path from "path";
import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { createGeminiClient, getTextModel } from "@/lib/ai/gemini";
import { runFfmpeg } from "@/lib/media/ffmpeg";
import { shortHash } from "./download";

/**
 * Vision checks on candidate photos (Gemini), batched:
 *  - watermark: stock-agency marks (Getty, WireImage, Shutterstock…) → avoid the photo;
 *  - sex of the chosen face (from a crop around the face box) → must match Wikidata's sex.
 *    Little-known spouses often have no Wikidata portrait, and search results can be filled with
 *    unrelated people; this check is what stops a man appearing in a "WIFE" slot.
 */
export interface PhotoCheckInput {
  file: string;
  faceBox?: [number, number, number, number] | null;
  width?: number;
  height?: number;
}

export interface PhotoCheck {
  watermark: boolean;
  sex: "male" | "female" | "unclear";
}

const BATCH = 6;

const ResultSchema = z.object({
  results: z.array(
    z.object({ index: z.number().int(), watermark: z.boolean(), sex: z.enum(["male", "female", "unclear"]) })
  ),
});
const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    results: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          index: { type: SchemaType.INTEGER },
          watermark: { type: SchemaType.BOOLEAN },
          sex: { type: SchemaType.STRING, enum: ["male", "female", "unclear"], format: "enum" },
        },
        required: ["index", "watermark", "sex"],
      },
    },
  },
  required: ["results"],
};

const PROMPT = `Each numbered item has two images: FULL (the whole photo) and FACE (a crop around one person's face).
For each item answer:
- watermark: does FULL show a visible watermark — a stock-photo or agency mark (e.g. "gettyimages", "WireImage",
  "Shutterstock", "Alamy", "Dreamstime", "123RF"), a semi-transparent logo or text stamped over the image, or a
  credit line printed on the photo? Text that is part of the scene (event backdrops, posters, signs, clothing) is NOT a watermark.
- sex: does the person in FACE present as "male" or "female"? Use "unclear" only if the face is not visible.
Return {"results":[{"index":n,"watermark":bool,"sex":"male"|"female"|"unclear"}, …]}, one entry per item.`;

async function fullThumb(file: string, dir: string): Promise<string> {
  const out = path.join(dir, `${shortHash(file)}-full.jpg`);
  if (!fs.existsSync(out)) await runFfmpeg(["-i", file, "-vf", "scale='min(640,iw)':-2", "-frames:v", "1", "-q:v", "4", out]);
  return out;
}

/** Square crop around the face box, expanded to include hair and shoulders. */
export function faceCropRect(
  box: [number, number, number, number],
  width: number,
  height: number,
  expand = 2.2
): { x: number; y: number; size: number } {
  const [x, y, w, h] = box;
  const size = Math.min(Math.round(Math.max(w, h) * expand), width, height);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const left = Math.round(Math.min(Math.max(0, cx - size / 2), width - size));
  const top = Math.round(Math.min(Math.max(0, cy - size / 2), height - size));
  return { x: left, y: top, size };
}

async function faceThumb(input: PhotoCheckInput, dir: string): Promise<string> {
  const key = shortHash(`${input.file}|${(input.faceBox ?? []).join(",")}`);
  const out = path.join(dir, `${key}-face.jpg`);
  if (fs.existsSync(out)) return out;
  if (input.faceBox && input.width && input.height) {
    const r = faceCropRect(input.faceBox, input.width, input.height);
    await runFfmpeg(["-i", input.file, "-vf", `crop=${r.size}:${r.size}:${r.x}:${r.y},scale=320:320`, "-frames:v", "1", "-q:v", "4", out]);
  } else {
    await runFfmpeg(["-i", input.file, "-vf", "scale='min(320,iw)':-2", "-frames:v", "1", "-q:v", "4", out]);
  }
  return out;
}

/**
 * Results keyed by `file|faceBox` (the same file can be checked for different faces).
 * Items that fail analysis come back as { watermark: false, sex: "unclear" } (never blocked by an outage).
 */
export function photoCheckKey(input: PhotoCheckInput): string {
  return `${input.file}|${(input.faceBox ?? []).join(",")}`;
}

export async function checkPhotos(inputs: PhotoCheckInput[], workDir: string): Promise<Record<string, PhotoCheck>> {
  const unique = new Map<string, PhotoCheckInput>();
  for (const i of inputs) unique.set(photoCheckKey(i), i);
  const todo = Array.from(unique.values());
  const dir = path.join(workDir, "photo-check");
  await fs.promises.mkdir(dir, { recursive: true });
  const genAI = createGeminiClient(process.env.GEMINI_API_KEY);
  const model = getTextModel({ genAI, generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0 } });
  const out: Record<string, PhotoCheck> = {};

  const batches: PhotoCheckInput[][] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const batch = batches[next++];
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: PROMPT }];
          for (let k = 0; k < batch.length; k++) {
            const full = await fullThumb(batch[k].file, dir);
            const face = await faceThumb(batch[k], dir);
            parts.push(
              { text: `Item ${k} FULL:` },
              { inlineData: { mimeType: "image/jpeg", data: (await fs.promises.readFile(full)).toString("base64") } },
              { text: `Item ${k} FACE:` },
              { inlineData: { mimeType: "image/jpeg", data: (await fs.promises.readFile(face)).toString("base64") } }
            );
          }
          const res = await model.generateContent(parts);
          const parsed = ResultSchema.parse(JSON.parse(res.response.text()));
          for (const r of parsed.results) {
            const item = batch[r.index];
            if (item) out[photoCheckKey(item)] = { watermark: r.watermark, sex: r.sex };
          }
          break;
        } catch (err) {
          if (attempt === 1) console.warn("[photo-check] batch failed:", err instanceof Error ? err.message : err);
        }
      }
      for (const item of batch) out[photoCheckKey(item)] ??= { watermark: false, sex: "unclear" };
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return out;
}
