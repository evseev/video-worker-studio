import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";
import { generateScriptPrompt } from "./prompts";

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
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
    systemInstruction: generateScriptPrompt(opts),
  });

  const result = await model.generateContent(
    `Create a video script about: ${topic}`
  );

  const text = result.response.text();

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
