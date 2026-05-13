/**
 * Produce a URL-safe slug from a channel display name (per-user uniqueness enforced at insert).
 */
export function slugifyChannelName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  const base = trimmed
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base.length > 0 ? base : "channel";
}
