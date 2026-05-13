import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/with-auth", () => ({
  withAuth: <T>(handler: T) => handler,
}));

const mockGetChannelContext = vi.fn();
vi.mock("@/lib/channels/context", () => ({
  getChannelContextForProject: (...args: unknown[]) => mockGetChannelContext(...args),
}));

const mockEnhanceIdea = vi.fn();
vi.mock("@/lib/ai/wizard", () => ({
  enhanceIdea: (...args: unknown[]) => mockEnhanceIdea(...args),
}));

import { POST } from "@/app/api/wizard/enhance-idea/route";

const postHandler = POST as (
  req: Request,
  ctx: { user: { id: string }; supabase: object }
) => Promise<Response>;

describe("POST /api/wizard/enhance-idea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnhanceIdea.mockResolvedValue(["a", "b", "c"]);
  });

  it("fetches channel context once and passes it to enhanceIdea when projectId set", async () => {
    mockGetChannelContext.mockResolvedValue({ niche: "N" });

    const req = new Request("http://localhost/api/wizard/enhance-idea", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        idea: "raw",
        sceneCount: 6,
        sceneDuration: 5,
      }),
    });

    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      })),
    };
    await postHandler(req, { user: { id: "u1" }, supabase });

    expect(mockGetChannelContext).toHaveBeenCalledTimes(1);
    expect(mockGetChannelContext).toHaveBeenCalledWith(
      supabase,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );
    expect(mockEnhanceIdea).toHaveBeenCalledWith("raw", {
      totalDuration: 30,
      channelContext: { niche: "N" },
    });
  });
});
