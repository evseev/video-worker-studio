import { z } from "zod";
import type { ChannelContext } from "@/lib/ai/prompts";

const WatermarkPositionSchema = z.enum(["tl", "tr", "bl", "br", "none"]);

export const WorkerChannelRpcRowSchema = z.object({
  channel_id: z.string().uuid(),
  niche: z.string().nullable(),
  target_language: z.string().nullable(),
  target_audience: z.string().nullable(),
  tone: z.string().nullable(),
  logo_url: z.string().nullable(),
  watermark_position: z.string(),
  watermark_opacity: z.coerce.number(),
});

export type WorkerChannelBundle = {
  channelId: string;
  niche: string | null;
  targetLanguage: string | null;
  targetAudience: string | null;
  tone: string | null;
  watermark: {
    logoUrl: string | null;
    position: z.infer<typeof WatermarkPositionSchema>;
    opacity: number;
  };
};

export function parseWorkerChannelRpcJson(json: unknown): WorkerChannelBundle {
  const row = WorkerChannelRpcRowSchema.parse(json);
  const pos = WatermarkPositionSchema.safeParse(row.watermark_position);
  return {
    channelId: row.channel_id,
    niche: row.niche,
    targetLanguage: row.target_language,
    targetAudience: row.target_audience,
    tone: row.tone,
    watermark: {
      logoUrl: row.logo_url,
      position: pos.success ? pos.data : "none",
      opacity: row.watermark_opacity,
    },
  };
}

export function workerBundleToChannelContext(bundle: WorkerChannelBundle): ChannelContext {
  const ctx: ChannelContext = {};
  if (bundle.niche?.trim()) ctx.niche = bundle.niche.trim();
  if (bundle.targetLanguage?.trim()) ctx.targetLanguage = bundle.targetLanguage.trim();
  if (bundle.targetAudience?.trim()) ctx.targetAudience = bundle.targetAudience.trim();
  if (bundle.tone?.trim()) ctx.tone = bundle.tone.trim();
  return ctx;
}
