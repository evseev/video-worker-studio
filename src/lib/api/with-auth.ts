import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RATE_LIMITS } from "@/lib/rate-limit";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type RateLimitTier = keyof typeof RATE_LIMITS;

type AuthenticatedHandler = (
  request: Request,
  context: { user: User; supabase: SupabaseClient }
) => Promise<NextResponse>;

interface WithAuthOptions {
  /** Rate limit tier: "ai" (10/min), "render" (3/min), or "general" (60/min). Default: "general" */
  rateLimit?: RateLimitTier;
}

/**
 * Wraps an API route handler with Supabase auth validation and rate limiting.
 * Returns 401 if no valid session exists.
 * Returns 429 if rate limit exceeded.
 * Passes the authenticated user and Supabase client to the handler.
 */
export function withAuth(handler: AuthenticatedHandler, options?: WithAuthOptions) {
  const tier = options?.rateLimit ?? "general";

  return async (request: Request) => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Rate limit check
      const rateLimitResponse = RATE_LIMITS[tier](user.id);
      if (rateLimitResponse) return rateLimitResponse;

      return await handler(request, { user, supabase });
    } catch (error) {
      console.error("API route error:", error);
      const message = process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : "Internal server error";
      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }
  };
}
