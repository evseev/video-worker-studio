import { NextResponse } from "next/server";
import { generateScript } from "@/lib/ai/generate-script";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { topic } = await req.json();
    if (!topic) {
      return NextResponse.json({ error: "Missing topic" }, { status: 400 });
    }

    const scenes = await generateScript(topic);
    return NextResponse.json({ scenes });
  } catch (err) {
    console.error("Failed to generate script:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
