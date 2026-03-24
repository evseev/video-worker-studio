import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";
import {
  enhanceIdeaPrompt,
  validateTrendPrompt,
  generateStructurePrompt,
  generateStructureUserMessage,
} from "./prompts";

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

export interface SceneScript {
  scriptText: string;
  searchKeyword: string;
}

const structureSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    scenes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          scriptText: {
            type: SchemaType.STRING,
            description: "The spoken text for this scene.",
          },
          searchKeyword: {
            type: SchemaType.STRING,
            description: "Pinterest search query to find a cinematic background image.",
          },
        },
        required: ["scriptText", "searchKeyword"],
      },
    },
  },
  required: ["scenes"],
};

export async function generateStructure(
  idea: string,
  template: string,
  opts?: { aspectRatio?: string; sceneCount?: number; sceneDuration?: number }
): Promise<SceneScript[]> {
  const sceneCount = opts?.sceneCount ?? 6;
  const sceneDuration = opts?.sceneDuration ?? 5;
  const aspectRatio = opts?.aspectRatio;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: structureSchema,
    },
    systemInstruction: generateStructurePrompt({ sceneCount, sceneDuration, aspectRatio }),
  });

  const result = await model.generateContent(generateStructureUserMessage(idea, template, aspectRatio));
  const text = result.response.text();

  const SceneSchema = z.object({
    scriptText: z.string(),
    searchKeyword: z.string(),
  });
  const ResponseSchema = z.object({
    scenes: z.array(SceneSchema).min(1),
  });

  const parsed = ResponseSchema.parse(JSON.parse(text));
  return parsed.scenes;
}
