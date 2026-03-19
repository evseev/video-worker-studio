import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
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
      "trendScore": 95 // A number out of 100
    }
  ]
}`;

    const { response } = await model.generateContent(prompt);
    const jsonStr = response.text();
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data.ideas || []);
  } catch (err) {
    console.error("Failed to generate ideas:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
