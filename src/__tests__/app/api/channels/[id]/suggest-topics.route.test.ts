import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (handler: (req: Request, ctx: { user: { id: string }; supabase: null }) => Promise<Response>, opts?: unknown) => {
    void opts;
    return async (request: Request) => handler(request, { user: { id: "u1" }, supabase: null });
  },
}));

vi.mock("@/lib/channels/suggest-topics", () => ({
  runChannelTopicSuggestions: vi.fn(() =>
    Promise.resolve({ ideas: [{ idea_text: "Test idea", ai_reasoning: "because" }] })
  ),
}));

import { POST } from "@/app/api/channels/[id]/suggest-topics/route";
import * as suggest from "@/lib/channels/suggest-topics";

describe("POST /api/channels/[id]/suggest-topics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ideas from suggestTopics lib", async () => {
    const params = Promise.resolve({ id: "chan-1" });
    const res = await POST(
      new NextRequest("http://localhost/api/channels/chan-1/suggest-topics", {
        method: "POST",
        body: JSON.stringify({ count: 5, persist: false }),
      }),
      { params }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ideas).toHaveLength(1);
    expect(suggest.runChannelTopicSuggestions).toHaveBeenCalledWith(
      null,
      "chan-1",
      expect.objectContaining({ count: 5, persist: false })
    );
  });
});
