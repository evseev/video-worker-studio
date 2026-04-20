import { SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";

export const comparisonGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    scenes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          scriptText: {
            type: SchemaType.STRING,
            description: "The spoken narration describing the comparison (for voiceover). 1-2 full sentences.",
          },
          captionText: {
            type: SchemaType.STRING,
            description: "Short on-screen caption identifying the subject of this scene (e.g. a full name, a year, or a single concept). 2-6 words. Do NOT include the full narration — just the subject being compared.",
          },
          searchKeywords: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            minItems: 2,
            maxItems: 2,
            description: "Exactly 2 Pinterest search keyword phrases: [leftImageKeyword, rightImageKeyword].",
          },
          leftLabel: {
            type: SchemaType.STRING,
            description: "Short label for the left side (e.g. 'Before', '1990', 'Budget').",
          },
          rightLabel: {
            type: SchemaType.STRING,
            description: "Short label for the right side (e.g. 'After', '2024', 'Luxury').",
          },
        },
        required: ["scriptText", "captionText", "searchKeywords", "leftLabel", "rightLabel"],
      },
    },
  },
  required: ["scenes"],
};

export const ComparisonResponseSchema = z.object({
  scenes: z
    .array(
      z.object({
        scriptText: z.string(),
        captionText: z.string(),
        searchKeywords: z.array(z.string()).length(2),
        leftLabel: z.string(),
        rightLabel: z.string(),
      })
    )
    .min(1),
});

export type ComparisonResponse = z.infer<typeof ComparisonResponseSchema>;
