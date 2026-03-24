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
          scriptText: {
            type: SchemaType.STRING,
            description: "The spoken caption text for this scene (max 15 words, 1-2 sentences).",
          },
          searchKeyword: {
            type: SchemaType.STRING,
            description: "A single Pinterest search keyword phrase to find a background image.",
          },
        },
        required: ["scriptText", "searchKeyword"],
      },
    },
  },
  required: ["scenes"],
};

export const SlideshowResponseSchema = z.object({
  scenes: z
    .array(
      z.object({
        scriptText: z.string(),
        searchKeyword: z.string(),
      })
    )
    .min(1),
});

export type SlideshowResponse = z.infer<typeof SlideshowResponseSchema>;
