import { SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";
import { generateScriptPrompt } from "./prompts";
import { createGeminiClient, generateTextOrThrow, getTextModel } from "@/lib/ai/gemini";

export interface SceneScript {
  scriptText: string;
  searchKeyword: string;
}

const responseSchema: Schema = {
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
            description:
              "Pinterest search query to find a cinematic background image.",
          },
        },
        required: ["scriptText", "searchKeyword"],
      },
    },
  },
  required: ["scenes"],
};

/**
 * Calls Gemini to generate a video script broken into scenes.
 */
export async function generateScript(
  topic: string,
  opts?: { sceneCount?: number; sceneDuration?: number }
): Promise<SceneScript[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = createGeminiClient(apiKey);
  const model = getTextModel({
    genAI,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
    systemInstruction: generateScriptPrompt(opts),
  });
  const text = await generateTextOrThrow(model, `Create a video script about: ${topic}`);

  // Validate LLM output at the trust boundary before anything hits the DB
  const SceneSchema = z.object({
    scriptText: z.string().min(1, "scriptText must not be empty"),
    searchKeyword: z.string().min(1, "searchKeyword must not be empty"),
  });
  const ResponseSchema = z.object({
    scenes: z.array(SceneSchema).min(1, "scenes array must not be empty"),
  });

  const parsed = ResponseSchema.parse(JSON.parse(text));

  return parsed.scenes;
}
