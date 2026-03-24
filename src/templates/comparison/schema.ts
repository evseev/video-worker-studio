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
            description: "The spoken text describing the comparison for this scene.",
          },
          searchKeywords: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
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
        required: ["scriptText", "searchKeywords", "leftLabel", "rightLabel"],
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
        searchKeywords: z.array(z.string()).length(2),
        leftLabel: z.string(),
        rightLabel: z.string(),
      })
    )
    .min(1),
});

export type ComparisonResponse = z.infer<typeof ComparisonResponseSchema>;
