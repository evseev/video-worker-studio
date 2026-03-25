# Template System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cosmetic template system with 3 structural template archetypes (Slideshow, Comparison, Fact Card) that drive the entire video pipeline — from AI scene generation through Remotion rendering.

**Architecture:** Template Modules approach — each template is a self-contained directory under `src/templates/` with its own types, prompts, schemas, and UI components. Remotion scene components live under `src/remotion/templates/` maintaining the Remotion boundary. A central registry (`src/templates/index.ts`) provides `getTemplate(id)` used everywhere.

**Tech Stack:** TypeScript, Zod (schema validation), Zustand (state), Remotion (video rendering), Gemini 2.5 Flash (AI generation), Next.js App Router (API routes)

**Design Spec:** `/Users/evs/.claude/plans/lively-seeking-seahorse.md`

---

## File Structure Overview

### New Files
```
src/templates/
  ├── index.ts                          # Registry
  ├── types.ts                          # Shared types: TemplateDefinition, BaseScene, AssetSlot, Scene union
  ├── slideshow/
  │   ├── config.ts                     # Template metadata
  │   ├── types.ts                      # SlideshowScene
  │   ├── prompt.ts                     # AI prompt builder
  │   ├── schema.ts                     # Gemini JSON schema + Zod validation
  │   ├── SceneCard.tsx                 # Preview/edit card
  │   └── index.ts                      # Re-exports
  ├── comparison/
  │   ├── config.ts
  │   ├── types.ts                      # ComparisonScene (leftLabel, rightLabel)
  │   ├── prompt.ts
  │   ├── schema.ts
  │   ├── SceneCard.tsx
  │   └── index.ts
  └── fact-card/
      ├── config.ts
      ├── types.ts                      # FactCardScene (title, subtitle, facts[])
      ├── prompt.ts
      ├── schema.ts
      ├── SceneCard.tsx
      └── index.ts

src/remotion/templates/
  ├── SlideshowScene.tsx
  ├── ComparisonScene.tsx
  └── FactCardScene.tsx

src/app/wizard/[id]/steps/TemplateStep.tsx
```

### Files to Modify
```
src/lib/stores/wizard-store.ts          # New Scene union, WizardStep, actions
src/app/wizard/[id]/client.tsx          # 6-step flow
src/app/wizard/[id]/steps/ScriptStep.tsx  # Remove template picker, adapt to template
src/app/wizard/[id]/steps/PreviewStep.tsx # Template-specific scene cards
src/app/wizard/[id]/steps/RenderStep.tsx  # Remove caption style selector
src/lib/ai/wizard.ts                    # Template-specific prompts & schemas
src/app/api/wizard/generate-structure/route.ts  # Pass templateId
src/app/api/wizard/fetch-assets/route.ts        # Multi-slot fetching
src/app/api/wizard/render/route.ts              # Remove captionStyle
src/app/api/wizard/draft/route.ts               # Handle new scene format
src/lib/inngest/functions.ts                    # New scene structure
src/lib/render/render-video.ts                  # Remove captionStyle, pass template
src/remotion/VideoComposition.tsx               # Template component dispatch
src/remotion/Root.tsx                           # Update default props
```

### Files to Remove
```
src/components/wizard/template-selector.tsx     # Unused, replaced by TemplateStep
src/components/wizard/caption-style-selector.tsx # Captions built into templates
src/lib/caption-styles.ts                       # No longer needed
src/remotion/Scene.tsx                          # Replaced by 3 template components
```

---

## Task 1: Template Types & Registry

**Files:**
- Create: `src/templates/types.ts`
- Create: `src/templates/slideshow/types.ts`
- Create: `src/templates/slideshow/config.ts`
- Create: `src/templates/slideshow/index.ts`
- Create: `src/templates/comparison/types.ts`
- Create: `src/templates/comparison/config.ts`
- Create: `src/templates/comparison/index.ts`
- Create: `src/templates/fact-card/types.ts`
- Create: `src/templates/fact-card/config.ts`
- Create: `src/templates/fact-card/index.ts`
- Create: `src/templates/index.ts`

- [ ] **Step 1: Create shared types**

Create `src/templates/types.ts`:
```ts
import type { z } from "zod";

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
```

- [ ] **Step 2: Create slideshow module**

`src/templates/slideshow/types.ts`: Re-export `SlideshowScene` from `../types`.

`src/templates/slideshow/config.ts`:
```ts
import type { TemplateDefinition } from "../types";

export const slideshowConfig: TemplateDefinition = {
  id: "slideshow",
  name: "Slideshow",
  description: "Single image with caption overlay per scene",
  useCases: "Top 10 lists, historical facts, storytelling, motivational, educational shorts",
  assetsPerScene: 1,
  defaultSceneCount: 8,
};
```

`src/templates/slideshow/index.ts`: Re-export config and types.

- [ ] **Step 3: Create comparison module**

`src/templates/comparison/config.ts`:
```ts
export const comparisonConfig: TemplateDefinition = {
  id: "comparison",
  name: "Side-by-Side",
  description: "Two images compared side by side with labels",
  useCases: "Then vs Now, Before/After, celebrity comparisons, product evolution",
  assetsPerScene: 2,
  defaultSceneCount: 6,
};
```

- [ ] **Step 4: Create fact-card module**

`src/templates/fact-card/config.ts`:
```ts
export const factCardConfig: TemplateDefinition = {
  id: "fact-card",
  name: "Fact Card",
  description: "Identity card with main image, secondary image, and fact labels",
  useCases: "Celebrity + spouse, actor + role, person + net worth, famous couples",
  assetsPerScene: 2,
  defaultSceneCount: 5,
};
```

- [ ] **Step 5: Create template registry**

`src/templates/index.ts`:
```ts
import { slideshowConfig } from "./slideshow";
import { comparisonConfig } from "./comparison";
import { factCardConfig } from "./fact-card";
import type { TemplateDefinition, TemplateId } from "./types";

export const TEMPLATES: Record<TemplateId, TemplateDefinition> = {
  slideshow: slideshowConfig,
  comparison: comparisonConfig,
  "fact-card": factCardConfig,
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];
export const allTemplates = Object.values(TEMPLATES);

export function getTemplate(id: string): TemplateDefinition {
  const t = TEMPLATES[id as TemplateId];
  if (!t) throw new Error(`Unknown template: ${id}`);
  return t;
}

export * from "./types";
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in `src/templates/` files

- [ ] **Step 7: Commit**

```bash
git add src/templates/
git commit -m "feat: add template types, configs, and registry for 3 archetypes"
```

---

## Task 2: Template Prompts & Schemas

**Files:**
- Create: `src/templates/slideshow/prompt.ts`
- Create: `src/templates/slideshow/schema.ts`
- Create: `src/templates/comparison/prompt.ts`
- Create: `src/templates/comparison/schema.ts`
- Create: `src/templates/fact-card/prompt.ts`
- Create: `src/templates/fact-card/schema.ts`

- [ ] **Step 1: Create slideshow prompt and schema**

`src/templates/slideshow/prompt.ts` — builds the system instruction for Gemini. Takes `{ sceneCount, sceneDuration, aspectRatio }`. Returns prompt string that asks for exactly `sceneCount` scenes, each with `scriptText` (max 15 words) and one `searchKeyword`. Include orientation hints from existing `generateStructurePrompt()` in `src/lib/ai/prompts.ts:31-51`.

`src/templates/slideshow/schema.ts` — exports:
1. `slideshowGeminiSchema` — Gemini JSON schema (using `SchemaType` from `@google/generative-ai`) for `{ scenes: [{ scriptText, searchKeyword }] }`
2. `SlideshowResponseSchema` — Zod schema validating the same shape

Pattern: Follow existing schema at `src/lib/ai/wizard.ts:112-134` for Gemini schema format, and `wizard.ts:157-163` for Zod validation.

- [ ] **Step 2: Create comparison prompt and schema**

`src/templates/comparison/prompt.ts` — prompt asks for `sceneCount` scenes, each with `scriptText`, two `searchKeywords` (left item, right item), `leftLabel`, and `rightLabel`. AI picks appropriate labels per scene.

`src/templates/comparison/schema.ts` — Gemini schema: `{ scenes: [{ scriptText, searchKeywords: [string, string], leftLabel, rightLabel }] }`. Zod validates same.

- [ ] **Step 3: Create fact-card prompt and schema**

`src/templates/fact-card/prompt.ts` — prompt asks for `sceneCount` scenes, each with `scriptText`, two `searchKeywords` (main image, secondary image), `title`, `subtitle`, and `facts` array of `{ label, value }`.

`src/templates/fact-card/schema.ts` — Gemini schema and Zod schema for the full fact-card scene output.

- [ ] **Step 4: Update template module re-exports**

Update each `index.ts` to re-export the prompt builder and schema.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 6: Commit**

```bash
git add src/templates/
git commit -m "feat: add template-specific AI prompts and Zod/Gemini schemas"
```

---

## Task 3: Update Wizard Store

**Files:**
- Modify: `src/lib/stores/wizard-store.ts`

- [ ] **Step 1: Update types**

Replace the existing `Scene` type (lines 8-14) with import from `src/templates/types`. Update `WizardStep` to include `"template"` as first step:
```ts
export type WizardStep = "template" | "idea" | "refine" | "script" | "preview" | "render";
```

Import `Scene`, `TemplateId`, `AssetSlot` from `@/templates/types`.

- [ ] **Step 2: Update state and actions**

- Change `selectedTemplate: string` to `selectedTemplate: TemplateId`
- Default to `"slideshow"`
- Update `selectAsset` action to work with new `assets: AssetSlot[]` structure:
  ```ts
  selectAsset: (sceneIdx: number, slotIdx: number, assetIdx: number) => void;
  ```
  Implementation: updates `scenes[sceneIdx].assets[slotIdx].selectedIndex` and `.url`
- Update `updateScene` to handle the union type properly
- Add `addBlankScene` action that creates template-appropriate blank scene

- [ ] **Step 3: Update parseDraftData and syncFromProject**

`parseDraftData` must handle new scene format. Since we're deleting all existing projects, no backward compat needed — just parse the new format.

Update default template value: `project.selected_template || "slideshow"`

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/wizard-store.ts
git commit -m "feat: update wizard store with template-aware scene types and 6-step flow"
```

---

## Task 4: Update AI Generation Pipeline

**Files:**
- Modify: `src/lib/ai/wizard.ts` (lines 107-167)
- Modify: `src/app/api/wizard/generate-structure/route.ts`

- [ ] **Step 1: Update `generateStructure()` in wizard.ts**

Replace the hardcoded `structureSchema` and `SceneScript` interface with template-specific versions:

```ts
import { getTemplate } from "@/templates";
// Each template module exports its Gemini schema and Zod response schema
import { slideshowGeminiSchema, SlideshowResponseSchema } from "@/templates/slideshow/schema";
import { comparisonGeminiSchema, ComparisonResponseSchema } from "@/templates/comparison/schema";
import { factCardGeminiSchema, FactCardResponseSchema } from "@/templates/fact-card/schema";
```

The function signature changes to return `Scene[]` (from `@/templates/types`) instead of `SceneScript[]`. It uses `templateId` to select the right schema + prompt + validation.

Keep `enhanceIdea()`, `validateTrend()`, `generateSeoMetadata()` unchanged.

- [ ] **Step 2: Update generate-structure route**

`src/app/api/wizard/generate-structure/route.ts` — ensure `templateId` is extracted from request body and passed to `generateStructure()`. The route should now return template-typed scenes.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/wizard.ts src/app/api/wizard/generate-structure/route.ts
git commit -m "feat: template-aware AI scene generation with per-template prompts and schemas"
```

---

## Task 5: Update Asset Fetching

**Files:**
- Modify: `src/app/api/wizard/fetch-assets/route.ts`

- [ ] **Step 1: Update fetch-assets route for multi-slot**

Current logic fetches 1 keyword per scene. Update to iterate `scene.searchKeywords[]` and populate `scene.assets[]` slots:

- Accept `scenes` with new shape (array of `Scene` from templates/types)
- For each scene, iterate `searchKeywords`
- For each keyword, fetch 3 image options (existing multi-asset logic)
- Return updated scenes with populated `assets[i].options[]`
- Preserve orientation hints from existing code (append portrait/landscape to keywords)

The existing `fetchAssets()` function in `src/lib/ai/fetch-assets.ts` takes an array of keywords — call it per slot.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/wizard/fetch-assets/route.ts
git commit -m "feat: multi-slot asset fetching for comparison and fact-card templates"
```

---

## Task 6: Remotion Scene Components

**Files:**
- Create: `src/remotion/templates/SlideshowScene.tsx`
- Create: `src/remotion/templates/ComparisonScene.tsx`
- Create: `src/remotion/templates/FactCardScene.tsx`

- [ ] **Step 1: Create SlideshowScene**

Port from current `src/remotion/Scene.tsx` (207 lines). Keep:
- Full-bleed background image with 1.1x zoom (Ken Burns)
- Dark gradient overlay at bottom
- Caption with fade-in animation (0.5s, slide up 30px)

Remove:
- Scene counter (top-right badge)
- `captionStyle` prop and `getCaptionStyle()` logic — use built-in caption style
- Template conditional branches (only slideshow rendering now)

Props:
```ts
type SlideshowSceneProps = {
  scriptText: string;
  assetUrl: string | null;
};
```

- [ ] **Step 2: Create ComparisonScene**

New component. Props:
```ts
type ComparisonSceneProps = {
  scriptText: string;
  leftAssetUrl: string | null;
  rightAssetUrl: string | null;
  leftLabel: string;
  rightLabel: string;
};
```

Layout (portrait 9:16):
- Dark background (#111)
- Two images side by side (50/50 split, 4px gap) occupying ~55% of height
- Labels centered above each image (bold, colored — left: warm, right: cool)
- Optional VS badge (white circle, centered between images)
- Caption bar at bottom (dark semi-transparent background)
- Caption text: white, centered, 28px, fade-in animation

Layout adapts to landscape: images still side by side but with more horizontal space.

- [ ] **Step 3: Create FactCardScene**

New component. Props:
```ts
type FactCardSceneProps = {
  scriptText: string;
  mainAssetUrl: string | null;
  secondaryAssetUrl: string | null;
  title: string;
  subtitle: string;
  facts: { label: string; value: string }[];
};
```

Layout (portrait 9:16):
- Main (hero) image at top (~35% height), rounded corners
- Card body below: dark card (#1e1e2e, rounded)
  - Row: secondary image thumbnail (50x50) + title + subtitle
  - Fact text from `scriptText`
  - Label badges row (colored pills with `label: value`)
- Animated entry: card slides up, fade in

- [ ] **Step 4: Verify Remotion components compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/remotion/templates/
git commit -m "feat: add 3 Remotion template scene components (Slideshow, Comparison, FactCard)"
```

---

## Task 7: Update VideoComposition & Root

**Files:**
- Modify: `src/remotion/VideoComposition.tsx`
- Modify: `src/remotion/Root.tsx`

- [ ] **Step 1: Update VideoCompositionProps**

In `src/remotion/VideoComposition.tsx`:
- Import all 3 scene components from `./templates/`
- Update `scenes` array type to include template-specific fields:
  ```ts
  scenes: Array<{
    template: string;
    scriptText: string;
    assets: Array<{ url: string | null }>;
    // Template-specific optional fields
    leftLabel?: string;
    rightLabel?: string;
    title?: string;
    subtitle?: string;
    facts?: { label: string; value: string }[];
  }>;
  ```
- Remove `captionStyle` prop
- Remove `template` prop (now per-scene via `scene.template`)

- [ ] **Step 2: Update scene rendering logic**

Replace single `<Scene>` with template dispatch:
```tsx
{scenes.flatMap((scene, index) => {
  const SceneComponent = (() => {
    switch (scene.template) {
      case "comparison":
        return <ComparisonScene
          scriptText={scene.scriptText}
          leftAssetUrl={scene.assets[0]?.url ?? null}
          rightAssetUrl={scene.assets[1]?.url ?? null}
          leftLabel={scene.leftLabel ?? ""}
          rightLabel={scene.rightLabel ?? ""}
        />;
      case "fact-card":
        return <FactCardScene
          scriptText={scene.scriptText}
          mainAssetUrl={scene.assets[0]?.url ?? null}
          secondaryAssetUrl={scene.assets[1]?.url ?? null}
          title={scene.title ?? ""}
          subtitle={scene.subtitle ?? ""}
          facts={scene.facts ?? []}
        />;
      default:
        return <SlideshowScene
          scriptText={scene.scriptText}
          assetUrl={scene.assets[0]?.url ?? null}
        />;
    }
  })();

  return [
    <TransitionSeries.Sequence key={`scene-${index}`} durationInFrames={sceneDurationFrames}>
      {SceneComponent}
    </TransitionSeries.Sequence>,
    ...(index < scenes.length - 1 ? [
      <TransitionSeries.Transition key={`transition-${index}`} presentation={fade()} timing={linearTiming({ durationInFrames: transitionFrames })} />
    ] : []),
  ];
})}
```

- [ ] **Step 3: Update Root.tsx default props**

Update default scene to include `template: "slideshow"` and `assets` array.

- [ ] **Step 4: Verify Remotion compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/remotion/VideoComposition.tsx src/remotion/Root.tsx
git commit -m "feat: template-based scene dispatch in VideoComposition"
```

---

## Task 8: Template Step UI

**Files:**
- Create: `src/app/wizard/[id]/steps/TemplateStep.tsx`

- [ ] **Step 1: Build TemplateStep component**

Component renders:
1. **Template picker** — 3 cards with visual SVG previews (adapt from existing TemplatePreview in ScriptStep.tsx lines 19-87). Each card shows: template name, description, use cases, assets-per-scene indicator.
2. **Project settings form** — preserved from current IdeaStep: topic input, scene count, scene duration, aspect ratio (9:16/16:9), video quality (720p/1080p/4k).
3. **Continue button** — saves template + settings to store, calls `saveProgress()`, advances to "idea" step.

Props: `{ store: WizardStoreApi }`

Read current IdeaStep at `src/app/wizard/[id]/steps/IdeaStep.tsx` for the settings form UI pattern to preserve.

- [ ] **Step 2: Commit**

```bash
git add src/app/wizard/[id]/steps/TemplateStep.tsx
git commit -m "feat: add TemplateStep as wizard Step 1 with template picker and project settings"
```

---

## Task 9: Update Wizard Client & Steps

**Files:**
- Modify: `src/app/wizard/[id]/client.tsx`
- Modify: `src/app/wizard/[id]/steps/IdeaStep.tsx`
- Modify: `src/app/wizard/[id]/steps/ScriptStep.tsx`
- Modify: `src/app/wizard/[id]/steps/RenderStep.tsx`

- [ ] **Step 1: Update client.tsx for 6 steps**

Add `"template"` step at the beginning of STEPS array:
```ts
const STEPS: { key: WizardStep; label: string }[] = [
  { key: "template", label: "Template" },
  { key: "idea", label: "Idea" },
  { key: "refine", label: "Refine" },
  { key: "script", label: "Script" },
  { key: "preview", label: "Preview" },
  { key: "render", label: "Render" },
];
```

Add import for TemplateStep, add rendering case:
```tsx
{currentStep === "template" && <TemplateStep store={store} />}
```

- [ ] **Step 2: Update IdeaStep**

Remove the project settings form (topic, scene count, duration, aspect ratio, quality) — these moved to TemplateStep. IdeaStep now only:
- Shows the selected template + topic (read-only summary)
- Generates AI idea angles shaped by the template
- Update the `enhanceIdea` call to include template context — append template name and description to the idea string passed to `enhanceIdea()` (in `src/lib/ai/wizard.ts:57-73`). No signature change needed — just enrich the input. E.g., `enhanceIdea(\`${topic} (Template: ${template.name} — ${template.description})\`)`

- [ ] **Step 3: Update ScriptStep**

Remove:
- Template picker (TEMPLATES array at lines 11-17)
- TemplatePreview function (lines 19-87)
- Template selection grid UI (lines 154-170)

Keep:
- Scene generation trigger (now uses template from store)
- Scene editing cards
- YouTube metadata section (lines 222-315)

- [ ] **Step 4: Update RenderStep**

Remove:
- Caption style selector import and UI (if present)
- `captionStyle` from render API call payload

Keep:
- Music selector
- Voiceover upload
- Aspect ratio + quality summary (read-only, editable)
- Progress polling
- Video player + download

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 6: Commit**

```bash
git add src/app/wizard/[id]/client.tsx src/app/wizard/[id]/steps/
git commit -m "feat: 6-step wizard flow with TemplateStep, updated IdeaStep and ScriptStep"
```

---

## Task 10: Template-Specific Scene Cards

**Files:**
- Create: `src/templates/slideshow/SceneCard.tsx`
- Create: `src/templates/comparison/SceneCard.tsx`
- Create: `src/templates/fact-card/SceneCard.tsx`
- Modify: `src/app/wizard/[id]/steps/PreviewStep.tsx`

- [ ] **Step 1: Create slideshow SceneCard**

Adapts from current `src/components/wizard/scene-card.tsx` (144 lines). Shows:
- Scene thumbnail (1 image from `assets[0]`)
- Script text textarea
- Search keyword input
- Asset options picker (3 thumbnails, click to select) for the single slot
- Reorder/delete buttons

- [ ] **Step 2: Create comparison SceneCard**

Shows:
- Two image thumbnails side by side (from `assets[0]` and `assets[1]`)
- Script text textarea
- Two search keyword inputs (left keyword, right keyword)
- Left/right label inputs (editable text)
- Asset options pickers for both slots
- Reorder/delete buttons

- [ ] **Step 3: Create fact-card SceneCard**

Shows:
- Main image thumbnail + secondary image thumbnail
- Title and subtitle text inputs
- Script text textarea
- Facts editor (list of label/value pairs, add/remove)
- Two search keyword inputs
- Asset options pickers for both slots
- Reorder/delete buttons

- [ ] **Step 4: Update PreviewStep**

Import scene cards from template modules. Render the appropriate SceneCard based on `scene.template`:
```tsx
import { SlideshowSceneCard } from "@/templates/slideshow/SceneCard";
import { ComparisonSceneCard } from "@/templates/comparison/SceneCard";
import { FactCardSceneCard } from "@/templates/fact-card/SceneCard";

// In render:
{scenes.map((scene, idx) => {
  switch (scene.template) {
    case "comparison": return <ComparisonSceneCard key={idx} ... />;
    case "fact-card": return <FactCardSceneCard key={idx} ... />;
    default: return <SlideshowSceneCard key={idx} ... />;
  }
})}
```

Preserve: drag-reorder, scene deletion, add blank scene, save progress, per-scene asset refresh (now per-slot).

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 6: Commit**

```bash
git add src/templates/*/SceneCard.tsx src/app/wizard/[id]/steps/PreviewStep.tsx
git commit -m "feat: template-specific SceneCard components and updated PreviewStep"
```

---

## Task 11: Update Render Pipeline

**Files:**
- Modify: `src/app/api/wizard/render/route.ts`
- Modify: `src/lib/inngest/functions.ts`
- Modify: `src/lib/render/render-video.ts`
- Modify: `src/app/api/wizard/draft/route.ts`

- [ ] **Step 1: Update render route**

`src/app/api/wizard/render/route.ts`:
- Remove `captionStyle` from request body destructuring (line 6)
- Remove `caption_style` from DB update (line 34)
- Ensure `template` (now a TemplateId) is passed to Inngest event
- Scenes now use new structure — pass them as-is to Inngest

- [ ] **Step 2: Update inngest functions**

`src/lib/inngest/functions.ts`:
- Update `VideoGenerateScene` interface to match new `Scene` union (or use `Scene` from `@/templates/types`)
- Remove `captionStyle` from `VideoGenerateEventData`
- Update "fetch-assets" step: iterate `scene.searchKeywords[]` instead of single `searchKeyword`
- Update "save-scenes" step: map `scene.searchKeywords` (join or pick first) for DB `search_keywords` column
- Update "render-video" step: pass template-typed scenes to `renderVideo()`
- Remove `captionStyle` from `renderVideo()` call

- [ ] **Step 3: Update render-video.ts**

`src/lib/render/render-video.ts`:
- Remove `captionStyle` from `RenderInput` type (line 22)
- Update `scenes` type in `RenderInput` to match new structure (include `template`, `assets`, template-specific fields)
- Remove `captionStyle` from Remotion `inputProps`
- Map scenes to format expected by `VideoCompositionProps`

- [ ] **Step 4: Update draft route**

`src/app/api/wizard/draft/route.ts` — ensure it handles new `draft_scenes` JSON shape (Scene union). No format migration needed since we're deleting old data.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/wizard/render/route.ts src/lib/inngest/functions.ts src/lib/render/render-video.ts src/app/api/wizard/draft/route.ts
git commit -m "feat: update render pipeline for template-typed scenes, remove captionStyle"
```

---

## Task 12: Cleanup Old Files

**Files:**
- Remove: `src/components/wizard/template-selector.tsx`
- Remove: `src/components/wizard/caption-style-selector.tsx`
- Remove: `src/lib/caption-styles.ts`
- Remove: `src/remotion/Scene.tsx`

- [ ] **Step 1: Remove old files**

```bash
git rm src/components/wizard/template-selector.tsx
git rm src/components/wizard/caption-style-selector.tsx
git rm src/lib/caption-styles.ts
git rm src/remotion/Scene.tsx
```

- [ ] **Step 2: Search for remaining imports**

Grep for any remaining references to removed files:
```bash
grep -r "caption-styles\|caption-style-selector\|template-selector\|from.*['\"].*\/Scene['\"]" src/ --include="*.ts" --include="*.tsx"
```

Fix any stale imports found.

- [ ] **Step 3: Verify TypeScript compiles with no errors**

Run: `npx tsc --noEmit --pretty`
Expected: Clean compilation

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old template-selector, caption-styles, and Scene.tsx"
```

---

## Task 13: Delete Test Data & Verify End-to-End

- [ ] **Step 1: Delete all existing projects from Supabase**

Via Supabase dashboard or SQL:
```sql
DELETE FROM scenes;
DELETE FROM projects;
```

- [ ] **Step 2: Run dev server**

```bash
npm run dev
```

- [ ] **Step 3: Verify full wizard flow — Slideshow template**

1. Open wizard → Step 1 shows 3 templates with visual previews
2. Select "Slideshow", enter topic, set scene count/duration/aspect ratio/quality
3. Continue → Idea step generates template-shaped angles
4. Continue → Refine step shows trend validation
5. Continue → Script step generates scenes (1 keyword, 1 caption each)
6. Continue → Preview step shows slideshow scene cards with 1 image slot each
7. Continue → Render step (music, voiceover). Trigger render.
8. Verify video renders correctly with slideshow layout

- [ ] **Step 4: Verify full wizard flow — Comparison template**

Same flow but selecting "Side-by-Side". Check:
- Scenes have 2 keywords, 2 image slots, left/right labels
- Scene cards show side-by-side images
- Rendered video shows comparison layout

- [ ] **Step 5: Verify full wizard flow — Fact Card template**

Same flow but selecting "Fact Card". Check:
- Scenes have 2 keywords, title, subtitle, facts
- Scene cards show card layout with fact editor
- Rendered video shows fact card layout

- [ ] **Step 6: Verify preserved features**

- Draft saving/resuming: Navigate away and back — state restored
- Scene editing: Reorder, delete, add scenes
- Multiple asset candidates: Each slot shows 3 options
- Background music: Select track, verify in render
- Voiceover upload: Upload file, verify in render
- Dashboard: Project cards, realtime status, delete

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete template system integration — 3 archetypes driving full pipeline"
```

---

## Verification Checklist

After all tasks complete, verify these from the design spec:

- [ ] Template selection is Step 1, with visual previews
- [ ] Topic, scene count, scene duration, aspect ratio, quality all configurable in Step 1
- [ ] AI generates scenes matching template structure
- [ ] Asset fetching respects template asset count (1 vs 2 per scene)
- [ ] Preview shows template-specific scene cards
- [ ] Remotion renders correct layout per template
- [ ] No scene counter in rendered video
- [ ] No caption style selector in UI
- [ ] Draft saving/resuming works
- [ ] Scene editing (reorder, delete, add, refresh) works
- [ ] Multiple asset candidates per slot
- [ ] Background music with fade
- [ ] Voiceover upload
- [ ] Dashboard and video delivery unchanged
