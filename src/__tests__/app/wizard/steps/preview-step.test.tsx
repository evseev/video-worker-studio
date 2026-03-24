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
    draft_scenes: {
      scenes: [
        { template: "slideshow", scriptText: "Scene 1 text", searchKeywords: ["sunset beach"], assets: [{}] },
        { template: "slideshow", scriptText: "Scene 2 text", searchKeywords: ["mountain view"], assets: [{}] },
      ],
      settings: { sceneCount: 6, sceneDuration: 5, aspectRatio: "9:16", quality: "fullhd" },
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
    fetchSpy = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ assetOptions: [] }),
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
        assetOptions: [
          { slotOptions: [["/a1.jpg", "/a2.jpg", "/a3.jpg"]], sceneIndex: 0 },
          { slotOptions: [["/b1.jpg", "/b2.jpg", "/b3.jpg"]], sceneIndex: 1 },
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
        settings: { sceneCount: 6, sceneDuration: 5, aspectRatio: "9:16", quality: "fullhd" },
      } as unknown,
    }));

    render(<PreviewStep store={store} />);

    // SceneCard asset picker thumbnails should be rendered (the main assertion)
    expect(screen.getAllByRole("button", { name: /Option \d/ })).toHaveLength(3);
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
        settings: { sceneCount: 6, sceneDuration: 5, aspectRatio: "9:16", quality: "fullhd" },
      } as unknown,
    }));

    render(<PreviewStep store={store} />);

    // SceneCard has a refresh button that appears on hover
    const refreshBtn = screen.getByLabelText("Refresh asset");
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
