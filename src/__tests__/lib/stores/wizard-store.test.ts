import { describe, it, expect } from "vitest";
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
    draft_scenes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Project;
}

describe("wizard-store", () => {
  describe("Scene type with assets", () => {
    it("accepts assets with options and selectedIndex in draft data", () => {
      const project = makeProject({
        draft_scenes: {
          scenes: [
            {
              template: "slideshow",
              scriptText: "Hello",
              searchKeywords: ["sunset"],
              assets: [{ url: "/a.jpg", options: ["/a.jpg", "/b.jpg", "/c.jpg"], selectedIndex: 1 }],
            },
          ],
          settings: { sceneCount: 6, sceneDuration: 5, aspectRatio: "9:16", quality: "fullhd" },
        } as unknown,
      });
      const store = createWizardStore(project);
      const state = store.getState();

      expect(state.scenes[0].assets[0].options).toEqual(["/a.jpg", "/b.jpg", "/c.jpg"]);
      expect(state.scenes[0].assets[0].selectedIndex).toBe(1);
    });

    it("handles scenes without asset options", () => {
      const project = makeProject({
        draft_scenes: {
          scenes: [
            {
              template: "slideshow",
              scriptText: "Hello",
              searchKeywords: ["sunset"],
              assets: [{ url: "/old.jpg" }],
            },
          ],
          settings: { sceneCount: 6, sceneDuration: 5, aspectRatio: "9:16", quality: "fullhd" },
        } as unknown,
      });
      const store = createWizardStore(project);
      const state = store.getState();

      expect(state.scenes[0].assets[0].url).toBe("/old.jpg");
      expect(state.scenes[0].assets[0].options).toBeUndefined();
      expect(state.scenes[0].assets[0].selectedIndex).toBeUndefined();
    });

    it("preserves assets through updateScene", () => {
      const project = makeProject({
        draft_scenes: {
          scenes: [
            {
              template: "slideshow",
              scriptText: "Hello",
              searchKeywords: ["sunset"],
              assets: [{ options: ["/a.jpg", "/b.jpg", "/c.jpg"], selectedIndex: 0 }],
            },
          ],
        } as unknown,
      });
      const store = createWizardStore(project);

      store.getState().updateScene(0, { scriptText: "Updated" });
      const scene = store.getState().scenes[0];

      expect(scene.scriptText).toBe("Updated");
      expect(scene.assets[0].options).toEqual(["/a.jpg", "/b.jpg", "/c.jpg"]);
      expect(scene.assets[0].selectedIndex).toBe(0);
    });
  });

  describe("selectAsset action", () => {
    it("updates asset url and selectedIndex atomically", () => {
      const project = makeProject({
        draft_scenes: {
          scenes: [
            {
              template: "slideshow",
              scriptText: "Hello",
              searchKeywords: ["sunset"],
              assets: [{ url: "/a.jpg", options: ["/a.jpg", "/b.jpg", "/c.jpg"], selectedIndex: 0 }],
            },
          ],
        } as unknown,
      });
      const store = createWizardStore(project);

      store.getState().selectAsset(0, 0, 2);
      const scene = store.getState().scenes[0];

      expect(scene.assets[0].url).toBe("/c.jpg");
      expect(scene.assets[0].selectedIndex).toBe(2);
    });

    it("no-ops when assetIndex is out of bounds", () => {
      const project = makeProject({
        draft_scenes: {
          scenes: [
            {
              template: "slideshow",
              scriptText: "Hello",
              searchKeywords: ["sunset"],
              assets: [{ url: "/a.jpg", options: ["/a.jpg"], selectedIndex: 0 }],
            },
          ],
        } as unknown,
      });
      const store = createWizardStore(project);

      store.getState().selectAsset(0, 0, 5);
      const scene = store.getState().scenes[0];

      expect(scene.assets[0].url).toBe("/a.jpg");
      expect(scene.assets[0].selectedIndex).toBe(0);
    });

    it("no-ops when slot has no options", () => {
      const project = makeProject({
        draft_scenes: {
          scenes: [
            {
              template: "slideshow",
              scriptText: "Hello",
              searchKeywords: ["sunset"],
              assets: [{ url: "/old.jpg" }],
            },
          ],
        } as unknown,
      });
      const store = createWizardStore(project);

      store.getState().selectAsset(0, 0, 0);
      const scene = store.getState().scenes[0];

      expect(scene.assets[0].url).toBe("/old.jpg");
      expect(scene.assets[0].selectedIndex).toBeUndefined();
    });

    it("no-ops for invalid scene index", () => {
      const project = makeProject({
        draft_scenes: {
          scenes: [
            {
              template: "slideshow",
              scriptText: "Hello",
              searchKeywords: ["sunset"],
              assets: [{ options: ["/a.jpg", "/b.jpg"], selectedIndex: 0 }],
            },
          ],
        } as unknown,
      });
      const store = createWizardStore(project);

      store.getState().selectAsset(99, 0, 0);
      const scene = store.getState().scenes[0];

      expect(scene.assets[0].selectedIndex).toBe(0);
    });
  });

  describe("parseDraftData", () => {
    it("parses old flat array format", () => {
      const project = makeProject({
        draft_scenes: [
          {
            template: "slideshow",
            scriptText: "Scene 1",
            searchKeywords: ["kw1"],
            assets: [{}],
          },
          {
            template: "slideshow",
            scriptText: "Scene 2",
            searchKeywords: ["kw2"],
            assets: [{}],
          },
        ] as unknown,
      });
      const store = createWizardStore(project);
      const state = store.getState();

      expect(state.scenes).toHaveLength(2);
      expect(state.scenes[0].scriptText).toBe("Scene 1");
    });

    it("parses new format with settings and asset options", () => {
      const project = makeProject({
        draft_scenes: {
          scenes: [
            {
              template: "slideshow",
              scriptText: "Scene 1",
              searchKeywords: ["kw1"],
              assets: [{ options: ["/x.jpg", "/y.jpg"], selectedIndex: 1 }],
            },
          ],
          settings: { sceneCount: 4, sceneDuration: 3, aspectRatio: "16:9", quality: "hd" },
        } as unknown,
      });
      const store = createWizardStore(project);
      const state = store.getState();

      expect(state.scenes[0].assets[0].options).toEqual(["/x.jpg", "/y.jpg"]);
      expect(state.scenes[0].assets[0].selectedIndex).toBe(1);
      expect(state.settings.aspectRatio).toBe("16:9");
    });

    it("handles null draft_scenes", () => {
      const project = makeProject({ draft_scenes: null });
      const store = createWizardStore(project);

      expect(store.getState().scenes).toEqual([]);
    });
  });

  describe("SEO metadata fields", () => {
    it("initializes targetKeywords, videoDescription, videoTags from draft", () => {
      const project = makeProject({
        draft_scenes: {
          scenes: [],
          settings: { sceneCount: 6, sceneDuration: 5, aspectRatio: "9:16", quality: "fullhd" },
          targetKeywords: "fitness tips",
          videoDescription: "A great video about fitness",
          videoTags: ["fitness", "health", "tips"],
        } as unknown,
      });
      const store = createWizardStore(project);
      const state = store.getState();

      expect(state.targetKeywords).toBe("fitness tips");
      expect(state.videoDescription).toBe("A great video about fitness");
      expect(state.videoTags).toEqual(["fitness", "health", "tips"]);
    });

    it("falls back to project columns when draft is empty", () => {
      const project = makeProject({
        draft_scenes: null,
        video_description: "From DB column",
        video_tags: "tag1, tag2, tag3",
      });
      const store = createWizardStore(project);
      const state = store.getState();

      expect(state.videoDescription).toBe("From DB column");
      expect(state.videoTags).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("defaults to empty when no draft or project data", () => {
      const project = makeProject({ draft_scenes: null });
      const store = createWizardStore(project);
      const state = store.getState();

      expect(state.targetKeywords).toBe("");
      expect(state.videoDescription).toBe("");
      expect(state.videoTags).toEqual([]);
    });

    it("setTargetKeywords updates state", () => {
      const store = createWizardStore(makeProject());
      store.getState().setTargetKeywords("new keywords");
      expect(store.getState().targetKeywords).toBe("new keywords");
    });

    it("setVideoDescription updates state", () => {
      const store = createWizardStore(makeProject());
      store.getState().setVideoDescription("New description");
      expect(store.getState().videoDescription).toBe("New description");
    });

    it("setVideoTags updates state", () => {
      const store = createWizardStore(makeProject());
      store.getState().setVideoTags(["a", "b", "c"]);
      expect(store.getState().videoTags).toEqual(["a", "b", "c"]);
    });
  });
});
