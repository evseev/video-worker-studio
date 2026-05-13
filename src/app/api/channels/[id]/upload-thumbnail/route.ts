import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { getChannelById } from "@/lib/channels/repository";

const BUCKET = "channel-assets";
const MAX_BYTES = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(request: Request, routeCtx: { params: Promise<{ id: string }> }) {
  const { id: channelId } = await routeCtx.params;
  const inner = withAuth(async (req, { supabase }) => {
    const { data: channel } = await getChannelById(supabase, channelId);
    if (!channel) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 400 });
    }

    const mime = file.type;
    const ext = EXT_BY_MIME[mime];
    if (!ext) {
      return NextResponse.json(
        { error: "Invalid type; allowed: image/png, image/jpeg, image/webp" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const objectPath = `${channelId}/thumbnail.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType: mime,
      upsert: true,
    });

    if (upErr) {
      if (/bucket not found|Bucket not found|404/i.test(upErr.message)) {
        return NextResponse.json(
          {
            error: `Storage bucket "${BUCKET}" is not available. Apply migration 20260513140500_channel_assets_storage_rls.sql and ensure the bucket exists in Supabase.`,
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    const publicUrl = pub.publicUrl;

    const { error: patchErr } = await supabase
      .from("channels")
      .update({ thumbnail_template_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", channelId);

    if (patchErr) {
      return NextResponse.json({ error: patchErr.message }, { status: 500 });
    }

    return NextResponse.json({ thumbnailUrl: publicUrl });
  });
  return inner(request);
}
