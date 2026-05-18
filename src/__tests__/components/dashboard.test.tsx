import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Dashboard } from "@/components/dashboard";
import { ToastContainer } from "@/components/ui/toast";
import type { User } from "@supabase/supabase-js";

const CHAN = "c1111111-1111-4111-8111-111111111111";
const push = vi.fn();
const searchParams = new URLSearchParams(`?channel=${CHAN}`);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: vi.fn(() => Promise.resolve()) },
    channel: vi.fn(() => {
      const api = {
        on: vi.fn(() => api),
        subscribe: vi.fn(() => ({})),
      };
      return api;
    }),
    removeChannel: vi.fn(),
  }),
}));

const mockUser = { id: "user-1", email: "t@t.com" } as User;

function defaultFetchImpl(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
  if (url.includes("/api/channels")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        channels: [{ id: CHAN, name: "Main", logo_url: null, project_count: 0 }],
      }),
    });
  }
  if (url.includes("/api/projects") && init?.method === "POST") {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        project: {
          id: "p-new-1111-1111-4111-8111-111111111111",
          topic: "Test topic",
          channel_id: CHAN,
          user_id: "user-1",
          status: "draft",
          wizard_step: "template",
        },
      }),
    });
  }
  return Promise.reject(new Error(`Unexpected fetch: ${url}`));
}

describe("Dashboard project creation", () => {
  beforeEach(() => {
    push.mockClear();
    searchParams.set("channel", CHAN);
    vi.stubGlobal("fetch", vi.fn(defaultFetchImpl) as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("navigates to the wizard after successful POST /api/projects", async () => {
    render(
      <>
        <Dashboard user={mockUser} projects={[]} />
        <ToastContainer />
      </>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /new video/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /new video/i }));

    fireEvent.change(screen.getByPlaceholderText(/tips for better sleep/i), {
      target: { value: "My new video topic" },
    });

    fireEvent.click(screen.getByRole("button", { name: /generate video/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/wizard/p-new-1111-1111-4111-8111-111111111111?step=template");
    });
  });

  it("shows an error toast when POST /api/projects fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        if (url.includes("/api/channels")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              channels: [{ id: CHAN, name: "Main", logo_url: null, project_count: 0 }],
            }),
          });
        }
        if (url.includes("/api/projects") && init?.method === "POST") {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: async () => ({ error: "Channel not found" }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }) as typeof fetch
    );

    render(
      <>
        <Dashboard user={mockUser} projects={[]} />
        <ToastContainer />
      </>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /new video/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /new video/i }));
    fireEvent.change(screen.getByPlaceholderText(/tips for better sleep/i), {
      target: { value: "Topic" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate video/i }));

    await waitFor(() => {
      expect(screen.getByText("Channel not found")).toBeInTheDocument();
    });
    expect(push).not.toHaveBeenCalled();
  });
});
