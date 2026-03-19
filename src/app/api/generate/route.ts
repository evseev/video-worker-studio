import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, topic, scenes, template } = await request.json();

    if (!projectId || (!topic && !scenes)) {
      return NextResponse.json(
        { error: "Missing projectId, topic, or scenes" },
        { status: 400 }
      );
    }

    // Send event to Inngest which triggers the VideoGenerationWorker
    await inngest.send({
      name: "video/generate",
      data: { projectId, topic, scenes, template },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to trigger generation:", error);
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    );
  }
}
