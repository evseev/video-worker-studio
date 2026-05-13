import { describe, it, expect, vi, beforeEach } from "vitest";
import { forceDeleteChannelCascade } from "@/lib/channels/repository";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/projects/delete-project-by-owner", () => ({
  deleteProjectByOwner: vi.fn(),
}));

import { deleteProjectByOwner } from "@/lib/projects/delete-project-by-owner";

function mockSupabaseForCascade(opts: {
  projectIds: string[];
  storageList?: { data: { name: string }[] | null; error: { message: string } | null };
  storageRemove?: { error: { message: string } | null };
  channelDelete?: { error: { message: string } | null };
}) {
  const list = vi.fn().mockResolvedValue(opts.storageList ?? { data: [], error: null });
  const remove = vi.fn().mockResolvedValue(opts.storageRemove ?? { error: null });
  const channelDeleteEq = vi.fn().mockResolvedValue(opts.channelDelete ?? { error: null });

  const projectsSelectEq = vi.fn().mockResolvedValue({
    data: opts.projectIds.map((id) => ({ id })),
    error: null,
  });

  const projectsBuilder = {
    select: vi.fn(function selectFn(this: unknown) {
      return this;
    }),
    eq: projectsSelectEq,
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "projects") {
        return projectsBuilder;
      }
      if (table === "channels") {
        const ch = {
          delete: vi.fn(function deleteFn(this: unknown) {
            return this;
          }),
          eq: channelDeleteEq,
        };
        return ch;
      }
      throw new Error(`unexpected ${table}`);
    }),
    storage: {
      from: vi.fn(() => ({
        list,
        remove,
      })),
    },
  } as unknown as SupabaseClient;
}

describe("forceDeleteChannelCascade", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns partial failures and does not delete channel when a project delete fails", async () => {
    vi.mocked(deleteProjectByOwner)
      .mockResolvedValueOnce({ ok: true, warnings: [] })
      .mockResolvedValueOnce({ ok: false, error: "storage busy" });

    const supabase = mockSupabaseForCascade({ projectIds: ["p1", "p2"] });
    const out = await forceDeleteChannelCascade(supabase, "user-1", "chan-1");

    expect(out.deletedProjects).toBe(1);
    expect(out.partialFailures).toEqual([{ projectId: "p2", error: "storage busy" }]);
    expect(supabase.from).toHaveBeenCalledWith("projects");
    expect(supabase.from).not.toHaveBeenCalledWith("channels");
  });

  it("deletes channel after all projects succeed", async () => {
    vi.mocked(deleteProjectByOwner).mockResolvedValue({ ok: true, warnings: [] });

    const supabase = mockSupabaseForCascade({ projectIds: ["p1"] });
    const out = await forceDeleteChannelCascade(supabase, "user-1", "chan-1");

    expect(out.partialFailures).toHaveLength(0);
    expect(out.deletedProjects).toBe(1);
    expect(supabase.from).toHaveBeenCalledWith("channels");
  });
});
