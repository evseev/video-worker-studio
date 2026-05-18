import { z } from "zod";

export const YoutubeTopVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  view_count: z.coerce.number().int().nonnegative(),
});

export type YoutubeTopVideo = z.infer<typeof YoutubeTopVideoSchema>;

/** Stored on `channels.youtube_meta` (jsonb). */
export const StoredYoutubeMetaSchema = z
  .object({
    fetched_at: z.string(),
    channel_title: z.string().optional(),
    top_videos: z.array(YoutubeTopVideoSchema).max(10).optional(),
    error: z.string().optional(),
  })
  .passthrough();

export type StoredYoutubeMeta = z.infer<typeof StoredYoutubeMetaSchema>;

export const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

export function parseStoredYoutubeMeta(raw: unknown): StoredYoutubeMeta | null {
  const parsed = StoredYoutubeMetaSchema.safeParse(raw);
  return parsed.success ? (parsed.data as StoredYoutubeMeta) : null;
}

export function isYoutubeMetaFresh(meta: unknown, nowMs = Date.now()): boolean {
  const parsed = parseStoredYoutubeMeta(meta);
  if (!parsed?.fetched_at) return false;
  const t = Date.parse(parsed.fetched_at);
  if (Number.isNaN(t)) return false;
  return nowMs - t < TWENTY_FOUR_H_MS;
}
