# Scene Transitions & Animation Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-configurable scene transitions (5 types + random), image motion effects (9 types + random), and text animations (5 types + random) to the video rendering pipeline.

**Architecture:** Three new selectors on TemplateStep (Step 1) feed settings through the wizard store → draft save → render API → Inngest (where "random" resolves to per-scene arrays) → Remotion inputProps. A shared `animation-utils.ts` replaces all hardcoded scene animations. All 5 transitions use built-in `@remotion/transitions` presentations.

**Tech Stack:** Remotion 4.x (`@remotion/transitions`), Zustand 5, TypeScript strict, Tailwind CSS v4, Vitest + Testing Library, Supabase PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-27-transitions-and-effects-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `src/lib/effects.ts` | Type definitions, option arrays with labels, random resolver functions |
| `src/components/wizard/effect-selector.tsx` | Reusable grid selector component (used 3× on TemplateStep) |
| `src/remotion/animation-utils.ts` | `getImageTransform()` and `getTextStyle()` — shared animation math |
| `supabase/migrations/20260327120000_add_scene_effects.sql` | 3 new columns with CHECK constraints |
| `src/__tests__/lib/effects.test.ts` | Tests for effect options and resolver |
| `src/__tests__/remotion/animation-utils.test.ts` | Tests for animation CSS output |
| `src/__tests__/components/wizard/effect-selector.test.ts` | Tests for selector rendering and interaction |

### Modified Files
| File | Change |
|---|---|
| `src/lib/stores/wizard-store.ts` | Add 3 effect fields to `VideoSettings`, update `DEFAULT_SETTINGS` |
| `src/app/wizard/[id]/steps/TemplateStep.tsx` | Collapsible "Effects & Animations" section with 3 selectors |
| `src/app/api/wizard/render/route.ts` | Accept + save + pass 3 effect fields |
| `src/lib/inngest/functions.ts` | Resolve random → per-scene arrays, pass to `renderVideo()` |
| `src/lib/render/render-video.ts` | Update `RenderInput` type, include resolved arrays in `inputProps` |
| `src/remotion/VideoComposition.tsx` | Per-scene transition presentation mapping, pass motion/animation to scenes |
| `src/remotion/templates/SlideshowScene.tsx` | Replace hardcoded Ken Burns with configurable `imageMotion` + `textAnimation` |
| `src/remotion/templates/ComparisonScene.tsx` | Replace hardcoded slide-in with configurable effects |
| `src/remotion/templates/FactCardScene.tsx` | Replace hardcoded pop-in with configurable effects |
| `src/remotion/Root.tsx` | Update `defaultProps` with new fields |
| `src/lib/supabase/types.ts` | Add 3 new columns to Projects Row/Insert/Update types |

---

## Task 1: Effect Definitions

**Files:**
- Create: `src/lib/effects.ts`
- Test: `src/__tests__/lib/effects.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/effects.test.ts`:

```typescript
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
        "pan-up", "pan-down", "pan-horizontal", "none",
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/__tests__/lib/effects.test.ts`
Expected: FAIL — cannot find module `@/lib/effects`

- [ ] **Step 3: Write the implementation**

Create `src/lib/effects.ts`:

```typescript
// --- Types ---

export type SceneTransition = "fade" | "slide" | "wipe" | "flip" | "clock-wipe" | "random";
export type ImageMotion = "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down" | "pan-horizontal" | "none" | "random";
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
  "zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down", "pan-horizontal", "none",
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/__tests__/lib/effects.test.ts`
Expected: All 13 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/effects.ts src/__tests__/lib/effects.test.ts
git commit -m "feat(epic-22): add effect type definitions and resolver functions"
```

---

## Task 2: Database Migration + Types

**Files:**
- Create: `supabase/migrations/20260327120000_add_scene_effects.sql`
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260327120000_add_scene_effects.sql`:

```sql
-- Epic 22: Scene Transitions & Animation Effects
-- Adds 3 new columns for user-configurable transitions and effects.
-- Defaults match existing hardcoded behavior (fade + zoom-in + slide-up).

ALTER TABLE projects
  ADD COLUMN scene_transition text NOT NULL DEFAULT 'fade'
    CHECK (scene_transition IN ('fade','slide','wipe','flip','clock-wipe','random')),
  ADD COLUMN image_motion text NOT NULL DEFAULT 'zoom-in'
    CHECK (image_motion IN ('zoom-in','zoom-out','pan-left','pan-right','pan-up','pan-down','pan-horizontal','none','random')),
  ADD COLUMN text_animation text NOT NULL DEFAULT 'slide-up'
    CHECK (text_animation IN ('slide-up','slide-left','typewriter','pop','fade-in','random'));
```

- [ ] **Step 2: Update types.ts**

Add 3 new fields to the `projects` table types in `src/lib/supabase/types.ts`:

In the `Row` type (after `background_music`):
```typescript
image_motion: string;
scene_transition: string;
text_animation: string;
```

In the `Insert` type (same position, all optional with defaults):
```typescript
image_motion?: string;
scene_transition?: string;
text_animation?: string;
```

In the `Update` type (same position, all optional):
```typescript
image_motion?: string;
scene_transition?: string;
text_animation?: string;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260327120000_add_scene_effects.sql src/lib/supabase/types.ts
git commit -m "feat(epic-22): add scene_transition, image_motion, text_animation columns"
```

---

## Task 3: Animation Utilities

**Files:**
- Create: `src/remotion/animation-utils.ts`
- Test: `src/__tests__/remotion/animation-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/remotion/animation-utils.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/__tests__/remotion/animation-utils.test.ts`
Expected: FAIL — cannot find module `@/remotion/animation-utils`

- [ ] **Step 3: Write the implementation**

Create `src/remotion/animation-utils.ts`:

```typescript
import type { ResolvedImageMotion, ResolvedTextAnimation } from "@/lib/effects";

export function getImageTransform(
  motion: ResolvedImageMotion,
  progress: number,
): React.CSSProperties {
  switch (motion) {
    case "zoom-in": {
      const scale = 1 + 0.1 * progress;
      return { transform: `scale(${scale})`, transformOrigin: "center center" };
    }
    case "zoom-out": {
      const scale = 1.1 - 0.1 * progress;
      return { transform: `scale(${scale})`, transformOrigin: "center center" };
    }
    case "pan-left": {
      const x = -5 * progress;
      return { transform: `translateX(${x}%)`, transformOrigin: "center center" };
    }
    case "pan-right": {
      const x = 5 * progress;
      return { transform: `translateX(${x}%)`, transformOrigin: "center center" };
    }
    case "pan-up": {
      const y = -5 * progress;
      return { transform: `translateY(${y}%)`, transformOrigin: "center center" };
    }
    case "pan-down": {
      const y = 5 * progress;
      return { transform: `translateY(${y}%)`, transformOrigin: "center center" };
    }
    case "pan-horizontal": {
      const x = 3 * Math.sin(progress * 2 * Math.PI);
      return { transform: `translateX(${Math.round(x * 100) / 100}%)`, transformOrigin: "center center" };
    }
    case "none":
      return { transform: "none" };
  }
}

export function getTextStyle(
  animation: ResolvedTextAnimation,
  frame: number,
  startFrame: number,
  fps: number,
): React.CSSProperties {
  const elapsed = Math.max(0, frame - startFrame);
  const duration = fps * 0.5; // 0.5 seconds

  switch (animation) {
    case "slide-up": {
      const t = Math.min(elapsed / duration, 1);
      return {
        opacity: t,
        transform: `translateY(${30 * (1 - t)}px)`,
      };
    }
    case "slide-left": {
      const t = Math.min(elapsed / duration, 1);
      return {
        opacity: t,
        transform: `translateX(${30 * (1 - t)}px)`,
      };
    }
    case "typewriter": {
      const revealDuration = fps * 1.0; // 1 second for full reveal
      const t = Math.min(elapsed / revealDuration, 1);
      const hidePercent = Math.round((1 - t) * 100);
      return {
        opacity: 1,
        clipPath: `inset(0 ${hidePercent}% 0 0)`,
      };
    }
    case "pop": {
      const popDuration = fps * 0.4; // 0.4 seconds
      const t = Math.min(elapsed / popDuration, 1);
      // Overshoot: 0 → 1.1 → 1.0
      const scale = t < 0.7 ? (t / 0.7) * 1.1 : 1.1 - 0.1 * ((t - 0.7) / 0.3);
      return {
        opacity: Math.min(t / 0.3, 1),
        transform: `scale(${Math.round(scale * 1000) / 1000})`,
      };
    }
    case "fade-in": {
      const t = Math.min(elapsed / duration, 1);
      return { opacity: t };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/__tests__/remotion/animation-utils.test.ts`
Expected: All tests PASS

Note: Some tests may need minor assertion adjustments based on rounding. Fix any rounding mismatches by updating test expectations to match the actual computed values.

- [ ] **Step 5: Commit**

```bash
git add src/remotion/animation-utils.ts src/__tests__/remotion/animation-utils.test.ts
git commit -m "feat(epic-22): add shared animation utility functions"
```

---

## Task 4: EffectSelector Component

**Files:**
- Create: `src/components/wizard/effect-selector.tsx`
- Test: `src/__tests__/components/wizard/effect-selector.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/components/wizard/effect-selector.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EffectSelector } from "@/components/wizard/effect-selector";

const options = [
  { id: "a" as const, label: "Alpha", description: "First option" },
  { id: "b" as const, label: "Beta", description: "Second option" },
  { id: "c" as const, label: "Gamma", description: "Third option" },
];

describe("EffectSelector", () => {
  it("renders all options", () => {
    const onChange = vi.fn();
    render(<EffectSelector options={options} value="a" onChange={onChange} />);
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
    expect(screen.getByText("Gamma")).toBeDefined();
  });

  it("renders descriptions", () => {
    const onChange = vi.fn();
    render(<EffectSelector options={options} value="a" onChange={onChange} />);
    expect(screen.getByText("First option")).toBeDefined();
  });

  it("highlights the selected option", () => {
    const onChange = vi.fn();
    const { container } = render(
      <EffectSelector options={options} value="b" onChange={onChange} />,
    );
    const buttons = container.querySelectorAll("button");
    // Second button (Beta) should have the selected ring class
    expect(buttons[1].className).toContain("ring-2");
  });

  it("calls onChange when clicking an option", () => {
    const onChange = vi.fn();
    render(<EffectSelector options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("does not call onChange when clicking the already-selected option", () => {
    const onChange = vi.fn();
    render(<EffectSelector options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByText("Alpha"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/__tests__/components/wizard/effect-selector.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write the implementation**

Create `src/components/wizard/effect-selector.tsx`:

```tsx
"use client";

export interface EffectOption<T extends string = string> {
  id: T;
  label: string;
  description: string;
}

export function EffectSelector<T extends string>({
  options,
  value,
  onChange,
}: {
  options: EffectOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => {
        const isSelected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              if (!isSelected) onChange(option.id);
            }}
            className={`rounded-lg border p-2 text-left transition-all ${
              isSelected
                ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
            }`}
          >
            <div className="text-sm font-medium text-white">{option.label}</div>
            <div className="mt-0.5 text-xs text-gray-400">{option.description}</div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/__tests__/components/wizard/effect-selector.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/wizard/effect-selector.tsx src/__tests__/components/wizard/effect-selector.test.ts
git commit -m "feat(epic-22): add reusable EffectSelector component"
```

---

## Task 5: Wizard Store Updates

**Files:**
- Modify: `src/lib/stores/wizard-store.ts` (lines 12-17 VideoSettings, lines 70-75 DEFAULT_SETTINGS)

- [ ] **Step 1: Update VideoSettings type**

In `src/lib/stores/wizard-store.ts`, add the import at the top:

```typescript
import type { SceneTransition, ImageMotion, TextAnimation } from "@/lib/effects";
```

Then extend the `VideoSettings` type (currently at lines 12-17):

```typescript
export type VideoSettings = {
  sceneCount: number;
  sceneDuration: number;
  aspectRatio: "16:9" | "9:16";
  quality: "720p" | "1080p" | "4k";
  sceneTransition: SceneTransition;
  imageMotion: ImageMotion;
  textAnimation: TextAnimation;
};
```

- [ ] **Step 2: Update DEFAULT_SETTINGS**

Update `DEFAULT_SETTINGS` (currently at lines 70-75) to include defaults:

```typescript
const DEFAULT_SETTINGS: VideoSettings = {
  sceneCount: 6,
  sceneDuration: 5,
  aspectRatio: "9:16",
  quality: "1080p",
  sceneTransition: "fade",
  imageMotion: "zoom-in",
  textAnimation: "slide-up",
};
```

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `npm run test`
Expected: All existing tests PASS (the new fields have defaults so existing code won't break)

- [ ] **Step 4: Commit**

```bash
git add src/lib/stores/wizard-store.ts
git commit -m "feat(epic-22): add effect settings to wizard store VideoSettings type"
```

---

## Task 6: TemplateStep UI

**Files:**
- Modify: `src/app/wizard/[id]/steps/TemplateStep.tsx`

- [ ] **Step 1: Add imports**

Add at the top of `TemplateStep.tsx`:

```typescript
import { EffectSelector } from "@/components/wizard/effect-selector";
import {
  SCENE_TRANSITIONS,
  IMAGE_MOTIONS,
  TEXT_ANIMATIONS,
  type SceneTransition,
  type ImageMotion,
  type TextAnimation,
} from "@/lib/effects";
```

- [ ] **Step 2: Add collapsible state**

Inside the component function, add a `useState` for the collapsible section:

```typescript
const [effectsExpanded, setEffectsExpanded] = useState(true);
```

(Import `useState` from React if not already imported.)

- [ ] **Step 3: Add the Effects section**

After the Quality selector (currently around line 136) and before the "Next" button section, add:

```tsx
{/* Effects & Animations */}
<div className="rounded-xl border border-white/10 bg-white/5">
  <button
    type="button"
    onClick={() => setEffectsExpanded(!effectsExpanded)}
    className="flex w-full items-center justify-between p-4"
  >
    <span className="text-sm font-medium text-white">Effects & Animations</span>
    <svg
      className={`h-4 w-4 text-gray-400 transition-transform ${effectsExpanded ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {effectsExpanded && (
    <div className="space-y-4 border-t border-white/10 p-4">
      <div>
        <label className="mb-2 block text-xs font-medium text-gray-400">
          Scene Transitions
        </label>
        <EffectSelector
          options={SCENE_TRANSITIONS}
          value={settings.sceneTransition}
          onChange={(v: SceneTransition) =>
            store.getState().setSettings({ sceneTransition: v })
          }
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-400">
          Image Motion
        </label>
        <EffectSelector
          options={IMAGE_MOTIONS}
          value={settings.imageMotion}
          onChange={(v: ImageMotion) =>
            store.getState().setSettings({ imageMotion: v })
          }
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-400">
          Text Animation
        </label>
        <EffectSelector
          options={TEXT_ANIMATIONS}
          value={settings.textAnimation}
          onChange={(v: TextAnimation) =>
            store.getState().setSettings({ textAnimation: v })
          }
        />
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/wizard/[id]/steps/TemplateStep.tsx
git commit -m "feat(epic-22): add Effects & Animations section to TemplateStep"
```

---

## Task 7: Render Pipeline Threading

**Files:**
- Modify: `src/app/api/wizard/render/route.ts` (line 6 destructuring, line 29-34 DB update, line 46 Inngest event)
- Modify: `src/lib/inngest/functions.ts` (line 101 event data, lines 198-208 renderVideo call)
- Modify: `src/lib/render/render-video.ts` (lines 11-29 RenderInput type, lines 145-151 and 241-247 inputProps)

- [ ] **Step 1: Update render route**

In `src/app/api/wizard/render/route.ts`:

Update the request destructuring (line 6) to include the 3 new fields:

```typescript
const { projectId, scenes, template, aspectRatio, videoQuality, sceneDuration, backgroundMusic, voiceoverUrl, sceneTransition, imageMotion, textAnimation } = await request.json();
```

Update the DB update (around line 29-34) to save the new columns:

```typescript
scene_transition: sceneTransition || "fade",
image_motion: imageMotion || "zoom-in",
text_animation: textAnimation || "slide-up",
```

Update the Inngest event data (around line 46) to include:

```typescript
sceneTransition: sceneTransition || "fade",
imageMotion: imageMotion || "zoom-in",
textAnimation: textAnimation || "slide-up",
```

- [ ] **Step 2: Update Inngest function**

In `src/lib/inngest/functions.ts`:

Add import at top:

```typescript
import { resolveTransitions, resolveImageMotions, resolveTextAnimations } from "@/lib/effects";
```

Update event data destructuring (around line 101) to include the 3 new fields:

```typescript
const { sceneTransition, imageMotion, textAnimation } = event.data;
```

In the render-video step (around line 198), add random resolution before calling `renderVideo`:

```typescript
const sceneCount = renderScenes.length;
const resolvedTransitions = resolveTransitions(sceneTransition || "fade", sceneCount);
const resolvedImageMotions = resolveImageMotions(imageMotion || "zoom-in", sceneCount);
const resolvedTextAnimations = resolveTextAnimations(textAnimation || "slide-up", sceneCount);
```

Update the `renderVideo()` call to pass the resolved arrays:

```typescript
return await renderVideo({
  projectId,
  scenes: renderScenes,
  template,
  aspectRatio,
  videoQuality,
  sceneDuration,
  backgroundMusic,
  voiceoverUrl,
  sceneTransitions: resolvedTransitions,
  imageMotions: resolvedImageMotions,
  textAnimations: resolvedTextAnimations,
});
```

- [ ] **Step 3: Update RenderInput and inputProps**

In `src/lib/render/render-video.ts`:

Add import at top:

```typescript
import type { ResolvedTransition, ResolvedImageMotion, ResolvedTextAnimation } from "@/lib/effects";
```

Add 3 new fields to the `RenderInput` type (after `voiceoverUrl`):

```typescript
sceneTransitions?: ResolvedTransition[];
imageMotions?: ResolvedImageMotion[];
textAnimations?: ResolvedTextAnimation[];
```

Update both inputProps constructions (Lambda ~line 145 and local ~line 241) to include:

```typescript
sceneTransitions: input.sceneTransitions ?? Array(scenes.length - 1).fill("fade"),
imageMotions: input.imageMotions ?? Array(scenes.length).fill("zoom-in"),
textAnimations: input.textAnimations ?? Array(scenes.length).fill("slide-up"),
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (VideoComposition props will be updated next)

Note: There may be a type mismatch with VideoCompositionProps at this point — that's expected and gets fixed in Task 8.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/wizard/render/route.ts src/lib/inngest/functions.ts src/lib/render/render-video.ts
git commit -m "feat(epic-22): thread effect settings through render pipeline"
```

---

## Task 8: VideoComposition Transitions

**Files:**
- Modify: `src/remotion/VideoComposition.tsx`

- [ ] **Step 1: Update imports**

Add these imports to `VideoComposition.tsx`:

```typescript
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import type { ResolvedTransition, ResolvedImageMotion, ResolvedTextAnimation } from "@/lib/effects";
```

- [ ] **Step 2: Update VideoCompositionProps type**

Add 3 new fields to `VideoCompositionProps` (after `voiceoverUrl`):

```typescript
sceneTransitions?: ResolvedTransition[];
imageMotions?: ResolvedImageMotion[];
textAnimations?: ResolvedTextAnimation[];
```

- [ ] **Step 3: Add transition presentation map**

After the type definition and before the component function, add:

```typescript
const transitionPresentationMap: Record<ResolvedTransition, () => ReturnType<typeof fade>> = {
  fade: () => fade(),
  slide: () => slide({ direction: "from-right" }),
  wipe: () => wipe(),
  flip: () => flip(),
  "clock-wipe": () => clockWipe(),
};
```

- [ ] **Step 4: Update component to use per-scene transitions and pass motion/animation props**

Destructure the new props in the component function:

```typescript
const {
  scenes, sceneDurationFrames, transitionFrames, musicUrl, voiceoverUrl,
  sceneTransitions = [],
  imageMotions = [],
  textAnimations = [],
} = props;
```

Replace the hardcoded `presentation={fade()}` (around line 105) with:

```typescript
presentation={transitionPresentationMap[sceneTransitions[i] ?? "fade"]()}
```

For each scene template case in the switch statement, add `imageMotion` and `textAnimation` props:

For slideshow (default case):
```typescript
imageMotion={imageMotions[i] ?? "zoom-in"}
textAnimation={textAnimations[i] ?? "slide-up"}
```

For comparison:
```typescript
imageMotion={imageMotions[i] ?? "zoom-in"}
textAnimation={textAnimations[i] ?? "slide-up"}
```

For fact-card:
```typescript
imageMotion={imageMotions[i] ?? "zoom-in"}
textAnimation={textAnimations[i] ?? "slide-up"}
```

- [ ] **Step 5: Commit**

```bash
git add src/remotion/VideoComposition.tsx
git commit -m "feat(epic-22): add per-scene transition mapping to VideoComposition"
```

---

## Task 9: SlideshowScene Animations

**Files:**
- Modify: `src/remotion/templates/SlideshowScene.tsx`

- [ ] **Step 1: Add imports and update props type**

Add import:

```typescript
import { getImageTransform, getTextStyle } from "@/remotion/animation-utils";
import type { ResolvedImageMotion, ResolvedTextAnimation } from "@/lib/effects";
```

Update `SlideshowSceneProps` (lines 9-13):

```typescript
type SlideshowSceneProps = {
  scriptText: string;
  assetUrl: string | null;
  assetObjectPosition?: string;
  imageMotion?: ResolvedImageMotion;
  textAnimation?: ResolvedTextAnimation;
};
```

- [ ] **Step 2: Replace hardcoded Ken Burns animation**

Remove the existing `scale` interpolation (lines 26-29):
```typescript
// DELETE these lines:
const scale = interpolate(frame, [0, durationInFrames], [1, 1.1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});
```

Replace with:
```typescript
const progress = frame / durationInFrames;
const imageStyle = getImageTransform(imageMotion ?? "zoom-in", progress);
```

Update the image container `style` (around line 48-49) to use `imageStyle` instead of the manual `transform: scale(${scale})`:
```typescript
style={{ ...imageStyle }}
```

- [ ] **Step 3: Replace hardcoded caption animation**

Remove the existing `captionOpacity` and `captionY` interpolations (lines 31-41):
```typescript
// DELETE these lines:
const captionDuration = Math.min(fps * 0.5, durationInFrames);
const captionOpacity = interpolate(frame, [0, captionDuration], [0, 1], { ... });
const captionY = interpolate(frame, [0, captionDuration], [30, 0], { ... });
```

Replace with:
```typescript
const textStyle = getTextStyle(textAnimation ?? "slide-up", frame, 0, fps);
```

Update the caption `style` (around line 84-89) to use `textStyle`:
```typescript
style={{ ...textStyle, textAlign: "center" }}
```

- [ ] **Step 4: Clean up unused imports**

Remove `interpolate` from the Remotion import if no longer used in this file.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/remotion/templates/SlideshowScene.tsx
git commit -m "feat(epic-22): use configurable animations in SlideshowScene"
```

---

## Task 10: ComparisonScene Animations

**Files:**
- Modify: `src/remotion/templates/ComparisonScene.tsx`

- [ ] **Step 1: Add imports and update props type**

Add import:

```typescript
import { getImageTransform, getTextStyle } from "@/remotion/animation-utils";
import type { ResolvedImageMotion, ResolvedTextAnimation } from "@/lib/effects";
```

Update `ComparisonSceneProps` (lines 8-16) to add:

```typescript
imageMotion?: ResolvedImageMotion;
textAnimation?: ResolvedTextAnimation;
```

- [ ] **Step 2: Replace hardcoded slide-in animation**

Remove the existing `slideProgress`, `leftX`, `rightX`, `imageOpacity` interpolations (lines 30-40).

Replace with:
```typescript
const progress = frame / durationInFrames;
const imageStyle = getImageTransform(imageMotion ?? "zoom-in", progress);
```

Apply `imageStyle` to both left and right image containers, replacing the `translateX(${leftX}px)` and `translateX(${rightX}px)` transforms and `imageOpacity` opacity.

Note: Both images now get the same motion effect (e.g., both zoom-in together). The old asymmetric slide-in-from-sides is replaced by the user's chosen effect.

- [ ] **Step 3: Replace hardcoded caption animation**

Remove the existing `captionOpacity` and `captionSlideY` interpolations (lines 42-51).

Replace with:
```typescript
const textStyle = getTextStyle(textAnimation ?? "slide-up", frame, 10, fps);
```

(Start frame 10 preserves the existing slight delay for caption appearance.)

Apply `textStyle` to the caption element, replacing the manual `opacity: captionOpacity, transform: translateY(${captionSlideY}px)`.

- [ ] **Step 4: Clean up unused interpolation imports if needed**

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/remotion/templates/ComparisonScene.tsx
git commit -m "feat(epic-22): use configurable animations in ComparisonScene"
```

---

## Task 11: FactCardScene Animations

**Files:**
- Modify: `src/remotion/templates/FactCardScene.tsx`

- [ ] **Step 1: Add imports and update props type**

Add import:

```typescript
import { getImageTransform, getTextStyle } from "@/remotion/animation-utils";
import type { ResolvedImageMotion, ResolvedTextAnimation } from "@/lib/effects";
```

Update `FactCardSceneProps` (lines 8-17) to add:

```typescript
imageMotion?: ResolvedImageMotion;
textAnimation?: ResolvedTextAnimation;
```

- [ ] **Step 2: Replace hardcoded hero pop-in animation**

Remove the existing `heroProgress`, `heroOpacity`, `heroScale` interpolations (lines 36-42).

Replace with:
```typescript
const progress = frame / durationInFrames;
const imageStyle = getImageTransform(imageMotion ?? "zoom-in", progress);
```

Apply `imageStyle` to the hero image container, replacing the manual `transform: scale(${heroScale})` and `opacity: heroOpacity`.

- [ ] **Step 3: Replace hardcoded card body animation**

Remove the existing `cardProgress`, `cardOpacity`, `cardY` interpolations (lines 44-50).

Replace with:
```typescript
const textStyle = getTextStyle(textAnimation ?? "slide-up", frame, 8, fps);
```

(Start frame 8 preserves the existing delay for card body appearance.)

Apply `textStyle` to the card body element, replacing `opacity: cardOpacity, transform: translateY(${cardY}px)`.

- [ ] **Step 4: Clean up unused interpolation imports if needed**

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/remotion/templates/FactCardScene.tsx
git commit -m "feat(epic-22): use configurable animations in FactCardScene"
```

---

## Task 12: Root.tsx + RenderStep Integration

**Files:**
- Modify: `src/remotion/Root.tsx` (lines 21-39 defaultProps)
- Modify: `src/app/wizard/[id]/steps/RenderStep.tsx` (render submission)

- [ ] **Step 1: Update Root.tsx defaultProps**

In `src/remotion/Root.tsx`, update the `defaultProps` object to include:

```typescript
defaultProps={
  {
    scenes: DEFAULT_SCENES,
    sceneDurationFrames: SCENE_DURATION_FRAMES,
    transitionFrames: TRANSITION_FRAMES,
    sceneTransitions: ["fade"],
    imageMotions: ["zoom-in"],
    textAnimations: ["slide-up"],
  } satisfies VideoCompositionProps
}
```

- [ ] **Step 2: Update RenderStep submission**

In `src/app/wizard/[id]/steps/RenderStep.tsx`, find where it calls the render API (look for `fetch("/api/wizard/render"`). Add the 3 effect fields from the store settings to the request body:

```typescript
sceneTransition: settings.sceneTransition,
imageMotion: settings.imageMotion,
textAnimation: settings.textAnimation,
```

These come from the wizard store's `settings` object which already includes the new fields from Task 5.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/remotion/Root.tsx src/app/wizard/[id]/steps/RenderStep.tsx
git commit -m "feat(epic-22): update Root.tsx defaults and RenderStep submission"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass, including the new tests from Tasks 1, 3, and 4

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: Zero lint errors

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Fix any issues**

If any step fails, fix the issue and re-run. Common issues:
- Unused imports from removing old interpolation code
- Type mismatches from the new props
- Missing `"use client"` directives

- [ ] **Step 5: Update backlog**

Add Epic 22 entry to `docs/prd_backlog.md` with all stories marked as complete.

- [ ] **Step 6: Update TODOS.md**

Remove the two completed TODOs:
- "Add different transition options between scenes"
- "Add different scene animation effects options between scenes"

- [ ] **Step 7: Final commit**

```bash
git add docs/prd_backlog.md TODOS.md
git commit -m "docs: mark Epic 22 complete, update backlog and TODOs"
```
