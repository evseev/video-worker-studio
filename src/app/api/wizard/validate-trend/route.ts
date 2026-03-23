import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { validateTrend } from "@/lib/ai/wizard";

export const POST = withAuth(async (request, { user, supabase }) => {
  const { projectId, idea } = await request.json();

  if (!idea) {
    return NextResponse.json({ error: "Idea is required" }, { status: 400 });
  }

  const trendData = await validateTrend(idea);

  if (projectId) {
    await supabase
      .from("projects")
      .update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        trend_validation_data: trendData as any,
        wizard_step: "validation",
      })
      .eq("id", projectId)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ trendData });
}, { rateLimit: "ai" });
