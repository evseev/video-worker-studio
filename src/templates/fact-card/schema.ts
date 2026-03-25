import { SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";

export const factCardGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    scenes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          scriptText: {
            type: SchemaType.STRING,
            description: "The spoken narration text for this fact-card scene.",
          },
          searchKeywords: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            minItems: 2,
            maxItems: 2,
            description: "Exactly 2 Pinterest search keyword phrases: [mainImageKeyword, secondaryImageKeyword].",
          },
          title: {
            type: SchemaType.STRING,
            description: "The name of the person, place, or subject featured on the card.",
          },
          subtitle: {
            type: SchemaType.STRING,
            description: "A short descriptor of their role, relationship, or category.",
          },
          facts: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                label: {
                  type: SchemaType.STRING,
                  description: "Short fact label (e.g. 'Born', 'Known for', 'Founded').",
                },
                value: {
                  type: SchemaType.STRING,
                  description: "Concise fact value (e.g. '1879', 'Theory of Relativity', '1776').",
                },
              },
              required: ["label", "value"],
            },
            description: "2-3 quick facts about the subject.",
          },
        },
        required: ["scriptText", "searchKeywords", "title", "subtitle", "facts"],
      },
    },
  },
  required: ["scenes"],
};

export const FactCardResponseSchema = z.object({
  scenes: z
    .array(
      z.object({
        scriptText: z.string(),
        searchKeywords: z.array(z.string()).length(2),
        title: z.string(),
        subtitle: z.string(),
        facts: z
          .array(
            z.object({
              label: z.string(),
              value: z.string(),
            })
          )
          .min(2)
          .max(3),
      })
    )
    .min(1),
});

export type FactCardResponse = z.infer<typeof FactCardResponseSchema>;
