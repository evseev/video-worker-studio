# Template System Design — 3 Archetypes for MVP

## Context

The project spec (section 7.1) defines 3 template archetypes, but the current codebase has no real template system. "Templates" today only affect caption styling — every scene always renders 1 full-bleed image with a text overlay. The 5 template options in ScriptStep.tsx (Slideshow, Fact Card, Compilation, Comparison, Evolution) are cosmetic presets with no structural impact.

This design introduces a **true template system** where the selected template drives the entire video creation pipeline: scene structure, AI generation, asset fetching, preview layout, and Remotion rendering.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Architecture | **Template Modules** — fully isolated per-template directories |
| Template selection | **Step 1** — before idea generation |
| Archetypes | **3**: Slideshow (1 img), Comparison (2 img), Fact Card (2 img + metadata) |
| Multi-image search | **Two separate keywords** per scene |
| Fact Card metadata | **AI-generated** per scene (title, subtitle, fact labels) |
| Comparison labels | **Per-scene** — AI picks appropriate pair per scene |
| Caption styles | **Built into templates** (no separate selector) |
| Scene counter | **Removed** from all Remotion scene components |
| Existing projects | **Delete all** (test data only) — no migration needed |
| Remotion boundary | **Maintained** — Remotion components stay under `src/remotion/` |

## Wizard Flow (6 Steps)

```
1. Template  →  2. Idea  →  3. Refine  →  4. Script+Assets  →  5. Preview  →  6. Render
```

1. **Template** (NEW) — Pick archetype: Slideshow / Comparison / Fact Card. Visual previews. Also configure: **topic, scene count, scene duration, aspect ratio, video quality**. These existing project form fields remain here as the initial project setup.
2. **Idea** — AI generates angles *shaped by template + topic* (e.g., comparison-style angles for Comparison template)
3. **Refine** — Trend validation (kept as separate step)
4. **Script + Assets** — AI generates template-shaped scenes (using scene count from Step 1) → auto-fetch assets (1 or 2 per scene per template)
5. **Preview + Edit** — Template-specific scene cards. Edit text, swap assets per slot, reorder. Scene duration, aspect ratio, quality visible/editable.
6. **Render** — Music, voiceover. Aspect ratio + quality shown as summary (editable). No caption style selector (built into template).

## File Structure

### New: Template Modules (app-side)
```
src/templates/
  ├── index.ts                      # Registry: getTemplate(id), TEMPLATE_IDS, allTemplates
  ├── types.ts                      # TemplateDefinition, BaseScene, AssetSlot, Scene union
  ├── slideshow/
  │   ├── config.ts                 # id, name, description, assetsPerScene: 1, defaultSceneCount
  │   ├── types.ts                  # SlideshowScene
  │   ├── prompt.ts                 # buildSlideshowPrompt(topic, sceneCount)
  │   ├── schema.ts                 # Zod schema for AI output validation
  │   ├── SceneCard.tsx             # Preview/edit card for wizard
  │   └── index.ts
  ├── comparison/
  │   ├── config.ts                 # assetsPerScene: 2
  │   ├── types.ts                  # ComparisonScene (leftLabel, rightLabel)
  │   ├── prompt.ts                 # buildComparisonPrompt
  │   ├── schema.ts
  │   ├── SceneCard.tsx
  │   └── index.ts
  └── fact-card/
      ├── config.ts                 # assetsPerScene: 2
      ├── types.ts                  # FactCardScene (title, subtitle, facts[])
      ├── prompt.ts                 # buildFactCardPrompt
      ├── schema.ts
      ├── SceneCard.tsx
      └── index.ts
```

### New: Remotion Scene Components
```
src/remotion/templates/
  ├── SlideshowScene.tsx            # Full-bleed image, Ken Burns, bottom caption
  ├── ComparisonScene.tsx           # Split layout, left/right images, labels, VS badge
  └── FactCardScene.tsx             # Hero image, card body, thumbnail, facts, labels
```

### New: Template Step UI
```
src/app/wizard/[id]/steps/TemplateStep.tsx   # Step 1: template picker with visual previews
```

## Data Model

### Scene Types (discriminated union)
```ts
interface AssetSlot {
  url?: string
  options?: string[]
  selectedIndex?: number
}

interface BaseScene {
  scriptText: string
  searchKeywords: string[]      // 1 for slideshow, 2 for comparison/fact-card
  assets: AssetSlot[]           // Matched to searchKeywords
}

interface SlideshowScene extends BaseScene {
  template: 'slideshow'
}

interface ComparisonScene extends BaseScene {
  template: 'comparison'
  leftLabel: string             // e.g. "Before", "1990", "Young"
  rightLabel: string            // e.g. "After", "2024", "Old"
}

interface FactCardScene extends BaseScene {
  template: 'fact-card'
  title: string                 // Person/subject name
  subtitle: string              // Role, relationship
  facts: { label: string; value: string }[]  // "Net Worth": "$50M"
}

type Scene = SlideshowScene | ComparisonScene | FactCardScene
```

### Template Definition Interface
```ts
interface TemplateDefinition {
  id: 'slideshow' | 'comparison' | 'fact-card'
  name: string
  description: string
  assetsPerScene: 1 | 2
  defaultSceneCount: number
  buildPrompt: (topic: string, count: number) => string
  sceneSchema: ZodSchema
}
```

## AI Generation — Template-Specific Prompts

Each template module's `prompt.ts` generates the system prompt for scene structure generation.

**Slideshow:** Generate N scenes, each with 1 search keyword, 1 caption (max 15 words). Storytelling style, one idea per scene.

**Comparison:** Generate N scenes, each with 2 search keywords (left vs right), label pair (AI picks per scene, e.g. "Before"/"After"), and caption. Contrasting items.

**Fact Card:** Generate N scenes, each with 2 search keywords (main image, secondary), title, subtitle, caption, and 2-3 fact key-value pairs.

All prompts enforce structured JSON output validated by template-specific Zod schemas.

## Asset Fetching

Adapts based on `template.assetsPerScene`:
- **Slideshow:** 1 keyword → fetch 3 image options → populate `assets[0].options`
- **Comparison:** 2 keywords → fetch 3 options each → populate `assets[0]` and `assets[1]`
- **Fact Card:** 2 keywords → fetch 3 options each → populate `assets[0]` and `assets[1]`

Existing Pinterest fetcher stays — called once per keyword per scene.

## Remotion Rendering

`VideoComposition.tsx` maps template → component:
```tsx
const SceneComponent = {
  'slideshow': SlideshowScene,
  'comparison': ComparisonScene,
  'fact-card': FactCardScene,
}[template]
```

Shared across all templates: transition logic (fade), duration, music/voiceover overlay.

**SlideshowScene:** Full-bleed image background, Ken Burns zoom/pan, dark gradient overlay at bottom, caption with fade-in animation. No scene counter.

**ComparisonScene:** Dark background, two images side by side (50/50 split with gap), per-scene labels above each image, optional VS separator badge, caption bar at bottom. No scene counter.

**FactCardScene:** Hero image at top (~40% height), card body below with: secondary thumbnail + title/subtitle row, fact text block, label badges. Animated entry. No scene counter.

## Files to Remove
- `src/components/wizard/template-selector.tsx` — replaced by TemplateStep
- `src/components/wizard/caption-style-selector.tsx` — captions built into templates
- `src/lib/caption-styles.ts` — no longer needed
- `src/remotion/Scene.tsx` — replaced by 3 template-specific components
- Template picker code in `src/app/wizard/[id]/steps/ScriptStep.tsx` — 5 SVG previews removed

## Files to Modify
- `src/lib/stores/wizard-store.ts` — new Scene union type, assets[], template step, remove captionStyle
- `src/remotion/VideoComposition.tsx` — template-based component switch, remove scene counter
- `src/remotion/Root.tsx` — update VideoCompositionProps
- `src/app/api/wizard/generate-structure/route.ts` — pass templateId to prompt builder
- `src/app/api/wizard/fetch-assets/route.ts` — iterate searchKeywords[], populate assets[]
- `src/lib/ai/wizard.ts` — use template-specific prompt
- `src/app/wizard/[id]/client.tsx` — add "template" step, update step routing
- `src/app/api/wizard/render/route.ts` — pass new scene shape
- `src/lib/inngest/functions.ts` — handle new scene structure
- `src/lib/supabase/types.ts` — update if needed for type safety

## Database Changes
- Delete all existing projects (test data only)
- `projects.draft_scenes` JSON format changes to new Scene union
- `projects.selected_template` values change: `"Slideshow"` → `"slideshow"`, etc.
- `projects.caption_style` column becomes unused (can keep nullable)
- No migration script needed

## Feature Preservation Checklist (from prd_backlog.md)

All implemented epics reviewed. The following must be explicitly preserved during integration:

### Must Not Break
- **Draft saving & resuming** (Epic 6.2) — `PUT /api/wizard/draft` must handle new Scene union JSON
- **Scene editing** (Epic 10) — reorder, delete, add blank scene, per-scene asset refresh — all work with new scene model
- **Multiple asset candidates** (Epic 17) — 3 options per slot, click-to-select in SceneCard — extended to per-asset-slot
- **Video config settings** (Epic 12) — `resolveVideoDimensions()`, aspect ratio (9:16/16:9), quality (720p/1080p/4k) all preserved
- **Settings propagation** (Epic 19) — aspect ratio → AI prompts, orientation hints → Pinterest keywords, sceneDuration → render pipeline
- **Background music** (Epic 13) — 5 presets, audio preview, fade-in/fade-out in Remotion
- **Voice-over upload** (Epic 16) — drag-drop upload, 50MB max, 0.9 volume in Remotion
- **Auth + rate limiting** (Epics 8, 15) — `withAuth()` wrapper, rate limit tiers on all routes
- **Zod validation** (Epic 8.3) — update schemas for new scene structure, keep validation pattern
- **Double-submit prevention** (Epic 8.5) — render route 409 check stays
- **Inngest error handling** (Epic 8.4) — throw on RPC failure pattern stays
- **Dashboard** (Epics 3, 7, 9) — project cards, realtime subscription, status badges, delete, links to player
- **Video delivery** (Epic 7) — project page with status views, VideoPlayer, download button, retry
- **Error boundaries + toasts** (Epic 9.5-9.6) — route error boundaries, toast notification system
- **Refine step** (Epic 18.3) — trend validation via `/api/wizard/enhance-idea` and `/api/wizard/validate-trend`
- **Render step** (Epic 18.6) — progress polling, in-app video player, download, error retry
- **Dashboard "New Video" modal** (Epic 18.7) — with video settings

### Intentionally Replaced
- **Caption style system** (Epic 11) — `caption-styles.ts`, `CaptionStyleSelector`, `caption_style` DB column — all replaced by template-built-in captions
- **5 template presets** (Epic 6.3) — replaced by 3 structural archetypes
- **Template SVG previews in ScriptStep** (Epic 19.3) — replaced by new TemplateStep previews

## Verification

1. **Template selection:** Open wizard → Step 1 shows 3 templates with visual previews → select one → stored in project
2. **AI generation:** Enter topic → AI generates scenes matching template structure (check scene count, field presence)
3. **Asset fetching:** Scenes fetch correct number of images per template (1 for slideshow, 2 for comparison/fact-card)
4. **Preview:** Scene cards render template-specific layouts with all editable fields
5. **Rendering:** Remotion preview/render produces correct layout per template
6. **Full flow:** Complete wizard end-to-end for each template type → video renders correctly
