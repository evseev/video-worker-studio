import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types";
import { slugifyChannelName } from "@/lib/channels/slug";
import { deleteProjectByOwner } from "@/lib/projects/delete-project-by-owner";
import * as fs from "fs";
import * as path from "path";

export type ChannelRow = Tables<"channels">;

export type ChannelWithProjectCount = ChannelRow & { project_count: number };

const CHANNEL_ASSETS_BUCKET = "channel-assets";

export async function listChannelsWithProjectCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: ChannelWithProjectCount[]; error: Error | null }> {
  const { data: channels, error: chErr } = await supabase
    .from("channels")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (chErr || !channels) {
    return { data: [], error: chErr ? new Error(chErr.message) : new Error("No channels") };
  }

  const { data: projects, error: pErr } = await supabase
    .from("projects")
    .select("channel_id")
    .eq("user_id", userId);

  if (pErr) {
    return { data: [], error: new Error(pErr.message) };
  }

  const counts = new Map<string, number>();
  for (const row of projects ?? []) {
    const cid = row.channel_id;
    counts.set(cid, (counts.get(cid) ?? 0) + 1);
  }

  const data: ChannelWithProjectCount[] = channels.map((c) => ({
    ...c,
    project_count: counts.get(c.id) ?? 0,
  }));

  return { data, error: null };
}

export async function getChannelById(
  supabase: SupabaseClient,
  channelId: string
): Promise<{ data: ChannelRow | null; error: Error | null }> {
  const { data, error } = await supabase.from("channels").select("*").eq("id", channelId).maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  return { data: data ?? null, error: null };
}

export async function createChannelForUser(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<{ data: ChannelRow | null; error: Error | null; code?: "SLUG_CONFLICT" }> {
  const baseSlug = slugifyChannelName(name);
  const maxAttempts = 25;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
    const insert: TablesInsert<"channels"> = {
      user_id: userId,
      name: name.trim(),
      slug,
    };

    const { data, error } = await supabase.from("channels").insert(insert).select("*").single();

    if (!error && data) {
      return { data, error: null };
    }

    if (error?.code === "23505") {
      continue;
    }

    return { data: null, error: new Error(error?.message ?? "Insert failed") };
  }

  return { data: null, error: new Error("Could not allocate a unique slug"), code: "SLUG_CONFLICT" };
}

export type ChannelPatch = Pick<
  TablesUpdate<"channels">,
  | "name"
  | "slug"
  | "niche"
  | "target_language"
  | "target_audience"
  | "tone"
  | "youtube_handle"
  | "default_settings"
  | "watermark_position"
  | "watermark_opacity"
  | "subject_memory_lookback"
  | "logo_url"
  | "thumbnail_template_url"
>;

export async function updateChannel(
  supabase: SupabaseClient,
  channelId: string,
  patch: ChannelPatch
): Promise<{ data: ChannelRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("channels")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", channelId)
    .select("*")
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  return { data: data ?? null, error: null };
}

export async function countProjectsOnChannel(
  supabase: SupabaseClient,
  channelId: string
): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("channel_id", channelId);

  if (error) {
    return { count: 0, error: new Error(error.message) };
  }
  return { count: count ?? 0, error: null };
}

export async function listProjectIdsForChannel(
  supabase: SupabaseClient,
  channelId: string
): Promise<{ ids: string[]; error: Error | null }> {
  const { data, error } = await supabase.from("projects").select("id").eq("channel_id", channelId);

  if (error) {
    return { ids: [], error: new Error(error.message) };
  }
  return { ids: (data ?? []).map((r) => r.id), error: null };
}

export type CascadePartialFailure = { projectId: string; error: string };

export async function forceDeleteChannelCascade(
  supabase: SupabaseClient,
  userId: string,
  channelId: string
): Promise<{ partialFailures: CascadePartialFailure[]; deletedProjects: number }> {
  const partialFailures: CascadePartialFailure[] = [];
  let deletedProjects = 0;
  const { ids, error: listErr } = await listProjectIdsForChannel(supabase, channelId);
  if (listErr) {
    partialFailures.push({ projectId: "_list", error: listErr.message });
    return { partialFailures, deletedProjects: 0 };
  }

  for (const projectId of ids) {
    const result = await deleteProjectByOwner(supabase, userId, projectId);
    if (!result.ok) {
      partialFailures.push({ projectId, error: result.error });
    } else {
      deletedProjects += 1;
    }
  }

  if (partialFailures.length > 0) {
    return { partialFailures, deletedProjects };
  }

  const preDeleteStorage = await removeChannelAssetsStoragePrefix(supabase, channelId);
  if (preDeleteStorage.warning) {
    console.warn("[channels] pre-delete storage:", preDeleteStorage.warning);
  }
  const preLocal = await removeChannelLocalRenderDir(channelId);
  if (preLocal) {
    console.warn("[channels] pre-delete local dir:", preLocal);
  }

  const { error: delCh } = await supabase.from("channels").delete().eq("id", channelId);
  if (delCh) {
    partialFailures.push({ projectId: channelId, error: delCh.message });
    return { partialFailures, deletedProjects };
  }

  return { partialFailures, deletedProjects };
}

export async function deleteEmptyChannelWithArtifacts(
  supabase: SupabaseClient,
  channelId: string
): Promise<{ error: Error | null; storageWarning: string | null }> {
  const storageResult = await removeChannelAssetsStoragePrefix(supabase, channelId);
  const localWarn = await removeChannelLocalRenderDir(channelId);
  const { error } = await supabase.from("channels").delete().eq("id", channelId);
  return {
    error: error ? new Error(error.message) : null,
    storageWarning:
      storageResult.warning ?? (localWarn ? `Local render cleanup: ${localWarn}` : null),
  };
}

async function removeChannelAssetsStoragePrefix(
  supabase: SupabaseClient,
  channelId: string
): Promise<{ warning: string | null }> {
  const warnings: string[] = [];
  const folder = channelId;
  const { data: files, error: listError } = await supabase.storage.from(CHANNEL_ASSETS_BUCKET).list(folder, {
    limit: 500,
  });

  if (listError) {
    if (/bucket not found|not found/i.test(listError.message)) {
      return { warning: `Storage bucket "${CHANNEL_ASSETS_BUCKET}" is missing or inaccessible: ${listError.message}` };
    }
    return { warning: listError.message };
  }

  if (!files?.length) {
    return { warning: null };
  }

  const paths = files.map((f) => `${folder}/${f.name}`);
  const { error: rmError } = await supabase.storage.from(CHANNEL_ASSETS_BUCKET).remove(paths);
  if (rmError) {
    warnings.push(rmError.message);
  }
  return { warning: warnings.length ? warnings.join("; ") : null };
}

async function removeChannelLocalRenderDir(channelId: string): Promise<string | null> {
  const dir = path.join(process.cwd(), "public", "local_renders", channelId);
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  return null;
}
