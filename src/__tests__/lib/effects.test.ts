import { describe, it, expect } from "vitest";
import {
  SCENE_TRANSITIONS,
  IMAGE_MOTIONS,
  TEXT_ANIMATIONS,
  resolveTransitions,
  resolveImageMotions,
  resolveTextAnimations,
  type SceneTransition,
  type ImageMotion,
  type TextAnimation,
  type ResolvedTransition,
  type ResolvedImageMotion,
  type ResolvedTextAnimation,
} from "@/lib/effects";

describe("effects", () => {
  describe("SCENE_TRANSITIONS", () => {
    it("has 6 options including random", () => {
      expect(SCENE_TRANSITIONS).toHaveLength(6);
    });

    it("has fade as first option", () => {
      expect(SCENE_TRANSITIONS[0].id).toBe("fade");
    });

    it("has random as last option", () => {
      expect(SCENE_TRANSITIONS[SCENE_TRANSITIONS.length - 1].id).toBe("random");
    });

    it("every option has id and label", () => {
      for (const t of SCENE_TRANSITIONS) {
        expect(t.id).toBeTruthy();
        expect(t.label).toBeTruthy();
      }
    });
  });

  describe("IMAGE_MOTIONS", () => {
    it("has 10 options including random", () => {
      expect(IMAGE_MOTIONS).toHaveLength(10);
    });

    it("includes pan-horizontal", () => {
      expect(IMAGE_MOTIONS.find((m) => m.id === "pan-horizontal")).toBeDefined();
    });

    it("includes none option", () => {
      expect(IMAGE_MOTIONS.find((m) => m.id === "none")).toBeDefined();
    });
  });

  describe("TEXT_ANIMATIONS", () => {
    it("has 6 options including random", () => {
      expect(TEXT_ANIMATIONS).toHaveLength(6);
    });

    it("includes typewriter", () => {
      expect(TEXT_ANIMATIONS.find((a) => a.id === "typewriter")).toBeDefined();
    });
  });

  describe("resolveTransitions", () => {
    it("repeats a specific transition for all gaps", () => {
      const result = resolveTransitions("slide", 5);
      expect(result).toHaveLength(4); // 5 scenes = 4 gaps
      expect(result.every((t) => t === "slide")).toBe(true);
    });

    it("resolves random to concrete values", () => {
      const result = resolveTransitions("random", 5);
      expect(result).toHaveLength(4);
      const validIds: ResolvedTransition[] = ["fade", "slide", "wipe", "flip", "clock-wipe"];
      for (const t of result) {
        expect(validIds).toContain(t);
      }
    });

    it("returns empty array for 1 scene", () => {
      const result = resolveTransitions("fade", 1);
      expect(result).toHaveLength(0);
    });
  });

  describe("resolveImageMotions", () => {
    it("repeats a specific motion for all scenes", () => {
      const result = resolveImageMotions("pan-left", 4);
      expect(result).toHaveLength(4);
      expect(result.every((m) => m === "pan-left")).toBe(true);
    });

    it("resolves random to concrete values", () => {
      const result = resolveImageMotions("random", 4);
      expect(result).toHaveLength(4);
      const validIds: ResolvedImageMotion[] = [
        "zoom-in", "zoom-out", "pan-left", "pan-right",
        "pan-up", "pan-down", "pan-horizontal", "pan-vertical", "none",
      ];
      for (const m of result) {
        expect(validIds).toContain(m);
      }
    });
  });

  describe("resolveTextAnimations", () => {
    it("repeats a specific animation for all scenes", () => {
      const result = resolveTextAnimations("pop", 3);
      expect(result).toHaveLength(3);
      expect(result.every((a) => a === "pop")).toBe(true);
    });

    it("resolves random to concrete values", () => {
      const result = resolveTextAnimations("random", 3);
      expect(result).toHaveLength(3);
      const validIds: ResolvedTextAnimation[] = [
        "slide-up", "slide-left", "typewriter", "pop", "fade-in",
      ];
      for (const a of result) {
        expect(validIds).toContain(a);
      }
    });
  });
});
