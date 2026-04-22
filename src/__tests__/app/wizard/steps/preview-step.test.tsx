import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PreviewStep } from "@/app/wizard/[id]/steps/PreviewStep";
import { createWizardStore } from "@/lib/stores/wizard-store";
import type { Tables } from "@/lib/supabase/types";

type Project = Tables<"projects">;

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    user_id: "user-1",
    topic: "test topic",
    status: "draft",
    wizard_step: "preview",
    video_url: null,
    selected_template: "slideshow",
    comparison_overlay_mode: "both",
    draft_scenes: {
      scenes: [
        { template: "slideshow", scriptText: "Scene 1 text", searchKeywords: ["sunset beach"], assets: [{}] },
        { template: "slideshow", scriptText: "Scene 2 text", searchKeywords: ["mountain view"], assets: [{}] },
      ],
      settings: { sceneCount: 6, sceneDuration: 5, aspectRatio: "9:16", quality: "1080p" },
    } as unknown,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Project;
}

describe("PreviewStep", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/wizard/draft") {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(""),
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ assetOptions: [] }),
      });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchSpy as any;
  });

  it("sends multipleAssets: true when fetching all assets", async () => {
    const store = createWizardStore(makeProject());
    render(<PreviewStep store={store} />);

    const fetchBtn = screen.getByText("Fetch All Images");
    fireEvent.click(fetchBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/wizard/fetch-assets",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"multipleAssets":true'),
        }),
      );
    });
  });

  it("handles assetOptions response and updates store scene assets", async () => {
    const store = createWizardStore(makeProject());

    fetchSpy.mockResolvedValue({
      json: () => Promise.resolve({
        scenes: [
          { searchKeywords: ["sunset"], assets: [{ options: ["/a1.jpg", "/a2.jpg", "/a3.jpg"] }] },
          { searchKeywords: ["ocean"], assets: [{ options: ["/b1.jpg", "/b2.jpg", "/b3.jpg"] }] },
        ],
      }),
    });

    render(<PreviewStep store={store} />);

    const fetchBtn = screen.getByText("Fetch All Images");
    fireEvent.click(fetchBtn);

    await waitFor(() => {
      const scenes = store.getState().scenes;
      expect(scenes[0].assets[0].options).toEqual(["/a1.jpg", "/a2.jpg", "/a3.jpg"]);
      expect(scenes[0].assets[0].url).toBe("/a1.jpg");
      expect(scenes[0].assets[0].selectedIndex).toBe(0);
      expect(scenes[1].assets[0].options).toEqual(["/b1.jpg", "/b2.jpg", "/b3.jpg"]);
    });
  });

  it("renders SceneCard components for each scene", () => {
    const store = createWizardStore(makeProject({
      draft_scenes: {
        scenes: [
          {
            template: "slideshow",
            scriptText: "Scene 1",
            searchKeywords: ["sunset"],
            assets: [{ options: ["/a.jpg", "/b.jpg", "/c.jpg"], selectedIndex: 0 }],
          },
        ],
        settings: { sceneCount: 6, sceneDuration: 5, aspectRatio: "9:16", quality: "1080p" },
      } as unknown,
    }));

    render(<PreviewStep store={store} />);

    // SceneCard asset picker thumbnails should be rendered (the main assertion)
    expect(screen.getAllByRole("button", { name: /Option \d/ })).toHaveLength(3);
  });

  it("merges streamed batches progressively", async () => {
    const store = createWizardStore(makeProject());
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `${JSON.stringify({
              type: "batch",
              batchIndex: 0,
              batchCount: 2,
              scenes: [{ sceneIdx: 0, assets: [{ slotIdx: 0, options: ["/a1.jpg", "/a2.jpg"] }] }],
            })}\n`
          )
        );
        controller.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: "done" })}\n`));
        controller.close();
      },
    });

    fetchSpy.mockImplementation((url: string) => {
      if (url === "/api/wizard/draft") {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(""),
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({ body: stream });
    });
    render(<PreviewStep store={store} />);
    fireEvent.click(screen.getByText("Fetch All Images"));

    await waitFor(() => {
      const scenes = store.getState().scenes;
      expect(scenes[0].assets[0].options).toEqual(["/a1.jpg", "/a2.jpg"]);
      expect(scenes[1].assets[0].options).toBeUndefined();
    });
  });

  it("edits captionText (not scriptText) when the Caption textarea changes", () => {
    const store = createWizardStore(makeProject({
      draft_scenes: {
        scenes: [
          {
            template: "slideshow",
            scriptText: "Full narration goes here.",
            captionText: "Old caption",
            searchKeywords: ["sunset"],
            assets: [{ url: "/a.jpg" }],
          },
        ],
        settings: { sceneCount: 6, sceneDuration: 5, aspectRatio: "9:16", quality: "1080p" },
      } as unknown,
    }));

    render(<PreviewStep store={store} />);

    const captionInput = screen.getByPlaceholderText(/Short on-screen caption/i) as HTMLTextAreaElement;
    expect(captionInput.value).toBe("Old caption");
    fireEvent.change(captionInput, { target: { value: "New caption" } });

    const state = store.getState();
    expect(state.scenes[0].captionText).toBe("New caption");
    expect(state.scenes[0].scriptText).toBe("Full narration goes here.");
  });

  it("sends multipleAssets: true when refreshing single scene", async () => {
    const store = createWizardStore(makeProject({
      draft_scenes: {
        scenes: [
          {
            template: "slideshow",
            scriptText: "Scene 1",
            searchKeywords: ["sunset"],
            assets: [{ url: "/old.jpg" }],
          },
        ],
        settings: { sceneCount: 6, sceneDuration: 5, aspectRatio: "9:16", quality: "1080p" },
      } as unknown,
    }));

    render(<PreviewStep store={store} />);

    // DraggableImage shows the refresh button on hover — trigger mouseEnter first
    const img = screen.getByRole("img");
    fireEvent.mouseEnter(img.parentElement!);
    const refreshBtn = await screen.findByLabelText("Refresh image");
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/wizard/fetch-assets",
        expect.objectContaining({
          body: expect.stringContaining('"multipleAssets":true'),
        }),
      );
    });
  });
});
