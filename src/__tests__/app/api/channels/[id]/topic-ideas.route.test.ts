import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (handler: (req: Request, ctx: { user: User; supabase: SupabaseClient }) => Promise<Response>) => {
    return async (request: Request) => {
      const supabase = (globalThis as unknown as { __testTopicIdeasSupabase: SupabaseClient })
        .__testTopicIdeasSupabase;
      const user = { id: "u1", email: "t@t.com" } as User;
      return handler(request, { user, supabase });
    };
  },
}));

vi.mock("@/lib/channels/repository", () => ({
  getChannelById: vi.fn(),
}));

import { GET } from "@/app/api/channels/[id]/topic-ideas/route";
import { getChannelById } from "@/lib/channels/repository";

const mockGetChannel = vi.mocked(getChannelById);

function setTestSupabase(client: SupabaseClient) {
  (globalThis as unknown as { __testTopicIdeasSupabase: SupabaseClient }).__testTopicIdeasSupabase = client;
}

function makeThenableBuilder(result: { data: unknown[]; error: null }, onEq?: (col: string, val: string) => void) {
  const b = {
    select: () => b,
    eq: (col: string, val: string) => {
      onEq?.(col, val);
      return b;
    },
    order: () => b,
    limit: () => b,
    then(onFulfilled: (x: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return b;
}

describe("GET /api/channels/[id]/topic-ideas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChannel.mockResolvedValue({ data: { id: "chan-1", user_id: "u1" } as never, error: null });
  });

  const params = Promise.resolve({ id: "chan-1" });

  it("400 when status query is invalid", async () => {
    const from = vi.fn();
    setTestSupabase({ from } as unknown as SupabaseClient);

    const res = await GET(
      new Request("http://localhost/api/channels/chan-1/topic-ideas?status=nope"),
      { params }
    );
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("passes backlog filter via eq when status=backlog", async () => {
    const eqPairs: [string, string][] = [];
    const supabase = {
      from: vi.fn(() =>
        makeThenableBuilder({ data: [{ id: "idea-1", idea_text: "x", status: "backlog" }], error: null }, (c, v) => {
          eqPairs.push([c, v]);
        })
      ),
    } as unknown as SupabaseClient;
    setTestSupabase(supabase);

    const res = await GET(
      new Request("http://localhost/api/channels/chan-1/topic-ideas?status=backlog"),
      { params }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ideas).toHaveLength(1);
    expect(eqPairs).toContainEqual(["channel_id", "chan-1"]);
    expect(eqPairs).toContainEqual(["status", "backlog"]);
  });

  it("omits status eq when no status query", async () => {
    const eqPairs: [string, string][] = [];
    const supabase = {
      from: vi.fn(() =>
        makeThenableBuilder({ data: [], error: null }, (c, v) => {
          eqPairs.push([c, v]);
        })
      ),
    } as unknown as SupabaseClient;
    setTestSupabase(supabase);

    const res = await GET(new Request("http://localhost/api/channels/chan-1/topic-ideas"), { params });
    expect(res.status).toBe(200);
    expect(eqPairs.some(([c]) => c === "status")).toBe(false);
  });
});
