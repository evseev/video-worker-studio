import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(() => Promise.resolve({ error: null })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc: mockRpc })),
}));

import { getExcludedSubjectsForChannel, listRecentSubjectKeysForChannel, persistSubjectsForProject } from "@/lib/ai/subject-memory";

describe("getExcludedSubjectsForChannel", () => {
  beforeEach(() => {
    vi.stubEnv("SUBJECT_MEMORY_ENABLED", "true");
  });

  it("respects subject_memory_lookback, filters by channel + completed projects, returns keys", async () => {
    const channelId = "11111111-1111-4111-8111-111111111111";
    const p1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const p2 = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "channels") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() =>
                  Promise.resolve({ data: { subject_memory_lookback: 2 }, error: null })
                ),
              })),
            })),
          };
        }
        if (table === "projects") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() =>
                      Promise.resolve({
                        data: [{ id: p1 }, { id: p2 }],
                        error: null,
                      })
                    ),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "video_subjects") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() =>
                      Promise.resolve({
                        data: [
                          {
                            subject_key: "alpha",
                            subject_normalized: "alpha",
                            embedding: null,
                            created_at: "2026-01-02",
                          },
                          {
                            subject_key: "beta",
                            subject_normalized: "beta",
                            embedding: null,
                            created_at: "2026-01-01",
                          },
                        ],
                        error: null,
                      })
                    ),
                  })),
                })),
              })),
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const keys = await getExcludedSubjectsForChannel(supabase as never, channelId, "idea text", {
      maxSubjects: 50,
    });
    expect(keys).toEqual(["alpha", "beta"]);
  });
});

describe("listRecentSubjectKeysForChannel", () => {
  it("dedupes and caps subject keys", async () => {
    const channelId = "11111111-1111-4111-8111-111111111111";
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() =>
                Promise.resolve({
                  data: [
                    { subject_key: "a", created_at: "1" },
                    { subject_key: "a", created_at: "2" },
                    { subject_key: "b", created_at: "3" },
                  ],
                  error: null,
                })
              ),
            })),
          })),
        })),
      })),
    };
    const keys = await listRecentSubjectKeysForChannel(supabase as never, channelId, 50);
    expect(keys).toEqual(["a", "b"]);
  });
});

describe("persistSubjectsForProject", () => {
  beforeEach(() => {
    mockRpc.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test");
    vi.stubEnv("SUBJECT_MEMORY_ENABLED", "true");
  });

  it("invokes worker_insert_video_subjects with p_channel_id; row payload has no user_id", async () => {
    await persistSubjectsForProject("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "11111111-1111-4111-8111-111111111111", [
      "Topic A",
    ]);

    expect(mockRpc).toHaveBeenCalledWith(
      "worker_insert_video_subjects",
      expect.objectContaining({
        p_channel_id: "11111111-1111-4111-8111-111111111111",
        p_project_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      })
    );
    const rows = (mockRpc.mock.calls[0][1] as { p_rows: Record<string, unknown>[] }).p_rows;
    expect(rows[0]).toMatchObject({ subject_key: expect.any(String), subject_normalized: expect.any(String) });
    expect(rows[0]).not.toHaveProperty("user_id");
    expect(rows[0]).not.toHaveProperty("channel_id");
  });
});
