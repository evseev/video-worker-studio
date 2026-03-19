import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";

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

export async function enhanceIdea(rawIdea: string): Promise<string[]> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: enhanceIdeaSchema,
    },
    systemInstruction: `You are an expert TikTok/Creative Director. 
The user has a rough idea for a short-form video. Transform it into 3 highly engaging, specific, and viral hooks/concepts. Keep each idea under 2 sentences.`,
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
    systemInstruction: `You are a social media trend analyst.
Score the viral potential of the given video idea on a scale of 0-100.
Provide a brief reasoning and suggest up to 2 hooks.`,
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

export async function generateStructure(idea: string, template: string): Promise<SceneScript[]> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: structureSchema,
    },
    systemInstruction: `You are an expert short-form video scriptwriter.
Given an idea and a visual template/style, generate a 5-8 scene script.
Each scene needs spoken text (short) and a visual search keyword for Pinterest that matches the template style (e.g. if template is 'dark mode', make sure the keyword includes 'dark').
RULES:
- Video should be 30-60 seconds.
- Hook in scene 1.
- Output MUST match the required JSON schema.`
  });

  const result = await model.generateContent(`Idea: ${idea}\nTemplate/Style: ${template}`);
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
