import type { Json } from "@/lib/supabase/types";

/**
 * Merge freshly generated scenes into the stored wizard draft without losing
 * settings, refined idea, keywords or SEO fields. Legacy drafts stored as a bare
 * scene array (or null) become `{ scenes }`.
 */
export function mergeDraftScenes(existing: Json | null | undefined, scenes: unknown[]): Record<string, unknown> {
  let base: unknown = existing;
  if (typeof base === "string") {
    try {
      base = JSON.parse(base);
    } catch {
      base = null;
    }
  }
  if (base && typeof base === "object" && !Array.isArray(base)) {
    return { ...(base as Record<string, unknown>), scenes };
  }
  return { scenes };
}
