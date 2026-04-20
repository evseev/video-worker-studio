import { create } from "zustand";
import type { Tables } from "@/lib/supabase/types";
import type { Scene, TemplateId } from "@/templates/types";
import type { SceneTransition, ImageMotion, TextAnimation } from "@/lib/effects";
import {
  parseCaptionStyle,
  parseComparisonOverlayMode,
  type CaptionStyleId,
  type ComparisonOverlayMode,
} from "@/lib/comparison-caption-styles";

export type { Scene };
export type { TemplateId };
export type { CaptionStyleId, ComparisonOverlayMode };

type Project = Tables<"projects">;

export type WizardStep = "template" | "idea" | "refine" | "script" | "preview" | "render";

export type VideoSettings = {
  sceneCount: number;
  sceneDuration: number;
  aspectRatio: "16:9" | "9:16";
  quality: "720p" | "1080p" | "4k";
  sceneTransition: SceneTransition;
  imageMotion: ImageMotion;
  textAnimation: TextAnimation;
  captionStyle: CaptionStyleId;
  comparisonOverlayMode: ComparisonOverlayMode;
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
  targetKeywords?: string;
  videoTitle?: string;
  videoDescription?: string;
  videoTags?: string[];
};

export type WizardState = {
  projectId: string;
  topic: string;
  currentStep: WizardStep;
  scenes: Scene[];
  selectedTemplate: TemplateId;
  settings: VideoSettings;
  refinedIdea: RefinedIdea | null;
  targetKeywords: string;
  videoTitle: string;
  videoDescription: string;
  videoTags: string[];
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
  setSelectedTemplate: (template: TemplateId) => void;
  setSettings: (settings: Partial<VideoSettings>) => void;
  selectAsset: (sceneIdx: number, slotIdx: number, assetIdx: number) => void;
  setTargetKeywords: (keywords: string) => void;
  setVideoTitle: (title: string) => void;
  setVideoDescription: (desc: string) => void;
  setVideoTags: (tags: string[]) => void;
  setRefinedIdea: (idea: RefinedIdea | null) => void;
  syncFromProject: (project: Project) => void;
  saveProgress: (updates: Record<string, unknown>) => Promise<void>;
};

const DEFAULT_SETTINGS: VideoSettings = {
  sceneCount: 6,
  sceneDuration: 5,
  aspectRatio: "9:16",
  quality: "1080p",
  sceneTransition: "fade",
  imageMotion: "zoom-in",
  textAnimation: "slide-up",
  captionStyle: "minimal",
  comparisonOverlayMode: "both",
};

function buildSettingsFromDraft(project: Project, draft: DraftData): VideoSettings {
  const s = draft.settings;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    captionStyle: parseCaptionStyle(
      (s?.captionStyle as string | undefined) ?? project.caption_style
    ),
    comparisonOverlayMode: parseComparisonOverlayMode(
      (s?.comparisonOverlayMode as string | undefined) ?? project.comparison_overlay_mode
    ),
  };
}

function parseDraftData(project: Project): DraftData {
  if (!project.draft_scenes) return {};
  const raw = typeof project.draft_scenes === "string"
    ? JSON.parse(project.draft_scenes)
    : project.draft_scenes;

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
    currentStep: (project.wizard_step as WizardStep) || "template",
    scenes: draft.scenes || [],
    selectedTemplate: (project.selected_template as TemplateId) || "slideshow",
    settings: buildSettingsFromDraft(project, draft),
    refinedIdea: draft.refinedIdea || null,
    targetKeywords: draft.targetKeywords || "",
    videoTitle: draft.videoTitle || project.video_title || "",
    videoDescription: draft.videoDescription || project.video_description || "",
    videoTags: draft.videoTags || (project.video_tags ? project.video_tags.split(", ") : []),
    projectStatus: project.status,
    videoUrl: project.video_url || null,
    renderErrorContext: (project as Record<string, unknown>).render_error_context ?? null,
    saving: false,

    setStep: (step) => set({ currentStep: step }),

    setTopic: (topic) => set({ topic }),

    setScenes: (scenes) => set({ scenes }),

    updateScene: (idx, updates) =>
      set((state) => ({
        scenes: state.scenes.map((s, i) => (i === idx ? { ...s, ...updates } as Scene : s)),
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

    selectAsset: (sceneIdx, slotIdx, assetIdx) =>
      set((state) => ({
        scenes: state.scenes.map((s, i) => {
          if (i !== sceneIdx) return s;
          const assets = [...s.assets];
          const slot = assets[slotIdx];
          if (!slot?.options?.[assetIdx]) return s;
          assets[slotIdx] = { ...slot, url: slot.options[assetIdx], selectedIndex: assetIdx, objectPosition: undefined };
          return { ...s, assets };
        }),
      })),

    setTargetKeywords: (keywords) => set({ targetKeywords: keywords }),

    setVideoTitle: (title) => set({ videoTitle: title }),

    setVideoDescription: (desc) => set({ videoDescription: desc }),

    setVideoTags: (tags) => set({ videoTags: tags }),

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
          const text = await res.text().catch(() => "");
          console.error("Save failed:", res.status, text);
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
