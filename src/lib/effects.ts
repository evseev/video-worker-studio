// --- Types ---

export type SceneTransition = "fade" | "slide" | "wipe" | "flip" | "clock-wipe" | "random";
export type ImageMotion =
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "pan-up"
  | "pan-down"
  | "pan-horizontal"
  | "pan-vertical"
  | "none"
  | "random";
export type TextAnimation = "slide-up" | "slide-left" | "typewriter" | "pop" | "fade-in" | "random";

export type ResolvedTransition = Exclude<SceneTransition, "random">;
export type ResolvedImageMotion = Exclude<ImageMotion, "random">;
export type ResolvedTextAnimation = Exclude<TextAnimation, "random">;

// --- Option definitions ---

export interface EffectOption<T extends string> {
  id: T;
  label: string;
  description: string;
}

export const SCENE_TRANSITIONS: EffectOption<SceneTransition>[] = [
  { id: "fade", label: "Fade", description: "Smooth cross-dissolve" },
  { id: "slide", label: "Slide", description: "Next scene slides in" },
  { id: "wipe", label: "Wipe", description: "Directional wipe reveal" },
  { id: "flip", label: "Flip", description: "3D card flip" },
  { id: "clock-wipe", label: "Clock Wipe", description: "Radial clock sweep" },
  { id: "random", label: "Random", description: "Different transition per scene" },
];

export const IMAGE_MOTIONS: EffectOption<ImageMotion>[] = [
  { id: "zoom-in", label: "Zoom In", description: "Slow zoom into image" },
  { id: "zoom-out", label: "Zoom Out", description: "Slow zoom out from image" },
  { id: "pan-left", label: "Pan Left", description: "Slow leftward drift" },
  { id: "pan-right", label: "Pan Right", description: "Slow rightward drift" },
  { id: "pan-up", label: "Pan Up", description: "Slow upward drift" },
  { id: "pan-down", label: "Pan Down", description: "Slow downward drift" },
  { id: "pan-horizontal", label: "Pan Horizontal", description: "Gentle side-to-side sway" },
  { id: "pan-vertical", label: "Pan Vertical", description: "Gentle up-and-down sway" },
  { id: "none", label: "None", description: "Static image, no motion" },
  { id: "random", label: "Random", description: "Different motion per scene" },
];

export const TEXT_ANIMATIONS: EffectOption<TextAnimation>[] = [
  { id: "slide-up", label: "Slide Up", description: "Text slides up and fades in" },
  { id: "slide-left", label: "Slide Left", description: "Text slides from right" },
  { id: "typewriter", label: "Typewriter", description: "Character-by-character reveal" },
  { id: "pop", label: "Pop", description: "Bouncy scale-in effect" },
  { id: "fade-in", label: "Fade In", description: "Simple opacity fade" },
  { id: "random", label: "Random", description: "Different animation per scene" },
];

// --- Resolvers ---

const CONCRETE_TRANSITIONS: ResolvedTransition[] = ["fade", "slide", "wipe", "flip", "clock-wipe"];
const CONCRETE_IMAGE_MOTIONS: ResolvedImageMotion[] = [
  "zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down", "pan-horizontal", "pan-vertical", "none",
];
const CONCRETE_TEXT_ANIMATIONS: ResolvedTextAnimation[] = [
  "slide-up", "slide-left", "typewriter", "pop", "fade-in",
];

function resolveArray<T>(value: string, count: number, options: T[]): T[] {
  if (value === "random") {
    return Array.from({ length: count }, () => options[Math.floor(Math.random() * options.length)]);
  }
  return Array.from({ length: count }, () => value as T);
}

export function resolveTransitions(value: SceneTransition, sceneCount: number): ResolvedTransition[] {
  return resolveArray(value, Math.max(0, sceneCount - 1), CONCRETE_TRANSITIONS);
}

export function resolveImageMotions(value: ImageMotion, sceneCount: number): ResolvedImageMotion[] {
  return resolveArray(value, sceneCount, CONCRETE_IMAGE_MOTIONS);
}

export function resolveTextAnimations(value: TextAnimation, sceneCount: number): ResolvedTextAnimation[] {
  return resolveArray(value, sceneCount, CONCRETE_TEXT_ANIMATIONS);
}
