import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export const POST = withAuth(async (request, { user, supabase }) => {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;

  if (!file || !projectId) {
    return NextResponse.json(
      { error: "file and projectId are required" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File must be under 50MB" },
      { status: 400 }
    );
  }

  if (!file.type.match(/^audio\/(mpeg|wav|mp3|x-wav)$/)) {
    return NextResponse.json(
      { error: "Only MP3 and WAV files are allowed" },
      { status: 400 }
    );
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const ext = file.name.split(".").pop() || "mp3";
  const storagePath = `voiceovers/${projectId}.${ext}`;

  const { error } = await supabase.storage
    .from("renders")
    .upload(storagePath, file, { upsert: true });

  if (error) {
    return NextResponse.json(
      { error: "Upload failed: " + error.message },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage
    .from("renders")
    .getPublicUrl(storagePath);

  return NextResponse.json({ voiceoverUrl: urlData.publicUrl });
});
