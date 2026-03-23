import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes to prevent memory growth
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStale() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}

/**
 * In-memory sliding window rate limiter.
 * Returns null if under limit, or a 429 NextResponse if over limit.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  cleanupStale();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  return null;
}

/** Pre-configured rate limit tiers */
export const RATE_LIMITS = {
  /** AI generation routes: 10 requests per minute per user */
  ai: (userId: string) => rateLimit(`ai:${userId}`, 10, 60_000),
  /** Render routes: 3 requests per minute per user */
  render: (userId: string) => rateLimit(`render:${userId}`, 3, 60_000),
  /** General API routes: 60 requests per minute per user */
  general: (userId: string) => rateLimit(`general:${userId}`, 60, 60_000),
} as const;
