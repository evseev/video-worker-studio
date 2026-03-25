# Image Crop & Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-asset drag-to-reposition controls so users can pan images within template slots during the Preview step.

**Architecture:** Adds an `objectPosition` string field to `AssetSlot`, a shared `DraggableImage` React component for all three SceneCard types, and threads the position through the Inngest/Remotion render pipeline to CSS `objectPosition`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Zustand, Remotion 4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-25-image-crop-positioning-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/templates/types.ts` | Add `objectPosition` to `AssetSlot` interface |
| `src/components/DraggableImage.tsx` | **NEW** — Shared hover-to-reveal, drag-to-pan image component |
| `src/templates/slideshow/SceneCard.tsx` | Integrate `DraggableImage` into slideshow thumbnail |
| `src/templates/comparison/SceneCard.tsx` | Integrate `DraggableImage` into left/right thumbnails |
| `src/templates/fact-card/SceneCard.tsx` | Integrate `DraggableImage` into main/secondary thumbnails |
| `src/lib/stores/wizard-store.ts` | Reset `objectPosition` on asset swap |
| `src/app/wizard/[id]/steps/PreviewStep.tsx` | Reset `objectPosition` on asset refresh |
| `src/lib/inngest/functions.ts` | Pass `objectPosition` through render asset mapping |
| `src/lib/render/render-video.ts` | Add `objectPosition` to `RenderInput` asset type |
| `src/remotion/VideoComposition.tsx` | Extract and pass `objectPosition` to scene components |
| `src/remotion/templates/SlideshowScene.tsx` | Apply `objectPosition` to `<Img>` |
| `src/remotion/templates/ComparisonScene.tsx` | Apply `objectPosition` to both `<Img>` elements |
| `src/remotion/templates/FactCardScene.tsx` | Apply `objectPosition` to both `<Img>` elements |
| `src/__tests__/lib/stores/wizard-store.test.ts` | Tests for objectPosition persistence and reset |
| `src/__tests__/components/DraggableImage.test.tsx` | **NEW** — Tests for DraggableImage component |

---

### Task 1: Data Model — Add `objectPosition` to `AssetSlot`

**Files:**
- Modify: `src/templates/types.ts:3-7`

- [ ] **Step 1: Add `objectPosition` field to `AssetSlot`**

In `src/templates/types.ts`, add the field to the interface:

```typescript
export interface AssetSlot {
  url?: string;
  options?: string[];
  selectedIndex?: number;
  objectPosition?: string;
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors (field is optional, so no downstream breakage)

- [ ] **Step 3: Commit**

```bash
git add src/templates/types.ts
git commit -m "feat(epic-21): add objectPosition to AssetSlot type"
```

---

### Task 2: Wizard Store — Reset `objectPosition` on Asset Swap

**Files:**
- Modify: `src/lib/stores/wizard-store.ts:147`
- Test: `src/__tests__/lib/stores/wizard-store.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/__tests__/lib/stores/wizard-store.test.ts` inside the `selectAsset action` describe block:

```typescript
it("resets objectPosition when selecting a different asset", () => {
  const project = makeProject({
    draft_scenes: {
      scenes: [
        {
          template: "slideshow",
          scriptText: "Hello",
          searchKeywords: ["sunset"],
          assets: [{ url: "/a.jpg", options: ["/a.jpg", "/b.jpg"], selectedIndex: 0, objectPosition: "30% 70%" }],
        },
      ],
    } as unknown,
  });
  const store = createWizardStore(project);

  store.getState().selectAsset(0, 0, 1);
  const scene = store.getState().scenes[0];

  expect(scene.assets[0].url).toBe("/b.jpg");
  expect(scene.assets[0].selectedIndex).toBe(1);
  expect(scene.assets[0].objectPosition).toBeUndefined();
});

it("preserves objectPosition in draft round-trip", () => {
  const project = makeProject({
    draft_scenes: {
      scenes: [
        {
          template: "slideshow",
          scriptText: "Hello",
          searchKeywords: ["sunset"],
          assets: [{ url: "/a.jpg", objectPosition: "25% 80%" }],
        },
      ],
      settings: { sceneCount: 6, sceneDuration: 5, aspectRatio: "9:16", quality: "1080p" },
    } as unknown,
  });
  const store = createWizardStore(project);
  const state = store.getState();

  expect(state.scenes[0].assets[0].objectPosition).toBe("25% 80%");
});
```

- [ ] **Step 2: Run tests to verify the reset test fails**

Run: `npx vitest run src/__tests__/lib/stores/wizard-store.test.ts`
Expected: "resets objectPosition" FAILS (objectPosition is preserved), "preserves objectPosition" PASSES

- [ ] **Step 3: Update `selectAsset` in wizard-store**

In `src/lib/stores/wizard-store.ts` line 147, change:

```typescript
// Before
assets[slotIdx] = { ...slot, url: slot.options[assetIdx], selectedIndex: assetIdx };
// After
assets[slotIdx] = { ...slot, url: slot.options[assetIdx], selectedIndex: assetIdx, objectPosition: undefined };
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/__tests__/lib/stores/wizard-store.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/wizard-store.ts src/__tests__/lib/stores/wizard-store.test.ts
git commit -m "feat(epic-21): reset objectPosition on asset swap in wizard store"
```

---

### Task 3: PreviewStep — Reset `objectPosition` on Asset Refresh

**Files:**
- Modify: `src/app/wizard/[id]/steps/PreviewStep.tsx:45,83`

- [ ] **Step 1: Reset position in `fetchAllAssets`**

In `src/app/wizard/[id]/steps/PreviewStep.tsx` line 45, change:

```typescript
// Before
return { ...slot, options, url: options[0], selectedIndex: 0 };
// After
return { ...slot, options, url: options[0], selectedIndex: 0, objectPosition: undefined };
```

- [ ] **Step 2: Reset position in `handleRefreshAsset`**

In the same file, line 83, change:

```typescript
// Before
assets[slotIdx] = { ...assets[slotIdx], options, url: options[0], selectedIndex: 0 };
// After
assets[slotIdx] = { ...assets[slotIdx], options, url: options[0], selectedIndex: 0, objectPosition: undefined };
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/wizard/[id]/steps/PreviewStep.tsx
git commit -m "feat(epic-21): reset objectPosition on asset refresh"
```

---

### Task 4: DraggableImage Component

**Files:**
- Create: `src/components/DraggableImage.tsx`
- Create: `src/__tests__/components/DraggableImage.test.tsx`

- [ ] **Step 1: Write tests**

Create `src/__tests__/components/DraggableImage.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DraggableImage } from "@/components/DraggableImage";

describe("DraggableImage", () => {
  it("renders image with objectFit cover", () => {
    render(
      <DraggableImage src="/test.jpg" alt="test" onPositionChange={vi.fn()} />
    );
    const img = screen.getByAltText("test");
    expect(img).toBeDefined();
    expect(img.style.objectFit).toBe("cover");
  });

  it("applies objectPosition when provided", () => {
    render(
      <DraggableImage
        src="/test.jpg"
        alt="test"
        objectPosition="30% 70%"
        onPositionChange={vi.fn()}
      />
    );
    const img = screen.getByAltText("test");
    expect(img.style.objectPosition).toBe("30% 70%");
  });

  it("defaults objectPosition to 50% 50%", () => {
    render(
      <DraggableImage src="/test.jpg" alt="test" onPositionChange={vi.fn()} />
    );
    const img = screen.getByAltText("test");
    expect(img.style.objectPosition).toBe("50% 50%");
  });

  it("shows reposition overlay on hover", async () => {
    render(
      <DraggableImage src="/test.jpg" alt="test" onPositionChange={vi.fn()} />
    );
    const container = screen.getByAltText("test").parentElement!;
    fireEvent.mouseEnter(container);
    expect(screen.getByText("Reposition")).toBeDefined();
  });

  it("hides reposition overlay when not hovered", () => {
    render(
      <DraggableImage src="/test.jpg" alt="test" onPositionChange={vi.fn()} />
    );
    expect(screen.queryByText("Reposition")).toBeNull();
  });

  it("renders refresh button on hover when onRefresh provided", () => {
    render(
      <DraggableImage
        src="/test.jpg"
        alt="test"
        onPositionChange={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    const container = screen.getByAltText("test").parentElement!;
    fireEvent.mouseEnter(container);
    expect(screen.getByLabelText("Refresh image")).toBeDefined();
  });

  it("does not render refresh button when onRefresh not provided", () => {
    render(
      <DraggableImage src="/test.jpg" alt="test" onPositionChange={vi.fn()} />
    );
    const container = screen.getByAltText("test").parentElement!;
    fireEvent.mouseEnter(container);
    expect(screen.queryByLabelText("Refresh image")).toBeNull();
  });

  it("does not render overlay when src is empty", () => {
    render(
      <DraggableImage src="" alt="test" onPositionChange={vi.fn()} />
    );
    const container = screen.getByText("No image").parentElement!;
    fireEvent.mouseEnter(container);
    expect(screen.queryByText("Reposition")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/components/DraggableImage.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create `DraggableImage` component**

Create `src/components/DraggableImage.tsx`:

```tsx
"use client";

import { useState, useRef, useCallback } from "react";

type DraggableImageProps = {
  src: string;
  alt: string;
  objectPosition?: string;
  onPositionChange: (pos: string) => void;
  onRefresh?: () => void;
  className?: string;
};

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function parsePosition(pos: string | undefined): [number, number] {
  if (!pos) return [50, 50];
  const parts = pos.split("%").map((s) => parseFloat(s.trim()));
  return [parts[0] ?? 50, parts[1] ?? 50];
}

export function DraggableImage({
  src,
  alt,
  objectPosition,
  onPositionChange,
  onRefresh,
  className,
}: DraggableImageProps) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const [livePosition, setLivePosition] = useState<string | undefined>(undefined);

  const currentPosition = livePosition ?? objectPosition;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!src) return;
      e.preventDefault();
      const [posX, posY] = parsePosition(currentPosition);
      dragStart.current = { x: e.clientX, y: e.clientY, posX, posY };
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [src, currentPosition],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !dragStart.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPct = ((e.clientX - dragStart.current.x) / rect.width) * 100;
      const deltaYPct = ((e.clientY - dragStart.current.y) / rect.height) * 100;
      const newX = clamp(dragStart.current.posX - deltaXPct, 0, 100);
      const newY = clamp(dragStart.current.posY - deltaYPct, 0, 100);
      setLivePosition(`${Math.round(newX)}% ${Math.round(newY)}%`);
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    dragStart.current = null;
    if (livePosition) {
      onPositionChange(livePosition);
      setLivePosition(undefined);
    }
  }, [dragging, livePosition, onPositionChange]);

  if (!src) {
    return (
      <div
        className={className}
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="text-[10px] text-zinc-600">No image</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", cursor: dragging ? "grabbing" : hovered ? "grab" : "default" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { if (!dragging) setHovered(false); }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="w-full h-full"
        style={{
          objectFit: "cover",
          objectPosition: currentPosition ?? "50% 50%",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />

      {/* Hover overlay — hidden while dragging */}
      {hovered && !dragging && (
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1 select-none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ opacity: 0.8 }}>
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" />
          </svg>
          <span className="text-white text-[8px] font-semibold uppercase tracking-wide">Reposition</span>
        </div>
      )}

      {/* Refresh button — top-right corner on hover */}
      {hovered && !dragging && onRefresh && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded flex items-center justify-center cursor-pointer hover:bg-black/80 transition-colors"
          aria-label="Refresh image"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/components/DraggableImage.test.tsx`
Expected: All PASS

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/DraggableImage.tsx src/__tests__/components/DraggableImage.test.tsx
git commit -m "feat(epic-21): add DraggableImage component with hover/drag pan"
```

---

### Task 5: Integrate DraggableImage into SceneCards

**Files:**
- Modify: `src/templates/slideshow/SceneCard.tsx:47-65`
- Modify: `src/templates/comparison/SceneCard.tsx:35-53`
- Modify: `src/templates/fact-card/SceneCard.tsx:36-54`

- [ ] **Step 1: Update SlideshowSceneCard**

In `src/templates/slideshow/SceneCard.tsx`:

Add import at top:
```typescript
import { DraggableImage } from "@/components/DraggableImage";
```

Replace the image container (lines 47-65). The current code has a `<div>` containing the `<img>` and a full-overlay refresh button. Replace with:

```tsx
<div className="w-20 h-24 bg-black/50 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center relative">
  <DraggableImage
    src={displayUrl ?? ""}
    alt={scene.searchKeywords[0] ?? ""}
    objectPosition={slot?.objectPosition}
    onPositionChange={(pos) => {
      const assets = [...scene.assets];
      assets[0] = { ...assets[0], objectPosition: pos };
      onUpdate({ assets } as Partial<SlideshowScene>);
    }}
    onRefresh={() => onRefreshAsset(0)}
    className="w-full h-full"
  />
</div>
```

Remove the old `<img>` and the old refresh `<button>` overlay that was inside this div (lines 48-65).

- [ ] **Step 2: Update ComparisonSceneCard's `AssetThumb`**

In `src/templates/comparison/SceneCard.tsx`:

Add import at top:
```typescript
import { DraggableImage } from "@/components/DraggableImage";
```

Add `slotIdx` and `onPositionChange` to the `AssetThumb` component's props, then update the image container. In the `AssetThumb` function, replace the image area (the `<div>` with class `relative w-full aspect-[3/4]` and its contents, lines 35-53) with:

```tsx
<div className="relative w-full aspect-[3/4] bg-black/50 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center">
  <DraggableImage
    src={displayUrl ?? ""}
    alt={label}
    objectPosition={slot?.objectPosition}
    onPositionChange={onPositionChange}
    onRefresh={onRefresh}
    className="w-full h-full"
  />
</div>
```

Update the `AssetThumb` call sites to pass `onPositionChange`:

```tsx
<AssetThumb
  slot={scene.assets[0]}
  label="Left"
  slotIdx={0}
  onRefresh={() => onRefreshAsset(0)}
  onSelect={(assetIdx) => onSelectAsset(0, assetIdx)}
  onPositionChange={(pos) => {
    const assets = [...scene.assets];
    assets[0] = { ...assets[0], objectPosition: pos };
    onUpdate({ assets } as Partial<ComparisonScene>);
  }}
/>
```

Same for the right slot with `assets[1]`.

- [ ] **Step 3: Update FactCardSceneCard's `AssetSlotPicker`**

In `src/templates/fact-card/SceneCard.tsx`:

Add import at top:
```typescript
import { DraggableImage } from "@/components/DraggableImage";
```

Add `onPositionChange` to `AssetSlotPicker` props. Replace the image container (the `<div>` with class `${sizeClass} bg-black/50...` and its contents, lines 36-54) with:

```tsx
<div className={`${sizeClass} bg-black/50 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center relative`}>
  <DraggableImage
    src={displayUrl ?? ""}
    alt={label}
    objectPosition={slot?.objectPosition}
    onPositionChange={onPositionChange}
    onRefresh={onRefresh}
    className="w-full h-full"
  />
</div>
```

Update `AssetSlotPicker` call sites to pass `onPositionChange`:

```tsx
<AssetSlotPicker
  slot={scene.assets[0]}
  size="large"
  label="Main Image"
  onRefresh={() => onRefreshAsset(0)}
  onSelect={(assetIdx) => onSelectAsset(0, assetIdx)}
  onPositionChange={(pos) => {
    const assets = [...scene.assets];
    assets[0] = { ...assets[0], objectPosition: pos };
    onUpdate({ assets } as Partial<FactCardScene>);
  }}
/>
```

Same for the secondary slot with `assets[1]`.

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/templates/slideshow/SceneCard.tsx src/templates/comparison/SceneCard.tsx src/templates/fact-card/SceneCard.tsx
git commit -m "feat(epic-21): integrate DraggableImage into all three SceneCard types"
```

---

### Task 6: Render Pipeline — Thread `objectPosition` Through Inngest and Remotion

**Files:**
- Modify: `src/lib/inngest/functions.ts:191`
- Modify: `src/lib/render/render-video.ts:16`
- Modify: `src/remotion/VideoComposition.tsx:12,64-91`
- Modify: `src/remotion/templates/SlideshowScene.tsx:9-12,51-53`
- Modify: `src/remotion/templates/ComparisonScene.tsx:8-14,73-75,126-128`
- Modify: `src/remotion/templates/FactCardScene.tsx:8-15,70-72,115-117`

- [ ] **Step 1: Update `RenderInput` type**

In `src/lib/render/render-video.ts` line 16, change:

```typescript
// Before
assets: Array<{ url?: string | null }>;
// After
assets: Array<{ url?: string | null; objectPosition?: string }>;
```

- [ ] **Step 2: Update `VideoGenerateScene` interface and Inngest asset mapping**

In `src/lib/inngest/functions.ts`, first update the `VideoGenerateScene` interface (line 12) to include `objectPosition`:

```typescript
// Before
assets: Array<{ url?: string; options?: string[]; selectedIndex?: number }>;
// After
assets: Array<{ url?: string; options?: string[]; selectedIndex?: number; objectPosition?: string }>;
```

Then update the render asset mapping (line 191):

```typescript
// Before
assets: s.assets.map((a) => ({ url: a.url ?? null })),
// After
assets: s.assets.map((a) => ({ url: a.url ?? null, objectPosition: a.objectPosition })),
```

- [ ] **Step 3: Update `VideoCompositionProps`**

In `src/remotion/VideoComposition.tsx` line 12, change:

```typescript
// Before
assets: Array<{ url?: string | null }>;
// After
assets: Array<{ url?: string | null; objectPosition?: string }>;
```

- [ ] **Step 4: Update `VideoComposition` switch/case to pass `objectPosition`**

In `src/remotion/VideoComposition.tsx`, update each case in the switch block (lines 62-91):

**Slideshow (default case):**
```tsx
<SlideshowScene
  scriptText={scene.scriptText}
  assetUrl={scene.assets[0]?.url ?? null}
  assetObjectPosition={scene.assets[0]?.objectPosition}
/>
```

**Comparison:**
```tsx
<ComparisonScene
  scriptText={scene.scriptText}
  leftAssetUrl={scene.assets[0]?.url ?? null}
  rightAssetUrl={scene.assets[1]?.url ?? null}
  leftObjectPosition={scene.assets[0]?.objectPosition}
  rightObjectPosition={scene.assets[1]?.objectPosition}
  leftLabel={scene.leftLabel ?? ""}
  rightLabel={scene.rightLabel ?? ""}
/>
```

**Fact Card:**
```tsx
<FactCardScene
  scriptText={scene.scriptText}
  mainAssetUrl={scene.assets[0]?.url ?? null}
  secondaryAssetUrl={scene.assets[1]?.url ?? null}
  mainObjectPosition={scene.assets[0]?.objectPosition}
  secondaryObjectPosition={scene.assets[1]?.objectPosition}
  title={scene.title ?? ""}
  subtitle={scene.subtitle ?? ""}
  facts={scene.facts ?? []}
/>
```

- [ ] **Step 5: Update SlideshowScene component**

In `src/remotion/templates/SlideshowScene.tsx`:

Update props type (line 9-12):
```typescript
type SlideshowSceneProps = {
  scriptText: string;
  assetUrl: string | null;
  assetObjectPosition?: string;
};
```

Destructure in component (line 17-19):
```typescript
export const SlideshowScene: React.FC<SlideshowSceneProps> = ({
  scriptText,
  assetUrl,
  assetObjectPosition,
}) => {
```

Update `<Img>` (line 51-53):
```tsx
<Img
  src={assetUrl}
  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: assetObjectPosition ?? "50% 50%" }}
/>
```

- [ ] **Step 6: Update ComparisonScene component**

In `src/remotion/templates/ComparisonScene.tsx`:

Update props type (line 8-14):
```typescript
type ComparisonSceneProps = {
  scriptText: string;
  leftAssetUrl: string | null;
  rightAssetUrl: string | null;
  leftObjectPosition?: string;
  rightObjectPosition?: string;
  leftLabel: string;
  rightLabel: string;
};
```

Destructure `leftObjectPosition` and `rightObjectPosition` in the component.

Update left `<Img>` (line 73-75):
```tsx
<Img
  src={leftAssetUrl}
  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: leftObjectPosition ?? "50% 50%" }}
/>
```

Update right `<Img>` (line 126-128):
```tsx
<Img
  src={rightAssetUrl}
  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: rightObjectPosition ?? "50% 50%" }}
/>
```

- [ ] **Step 7: Update FactCardScene component**

In `src/remotion/templates/FactCardScene.tsx`:

Update props type (line 8-15):
```typescript
type FactCardSceneProps = {
  scriptText: string;
  mainAssetUrl: string | null;
  secondaryAssetUrl: string | null;
  mainObjectPosition?: string;
  secondaryObjectPosition?: string;
  title: string;
  subtitle: string;
  facts: { label: string; value: string }[];
};
```

Destructure `mainObjectPosition` and `secondaryObjectPosition` in the component.

Update main `<Img>` (line 70-72):
```tsx
<Img
  src={mainAssetUrl}
  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: mainObjectPosition ?? "50% 50%" }}
/>
```

Update secondary `<Img>` (line 115-117):
```tsx
<Img
  src={secondaryAssetUrl}
  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: secondaryObjectPosition ?? "50% 50%" }}
/>
```

- [ ] **Step 8: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/lib/inngest/functions.ts src/lib/render/render-video.ts src/remotion/VideoComposition.tsx src/remotion/templates/SlideshowScene.tsx src/remotion/templates/ComparisonScene.tsx src/remotion/templates/FactCardScene.tsx
git commit -m "feat(epic-21): thread objectPosition through render pipeline to Remotion"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual verification in dev server**

Run: `npm run dev`

Test checklist:
1. Create or resume a project with each template type (slideshow, comparison, fact-card)
2. In Preview step: hover an image thumbnail → verify "Reposition" overlay appears
3. Drag the image → verify it pans smoothly and updates position in real-time
4. Release → verify position persists (refresh page, re-open project)
5. Swap to a different asset option → verify position resets to center
6. Click refresh on an image → verify position resets to center
7. Verify existing projects without objectPosition render at center (backward compat)

- [ ] **Step 4: Verify Remotion preview**

In the render step, check that the Remotion preview shows the repositioned image matching the position set in the Preview step.

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(epic-21): address verification findings"
```

---

## Verification Summary

| What | How | Expected |
|------|-----|----------|
| TypeScript | `npx tsc --noEmit` | No errors |
| Unit tests | `npx vitest run` | All pass |
| Drag interaction | Manual: hover/drag thumbnails in all 3 templates | Smooth pan, overlay, cursor changes |
| Persistence | Refresh page after setting position | Position preserved |
| Reset on swap | Click different asset option | Position clears to center |
| Reset on refresh | Click refresh button | Position clears to center |
| Render output | Check Remotion preview | Image positioned correctly |
| Backward compat | Open existing project without objectPosition | Renders at center (default) |
