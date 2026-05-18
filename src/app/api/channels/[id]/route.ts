import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/with-auth";
import {
  countProjectsOnChannel,
  deleteEmptyChannelWithArtifacts,
  forceDeleteChannelCascade,
  getChannelById,
  updateChannel,
  type ChannelPatch,
} from "@/lib/channels/repository";

const WatermarkPositionSchema = z.enum(["tl", "tr", "bl", "br", "none"]);

const PatchBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    slug: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    niche: z.string().max(2000).nullable().optional(),
    target_language: z.string().max(50).nullable().optional(),
    target_audience: z.string().max(2000).nullable().optional(),
    tone: z.string().max(2000).nullable().optional(),
    youtube_handle: z.string().max(100).nullable().optional(),
    default_settings: z.record(z.string(), z.unknown()).optional(),
    watermark_position: WatermarkPositionSchema.optional(),
    watermark_opacity: z.number().min(0).max(1).optional(),
    subject_memory_lookback: z.number().int().min(1).max(50).optional(),
    logo_url: z.union([z.string().url(), z.null()]).optional(),
    thumbnail_template_url: z.union([z.string().url(), z.null()]).optional(),
  })
  .strict();

function channelForbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(request: Request, routeCtx: { params: Promise<{ id: string }> }) {
  const { id } = await routeCtx.params;
  const handler = withAuth(async (_req, { supabase }) => {
    const { data, error } = await getChannelById(supabase, id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return channelForbidden();
    }
    return NextResponse.json({ channel: data });
  });
  return handler(request);
}

export async function PATCH(request: Request, routeCtx: { params: Promise<{ id: string }> }) {
  const { id } = await routeCtx.params;
  const handler = withAuth(async (req, { supabase }) => {
    const existing = await getChannelById(supabase, id);
    if (existing.error) {
      return NextResponse.json({ error: existing.error.message }, { status: 500 });
    }
    if (!existing.data) {
      return channelForbidden();
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = PatchBodySchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid body";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const patch: ChannelPatch = {};
    const b = parsed.data;
    if (b.name !== undefined) patch.name = b.name;
    if (b.slug !== undefined) patch.slug = b.slug;
    if (b.niche !== undefined) patch.niche = b.niche;
    if (b.target_language !== undefined) patch.target_language = b.target_language;
    if (b.target_audience !== undefined) patch.target_audience = b.target_audience;
    if (b.tone !== undefined) patch.tone = b.tone;
    if (b.youtube_handle !== undefined) patch.youtube_handle = b.youtube_handle;
    if (b.default_settings !== undefined) {
      patch.default_settings = b.default_settings as ChannelPatch["default_settings"];
    }
    if (b.watermark_position !== undefined) patch.watermark_position = b.watermark_position;
    if (b.watermark_opacity !== undefined) patch.watermark_opacity = b.watermark_opacity;
    if (b.subject_memory_lookback !== undefined) {
      patch.subject_memory_lookback = b.subject_memory_lookback;
    }
    if (b.logo_url !== undefined) patch.logo_url = b.logo_url;
    if (b.thumbnail_template_url !== undefined) {
      patch.thumbnail_template_url = b.thumbnail_template_url;
    }

    const { data, error } = await updateChannel(supabase, id, patch);
    if (error) {
      if (/duplicate key|unique constraint|23505/i.test(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return channelForbidden();
    }
    return NextResponse.json({ channel: data });
  });
  return handler(request);
}

export async function DELETE(request: Request, routeCtx: { params: Promise<{ id: string }> }) {
  const { id } = await routeCtx.params;
  const handler = withAuth(async (_req, { user, supabase }) => {
    const existing = await getChannelById(supabase, id);
    if (existing.error) {
      return NextResponse.json({ error: existing.error.message }, { status: 500 });
    }
    if (!existing.data) {
      return channelForbidden();
    }

    const force = new URL(request.url).searchParams.get("force") === "true";
    const { count, error: countErr } = await countProjectsOnChannel(supabase, id);
    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    if (count > 0 && !force) {
      return NextResponse.json(
        { error: "Channel has projects", projectCount: count },
        { status: 409 }
      );
    }

    if (!force && count === 0) {
      const { error: delErr, storageWarning } = await deleteEmptyChannelWithArtifacts(supabase, id);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        ...(storageWarning ? { warnings: [storageWarning] } : {}),
      });
    }

    const { partialFailures, deletedProjects } = await forceDeleteChannelCascade(supabase, user.id, id);
    if (partialFailures.length > 0) {
      return NextResponse.json(
        {
          error: "Partial failure during cascade delete",
          deleted: deletedProjects,
          failed: partialFailures,
        },
        { status: 207 }
      );
    }

    return NextResponse.json({ success: true, cascade: true });
  });
  return handler(request);
}
