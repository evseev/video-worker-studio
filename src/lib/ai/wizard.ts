import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";
import {
  enhanceIdeaPrompt,
  validateTrendPrompt,
  generateSeoMetadataPrompt,
  generateSeoMetadataUserMessage,
} from "./prompts";
import type { Scene, TemplateId } from "@/templates/types";
import { buildSlideshowPrompt, slideshowGeminiSchema, SlideshowResponseSchema } from "@/templates/slideshow";
import { buildComparisonPrompt, comparisonGeminiSchema, ComparisonResponseSchema } from "@/templates/comparison";
import { buildFactCardPrompt, factCardGeminiSchema, FactCardResponseSchema } from "@/templates/fact-card";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set");
}
const genAI = new GoogleGenerativeAI(apiKey);

// --- Enhance Idea ---

const enhanceIdeaSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    ideas: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "A list of 3 highly engaging, viral video ideas based on the user's input.",
    },
  },
  required: ["ideas"],
};

export async function enhanceIdea(rawIdea: string, totalDuration?: number): Promise<string[]> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: enhanceIdeaSchema,
    },
    systemInstruction: enhanceIdeaPrompt(totalDuration ? { totalDuration } : undefined),
  });

  const result = await model.generateContent(`Raw idea: ${rawIdea}`);
  const text = result.response.text();

  const ResponseSchema = z.object({
    ideas: z.array(z.string()).min(1),
  });

  const parsed = ResponseSchema.parse(JSON.parse(text));
  return parsed.ideas;
}

// --- Validate Trend ---

const validateTrendSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    score: {
      type: SchemaType.INTEGER,
      description: "Trend score from 0 to 100",
    },
    reasoning: {
      type: SchemaType.STRING,
      description: "Why this topic is or isn't trending right now.",
    },
    hooks: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "1-2 viral hook ideas to maximize trend potential.",
    }
  },
  required: ["score", "reasoning", "hooks"],
};

export interface TrendValidation {
  score: number;
  reasoning: string;
  hooks: string[];
}

export async function validateTrend(idea: string): Promise<TrendValidation> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    // In a real app we might use Grounding with Google Search here
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: validateTrendSchema,
    },
    systemInstruction: validateTrendPrompt(),
  });

  const result = await model.generateContent(`Idea: ${idea}`);
  const text = result.response.text();

  const ResponseSchema = z.object({
    score: z.number().min(0).max(100),
    reasoning: z.string(),
    hooks: z.array(z.string()),
  });

  const parsed = ResponseSchema.parse(JSON.parse(text));
  return parsed;
}

// --- Generate Structure ---

function getTemplateAI(templateId: TemplateId) {
  switch (templateId) {
    case "slideshow":
      return { buildPrompt: buildSlideshowPrompt, geminiSchema: slideshowGeminiSchema, zodSchema: SlideshowResponseSchema };
    case "comparison":
      return { buildPrompt: buildComparisonPrompt, geminiSchema: comparisonGeminiSchema, zodSchema: ComparisonResponseSchema };
    case "fact-card":
      return { buildPrompt: buildFactCardPrompt, geminiSchema: factCardGeminiSchema, zodSchema: FactCardResponseSchema };
  }
}

function toScene(templateId: TemplateId, raw: Record<string, unknown>): Scene {
  // Fall back to scriptText if the AI didn't emit captionText (should be rare
  // with the updated schema, but keeps legacy behavior safe).
  const captionText: string = (raw.captionText as string | undefined) ?? (raw.scriptText as string | undefined) ?? "";
  switch (templateId) {
    case "slideshow":
      return {
        template: "slideshow",
        scriptText: raw.scriptText as string,
        captionText,
        searchKeywords: [raw.searchKeyword as string],
        assets: [{}],
      };
    case "comparison":
      return {
        template: "comparison",
        scriptText: raw.scriptText as string,
        captionText,
        searchKeywords: raw.searchKeywords as string[],
        leftLabel: (raw.leftLabel as string | undefined) ?? "",
        rightLabel: (raw.rightLabel as string | undefined) ?? "",
        assets: [{}, {}],
      };
    case "fact-card":
      return {
        template: "fact-card",
        scriptText: raw.scriptText as string,
        captionText,
        searchKeywords: raw.searchKeywords as string[],
        title: (raw.title as string | undefined) ?? "",
        subtitle: (raw.subtitle as string | undefined) ?? "",
        facts: (raw.facts as { label: string; value: string }[] | undefined) ?? [],
        assets: [{}, {}],
      };
  }
}

const CHUNK_THRESHOLD = 24;
const CHUNK_SIZE = 16;

type StructureOptions = { aspectRatio?: string; sceneCount?: number; sceneDuration?: number };

async function generateStructureChunk(
  idea: string,
  templateId: TemplateId,
  opts: { aspectRatio?: string; sceneCount: number; sceneDuration: number; chunkStart: number; chunkSize: number }
): Promise<Scene[]> {
  const ai = getTemplateAI(templateId);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ai.geminiSchema,
    },
    systemInstruction: ai.buildPrompt({
      sceneCount: opts.chunkSize,
      sceneDuration: opts.sceneDuration,
      aspectRatio: opts.aspectRatio,
    }),
  });

  const result = await model.generateContent(
    [
      `Idea: ${idea}`,
      `Video orientation: ${opts.aspectRatio === "16:9" ? "landscape" : "portrait"}`,
      `This is chunk ${Math.floor(opts.chunkStart / CHUNK_SIZE) + 1} of ${Math.ceil(opts.sceneCount / CHUNK_SIZE)}.`,
      `Generate scenes ${opts.chunkStart + 1} to ${opts.chunkStart + opts.chunkSize} out of ${opts.sceneCount}.`,
    ].join("\n")
  );
  const text = result.response.text();
  const parsed = ai.zodSchema.parse(JSON.parse(text));
  return parsed.scenes.map((raw: unknown) => toScene(templateId, raw as Record<string, unknown>));
}

async function generateStructureChunked(
  idea: string,
  templateId: TemplateId,
  opts: { aspectRatio?: string; sceneCount: number; sceneDuration: number }
): Promise<Scene[]> {
  const chunks: Scene[] = [];
  for (let chunkStart = 0; chunkStart < opts.sceneCount; chunkStart += CHUNK_SIZE) {
    const chunkSize = Math.min(CHUNK_SIZE, opts.sceneCount - chunkStart);
    const chunkScenes = await generateStructureChunk(idea, templateId, {
      ...opts,
      chunkStart,
      chunkSize,
    });
    chunks.push(...chunkScenes.slice(0, chunkSize));
  }
  return chunks.slice(0, opts.sceneCount);
}

export async function generateStructure(
  idea: string,
  templateId: TemplateId,
  opts?: StructureOptions
): Promise<Scene[]> {
  const sceneCount = opts?.sceneCount ?? 6;
  const sceneDuration = opts?.sceneDuration ?? 5;
  const aspectRatio = opts?.aspectRatio;

  if (sceneCount > CHUNK_THRESHOLD) {
    return generateStructureChunked(idea, templateId, { aspectRatio, sceneCount, sceneDuration });
  }

  return generateStructureChunk(idea, templateId, {
    aspectRatio,
    sceneCount,
    sceneDuration,
    chunkStart: 0,
    chunkSize: sceneCount,
  });
}

// --- Generate SEO Metadata ---

export interface SeoMetadata {
  description: string;
  tags: string[];
}

const seoMetadataSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    description: {
      type: SchemaType.STRING,
      description: "SEO-optimized YouTube video description (150-300 words).",
    },
    tags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "20-30 YouTube tags for discoverability.",
    },
  },
  required: ["description", "tags"],
};

export async function generateSeoMetadata(
  idea: string,
  scenes: { scriptText: string }[],
  opts?: { targetKeywords?: string; sceneCount?: number; sceneDuration?: number }
): Promise<SeoMetadata> {
  const sceneCount = opts?.sceneCount ?? 6;
  const sceneDuration = opts?.sceneDuration ?? 5;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: seoMetadataSchema,
    },
    systemInstruction: generateSeoMetadataPrompt({ sceneCount, sceneDuration }),
  });

  const result = await model.generateContent(
    generateSeoMetadataUserMessage(idea, scenes, opts?.targetKeywords)
  );
  const text = result.response.text();

  const ResponseSchema = z.object({
    description: z.string().min(1),
    tags: z.array(z.string()).min(1),
  });

  const parsed = ResponseSchema.parse(JSON.parse(text));
  return parsed;
}
