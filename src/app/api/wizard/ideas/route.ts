import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { generateIdeasPrompt } from "@/lib/ai/prompts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const IdeaSchema = z.object({
  title: z.string(),
  description: z.string(),
  trendScore: z.number().min(0).max(100),
});

const IdeasResponseSchema = z.object({
  ideas: z.array(IdeaSchema),
});

export const POST = withAuth(
  async (req) => {
    const { topic, sceneCount, sceneDuration } = await req.json();
    if (!topic) {
      return NextResponse.json({ error: "Missing topic" }, { status: 400 });
    }

    const totalDuration = (sceneCount ?? 6) * (sceneDuration ?? 5);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = generateIdeasPrompt({ topic, totalDuration });

    const { response } = await model.generateContent(prompt);
    const jsonStr = response.text();
    const parsed = IdeasResponseSchema.parse(JSON.parse(jsonStr));

    return NextResponse.json(parsed.ideas);
  },
  { rateLimit: "ai" }
);
