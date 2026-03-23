import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

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
    const { topic } = await req.json();
    if (!topic) {
      return NextResponse.json({ error: "Missing topic" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `You are a viral social media video expert.

The user wants to make a short-form video about: "${topic}".
Please suggest 3 viral angles/hooks for this topic.

Format your response as a JSON object with this shape:
{
  "ideas": [
    {
      "title": "A short catchy title for the angle",
      "description": "A 1-2 sentence description of what the video is about.",
      "trendScore": 95
    }
  ]
}`;

    const { response } = await model.generateContent(prompt);
    const jsonStr = response.text();
    const parsed = IdeasResponseSchema.parse(JSON.parse(jsonStr));

    return NextResponse.json(parsed.ideas);
  },
  { rateLimit: "ai" }
);
