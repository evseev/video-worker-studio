import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateTrend } from "@/lib/ai/wizard";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, idea } = await request.json();

    if (!idea) {
      return NextResponse.json(
        { error: "Idea is required" },
        { status: 400 }
      );
    }

    const trendData = await validateTrend(idea);

    if (projectId) {
      await supabase
        .from("projects")
        .update({ 
          trend_validation_data: trendData as any,
          wizard_step: "validation"
        })
        .eq("id", projectId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ trendData });
  } catch (error) {
    console.error("Failed to validate trend:", error);
    return NextResponse.json(
      { error: "Failed to validate trend" },
      { status: 500 }
    );
  }
}
