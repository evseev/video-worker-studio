/**
 * Active channel contract (Epic 25): list from GET /api/channels; selection priority is
 * URL search param `channel` then localStorage key `vws.activeChannelId`; setActiveChannelId
 * mirrors to both via router.replace (see `src/lib/hooks/use-active-channel.ts`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useActiveChannel } from "@/lib/hooks/use-active-channel";

const replace = vi.fn();
const searchParams = new URLSearchParams("?channel=c1111111-1111-4111-8111-111111111111");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/",
  useSearchParams: () => searchParams,
}));

describe("useActiveChannel", () => {
  beforeEach(() => {
    replace.mockClear();
    searchParams.set("channel", "c1111111-1111-4111-8111-111111111111");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        channels: [
          {
            id: "c1111111-1111-4111-8111-111111111111",
            name: "Main",
            logo_url: null,
            project_count: 1,
          },
        ],
      }),
    }) as unknown as typeof fetch;
  });

  it("syncs activeChannelId from URL when channel exists in list", async () => {
    const { result } = renderHook(() => useActiveChannel());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeChannelId).toBe("c1111111-1111-4111-8111-111111111111");
  });

  it("setActiveChannelId updates URL via router.replace", async () => {
    const { result } = renderHook(() => useActiveChannel());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.setActiveChannelId(null);
    });
    expect(replace).toHaveBeenCalled();
  });
});
