import { describe, it, expect, vi } from "vitest";
import { getChannelContextForProject } from "@/lib/channels/context";

describe("getChannelContextForProject", () => {
  it("returns {} when project has no channel row", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({
                data: { channel_id: null, channels: null },
                error: null,
              })
            ),
          })),
        })),
      })),
    };
    await expect(getChannelContextForProject(supabase as never, "p-1")).resolves.toEqual({});
  });

  it("maps joined channel fields to ChannelContext", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({
                data: {
                  channel_id: "c1",
                  channels: {
                    niche: " Tech ",
                    target_language: "en",
                    target_audience: " Builders ",
                    tone: " dry ",
                  },
                },
                error: null,
              })
            ),
          })),
        })),
      })),
    };
    await expect(getChannelContextForProject(supabase as never, "p-1")).resolves.toEqual({
      niche: "Tech",
      targetLanguage: "en",
      targetAudience: "Builders",
      tone: "dry",
    });
  });

  it("never throws on supabase error", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: { message: "x" } })),
          })),
        })),
      })),
    };
    await expect(getChannelContextForProject(supabase as never, "p-1")).resolves.toEqual({});
  });
});
