import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listChannelsWithProjectCounts,
  createChannelForUser,
  countProjectsOnChannel,
  forceDeleteChannelCascade,
} from "@/lib/channels/repository";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/projects/delete-project-by-owner", () => ({
  deleteProjectByOwner: vi.fn(),
}));

import { deleteProjectByOwner } from "@/lib/projects/delete-project-by-owner";

const mockDeleteProjectByOwner = vi.mocked(deleteProjectByOwner);

function chainResult<T>(value: T) {
  return Promise.resolve(value);
}

describe("channels repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listChannelsWithProjectCounts aggregates project counts", async () => {
    const ch1 = { id: "c1", user_id: "u1", name: "A", slug: "a" } as never;
    const ch2 = { id: "c2", user_id: "u1", name: "B", slug: "b" } as never;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "channels") {
          return {
            select: () => ({
              eq: () => ({
                order: () => chainResult({ data: [ch1, ch2], error: null }),
              }),
            }),
          };
        }
        if (table === "projects") {
          return {
            select: () => ({
              eq: () =>
                chainResult({
                  data: [{ channel_id: "c1" }, { channel_id: "c1" }, { channel_id: "c2" }],
                  error: null,
                }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as unknown as SupabaseClient;

    const { data, error } = await listChannelsWithProjectCounts(supabase, "u1");
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data[0].project_count).toBe(2);
    expect(data[1].project_count).toBe(1);
  });

  it("createChannelForUser retries on slug unique violation", async () => {
    let attempts = 0;
    const row = { id: "new", slug: "my-slug-1" } as never;
    const supabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: () => {
              attempts += 1;
              if (attempts === 1) {
                return chainResult({ data: null, error: { code: "23505", message: "dup" } });
              }
              return chainResult({ data: row, error: null });
            },
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const { data, error } = await createChannelForUser(supabase, "u1", "My Slug");
    expect(error).toBeNull();
    expect(data).toEqual(row);
    expect(attempts).toBe(2);
  });

  it("countProjectsOnChannel returns head count", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => chainResult({ count: 4, error: null }),
        }),
      }),
    } as unknown as SupabaseClient;

    const { count, error } = await countProjectsOnChannel(supabase, "c1");
    expect(error).toBeNull();
    expect(count).toBe(4);
  });

  it("forceDeleteChannelCascade returns 207-style partial failures and skips channel delete", async () => {
    mockDeleteProjectByOwner
      .mockResolvedValueOnce({ ok: false, error: "boom" })
      .mockResolvedValueOnce({ ok: true, warnings: [] });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "projects") {
          return {
            select: () => ({
              eq: () => chainResult({ data: [{ id: "p1" }, { id: "p2" }], error: null }),
            }),
          };
        }
        if (table === "channels") {
          return { delete: () => ({ eq: () => chainResult({ error: null }) }) };
        }
        throw new Error(table);
      }),
    } as unknown as SupabaseClient;

    const { partialFailures, deletedProjects } = await forceDeleteChannelCascade(supabase, "u1", "c1");
    expect(partialFailures).toHaveLength(1);
    expect(partialFailures[0].projectId).toBe("p1");
    expect(deletedProjects).toBe(1);
    expect(supabase.from).not.toHaveBeenCalledWith("channels");
  });
});
