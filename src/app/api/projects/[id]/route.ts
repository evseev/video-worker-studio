import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { deleteProjectAssets } from "@/lib/projects/delete-project-assets";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = (await params).id;

    if (!id) {
      return NextResponse.json({ error: "Project ID missing" }, { status: 400 });
    }

    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("id, video_url")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");

    if (deleteError) {
      throw deleteError;
    }

    if (!deletedRows?.length) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { warnings } = await deleteProjectAssets(project.id, project.video_url);
    if (warnings.length > 0) {
      Sentry.captureMessage("Project delete cleanup warnings", {
        level: "warning",
        extra: { projectId: project.id, warnings },
      });
    }

    return NextResponse.json(
      warnings.length > 0 ? { success: true, warnings } : { success: true }
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
