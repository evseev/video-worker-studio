import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";

export interface SceneScript {
  scriptText: string;
  searchKeyword: string;
}

const SYSTEM_PROMPT = `You are an expert short-form video scriptwriter (TikTok/Reels/Shorts).
Given a user TOPIC, generate a high-retention video script.
The script must be broken into a sequence of scenes.

For each scene, provide:
1. "scriptText": The actual words that will be spoken (used for captions/TTS). Keep each scene to 1-2 short sentences.
2. "searchKeyword": A single, highly descriptive keyword phrase (e.g., "moody cinematic coffee shop desk") that will be passed to a Pinterest image scraper to find the background asset. Make it visual and specific.

RULES:
- Video should be 30-60 seconds (roughly 5-8 scenes).
- Hook the viewer in the first scene with a bold claim or question.
- End with a strong call to action or surprising twist.
- searchKeyword must be descriptive enough to find a beautiful, cinematic image.
- Output MUST match the required JSON schema exactly.`;

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
export async function generateScript(topic: string): Promise<SceneScript[]> {
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
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent(
    `Create a short-form video script about: ${topic}`
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
