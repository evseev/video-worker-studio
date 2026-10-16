import type { SupabaseClient } from "@supabase/supabase-js";
import * as path from "path";
import { autopilotRoot } from "./review";

/** Columns added by migration 20261016120000_autopilot.sql (types.ts not regenerated yet). */
export interface AutopilotProjectRow {
  id: string;
  user_id: string;
  channel_id: string;
  topic: string;
  status: string;
  autopilot: boolean;
  format_slug: string | null;
  background_music: string | null;
  autopilot_run_dir: string | null;
  autopilot_summary: Record<string, unknown> | null;
  review_status: string | null;
  publish_at: string | null;
  youtube_video_id: string | null;
}

/**
 * Load an autopilot project the user owns (RLS-scoped client) and validate its run directory
 * lies inside AUTOPILOT_OUT_DIR. Returns null when not found / not owned / not autopilot.
 */
export async function getOwnedAutopilotProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<(AutopilotProjectRow & { runDir: string }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as AutopilotProjectRow;
  if (!row.autopilot || !row.autopilot_run_dir) return null;
  const root = autopilotRoot();
  const runDir = path.resolve(row.autopilot_run_dir);
  if (!runDir.startsWith(root + path.sep)) return null;
  return { ...row, runDir };
}
