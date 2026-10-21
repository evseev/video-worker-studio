import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { FORMAT_SLUGS, type FormatSlug } from "./formats";

/**
 * Autopilot DB access. Every write goes through a SECURITY DEFINER RPC granted to
 * service_role only (migration 20261016120000_autopilot.sql). The client is deliberately untyped:
 * generated RPC arg types are non-nullable, while these functions accept NULL for "leave unchanged".
 */
export function autopilotDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Autopilot needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function rpc<T>(name: string, args: Record<string, unknown>, schema: z.ZodType<T>, db = autopilotDb()): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(`${name} failed: ${error.message}`);
  return schema.parse(data);
}

export const AutopilotConfigSchema = z
  .object({
    /** Weekdays to publish on, 1 = Monday … 7 = Sunday. */
    weekdays: z.array(z.number().int().min(1).max(7)).default([1, 2, 3, 4, 5]),
    publishHour: z.number().int().min(0).max(23).default(17),
    timezone: z.string().default("America/New_York"),
    defaultFormat: z.enum(FORMAT_SLUGS as [FormatSlug, ...FormatSlug[]]).default("couples"),
    defaultPairs: z.number().int().min(6).max(150).default(50),
    musicId: z.string().default("lifting-dreams"),
    locales: z.array(z.string()).default(["pt-BR", "es"]),
    /** Do not start new videos while this many are waiting for review. */
    maxPendingReview: z.number().int().min(1).max(20).default(3),
    seriesName: z.string().optional(),
    hostMode: z.enum(["off", "intro_outro", "intro_bridges_outro", "pip"]).default("off"),
  })
  .default({
    weekdays: [1, 2, 3, 4, 5],
    publishHour: 17,
    timezone: "America/New_York",
    defaultFormat: "couples",
    defaultPairs: 50,
    musicId: "lifting-dreams",
    locales: ["pt-BR", "es"],
    maxPendingReview: 3,
    hostMode: "off",
  });

export type AutopilotConfig = z.infer<typeof AutopilotConfigSchema>;

const EnabledChannelSchema = z.object({
  channel_id: z.string(),
  user_id: z.string(),
  name: z.string(),
  niche: z.string().nullable(),
  autopilot_config: z.unknown(),
  pending_review: z.number(),
  scheduled_ahead: z.number(),
});

export async function listEnabledChannels() {
  const rows = await rpc("autopilot_list_enabled_channels", {}, z.array(EnabledChannelSchema));
  return rows.map((r) => ({ ...r, config: AutopilotConfigSchema.parse(r.autopilot_config ?? {}) }));
}

const IdeaSchema = z
  .object({
    id: z.string(),
    idea_text: z.string(),
    format_slug: z.string().nullable(),
    pair_count: z.number().nullable(),
    series_key: z.string().nullable(),
    template_id: z.string().nullable(),
  })
  .nullable();

export async function claimNextIdea(channelId: string) {
  return rpc("autopilot_claim_next_idea", { p_channel_id: channelId }, IdeaSchema);
}

export async function createAutopilotProject(params: {
  channelId: string;
  ideaId: string | null;
  topic: string;
  format: FormatSlug;
  musicId: string;
  experimentArm?: string | null;
}): Promise<string> {
  return rpc(
    "autopilot_create_project",
    {
      p_channel_id: params.channelId,
      p_idea_id: params.ideaId,
      p_payload: {
        topic: params.topic,
        format_slug: params.format,
        background_music: params.musicId,
        video_quality: "1080p",
        experiment_arm: params.experimentArm ?? null,
      },
    },
    z.string()
  );
}

export async function updateAutopilot(params: {
  projectId: string;
  status?: "processing" | "awaiting_review" | "rendering" | "completed" | "failed_ai" | "failed_render";
  reviewStatus?: "pending_review" | "approved" | "rejected";
  runDir?: string;
  summary?: Record<string, unknown>;
}) {
  await rpc(
    "worker_update_autopilot",
    {
      p_project_id: params.projectId,
      p_status: params.status ?? null,
      p_review_status: params.reviewStatus ?? null,
      p_run_dir: params.runDir ?? null,
      p_summary: params.summary ?? null,
    },
    z.unknown()
  );
}

export async function setPublishResult(params: {
  projectId: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  youtubeVideoId?: string | null;
  publishAt?: string | null;
}) {
  await rpc(
    "worker_set_publish_result",
    {
      p_project_id: params.projectId,
      p_video_url: params.videoUrl ?? null,
      p_thumbnail_url: params.thumbnailUrl ?? null,
      p_youtube_video_id: params.youtubeVideoId ?? null,
      p_publish_at: params.publishAt ?? null,
    },
    z.unknown()
  );
}

/** Already-scheduled slots for a channel (ISO strings), used to pick the next free slot. */
export async function scheduledSlots(channelId: string): Promise<string[]> {
  const db = autopilotDb();
  const { data, error } = await db
    .from("projects")
    .select("publish_at")
    .eq("channel_id", channelId)
    .not("publish_at", "is", null)
    .gte("publish_at", new Date().toISOString());
  if (error) throw new Error(`scheduledSlots failed: ${error.message}`);
  return (data ?? []).map((r: { publish_at: string }) => r.publish_at);
}
