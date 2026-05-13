import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (handler: (req: Request, ctx: { user: User; supabase: SupabaseClient }) => Promise<Response>) => {
    return async (request: Request) => {
      const supabase = (globalThis as unknown as { __testProjectsSupabase: SupabaseClient }).__testProjectsSupabase;
      return handler(request, {
        user: { id: "u1", email: "t@t.com" } as User,
        supabase,
      });
    };
  },
}));

vi.mock("@/lib/channels/repository", () => ({
  getChannelById: vi.fn(),
}));

import { POST } from "@/app/api/projects/route";
import { getChannelById } from "@/lib/channels/repository";

const mockGetChannel = vi.mocked(getChannelById);

/** Valid v4 UUID for Zod `channelId` in request bodies */
const CHAN = "11111111-1111-4111-8111-111111111111";

function setTestSupabase(client: SupabaseClient) {
  (globalThis as unknown as { __testProjectsSupabase: SupabaseClient }).__testProjectsSupabase = client;
}

describe("POST /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChannel.mockResolvedValue({
      data: { id: CHAN, user_id: "u1", name: "Ch" } as never,
      error: null,
    });
  });

  it("201 with copyLastSettings true copies settings and snapshots channel", async () => {
    const lastRow = {
      selected_template: "slideshow",
      aspect_ratio: "16:9",
      video_quality: "720p",
      background_music: "calm-1",
      caption_style: "minimal",
      comparison_overlay_mode: "both",
      scene_transition: "fade",
      image_motion: "zoom-in",
      text_animation: "slide-up",
      draft_scenes: { settings: { sceneCount: 10, sceneDuration: 7 } },
      voiceover_url: "x",
    };
    const inserted = { id: "p-new", topic: "Hi", channel_id: CHAN, user_id: "u1" };
    let channelUpdatePayload: unknown;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "projects") {
          return {
            select: () => ({
              eq: () => ({
                neq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () => Promise.resolve({ data: lastRow, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            insert: (payload: unknown) => ({
              select: () => ({
                single: () => {
                  expect(payload).toMatchObject({
                    aspect_ratio: "16:9",
                    selected_template: "slideshow",
                    voiceover_url: null,
                  });
                  expect((payload as { draft_scenes: { settings: { sceneCount: number } } }).draft_scenes.settings.sceneCount).toBe(10);
                  return Promise.resolve({ data: inserted, error: null });
                },
              }),
            }),
          };
        }
        if (table === "channels") {
          return {
            update: (patch: unknown) => {
              channelUpdatePayload = patch;
              return {
                eq: () => Promise.resolve({ error: null }),
              };
            },
          };
        }
        throw new Error(`unexpected ${table}`);
      }),
    } as unknown as SupabaseClient;

    setTestSupabase(supabase);

    const res = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: CHAN, copyLastSettings: true, topic: "Hi" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.project.id).toBe("p-new");
    expect(channelUpdatePayload).toMatchObject({
      default_settings: expect.objectContaining({
        aspect_ratio: "16:9",
        sceneCount: 10,
        voiceoverPreferred: true,
      }),
    });
  });

  it("201 with copyLastSettings false skips copy and snapshot", async () => {
    const inserted = { id: "p2", topic: "", channel_id: CHAN };
    const maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const channelUpdate = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "projects") {
          return {
            select: () => ({
              eq: () => ({
                neq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle,
                    }),
                  }),
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: inserted, error: null }),
              }),
            }),
          };
        }
        if (table === "channels") {
          return {
            update: () => ({
              eq: () => {
                channelUpdate();
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        throw new Error(`unexpected ${table}`);
      }),
    } as unknown as SupabaseClient;

    setTestSupabase(supabase);

    const res = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: CHAN, copyLastSettings: false }),
      })
    );
    expect(res.status).toBe(201);
    expect(maybeSingle).not.toHaveBeenCalled();
    expect(channelUpdate).not.toHaveBeenCalled();
  });

  it("201 with copyLastSettings true and no prior project does not snapshot", async () => {
    const inserted = { id: "p3", topic: "", channel_id: CHAN };
    const channelUpdate = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "projects") {
          return {
            select: () => ({
              eq: () => ({
                neq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: inserted, error: null }),
              }),
            }),
          };
        }
        if (table === "channels") {
          return {
            update: () => ({
              eq: () => {
                channelUpdate();
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        throw new Error(`unexpected ${table}`);
      }),
    } as unknown as SupabaseClient;

    setTestSupabase(supabase);

    const res = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: CHAN, copyLastSettings: true }),
      })
    );
    expect(res.status).toBe(201);
    expect(channelUpdate).not.toHaveBeenCalled();
  });

  it("400 when channelId missing", async () => {
    setTestSupabase({ from: vi.fn() } as never);
    const res = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("404 when channel does not exist", async () => {
    mockGetChannel.mockResolvedValue({ data: null, error: null });
    setTestSupabase({ from: vi.fn() } as never);
    const res = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: "00000000-0000-4000-8000-000000000001" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("403 when channel owned by another user", async () => {
    const otherChan = "22222222-2222-4222-8222-222222222222";
    mockGetChannel.mockResolvedValue({
      data: { id: otherChan, user_id: "other", name: "X" } as never,
      error: null,
    });
    setTestSupabase({ from: vi.fn() } as never);
    const res = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: otherChan }),
      })
    );
    expect(res.status).toBe(403);
  });
});
