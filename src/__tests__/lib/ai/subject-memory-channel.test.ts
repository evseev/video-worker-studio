import { describe, it, expect, vi } from "vitest";
import { listRecentSubjectKeysForChannel } from "@/lib/ai/subject-memory";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("listRecentSubjectKeysForChannel", () => {
  it("queries video_subjects scoped by channel_id only", async () => {
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn().mockReturnThis();
    const limit = vi.fn().mockResolvedValue({
      data: [
        { subject_key: "a", created_at: "1" },
        { subject_key: "a", created_at: "2" },
        { subject_key: "b", created_at: "3" },
      ],
      error: null,
    });

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq,
        order,
        limit,
      })),
    } as unknown as SupabaseClient;

    const keys = await listRecentSubjectKeysForChannel(supabase, "chan-z", 50);

    expect(eq).toHaveBeenCalledWith("channel_id", "chan-z");
    expect(keys).toEqual(["a", "b"]);
  });
});
