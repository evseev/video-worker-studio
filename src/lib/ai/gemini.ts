import { GoogleGenerativeAI, type GenerativeModel, type GenerationConfig } from "@google/generative-ai";

export const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";
export const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004";

export function createGeminiClient(apiKey?: string): GoogleGenerativeAI {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenerativeAI(apiKey);
}

export function getTextModel(params: {
  genAI: GoogleGenerativeAI;
  generationConfig?: GenerationConfig;
  systemInstruction?: string;
}): GenerativeModel {
  try {
    return params.genAI.getGenerativeModel({
      model: GEMINI_TEXT_MODEL,
      generationConfig: params.generationConfig,
      systemInstruction: params.systemInstruction,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Gemini model initialization error";
    throw new Error(
      `Invalid Gemini text model "${GEMINI_TEXT_MODEL}". Set GEMINI_TEXT_MODEL to a valid model. Original error: ${message}`
    );
  }
}

export async function generateTextOrThrow(model: GenerativeModel, content: string): Promise<string> {
  try {
    const result = await model.generateContent(content);
    return result.response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Gemini generation error";
    throw new Error(
      `Gemini text generation failed using model "${GEMINI_TEXT_MODEL}". Verify GEMINI_TEXT_MODEL is valid. Original error: ${message}`
    );
  }
}

export function getEmbeddingModel(genAI: GoogleGenerativeAI): GenerativeModel {
  try {
    return genAI.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Gemini model initialization error";
    throw new Error(
      `Invalid Gemini embedding model "${GEMINI_EMBEDDING_MODEL}". Set GEMINI_EMBEDDING_MODEL to a valid model. Original error: ${message}`
    );
  }
}

export async function embedTextOrThrow(model: GenerativeModel, text: string): Promise<number[] | null> {
  try {
    const result = await model.embedContent(text);
    return result.embedding.values ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Gemini embedding error";
    throw new Error(
      `Gemini embedding failed using model "${GEMINI_EMBEDDING_MODEL}". Verify GEMINI_EMBEDDING_MODEL is valid. Original error: ${message}`
    );
  }
}
