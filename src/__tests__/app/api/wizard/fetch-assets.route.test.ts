import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (handler: Function) => handler,
}));

vi.mock("@/lib/ai/fetch-assets", () => ({
  fetchAssets: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { POST } from "@/app/api/wizard/fetch-assets/route";
import { fetchAssets } from "@/lib/ai/fetch-assets";

const mockFetchAssets = vi.mocked(fetchAssets);

function createMockRequest(body: unknown): Request {
  return new Request("http://localhost/api/wizard/fetch-assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockUser = { id: "user-1" };
const mockSupabase = {
  from: () => ({
    update: () => ({
      eq: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
};

describe("fetch-assets API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns scenes with populated assets when multipleAssets is true", async () => {
    mockFetchAssets.mockResolvedValue([
      ["/public/tmp_assets/vws-assets/proj-1/scene-0/a.jpg", "/public/tmp_assets/vws-assets/proj-1/scene-0/b.jpg", "/public/tmp_assets/vws-assets/proj-1/scene-0/c.jpg"],
    ]);

    const req = createMockRequest({
      projectId: "proj-1",
      scenes: [{ searchKeywords: ["sunset"], assets: [] }],
      multipleAssets: true,
      aspectRatio: "9:16",
    });

    // withAuth is mocked to pass through, so we call with (req, { user, supabase })
    const response = await (POST as Function)(req, { user: mockUser, supabase: mockSupabase });
    const data = await response.json();

    expect(data.scenes).toBeDefined();
    expect(data.scenes[0].assets[0]).toHaveProperty("options");
    expect(Array.isArray(data.scenes[0].assets[0].options)).toBe(true);
  });

  it("returns assets format when multipleAssets is absent", async () => {
    mockFetchAssets.mockResolvedValue([
      process.cwd() + "/public/tmp_assets/vws-assets/proj-1/scene-0/a.jpg",
    ]);

    const req = createMockRequest({
      projectId: "proj-1",
      scenes: [{ searchKeywords: ["sunset"], assets: [] }],
      aspectRatio: "9:16",
    });

    const response = await (POST as Function)(req, { user: mockUser, supabase: mockSupabase });
    const data = await response.json();

    expect(data.assets).toBeDefined();
    expect(data.assets[0]).toHaveProperty("file_path");
    expect(data.assets[0]).toHaveProperty("type");
    expect(data.assetOptions).toBeUndefined();
  });

  it("passes count=3 to fetchAssets when multipleAssets is true", async () => {
    mockFetchAssets.mockResolvedValue([[]]);

    const req = createMockRequest({
      projectId: "proj-1",
      scenes: [{ searchKeywords: ["sunset"], assets: [] }],
      multipleAssets: true,
      aspectRatio: "9:16",
    });

    await (POST as Function)(req, { user: mockUser, supabase: mockSupabase });

    expect(mockFetchAssets).toHaveBeenCalledWith(
      expect.any(Array),
      "proj-1",
      3,
    );
  });

  it("passes count=1 (default) when multipleAssets is absent", async () => {
    mockFetchAssets.mockResolvedValue([null]);

    const req = createMockRequest({
      projectId: "proj-1",
      scenes: [{ searchKeywords: ["sunset"], assets: [] }],
      aspectRatio: "9:16",
    });

    await (POST as Function)(req, { user: mockUser, supabase: mockSupabase });

    expect(mockFetchAssets).toHaveBeenCalledWith(
      expect.any(Array),
      "proj-1",
    );
  });

  it("appends orientation hint to keywords based on aspectRatio", async () => {
    mockFetchAssets.mockResolvedValue([null]);

    const req = createMockRequest({
      projectId: "proj-1",
      scenes: [{ searchKeywords: ["sunset"], assets: [] }],
      aspectRatio: "16:9",
    });

    await (POST as Function)(req, { user: mockUser, supabase: mockSupabase });

    expect(mockFetchAssets).toHaveBeenCalledWith(
      ["sunset landscape"],
      "proj-1",
    );
  });

  it("returns 400 when projectId or scenes are missing", async () => {
    const req = createMockRequest({ projectId: "proj-1" });

    const response = await (POST as Function)(req, { user: mockUser, supabase: mockSupabase });

    expect(response.status).toBe(400);
  });
});
