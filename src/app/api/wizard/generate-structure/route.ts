import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateStructure } from "@/lib/ai/wizard";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, idea, template } = await request.json();

    if (!idea || !template) {
      return NextResponse.json(
        { error: "Idea and template are required" },
        { status: 400 }
      );
    }

    const scenes = await generateStructure(idea, template);

    if (projectId) {
      await supabase
        .from("projects")
        .update({ 
          selected_template: template,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          draft_scenes: scenes as any,
          wizard_step: "structure"
        })
        .eq("id", projectId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ scenes });
  } catch (error) {
    console.error("Failed to generate structure:", error);
    return NextResponse.json(
      { error: "Failed to generate structure" },
      { status: 500 }
    );
  }
}
