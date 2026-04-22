export const SCENE_COUNT_MIN = 3;
export const SCENE_COUNT_MAX = 120;
export const SCENE_DURATION_MIN = 3;
export const SCENE_DURATION_MAX = 15;

function clampRounded(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

export const clampSceneCount = (n: number): number =>
  clampRounded(n, SCENE_COUNT_MIN, SCENE_COUNT_MAX);

export const clampSceneDuration = (n: number): number =>
  clampRounded(n, SCENE_DURATION_MIN, SCENE_DURATION_MAX);
