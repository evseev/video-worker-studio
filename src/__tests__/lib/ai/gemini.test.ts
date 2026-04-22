import { describe, it, expect, vi } from "vitest";
import type { GenerativeModel } from "@google/generative-ai";
import {
  createGeminiClient,
  getTextModel,
  generateTextOrThrow,
  getEmbeddingModel,
  embedTextOrThrow,
} from "@/lib/ai/gemini";

describe("gemini helpers error paths", () => {
  it("throws when GEMINI_API_KEY is missing", () => {
    expect(() => createGeminiClient(undefined)).toThrow("GEMINI_API_KEY is not set");
  });

  it("wraps text model initialization errors", () => {
    const genAI = {
      getGenerativeModel: vi.fn(() => {
        throw new Error("Unknown model");
      }),
    };

    expect(() =>
      getTextModel({
        genAI: genAI as unknown as Parameters<typeof getTextModel>[0]["genAI"],
      })
    ).toThrow('Invalid Gemini text model "gemini-2.5-flash"');
  });

  it("wraps text generation errors", async () => {
    const model = {
      generateContent: vi.fn(async () => {
        throw new Error("Model not found");
      }),
    };

    await expect(
      generateTextOrThrow(model as unknown as GenerativeModel, "hello")
    ).rejects.toThrow('Gemini text generation failed using model "gemini-2.5-flash"');
  });

  it("wraps embedding model initialization errors", () => {
    const genAI = {
      getGenerativeModel: vi.fn(() => {
        throw new Error("Unknown embedding model");
      }),
    };

    expect(() =>
      getEmbeddingModel(genAI as unknown as Parameters<typeof getEmbeddingModel>[0])
    ).toThrow('Invalid Gemini embedding model "text-embedding-004"');
  });

  it("wraps embedding call errors", async () => {
    const model = {
      embedContent: vi.fn(async () => {
        throw new Error("Embedding unavailable");
      }),
    };

    await expect(
      embedTextOrThrow(model as unknown as GenerativeModel, "hello")
    ).rejects.toThrow('Gemini embedding failed using model "text-embedding-004"');
  });
});
