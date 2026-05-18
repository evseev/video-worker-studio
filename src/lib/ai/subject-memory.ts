import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { normalizeSubject } from "@/lib/ai/dedupe";
import { embedTextOrThrow, getEmbeddingModel } from "@/lib/ai/gemini";

const apiKey = process.env.GEMINI_API_KEY;
const subjectMemoryEnabled = (process.env.SUBJECT_MEMORY_ENABLED ?? "true").toLowerCase() !== "false";
const subjectMemoryMax = Number(process.env.SUBJECT_MEMORY_MAX ?? "200");

/** Conservative cap: max scenes per video × default lookback headroom for SQL LIMIT. */
const AVG_SUBJECTS_PER_PROJECT = 30;

type StoredSubjectRow = {
  subject_key: string;
  subject_normalized: string;
  embedding: string | null;
  created_at: string;
};

function parseVectorString(value: string | null): number[] | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as number[];
  } catch {
    return null;
  }
}

function getWorkerDbClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return -1;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return -1;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedText(text: string): Promise<number[] | null> {
  if (!apiKey) {
    return null;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = getEmbeddingModel(genAI);
  return embedTextOrThrow(model, text);
}

/**
 * Returns subject keys from this channel's recent **completed** videos to exclude from new ideas,
 * ranked by embedding similarity to `idea` (same algorithm as ADR-002; channel-scoped per Epic 25).
 *
 * Loads `channels.subject_memory_lookback` (default 5), takes that many latest completed projects on
 * the channel, then loads up to `lookback × AVG_SUBJECTS_PER_PROJECT` subject rows (newest first)
 * from those projects before embed-ranking.
 */
export async function getExcludedSubjectsForChannel(
  supabase: SupabaseClient<Database>,
  channelId: string,
  idea: string,
  opts?: { maxSubjects?: number }
): Promise<string[]> {
  if (!subjectMemoryEnabled) {
    return [];
  }

  const maxSubjects = opts?.maxSubjects ?? subjectMemoryMax;

  const { data: channelRow, error: channelErr } = await supabase
    .from("channels")
    .select("subject_memory_lookback")
    .eq("id", channelId)
    .maybeSingle();

  if (channelErr || !channelRow) {
    return [];
  }

  const lookback = Math.min(Math.max(channelRow.subject_memory_lookback ?? 5, 1), 50);
  const subjectSqlLimit = Math.min(lookback * AVG_SUBJECTS_PER_PROJECT, maxSubjects);

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id")
    .eq("channel_id", channelId)
    .eq("status", "completed")
    .order("updated_at", { ascending: false })
    .limit(lookback);

  if (projectsError || !projects || projects.length === 0) {
    return [];
  }

  const projectIds = projects.map((row) => row.id);
  const { data: subjects, error: subjectsError } = await supabase
    .from("video_subjects")
    .select("subject_key, subject_normalized, embedding, created_at")
    .eq("channel_id", channelId)
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(subjectSqlLimit);

  if (subjectsError || !subjects || subjects.length === 0) {
    return [];
  }

  const typedSubjects = subjects as StoredSubjectRow[];

  try {
    const ideaEmbedding = await embedText(idea);
    if (!ideaEmbedding) {
      return typedSubjects.map((row) => row.subject_key);
    }
    return typedSubjects
      .map((row) => ({
        key: row.subject_key,
        score: (() => {
          const vector = parseVectorString(row.embedding);
          return vector ? cosineSimilarity(ideaEmbedding, vector) : -1;
        })(),
      }))
      .sort((a, b) => b.score - a.score)
      .map((row) => row.key)
      .slice(0, maxSubjects);
  } catch {
    return typedSubjects.map((row) => row.subject_key);
  }
}

/**
 * Recent subject keys on a channel (newest first), capped for bounded prompts (Epic 25 topic suggestions).
 */
export async function listRecentSubjectKeysForChannel(
  supabase: SupabaseClient<Database>,
  channelId: string,
  limit = 50
): Promise<string[]> {
  const cap = Math.min(Math.max(limit, 1), 100);
  const { data, error } = await supabase
    .from("video_subjects")
    .select("subject_key, created_at")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(cap * 2);

  if (error || !data?.length) {
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data) {
    const k = row.subject_key?.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Persists normalized subject keys for ADR-002-style dedupe. Rows are written with `channel_id`
 * via `worker_insert_video_subjects` (no `user_id`; ownership is the channel).
 */
export async function persistSubjectsForProject(
  projectId: string,
  channelId: string,
  subjects: string[]
): Promise<void> {
  if (!subjectMemoryEnabled || subjects.length === 0) {
    return;
  }

  const unique = Array.from(
    new Map(
      subjects
        .map((subjectKey) => ({ subjectKey, subjectNormalized: normalizeSubject(subjectKey) }))
        .filter((item) => item.subjectNormalized.length > 0)
        .map((item) => [item.subjectNormalized, item])
    ).values()
  ).slice(0, subjectMemoryMax);

  const rows: Json[] = [];
  for (const item of unique) {
    let embedding: number[] | null = null;
    try {
      embedding = await embedText(item.subjectKey);
    } catch {
      embedding = null;
    }
    rows.push({
      subject_key: item.subjectKey,
      subject_normalized: item.subjectNormalized,
      embedding,
    });
  }

  const db = getWorkerDbClient();
  const { error } = await db.rpc("worker_insert_video_subjects", {
    p_channel_id: channelId,
    p_project_id: projectId,
    p_rows: rows,
  });
  if (error) {
    throw new Error(`Failed to persist subject memory: ${error.message}`);
  }
}
