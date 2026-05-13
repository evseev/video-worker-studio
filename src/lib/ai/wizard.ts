import { SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";
import {
  enhanceIdeaPrompt,
  validateTrendPrompt,
  generateSeoMetadataPrompt,
  generateSeoMetadataUserMessage,
  type ChannelContext,
} from "./prompts";
import type { Scene, TemplateId } from "@/templates/types";
import { buildSlideshowPrompt, slideshowGeminiSchema, SlideshowResponseSchema } from "@/templates/slideshow";
import { buildComparisonPrompt, comparisonGeminiSchema, ComparisonResponseSchema } from "@/templates/comparison";
import { buildFactCardPrompt, factCardGeminiSchema, FactCardResponseSchema } from "@/templates/fact-card";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { normalizeSubject } from "@/lib/ai/dedupe";
import { getExcludedSubjectsForChannel } from "@/lib/ai/subject-memory";
import { createGeminiClient, generateTextOrThrow, getTextModel } from "@/lib/ai/gemini";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = createGeminiClient(apiKey);

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

export async function enhanceIdea(
  rawIdea: string,
  opts?: { totalDuration?: number; channelContext?: ChannelContext }
): Promise<string[]> {
  const model = getTextModel({
    genAI,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: enhanceIdeaSchema,
    },
    systemInstruction: enhanceIdeaPrompt({
      totalDuration: opts?.totalDuration,
      channelContext: opts?.channelContext,
    }),
  });

  const text = await generateTextOrThrow(model, `Raw idea: ${rawIdea}`);

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

export async function validateTrend(
  idea: string,
  opts?: { channelContext?: ChannelContext }
): Promise<TrendValidation> {
  const model = getTextModel({
    genAI,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: validateTrendSchema,
    },
    // In a real app we might use Grounding with Google Search here
    systemInstruction: validateTrendPrompt(opts?.channelContext),
  });

  const text = await generateTextOrThrow(model, `Idea: ${idea}`);

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
        subjectKey: raw.subjectKey as string,
        scriptText: raw.scriptText as string,
        captionText,
        searchKeywords: [raw.searchKeyword as string],
        assets: [{}],
      };
    case "comparison":
      return {
        template: "comparison",
        subjectKey: raw.subjectKey as string,
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
        subjectKey: raw.subjectKey as string,
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

type StructureOptions = {
  aspectRatio?: string;
  sceneCount?: number;
  sceneDuration?: number;
  /** When set with `channelId`, loads channel-scoped subject exclusions. */
  supabase?: SupabaseClient<Database>;
  channelId?: string;
  crossVideoExcludes?: string[];
  channelContext?: ChannelContext;
};

async function generateStructureChunk(
  idea: string,
  templateId: TemplateId,
  opts: {
    aspectRatio?: string;
    sceneCount: number;
    sceneDuration: number;
    chunkStart: number;
    chunkSize: number;
    excludeSubjects?: string[];
    channelContext?: ChannelContext;
  }
): Promise<Scene[]> {
  const ai = getTemplateAI(templateId);
  const model = getTextModel({
    genAI,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ai.geminiSchema,
    },
    systemInstruction: ai.buildPrompt({
      sceneCount: opts.chunkSize,
      sceneDuration: opts.sceneDuration,
      aspectRatio: opts.aspectRatio,
      excludeSubjects: opts.excludeSubjects,
      channelContext: opts.channelContext,
    }),
  });

  const text = await generateTextOrThrow(
    model,
    [
      `Idea: ${idea}`,
      `Video orientation: ${opts.aspectRatio === "16:9" ? "landscape" : "portrait"}`,
      `This is chunk ${Math.floor(opts.chunkStart / CHUNK_SIZE) + 1} of ${Math.ceil(opts.sceneCount / CHUNK_SIZE)}.`,
      `Generate scenes ${opts.chunkStart + 1} to ${opts.chunkStart + opts.chunkSize} out of ${opts.sceneCount}.`,
    ].join("\n")
  );
  const parsed = ai.zodSchema.parse(JSON.parse(text));
  return parsed.scenes.map((raw: unknown) => toScene(templateId, raw as Record<string, unknown>));
}

function filterUniqueScenes(scenes: Scene[], seenSubjects: Set<string>): { uniqueScenes: Scene[]; droppedCount: number } {
  const workingSeen = new Set(seenSubjects);
  const uniqueScenes: Scene[] = [];
  let droppedCount = 0;
  for (const scene of scenes) {
    const normalized = normalizeSubject(scene.subjectKey);
    if (!normalized || workingSeen.has(normalized)) {
      droppedCount += 1;
      continue;
    }
    workingSeen.add(normalized);
    uniqueScenes.push(scene);
  }
  return { uniqueScenes, droppedCount };
}

async function generateStructureChunked(
  idea: string,
  templateId: TemplateId,
  opts: {
    aspectRatio?: string;
    sceneCount: number;
    sceneDuration: number;
    excludeSubjects?: string[];
    channelContext?: ChannelContext;
  }
): Promise<Scene[]> {
  const chunks: Scene[] = [];
  const seenSubjects = new Set((opts.excludeSubjects ?? []).map(normalizeSubject).filter(Boolean));
  for (let chunkStart = 0; chunkStart < opts.sceneCount; chunkStart += CHUNK_SIZE) {
    const chunkSize = Math.min(CHUNK_SIZE, opts.sceneCount - chunkStart);
    const excludeSubjects = Array.from(seenSubjects);
    const firstPassScenes = await generateStructureChunk(idea, templateId, {
      ...opts,
      chunkStart,
      chunkSize,
      excludeSubjects,
    });
    const firstPass = filterUniqueScenes(firstPassScenes, seenSubjects);
    let { uniqueScenes } = firstPass;
    const { droppedCount } = firstPass;

    if (droppedCount > 1) {
      const retryScenes = await generateStructureChunk(idea, templateId, {
        ...opts,
        chunkStart,
        chunkSize,
        excludeSubjects: Array.from(seenSubjects),
      });
      ({ uniqueScenes } = filterUniqueScenes(retryScenes, seenSubjects));
    }

    for (const scene of uniqueScenes) {
      const normalized = normalizeSubject(scene.subjectKey);
      if (normalized) {
        seenSubjects.add(normalized);
      }
    }
    chunks.push(...uniqueScenes.slice(0, chunkSize));
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
  const crossVideoExcludes =
    opts?.crossVideoExcludes ??
    (opts?.supabase && opts?.channelId
      ? await getExcludedSubjectsForChannel(opts.supabase, opts.channelId, idea)
      : []);

  if (sceneCount > CHUNK_THRESHOLD) {
    return generateStructureChunked(idea, templateId, {
      aspectRatio,
      sceneCount,
      sceneDuration,
      excludeSubjects: crossVideoExcludes,
      channelContext: opts?.channelContext,
    });
  }

  return generateStructureChunk(idea, templateId, {
    aspectRatio,
    sceneCount,
    sceneDuration,
    chunkStart: 0,
    chunkSize: sceneCount,
    excludeSubjects: crossVideoExcludes,
    channelContext: opts?.channelContext,
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
  opts?: {
    targetKeywords?: string;
    sceneCount?: number;
    sceneDuration?: number;
    channelContext?: ChannelContext;
  }
): Promise<SeoMetadata> {
  const sceneCount = opts?.sceneCount ?? 6;
  const sceneDuration = opts?.sceneDuration ?? 5;

  const model = getTextModel({
    genAI,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: seoMetadataSchema,
    },
    systemInstruction: generateSeoMetadataPrompt({
      sceneCount,
      sceneDuration,
      channelContext: opts?.channelContext,
    }),
  });

  const text = await generateTextOrThrow(
    model,
    generateSeoMetadataUserMessage(idea, scenes, opts?.targetKeywords)
  );

  const ResponseSchema = z.object({
    description: z.string().min(1),
    tags: z.array(z.string()).min(1),
  });

  const parsed = ResponseSchema.parse(JSON.parse(text));
  return parsed;
}
