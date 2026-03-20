import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { generateScript } from "@/lib/ai/generate-script";

export const POST = withAuth(async (req) => {
  const { topic, sceneCount } = await req.json();
  if (!topic) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }

  const scenes = await generateScript(topic, sceneCount);
  return NextResponse.json({ scenes });
}, { rateLimit: "ai" });
