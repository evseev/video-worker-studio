import { create } from "zustand";
import type { Tables } from "@/lib/supabase/types";

type Project = Tables<"projects">;

export type WizardStep = "idea" | "refine" | "script" | "preview" | "render";

export type Scene = {
  scriptText: string;
  searchKeyword: string;
  assetUrl?: string;
};

export type VideoSettings = {
  sceneCount: number;
  sceneDuration: number;
  aspectRatio: "16:9" | "9:16";
  quality: "hd" | "fullhd" | "4k";
};

export type RefinedIdea = {
  ideas: string[];
  selectedIdea: string;
  trendScore: number;
  trendReasoning: string;
  trendHooks: string[];
};

type DraftData = {
  scenes?: Scene[];
  settings?: VideoSettings;
  refinedIdea?: RefinedIdea;
};

export type WizardState = {
  projectId: string;
  topic: string;
  currentStep: WizardStep;
  scenes: Scene[];
  selectedTemplate: string;
  settings: VideoSettings;
  refinedIdea: RefinedIdea | null;
  projectStatus: string;
  videoUrl: string | null;
  renderErrorContext: unknown;
  saving: boolean;

  // Actions
  setStep: (step: WizardStep) => void;
  setTopic: (topic: string) => void;
  setScenes: (scenes: Scene[]) => void;
  updateScene: (idx: number, updates: Partial<Scene>) => void;
  removeScene: (idx: number) => void;
  reorderScenes: (fromIdx: number, toIdx: number) => void;
  setSelectedTemplate: (template: string) => void;
  setSettings: (settings: Partial<VideoSettings>) => void;
  setRefinedIdea: (idea: RefinedIdea | null) => void;
  syncFromProject: (project: Project) => void;
  saveProgress: (updates: Record<string, unknown>) => Promise<void>;
};

const DEFAULT_SETTINGS: VideoSettings = {
  sceneCount: 6,
  sceneDuration: 5,
  aspectRatio: "9:16",
  quality: "fullhd",
};

function parseDraftData(project: Project): DraftData {
  if (!project.draft_scenes) return {};
  const raw = typeof project.draft_scenes === "string"
    ? JSON.parse(project.draft_scenes)
    : project.draft_scenes;

  // Support both old format (flat array of scenes) and new format (object with scenes + settings)
  if (Array.isArray(raw)) {
    return { scenes: raw };
  }
  return raw as DraftData;
}


export function createWizardStore(project: Project) {
  const draft = parseDraftData(project);

  return create<WizardState>((set, get) => ({
    projectId: project.id,
    topic: project.topic || "",
    currentStep: (project.wizard_step as WizardStep) || "idea",
    scenes: draft.scenes || [],
    selectedTemplate: project.selected_template || "Slideshow",
    settings: draft.settings || DEFAULT_SETTINGS,
    refinedIdea: draft.refinedIdea || null,
    projectStatus: project.status,
    videoUrl: project.video_url || null,
    renderErrorContext: (project as Record<string, unknown>).render_error_context ?? null,
    saving: false,

    setStep: (step) => set({ currentStep: step }),

    setTopic: (topic) => set({ topic }),

    setScenes: (scenes) => set({ scenes }),

    updateScene: (idx, updates) =>
      set((state) => ({
        scenes: state.scenes.map((s, i) => (i === idx ? { ...s, ...updates } : s)),
      })),

    removeScene: (idx) =>
      set((state) => ({
        scenes: state.scenes.filter((_, i) => i !== idx),
      })),

    reorderScenes: (fromIdx, toIdx) =>
      set((state) => {
        const scenes = [...state.scenes];
        const [moved] = scenes.splice(fromIdx, 1);
        scenes.splice(toIdx, 0, moved);
        return { scenes };
      }),

    setSelectedTemplate: (template) => set({ selectedTemplate: template }),

    setSettings: (updates) =>
      set((state) => ({
        settings: { ...state.settings, ...updates },
      })),

    setRefinedIdea: (idea) => set({ refinedIdea: idea }),

    syncFromProject: (project) =>
      set({
        projectStatus: project.status,
        videoUrl: project.video_url || null,
        renderErrorContext: (project as Record<string, unknown>).render_error_context ?? null,
      }),

    saveProgress: async (updates) => {
      set({ saving: true });
      try {
        const res = await fetch("/api/wizard/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: get().projectId, ...updates }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error("Save failed:", res.status, body);
        }
      } catch (e) {
        console.error("Failed to save progress", e);
      } finally {
        set({ saving: false });
      }
    },
  }));
}

export type WizardStoreApi = ReturnType<typeof createWizardStore>;
