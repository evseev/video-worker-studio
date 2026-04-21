export type TemplateId = "slideshow" | "comparison" | "fact-card";

export interface AssetSlot {
  url?: string;
  options?: string[];
  selectedIndex?: number;
  objectPosition?: string;
}

export interface BaseScene {
  template: TemplateId;
  /**
   * Canonical identity for the scene subject used by dedupe logic.
   * Example: "Tom Cruise", "Tokyo", "Theory of Relativity".
   */
  subjectKey: string;
  /**
   * Spoken narration text. Used for voiceover generation (or as a caption fallback).
   * Typically 1-2 full sentences per scene.
   */
  scriptText: string;
  /**
   * Short on-screen caption rendered by Remotion. Visually punchy and template-specific
   * (e.g. a name for comparison scenes, a headline for fact cards). Falls back to
   * `scriptText` at render time when empty/missing so legacy scenes still render.
   */
  captionText: string;
  searchKeywords: string[];
  assets: AssetSlot[];
}

export interface SlideshowScene extends BaseScene {
  template: "slideshow";
}

export interface ComparisonScene extends BaseScene {
  template: "comparison";
  leftLabel: string;
  rightLabel: string;
}

export interface FactCardScene extends BaseScene {
  template: "fact-card";
  title: string;
  subtitle: string;
  facts: { label: string; value: string }[];
}

export type Scene = SlideshowScene | ComparisonScene | FactCardScene;

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  useCases: string;
  assetsPerScene: 1 | 2;
  defaultSceneCount: number;
}
