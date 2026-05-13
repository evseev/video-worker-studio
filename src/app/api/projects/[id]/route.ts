import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { deleteProjectByOwner } from "@/lib/projects/delete-project-by-owner";

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

    const result = await deleteProjectByOwner(supabase, user.id, id);
    if (!result.ok) {
      if (result.error === "not_found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      throw new Error(result.error);
    }

    const { warnings } = result;
    if (warnings.length > 0) {
      Sentry.captureMessage("Project delete cleanup warnings", {
        level: "warning",
        extra: { projectId: id, warnings },
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
