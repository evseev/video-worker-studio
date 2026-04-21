import { describe, expect, it } from "vitest";
import {
  clampSceneCount,
  clampSceneDuration,
  SCENE_COUNT_MAX,
  SCENE_COUNT_MIN,
  SCENE_DURATION_MAX,
  SCENE_DURATION_MIN,
} from "@/lib/video-constraints";

describe("video constraints", () => {
  it("clamps scene count to bounds", () => {
    expect(clampSceneCount(SCENE_COUNT_MIN - 10)).toBe(SCENE_COUNT_MIN);
    expect(clampSceneCount(SCENE_COUNT_MAX + 10)).toBe(SCENE_COUNT_MAX);
    expect(clampSceneCount(42)).toBe(42);
  });

  it("clamps scene duration to bounds", () => {
    expect(clampSceneDuration(SCENE_DURATION_MIN - 10)).toBe(SCENE_DURATION_MIN);
    expect(clampSceneDuration(SCENE_DURATION_MAX + 10)).toBe(SCENE_DURATION_MAX);
    expect(clampSceneDuration(9)).toBe(9);
  });
});
