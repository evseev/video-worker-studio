import { SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";
import {
  enhanceIdeaPrompt,
  validateTrendPrompt,
  generateSeoMetadataPrompt,
  generateSeoMetadataUserMessage,
  planSubjectsPrompt,
  planSubjectsUserMessage,
  type ChannelContext,
} from "./prompts";
import type { Scene, TemplateId } from "@/templates/types";
import { buildSlideshowPrompt, slideshowGeminiSchema, SlideshowResponseSchema } from "@/templates/slideshow";
import { buildComparisonPrompt, comparisonGeminiSchema, ComparisonResponseSchema } from "@/templates/comparison";
import { buildFactCardPrompt, factCardGeminiSchema, FactCardResponseSchema } from "@/templates/fact-card";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { normalizeSubject } from "@/lib/ai/dedupe";
import { filterScenesAgainstChannelMemory } from "@/lib/ai/wizard-structure-chunk-filter";
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
/**
 * Hard ceiling on chunk API calls per structure generation. Without it, an unusually
 * narrow topic (e.g. "10 famous left-handed astronauts") could loop forever asking the
 * model for distinct subjects it doesn't know.
 *
 * Formula: enough budget for ~2× the optimistic call count, plus a small constant.
 */
function chunkCallBudget(sceneCount: number): number {
  return Math.ceil((sceneCount * 2) / CHUNK_SIZE) + 4;
}

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

export type StructureChunkRequest = {
  idea: string;
  templateId: TemplateId;
  aspectRatio?: string;
  sceneCount: number;
  sceneDuration: number;
  chunkStart: number;
  chunkSize: number;
  excludeSubjects?: string[];
  /**
   * When set, the model is told to write exactly one scene per subject in this list,
   * in order. The returned scenes are aligned back to these subjects and `subjectKey`
   * is forced to match — defeats the model's tendency to converge on a small set of
   * "obvious" subjects when free-form chunked generation is used.
   */
  assignedSubjects?: string[];
  channelContext?: ChannelContext;
};

async function defaultGenerateStructureChunk(req: StructureChunkRequest): Promise<Scene[]> {
  const ai = getTemplateAI(req.templateId);
  const hasAssigned = (req.assignedSubjects?.length ?? 0) > 0;
  const effectiveSceneCount = hasAssigned ? req.assignedSubjects!.length : req.chunkSize;

  const model = getTextModel({
    genAI,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ai.geminiSchema,
    },
    systemInstruction: ai.buildPrompt({
      sceneCount: effectiveSceneCount,
      sceneDuration: req.sceneDuration,
      aspectRatio: req.aspectRatio,
      // When subjects are positively assigned, exclude lists become noise.
      excludeSubjects: hasAssigned ? undefined : req.excludeSubjects,
      channelContext: req.channelContext,
    }),
  });

  const userLines: string[] = [
    `Idea: ${req.idea}`,
    `Video orientation: ${req.aspectRatio === "16:9" ? "landscape" : "portrait"}`,
    `Generate scenes ${req.chunkStart + 1} to ${req.chunkStart + effectiveSceneCount} out of ${req.sceneCount}.`,
  ];
  if (hasAssigned) {
    userLines.push(
      "",
      `ASSIGNED SUBJECTS — generate exactly ${req.assignedSubjects!.length} scene(s), one per subject below, in this exact order:`,
      ...req.assignedSubjects!.map((s, i) => `${i + 1}. ${s}`),
      "",
      "For each scene, the `subjectKey` field MUST be the assigned subject's name verbatim. The `scriptText`, `captionText`, and `searchKeywords` must describe THAT specific subject. Do not substitute, merge, or skip subjects."
    );
  }

  const text = await generateTextOrThrow(model, userLines.join("\n"));
  const parsed = ai.zodSchema.parse(JSON.parse(text));
  return parsed.scenes.map((raw: unknown) => toScene(req.templateId, raw as Record<string, unknown>));
}

/**
 * Aligns raw scenes from a chunk generator back to a list of assigned subjects.
 *
 * Strategy: prefer exact (normalized) subjectKey match; fall back to positional. The
 * returned scene's `subjectKey` is forced to the canonical assigned name so downstream
 * dedup and persistence see a stable identifier.
 *
 * Returns the aligned scenes (in assigned order, length ≤ `assignedSubjects.length`)
 * plus the list of subjects with no candidate match — the caller can retry those.
 */
function alignScenesToAssignedSubjects(
  scenes: Scene[],
  assignedSubjects: string[]
): { aligned: Scene[]; missing: string[] } {
  const byNormalized = new Map<string, Scene>();
  for (const s of scenes) {
    const norm = normalizeSubject(s.subjectKey);
    if (norm && !byNormalized.has(norm)) byNormalized.set(norm, s);
  }
  const positional = [...scenes];
  const aligned: Scene[] = [];
  const missing: string[] = [];
  for (const subject of assignedSubjects) {
    const norm = normalizeSubject(subject);
    const named = norm ? byNormalized.get(norm) : undefined;
    if (named) {
      byNormalized.delete(norm);
      const posIdx = positional.indexOf(named);
      if (posIdx >= 0) positional.splice(posIdx, 1);
      aligned.push({ ...named, subjectKey: subject });
      continue;
    }
    const fallback = positional.shift();
    if (fallback) {
      aligned.push({ ...fallback, subjectKey: subject });
    } else {
      missing.push(subject);
    }
  }
  return { aligned, missing };
}

type ChunkedRunOptions = {
  aspectRatio?: string;
  sceneCount: number;
  sceneDuration: number;
  excludeSubjects?: string[];
  channelContext?: ChannelContext;
  /** Test-only injection point. */
  chunkGenerator?: (req: StructureChunkRequest) => Promise<Scene[]>;
};

/**
 * Builds the final scene list by iterating chunk calls until we hit `sceneCount` distinct
 * subjects (or exhaust the chunk-call budget). Each iteration:
 *   - over-requests a small buffer to absorb Gemini's typical undershoot,
 *   - drops scenes whose subject duplicates earlier chunks (or earlier scenes in *this* chunk),
 *   - feeds accepted subjects into the next prompt's `excludeSubjects` list.
 *
 * Replaces the prior fixed-grid loop (`chunkStart += CHUNK_SIZE`) that ignored dedup
 * shortfalls and frequently shipped fewer scenes than requested.
 */
export async function generateStructureChunked(
  idea: string,
  templateId: TemplateId,
  opts: ChunkedRunOptions
): Promise<Scene[]> {
  const acceptedScenes: Scene[] = [];
  const channelNormalizedExcludes = new Set(
    (opts.excludeSubjects ?? []).map(normalizeSubject).filter(Boolean)
  );
  const inRunNormalizedAccepted = new Set<string>();
  /** Subjects the model must avoid (channel memory + already-accepted subjects). */
  const subjectsBannedInPrompt = new Set(opts.excludeSubjects ?? []);

  const callChunk = opts.chunkGenerator ?? defaultGenerateStructureChunk;
  const maxCalls = chunkCallBudget(opts.sceneCount);
  /** Two consecutive empty chunks ⇒ model has nothing new to offer; bail out. */
  const maxConsecutiveZeroProgress = 1;
  let calls = 0;
  let consecutiveZero = 0;

  while (acceptedScenes.length < opts.sceneCount && calls < maxCalls) {
    const remaining = opts.sceneCount - acceptedScenes.length;
    // Over-request by a small buffer so a stochastic 1-scene shortfall doesn't force a top-up call.
    const chunkSize = Math.max(1, Math.min(CHUNK_SIZE, remaining + 2));
    calls += 1;

    const generated = await callChunk({
      idea,
      templateId,
      aspectRatio: opts.aspectRatio,
      sceneCount: opts.sceneCount,
      sceneDuration: opts.sceneDuration,
      chunkStart: acceptedScenes.length,
      chunkSize,
      excludeSubjects: Array.from(subjectsBannedInPrompt),
      channelContext: opts.channelContext,
    });

    const filtered = filterScenesAgainstChannelMemory(
      generated,
      channelNormalizedExcludes,
      acceptedScenes.length,
      inRunNormalizedAccepted
    );

    const before = acceptedScenes.length;
    const take = Math.min(remaining, filtered.uniqueScenes.length);
    for (let i = 0; i < take; i += 1) {
      const scene = filtered.uniqueScenes[i];
      const norm = filtered.acceptedNormalized[i];
      acceptedScenes.push(scene);
      if (norm) {
        inRunNormalizedAccepted.add(norm);
        subjectsBannedInPrompt.add(scene.subjectKey);
      }
    }

    if (acceptedScenes.length === before) {
      consecutiveZero += 1;
      if (consecutiveZero > maxConsecutiveZeroProgress) break;
    } else {
      consecutiveZero = 0;
    }
  }

  return acceptedScenes.slice(0, opts.sceneCount);
}

// --- Subject Planning (plan-then-script for high-count videos) -------------------------

const planSubjectsSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    subjects: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Distinct subject names for the video — short canonical names, 1-5 words each.",
    },
  },
  required: ["subjects"],
};

const PlanSubjectsResponseSchema = z.object({
  subjects: z.array(z.string()).min(1),
});

/**
 * Different angle hints used across successive planning attempts. The first pass uses the
 * default broad framing; subsequent passes push the model toward lesser-known and niche
 * examples to surface fresh subjects beyond its first-instinct convergence point.
 */
const PLAN_SUBJECTS_ANGLE_HINTS: string[] = [
  "Include a comprehensive mix of well-known headline names AND less-obvious, lesser-cited examples. Cover multiple sub-angles of the topic.",
  "Focus on lesser-known, less obvious examples this round. Avoid the most popular, viral, or A-list names. Surface B-list, niche, or historically overlooked figures that still fit the topic.",
  "Branch into different sub-categories and international examples. Include voices from underrepresented regions, eras, sub-disciplines, or angles that mainstream coverage tends to skip.",
];

export type SubjectPlanRequest = {
  idea: string;
  askFor: number;
  sceneCount: number;
  sceneDuration: number;
  excludeSubjects: string[];
  angleHint: string;
  channelContext?: ChannelContext;
};

async function defaultPlanSubjectsCall(req: SubjectPlanRequest): Promise<string[]> {
  const model = getTextModel({
    genAI,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: planSubjectsSchema,
    },
    systemInstruction: planSubjectsPrompt({
      sceneCount: req.sceneCount,
      sceneDuration: req.sceneDuration,
      channelContext: req.channelContext,
      angleHint: req.angleHint,
    }),
  });
  const text = await generateTextOrThrow(
    model,
    planSubjectsUserMessage({
      idea: req.idea,
      askFor: req.askFor,
      excludeSubjects: req.excludeSubjects,
    })
  );
  const parsed = PlanSubjectsResponseSchema.parse(JSON.parse(text));
  return parsed.subjects;
}

export type PlanSubjectsOptions = {
  idea: string;
  sceneCount: number;
  sceneDuration: number;
  channelExcludes: string[];
  channelContext?: ChannelContext;
  /** Test injection point. */
  planSubjectsCall?: (req: SubjectPlanRequest) => Promise<string[]>;
};

/**
 * Plans a list of `sceneCount` distinct subjects via 1-3 LLM calls with rotating angle hints.
 *
 * Returns up to `sceneCount` subjects; may return fewer if the model truly can't enumerate
 * more (genuinely narrow topic). The caller decides how to handle a shortfall.
 */
export async function planSubjects(opts: PlanSubjectsOptions): Promise<string[]> {
  const callPlan = opts.planSubjectsCall ?? defaultPlanSubjectsCall;
  const channelExcludedNormalized = new Set(
    opts.channelExcludes.map(normalizeSubject).filter(Boolean)
  );
  const acceptedNormalized = new Set<string>();
  const accepted: string[] = [];

  for (let attempt = 0; attempt < PLAN_SUBJECTS_ANGLE_HINTS.length && accepted.length < opts.sceneCount; attempt += 1) {
    const need = opts.sceneCount - accepted.length;
    // Ask for at least 40% headroom so dedup losses don't force another call.
    const askFor = Math.max(need + 4, Math.ceil(need * 1.4));

    let list: string[];
    try {
      list = await callPlan({
        idea: opts.idea,
        askFor,
        sceneCount: opts.sceneCount,
        sceneDuration: opts.sceneDuration,
        excludeSubjects: [...opts.channelExcludes, ...accepted],
        angleHint: PLAN_SUBJECTS_ANGLE_HINTS[attempt],
        channelContext: opts.channelContext,
      });
    } catch {
      // A single failed planning call shouldn't abort the whole video; try the next angle.
      continue;
    }

    const beforeCount = accepted.length;
    for (const raw of list) {
      const trimmed = raw.trim();
      const norm = normalizeSubject(trimmed);
      if (!norm) continue;
      if (channelExcludedNormalized.has(norm)) continue;
      if (acceptedNormalized.has(norm)) continue;
      acceptedNormalized.add(norm);
      accepted.push(trimmed);
      if (accepted.length >= opts.sceneCount) break;
    }

    // If the angle hint produced zero new subjects, the next angle still gets to try once.
    if (accepted.length === beforeCount && attempt === PLAN_SUBJECTS_ANGLE_HINTS.length - 1) {
      break;
    }
  }

  return accepted.slice(0, opts.sceneCount);
}

// --- Planned (plan-then-script) structure generation -----------------------------------

const PLANNED_BATCH_SIZE = 8;
const PLANNED_BATCH_MAX_RETRIES = 1;

type PlannedRunOptions = {
  aspectRatio?: string;
  sceneCount: number;
  sceneDuration: number;
  excludeSubjects?: string[];
  channelContext?: ChannelContext;
  /** Test-only injection points. */
  planSubjectsCall?: (req: SubjectPlanRequest) => Promise<string[]>;
  chunkGenerator?: (req: StructureChunkRequest) => Promise<Scene[]>;
};

/**
 * Two-phase generator for high-count videos:
 *   1. Plan a list of distinct subjects (1-3 small LLM calls).
 *   2. For each batch of subjects, ask the LLM to write the scene-level fields with the
 *      subjects pre-assigned — so the model can't drift, can't repeat, and can't fall back
 *      to its converged "obvious" subject set.
 *
 * Subjects that the per-batch model fails to write a scene for are retried up to
 * `PLANNED_BATCH_MAX_RETRIES` times before being dropped.
 */
export async function generateStructurePlanned(
  idea: string,
  templateId: TemplateId,
  opts: PlannedRunOptions
): Promise<Scene[]> {
  const callChunk = opts.chunkGenerator ?? defaultGenerateStructureChunk;
  const channelExcludes = opts.excludeSubjects ?? [];

  const plannedSubjects = await planSubjects({
    idea,
    sceneCount: opts.sceneCount,
    sceneDuration: opts.sceneDuration,
    channelExcludes,
    channelContext: opts.channelContext,
    planSubjectsCall: opts.planSubjectsCall,
  });

  if (plannedSubjects.length === 0) {
    return [];
  }

  const scenes: Scene[] = [];
  for (let i = 0; i < plannedSubjects.length; i += PLANNED_BATCH_SIZE) {
    const batch = plannedSubjects.slice(i, i + PLANNED_BATCH_SIZE);
    let pending = [...batch];
    const batchResult: Scene[] = [];

    for (let attempt = 0; attempt <= PLANNED_BATCH_MAX_RETRIES && pending.length > 0; attempt += 1) {
      const generated = await callChunk({
        idea,
        templateId,
        aspectRatio: opts.aspectRatio,
        sceneCount: opts.sceneCount,
        sceneDuration: opts.sceneDuration,
        chunkStart: scenes.length + batchResult.length,
        chunkSize: pending.length,
        assignedSubjects: pending,
        channelContext: opts.channelContext,
      });

      const { aligned, missing } = alignScenesToAssignedSubjects(generated, pending);
      batchResult.push(...aligned);
      pending = missing;
    }

    scenes.push(...batchResult);
  }

  return scenes;
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
    return generateStructurePlanned(idea, templateId, {
      aspectRatio,
      sceneCount,
      sceneDuration,
      excludeSubjects: crossVideoExcludes,
      channelContext: opts?.channelContext,
    });
  }

  return defaultGenerateStructureChunk({
    idea,
    templateId,
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
