import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { generateIdeasPrompt } from "@/lib/ai/prompts";
import {
  SCENE_COUNT_MIN,
  SCENE_COUNT_MAX,
  SCENE_DURATION_MIN,
  SCENE_DURATION_MAX,
} from "@/lib/video-constraints";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const IdeaSchema = z.object({
  title: z.string(),
  description: z.string(),
  trendScore: z.number().min(0).max(100),
});

const IdeasResponseSchema = z.object({
  ideas: z.array(IdeaSchema),
});

const IdeasRequestSchema = z.object({
  topic: z.string().min(1, "Missing topic"),
  sceneCount: z.number().int().min(SCENE_COUNT_MIN).max(SCENE_COUNT_MAX).optional(),
  sceneDuration: z.number().int().min(SCENE_DURATION_MIN).max(SCENE_DURATION_MAX).optional(),
});

export const POST = withAuth(
  async (req) => {
    const payload = await req.json();
    const parsedReq = IdeasRequestSchema.safeParse(payload);
    if (!parsedReq.success) {
      return NextResponse.json({ error: parsedReq.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
    }
    const { topic, sceneCount, sceneDuration } = parsedReq.data;

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
