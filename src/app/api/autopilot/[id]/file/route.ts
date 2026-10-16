import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";
import { createClient } from "@/lib/supabase/server";
import { getOwnedAutopilotProject } from "@/lib/autopilot/access";
import { safeRunPath } from "@/lib/autopilot/review";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".srt": "application/x-subrip; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

/** Owner-only access to files of an autopilot run (photos, narration, bundle). Supports Range for video. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getOwnedAutopilotProject(supabase, user.id, (await params).id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rel = new URL(request.url).searchParams.get("path") ?? "";
  const file = safeRunPath(project.runDir, rel);
  const type = file ? TYPES[path.extname(file).toLowerCase()] : undefined;
  if (!file || !type || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const size = fs.statSync(file).size;
  const download = new URL(request.url).searchParams.get("download") === "1";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
    ...(download ? { "Content-Disposition": `attachment; filename="${path.basename(file)}"` } : {}),
  };
  const range = request.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start > end || start >= size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new NextResponse(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
