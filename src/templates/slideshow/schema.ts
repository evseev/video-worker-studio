import { SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";

export const slideshowGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    scenes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          subjectKey: {
            type: SchemaType.STRING,
            description:
              "Canonical name/identifier of the subject of this scene (e.g. 'Tom Cruise', 'Tokyo', 'Theory of Relativity'). Short, singular, no adjectives.",
          },
          scriptText: {
            type: SchemaType.STRING,
            description: "The spoken narration for this scene (for voiceover). 1-2 full sentences, max 25 words.",
          },
          captionText: {
            type: SchemaType.STRING,
            description: "Short on-screen caption displayed over the image. Visually punchy, 3-8 words. Do NOT repeat the full narration — summarize the single idea of the scene.",
          },
          searchKeyword: {
            type: SchemaType.STRING,
            description: "A single Pinterest search keyword phrase to find a background image.",
          },
        },
        required: ["subjectKey", "scriptText", "captionText", "searchKeyword"],
      },
    },
  },
  required: ["scenes"],
};

export const SlideshowResponseSchema = z.object({
  scenes: z
    .array(
      z.object({
        subjectKey: z.string(),
        scriptText: z.string(),
        captionText: z.string(),
        searchKeyword: z.string(),
      })
    )
    .min(1),
});

export type SlideshowResponse = z.infer<typeof SlideshowResponseSchema>;
