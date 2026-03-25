# Epic 21: Image Crop & Positioning — Design Spec

## Problem

When images are sourced from Pinterest, `objectFit: "cover"` crops them to center by default. This works well when the subject is centered, but frequently clips faces, key details, or compositional elements — especially in constrained slots like the Comparison template's portrait panels or the Fact Card's hero banner. Users currently have no way to adjust which part of the image is visible.

## Goal

Add per-asset pan controls so users can adjust image positioning within each template slot during the Preview step (Step 5). The crop aspect ratio is fixed by the template slot shape — users only pan, they don't zoom or resize.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Interaction model | Pan only (no zoom) | Covers 90% of use cases; maps directly to CSS `objectPosition`; minimal data model |
| UI location | Inline on SceneCard thumbnails | No extra steps, modal, or wizard length increase |
| Trigger | Hover to reveal, drag to pan | Zero-click for discoverability; direct manipulation feels native |
| Data format | `objectPosition` string on `AssetSlot` | Maps 1:1 to CSS; no transformation needed at render time |
| Default | `undefined` (browser default = center) | Simple, predictable; no AI or detection needed |
| Reset behavior | Clear on asset swap | When user picks a different image option, position resets to center |
| Asset option thumbnails | Keep center crop | Picker thumbnails are tiny (40×40px); applying custom position adds no value |

## Data Model

```typescript
// src/templates/types.ts
export interface AssetSlot {
  url?: string;
  options?: string[];
  selectedIndex?: number;
  objectPosition?: string;  // NEW — e.g. "50% 50%", "30% 70%"
}
```

- Optional field — `undefined` means center (backward compatible)
- String format: `"${xPercent}% ${yPercent}%"` where 0% = left/top, 100% = right/bottom
- Persisted automatically via existing `draft_scenes` JSONB column (no DB migration)
- Reset to `undefined` when `selectedIndex` changes (requires updating `selectAsset` in wizard-store)

## UI Component: `DraggableImage`

A shared React component that replaces raw `<img>` tags in all three SceneCard types.

### Component API

```typescript
type DraggableImageProps = {
  src: string;
  alt: string;
  objectPosition?: string;           // Current position, e.g. "50% 50%"
  onPositionChange: (pos: string) => void;
  onRefresh?: () => void;            // Refresh button callback (rendered as corner icon)
  className?: string;
};
```

The `onRefresh` prop handles the refresh button that currently exists as a full-overlay hover action. `DraggableImage` renders it as a small corner icon (top-right, 20×20px, `bg-black/60` rounded) within its own hover state, keeping all image interactions co-located.

### States

**Normal (no hover):**
- Renders the image with `objectFit: "cover"` and `objectPosition` applied
- Identical to current behavior

**Hover:**
- Semi-transparent dark overlay (`bg-black/40`)
- Move icon (4-directional arrows) + "Reposition" label centered
- Refresh button as small icon in top-right corner
- Container gets subtle violet border hint
- Cursor: `grab`

**Dragging:**
- Overlay disappears — user sees the image move
- Image position updates in real-time as user drags
- Cursor: `grabbing`
- Position clamped to 0%–100% on both axes (CSS `objectPosition` handles this gracefully — no need to load natural image dimensions)
- On `mouseup`/`pointerup`: final position saved via `onPositionChange`

### Drag Math

The drag handler converts pixel movement to objectPosition percentages:

```
deltaXPercent = (mouseDeltaX / containerWidth) * 100
newX = clamp(currentX - deltaXPercent, 0, 100)
newY = clamp(currentY - deltaYPercent, 0, 100)
objectPosition = `${newX}% ${newY}%`
```

Delta is subtracted on both axes. This follows standard `objectPosition` semantics: `objectPosition: 0% 0%` shows the top-left of the image, `100% 100%` shows the bottom-right. So dragging right (positive deltaX) reveals the right side of the image by decreasing the x% value. Same logic applies to Y.

### Integration Points

The `DraggableImage` component replaces the `<img>` tag in:

1. **SlideshowSceneCard** (`src/templates/slideshow/SceneCard.tsx` line 50) — single slot
2. **ComparisonSceneCard > AssetThumb** (`src/templates/comparison/SceneCard.tsx` line 38) — left and right slots
3. **FactCardSceneCard > AssetSlotPicker** (`src/templates/fact-card/SceneCard.tsx` line 39) — main and secondary slots

Each SceneCard's `onUpdate` callback propagates the new `objectPosition` into the scene's `assets` array, which the wizard store auto-saves to the server.

### Slideshow SceneCard Hover Scope

The Slideshow SceneCard currently uses Tailwind `group` on the outer card container (line 32), and the refresh button uses `group-hover:opacity-100`. This is too broad — it would trigger the reposition overlay on any card hover.

Fix: The `DraggableImage` component manages its own hover state internally (via `useState` + `onMouseEnter`/`onMouseLeave`) rather than relying on Tailwind group scopes. This makes it self-contained and avoids any conflicts with parent group scopes in any template.

### Asset Swap Reset

When the user selects a different image option, `objectPosition` must reset. The `selectAsset` action in `wizard-store.ts` (line 147) currently spreads the existing slot, which would preserve stale position data. Update it to:

```typescript
assets[slotIdx] = { ...slot, url: slot.options[assetIdx], selectedIndex: assetIdx, objectPosition: undefined };
```

Similarly, when `handleRefreshAsset` in PreviewStep.tsx fetches new images, the position should reset since the new image is different.

## Render Pipeline

### Inngest + Render Input

The Inngest function (`src/lib/inngest/functions.ts` line 191) currently strips assets to `{ url }` only:
```typescript
assets: s.assets.map((a) => ({ url: a.url ?? null })),
```

This must be updated to preserve `objectPosition`:
```typescript
assets: s.assets.map((a) => ({ url: a.url ?? null, objectPosition: a.objectPosition })),
```

The `RenderInput` type in `src/lib/render/render-video.ts` (line 16) must also include `objectPosition`:
```typescript
assets: Array<{ url?: string | null; objectPosition?: string }>
```

The local render path (line 204) uses `...scene` spread and `...a` spread on assets, so it will pass `objectPosition` through once the `RenderInput` type allows it.

### Remotion Props

**VideoComposition** (`src/remotion/VideoComposition.tsx`):
```typescript
// Update the asset type in VideoCompositionProps
assets: Array<{ url?: string | null; objectPosition?: string }>
```

Update the switch/case block to extract and pass `objectPosition` to each scene component:

```tsx
case "comparison":
  return (
    <ComparisonScene
      scriptText={scene.scriptText}
      leftAssetUrl={scene.assets[0]?.url ?? null}
      rightAssetUrl={scene.assets[1]?.url ?? null}
      leftObjectPosition={scene.assets[0]?.objectPosition}
      rightObjectPosition={scene.assets[1]?.objectPosition}
      leftLabel={scene.leftLabel ?? ""}
      rightLabel={scene.rightLabel ?? ""}
    />
  );
// Same pattern for slideshow and fact-card
```

**Scene component props** — each gets position per image:
- `SlideshowScene`: add `assetObjectPosition?: string`
- `ComparisonScene`: add `leftObjectPosition?: string`, `rightObjectPosition?: string`
- `FactCardScene`: add `mainObjectPosition?: string`, `secondaryObjectPosition?: string`

### Img Rendering

One-line change per `<Img>` element across all three scene components:

```tsx
// Before
<Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

// After
<Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: objectPosition ?? "50% 50%" }} />
```

### Data Flow

```
AssetSlot.objectPosition (wizard store)
  → draft_scenes JSONB (Supabase, auto-persisted)
  → /api/wizard/render (POST body, no changes needed)
  → Inngest event payload (updated asset mapping in functions.ts)
  → RenderInput type (updated in render-video.ts)
  → Remotion inputProps / VideoCompositionProps (updated asset type)
  → Scene component props (new objectPosition props)
  → <Img style={{ objectPosition }}>
```

## Files to Modify

| File | Change |
|------|--------|
| `src/templates/types.ts` | Add `objectPosition?: string` to `AssetSlot` |
| `src/components/DraggableImage.tsx` | **NEW** — shared drag-to-pan component with `onRefresh` support |
| `src/templates/slideshow/SceneCard.tsx` | Replace `<img>` with `<DraggableImage>`, wire `onPositionChange` and `onRefresh` |
| `src/templates/comparison/SceneCard.tsx` | Replace `<img>` in `AssetThumb` with `<DraggableImage>` |
| `src/templates/fact-card/SceneCard.tsx` | Replace `<img>` in `AssetSlotPicker` with `<DraggableImage>` |
| `src/lib/stores/wizard-store.ts` | Reset `objectPosition: undefined` in `selectAsset` |
| `src/app/wizard/[id]/steps/PreviewStep.tsx` | Reset `objectPosition` in `handleRefreshAsset` |
| `src/lib/inngest/functions.ts` | Add `objectPosition` to asset mapping in render step |
| `src/lib/render/render-video.ts` | Add `objectPosition` to `RenderInput` asset type |
| `src/remotion/VideoComposition.tsx` | Add `objectPosition` to asset type, extract and pass to scene components |
| `src/remotion/templates/SlideshowScene.tsx` | Add `assetObjectPosition` prop, apply to `<Img>` style |
| `src/remotion/templates/ComparisonScene.tsx` | Add position props, apply to both `<Img>` styles |
| `src/remotion/templates/FactCardScene.tsx` | Add position props, apply to both `<Img>` styles |

## What Does NOT Change

- No database schema migration
- No API route changes (render route already passes full scene JSON)
- No AI prompt changes
- No new dependencies
- No changes to asset fetching logic
- Asset option picker thumbnails keep center crop

## Verification

1. **Data model:** Confirm `objectPosition` persists in draft, survives page reload, resets on asset swap
2. **Drag interaction:** Hover reveals overlay on all 3 template SceneCards; drag pans image smoothly; position clamps to edges
3. **Render output:** Remotion preview shows repositioned images; rendered MP4 matches preview positioning
4. **Pipeline:** Verify `objectPosition` flows through Inngest → render-video → Remotion by checking inputProps
5. **Backward compatibility:** Existing projects without `objectPosition` render identically (center crop)
6. **Edge cases:** Missing image (no-image placeholder) — DraggableImage shows no overlay; single-option slots — drag still works
