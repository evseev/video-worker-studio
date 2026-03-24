import { describe, it, expect, vi, beforeEach } from "vitest";
import { withAuth } from "@/lib/api/with-auth";
import { NextResponse } from "next/server";

// Mock the Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

function createMockRequest(body?: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("withAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no user session exists", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const handler = vi.fn();
    const wrappedHandler = withAuth(handler);
    const response = await wrappedHandler(createMockRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler with user and supabase when authenticated", async () => {
    const mockUser = { id: "user-123", email: "test@test.com" };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    };
    mockCreateClient.mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ ok: true })
    );
    const wrappedHandler = withAuth(handler);
    const req = createMockRequest({ test: true });
    const response = await wrappedHandler(req);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(req, {
      user: mockUser,
      supabase: mockSupabase,
    });
    expect(response.status).toBe(200);
  });

  it("returns 500 when handler throws", async () => {
    const mockUser = { id: "user-123" };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    const wrappedHandler = withAuth(handler);
    const response = await wrappedHandler(createMockRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });

  it("returns 429 when rate limited", async () => {
    const mockUser = { id: `rate-limit-test-${Date.now()}` };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ ok: true })
    );
    // Use render tier (3 req/min) for faster test
    const wrappedHandler = withAuth(handler, { rateLimit: "render" });

    // First 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const response = await wrappedHandler(createMockRequest());
      expect(response.status).toBe(200);
    }

    // 4th request should be rate limited
    const blocked = await wrappedHandler(createMockRequest());
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error).toContain("Too many requests");
  });
});
