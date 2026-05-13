import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (handler: (req: Request, ctx: { user: { id: string }; supabase: null }) => Promise<Response>) => {
    return async (request: Request) => handler(request, { user: { id: "u1" }, supabase: null });
  },
}));

vi.mock("@/lib/channels/repository", () => ({
  getChannelById: vi.fn(),
  countProjectsOnChannel: vi.fn(),
  deleteEmptyChannelWithArtifacts: vi.fn(),
  forceDeleteChannelCascade: vi.fn(),
  updateChannel: vi.fn(),
}));

import { GET, DELETE } from "@/app/api/channels/[id]/route";
import * as repo from "@/lib/channels/repository";

const mockGet = vi.mocked(repo.getChannelById);
const mockCount = vi.mocked(repo.countProjectsOnChannel);
const mockForce = vi.mocked(repo.forceDeleteChannelCascade);
const mockDeleteEmpty = vi.mocked(repo.deleteEmptyChannelWithArtifacts);

describe("/api/channels/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = Promise.resolve({ id: "chan-1" });

  it("GET returns 403 when channel not visible", async () => {
    mockGet.mockResolvedValue({ data: null, error: null });
    const res = await GET(new NextRequest("http://localhost/api/channels/chan-1"), { params });
    expect(res.status).toBe(403);
  });

  it("DELETE without force returns 409 when projects exist", async () => {
    mockGet.mockResolvedValue({ data: { id: "chan-1" } as never, error: null });
    mockCount.mockResolvedValue({ count: 2, error: null });
    const res = await DELETE(new NextRequest("http://localhost/api/channels/chan-1"), { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.projectCount).toBe(2);
  });

  it("DELETE force returns 207 on partial cascade failures", async () => {
    mockGet.mockResolvedValue({ data: { id: "chan-1" } as never, error: null });
    mockCount.mockResolvedValue({ count: 2, error: null });
    mockForce.mockResolvedValue({
      partialFailures: [{ projectId: "p1", error: "x" }],
      deletedProjects: 0,
    });
    const res = await DELETE(
      new NextRequest("http://localhost/api/channels/chan-1?force=true"),
      { params }
    );
    expect(res.status).toBe(207);
  });

  it("DELETE removes empty channel", async () => {
    mockGet.mockResolvedValue({ data: { id: "chan-1" } as never, error: null });
    mockCount.mockResolvedValue({ count: 0, error: null });
    mockDeleteEmpty.mockResolvedValue({ error: null, storageWarning: null });
    const res = await DELETE(new NextRequest("http://localhost/api/channels/chan-1"), { params });
    expect(res.status).toBe(200);
    expect(mockDeleteEmpty).toHaveBeenCalled();
  });
});
