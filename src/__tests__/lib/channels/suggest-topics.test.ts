import { describe, it, expect, vi, beforeEach } from "vitest";
import { runChannelTopicSuggestions, truncateChannelField } from "@/lib/channels/suggest-topics";

vi.mock("@/lib/channels/repository", () => ({
  getChannelById: vi.fn(),
}));

vi.mock("@/lib/ai/subject-memory", () => ({
  listRecentSubjectKeysForChannel: vi.fn(),
}));

vi.mock("@/lib/ai/gemini", () => ({
  createGeminiClient: vi.fn(() => ({})),
  getTextModel: vi.fn(() => ({})),
  generateTextOrThrow: vi.fn(),
}));

vi.mock("@/lib/ai/prompts", () => ({
  channelTopicSuggestionsPrompt: vi.fn(() => "prompt-body"),
}));

import { getChannelById } from "@/lib/channels/repository";
import { listRecentSubjectKeysForChannel } from "@/lib/ai/subject-memory";
import { generateTextOrThrow } from "@/lib/ai/gemini";
import { channelTopicSuggestionsPrompt } from "@/lib/ai/prompts";

describe("truncateChannelField", () => {
  it("caps channel context fields at 200 characters", () => {
    const long = "a".repeat(250);
    expect(truncateChannelField(long).length).toBe(200);
    expect(truncateChannelField("  hi  ")).toBe("hi");
  });
});

describe("runChannelTopicSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when channel is missing", async () => {
    vi.mocked(getChannelById).mockResolvedValueOnce({ data: null, error: null });
    const supabase = {} as never;
    await expect(
      runChannelTopicSuggestions(supabase, "missing", { count: 3, persist: false })
    ).rejects.toThrow(/not found/i);
  });

  it("calls Gemini with exclusions and caps top videos at 10 in prompt input", async () => {
    const manyVideos = Array.from({ length: 15 }, (_, i) => ({
      id: `v${i}`,
      title: `t${i}`,
      view_count: i,
    }));
    vi.mocked(getChannelById).mockResolvedValueOnce({
      data: {
        id: "chan-1",
        niche: "x",
        target_language: "en",
        target_audience: "y",
        tone: "z",
        youtube_meta: {
          fetched_at: new Date().toISOString(),
          top_videos: manyVideos,
        },
      },
      error: null,
    });
    vi.mocked(listRecentSubjectKeysForChannel).mockResolvedValue(["ex-a", "ex-b"]);
    vi.mocked(generateTextOrThrow).mockResolvedValue(
      JSON.stringify({
        ideas: [
          { idea_text: "One", ai_reasoning: "r", inspired_by_video_id: "v0" },
          { idea_text: "Two" },
        ],
      })
    );

    const from = vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }));
    const supabase = { from } as never;

    const out = await runChannelTopicSuggestions(supabase, "chan-1", { count: 2, persist: false });

    expect(out.ideas).toHaveLength(2);
    expect(listRecentSubjectKeysForChannel).toHaveBeenCalledWith(supabase, "chan-1", 50);
    expect(channelTopicSuggestionsPrompt).toHaveBeenCalled();
    const arg = vi.mocked(channelTopicSuggestionsPrompt).mock.calls[0][0];
    expect(arg.topVideos?.length).toBeLessThanOrEqual(10);
    expect(arg.exclusions).toEqual(["ex-a", "ex-b"]);
    expect(from).not.toHaveBeenCalled();
  });
});
