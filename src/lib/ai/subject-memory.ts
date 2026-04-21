import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { normalizeSubject } from "@/lib/ai/dedupe";

const apiKey = process.env.GEMINI_API_KEY;
const subjectMemoryEnabled = (process.env.SUBJECT_MEMORY_ENABLED ?? "true").toLowerCase() !== "false";
const subjectMemoryLimit = Number(process.env.SUBJECT_MEMORY_LIMIT ?? "10");
const subjectMemoryMax = Number(process.env.SUBJECT_MEMORY_MAX ?? "200");

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
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values ?? null;
}

export async function getExcludedSubjectsForUser(
  userId: string,
  idea: string,
  opts?: { limit?: number; maxSubjects?: number }
): Promise<string[]> {
  if (!subjectMemoryEnabled) {
    return [];
  }

  const db = getWorkerDbClient();
  const limit = opts?.limit ?? subjectMemoryLimit;
  const maxSubjects = opts?.maxSubjects ?? subjectMemoryMax;

  const { data: projects, error: projectsError } = await db
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectsError || !projects || projects.length === 0) {
    return [];
  }

  const projectIds = projects.map((row) => row.id);
  const { data: subjects, error: subjectsError } = await db
    .from("video_subjects")
    .select("subject_key, subject_normalized, embedding, created_at")
    .eq("user_id", userId)
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(maxSubjects) as { data: StoredSubjectRow[] | null; error: Error | null };

  if (subjectsError || !subjects || subjects.length === 0) {
    return [];
  }

  try {
    const ideaEmbedding = await embedText(idea);
    if (!ideaEmbedding) {
      return subjects.map((row) => row.subject_key);
    }
    return subjects
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
    return subjects.map((row) => row.subject_key);
  }
}

export async function persistSubjectsForProject(
  projectId: string,
  userId: string,
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
    p_user_id: userId,
    p_project_id: projectId,
    p_rows: rows,
  });
  if (error) {
    throw new Error(`Failed to persist subject memory: ${error.message}`);
  }
}
