import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: Request) {
  try {
    const { projectId, topic } = await request.json();

    if (!projectId || !topic) {
      return NextResponse.json(
        { error: "Missing projectId or topic" },
        { status: 400 }
      );
    }

    // Send event to Inngest which triggers the VideoGenerationWorker
    await inngest.send({
      name: "video/generate",
      data: { projectId, topic },
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
