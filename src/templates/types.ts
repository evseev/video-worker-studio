export type TemplateId = "slideshow" | "comparison" | "fact-card";

export interface AssetSlot {
  url?: string;
  options?: string[];
  selectedIndex?: number;
}

export interface BaseScene {
  template: TemplateId;
  scriptText: string;
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
