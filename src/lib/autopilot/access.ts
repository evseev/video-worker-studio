import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@/lib/supabase/types";
import * as path from "path";
import { autopilotRoot } from "./review";

export type AutopilotProjectRow = Tables<"projects">;

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
  const row = data as AutopilotProjectRow;
  if (!row.autopilot || !row.autopilot_run_dir) return null;
  const root = autopilotRoot();
  const runDir = path.resolve(/* turbopackIgnore: true */ row.autopilot_run_dir);
  if (!runDir.startsWith(root + path.sep)) return null;
  return { ...row, runDir };
}
