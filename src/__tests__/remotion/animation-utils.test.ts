import { describe, it, expect } from "vitest";
import { getImageTransform, getTextStyle } from "@/remotion/animation-utils";

describe("getImageTransform", () => {
  it("zoom-in scales from 1.0 to 1.1", () => {
    const start = getImageTransform("zoom-in", 0);
    const end = getImageTransform("zoom-in", 1);
    expect(start.transform).toBe("scale(1)");
    expect(end.transform).toBe("scale(1.1)");
  });

  it("zoom-out scales from 1.1 to 1.0", () => {
    const start = getImageTransform("zoom-out", 0);
    const end = getImageTransform("zoom-out", 1);
    expect(start.transform).toBe("scale(1.1)");
    expect(end.transform).toBe("scale(1)");
  });

  it("pan-left translates X negatively", () => {
    const end = getImageTransform("pan-left", 1);
    expect(end.transform).toBe("translateX(-5%)");
  });

  it("pan-right translates X positively", () => {
    const end = getImageTransform("pan-right", 1);
    expect(end.transform).toBe("translateX(5%)");
  });

  it("pan-up translates Y negatively", () => {
    const end = getImageTransform("pan-up", 1);
    expect(end.transform).toBe("translateY(-5%)");
  });

  it("pan-down translates Y positively", () => {
    const end = getImageTransform("pan-down", 1);
    expect(end.transform).toBe("translateY(5%)");
  });

  it("pan-horizontal returns sinusoidal translateX", () => {
    const mid = getImageTransform("pan-horizontal", 0.25);
    // At 25% progress: sin(0.25 * 2π) = sin(π/2) = 1 → translateX(3%)
    expect(mid.transform).toBe("translateX(3%)");
  });

  it("pan-vertical returns sinusoidal translateY", () => {
    const mid = getImageTransform("pan-vertical", 0.25);
    // At 25% progress: sin(0.25 * 2π) = sin(π/2) = 1 → translateY(3%)
    expect(mid.transform).toBe("translateY(3%)");
  });

  it("none returns no transform", () => {
    const result = getImageTransform("none", 0.5);
    expect(result.transform).toBe("none");
  });
});

describe("getTextStyle", () => {
  const fps = 30;

  it("slide-up: invisible at start", () => {
    const style = getTextStyle("slide-up", 0, 0, fps);
    expect(style.opacity).toBe(0);
  });

  it("slide-up: fully visible after 0.5s", () => {
    const style = getTextStyle("slide-up", 15, 0, fps);
    expect(style.opacity).toBe(1);
    expect(style.transform).toBe("translateY(0px)");
  });

  it("slide-left: translates X", () => {
    const style = getTextStyle("slide-left", 0, 0, fps);
    expect(style.transform).toBe("translateX(30px)");
  });

  it("typewriter: reveals progressively", () => {
    const style = getTextStyle("typewriter", 0, 0, fps);
    expect(style.clipPath).toContain("inset");
  });

  it("typewriter: fully revealed after duration", () => {
    const style = getTextStyle("typewriter", 30, 0, fps);
    expect(style.clipPath).toBe("inset(0 0% 0 0)");
  });

  it("pop: scales with overshoot", () => {
    const mid = getTextStyle("pop", 6, 0, fps);
    expect(mid.opacity).toBeGreaterThan(0);
    expect(mid.transform).toContain("scale");
  });

  it("fade-in: only changes opacity", () => {
    const start = getTextStyle("fade-in", 0, 0, fps);
    const end = getTextStyle("fade-in", 15, 0, fps);
    expect(start.opacity).toBe(0);
    expect(end.opacity).toBe(1);
    expect(end.transform).toBeUndefined();
  });

  it("respects startFrame offset", () => {
    const before = getTextStyle("slide-up", 5, 10, fps);
    expect(before.opacity).toBe(0);
    const after = getTextStyle("slide-up", 25, 10, fps);
    expect(after.opacity).toBe(1);
  });
});
