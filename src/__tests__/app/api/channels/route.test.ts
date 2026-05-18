import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (handler: (req: Request, ctx: { user: { id: string }; supabase: null }) => Promise<Response>) => {
    return async (request: Request) => handler(request, { user: { id: "u1" }, supabase: null });
  },
}));

vi.mock("@/lib/channels/repository", () => ({
  listChannelsWithProjectCounts: vi.fn(),
  createChannelForUser: vi.fn(),
}));

import { GET, POST } from "@/app/api/channels/route";
import * as repo from "@/lib/channels/repository";

const mockList = vi.mocked(repo.listChannelsWithProjectCounts);
const mockCreate = vi.mocked(repo.createChannelForUser);

describe("/api/channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns channels list", async () => {
    mockList.mockResolvedValue({
      data: [{ id: "c1", name: "A", slug: "a", project_count: 0 } as never],
      error: null,
    });
    const res = await GET(new Request("http://localhost/api/channels"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels).toHaveLength(1);
  });

  it("POST creates channel", async () => {
    mockCreate.mockResolvedValue({
      data: { id: "c1", name: "New", slug: "new" } as never,
      error: null,
    });
    const res = await POST(
      new Request("http://localhost/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      })
    );
    expect(res.status).toBe(201);
  });
});
