# Epic 22: Scene Transitions & Animation Effects — Design Spec

## Context

Currently, Video Worker Studio uses a single hardcoded fade transition between all scenes and basic hardcoded animations within scenes (Ken Burns zoom on slideshow, slide-in on comparison, pop-in on fact-card). The TODOS.md requests two features: (1) let users choose from multiple transition types between scenes, and (2) let users choose scene animation effects — both with a "random" option that varies per scene. This epic delivers full granular control over transitions, image motion, and text animations.

## Scope

**In scope:**
- 5 scene transition types + random (all using built-in `@remotion/transitions` presentations)
- 9 image motion types + random (transform-based animations on scene images)
- 5 text animation types + random (caption/label entry effects)
- 3 selectors on the Template step (Step 1) in a collapsible "Effects & Animations" section
- Pipeline threading from wizard store → DB → Inngest → Remotion
- Random resolution at render dispatch time (deterministic for Lambda parallel rendering)

**Out of scope:**
- Per-scene effect overrides (all scenes use the same global setting, except when "random" resolves per-scene)
- Audio-synced animations
- Custom user-defined effects

---

## 1. Effect Definitions

### Scene Transitions (between scenes)

| ID | Label | Remotion Presentation | Default |
|---|---|---|---|
| `fade` | Fade | `fade()` | ✓ |
| `slide` | Slide | `slide({ direction: 'from-right' })` | |
| `wipe` | Wipe | `wipe()` | |
| `flip` | Flip | `flip()` | |
| `clock-wipe` | Clock Wipe | `clockWipe()` | |
| `random` | Random | Resolved per-gap at render time | |

### Image Motions (within scenes)

| ID | Label | CSS Transform | Default |
|---|---|---|---|
| `zoom-in` | Zoom In | scale 1.0 → 1.1 | ✓ |
| `zoom-out` | Zoom Out | scale 1.1 → 1.0 | |
| `pan-left` | Pan Left | translateX 0 → -5% | |
| `pan-right` | Pan Right | translateX 0 → 5% | |
| `pan-up` | Pan Up | translateY 0 → -5% | |
| `pan-down` | Pan Down | translateY 0 → 5% | |
| `pan-horizontal` | Pan Horizontal | translateX sinusoidal: 0 → -3% → 0 → +3% → 0 | |
| `none` | None | No transform (static) | |
| `random` | Random | Resolved per-scene at render time | |

### Text Animations (caption/label entry)

| ID | Label | Effect | Default |
|---|---|---|---|
| `slide-up` | Slide Up | translateY 30→0 + opacity 0→1 | ✓ |
| `slide-left` | Slide Left | translateX 30→0 + opacity 0→1 | |
| `typewriter` | Typewriter | Character-by-character reveal | |
| `pop` | Pop | scale 0→1.1→1.0 + opacity 0→1 | |
| `fade-in` | Fade In | opacity 0→1 only | |
| `random` | Random | Resolved per-scene at render time | |

---

## 2. Data Model

### Database Migration

New migration: `supabase/migrations/YYYYMMDDHHMMSS_add_scene_effects.sql`

```sql
ALTER TABLE projects
  ADD COLUMN scene_transition text NOT NULL DEFAULT 'fade'
    CHECK (scene_transition IN ('fade','slide','wipe','flip','clock-wipe','random')),
  ADD COLUMN image_motion text NOT NULL DEFAULT 'zoom-in'
    CHECK (image_motion IN ('zoom-in','zoom-out','pan-left','pan-right','pan-up','pan-down','pan-horizontal','none','random')),
  ADD COLUMN text_animation text NOT NULL DEFAULT 'slide-up'
    CHECK (text_animation IN ('slide-up','slide-left','typewriter','pop','fade-in','random'));
```

Defaults match current hardcoded behavior — zero visual change for existing projects.

### TypeScript Types

New file: `src/lib/effects.ts`

```ts
export type SceneTransition = 'fade' | 'slide' | 'wipe' | 'flip' | 'clock-wipe' | 'random';
export type ImageMotion = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' | 'pan-horizontal' | 'none' | 'random';
export type TextAnimation = 'slide-up' | 'slide-left' | 'typewriter' | 'pop' | 'fade-in' | 'random';

// Concrete types (no 'random' — used after resolution)
export type ResolvedTransition = Exclude<SceneTransition, 'random'>;
export type ResolvedImageMotion = Exclude<ImageMotion, 'random'>;
export type ResolvedTextAnimation = Exclude<TextAnimation, 'random'>;
```

Plus arrays of options with `{ id, label, description }` for UI rendering.

### Random Resolution

Random values are resolved **before** passing to Remotion (in Inngest function or render route) to ensure deterministic Lambda rendering. Resolved values are passed as per-scene arrays:

```ts
// Remotion inputProps (after resolution)
{
  sceneTransitions: ResolvedTransition[],   // length = scenes.length - 1
  imageMotions: ResolvedImageMotion[],       // length = scenes.length
  textAnimations: ResolvedTextAnimation[],   // length = scenes.length
}
```

Resolver function in `src/lib/effects.ts`:
- If value is not `'random'`, repeat it for all scenes/gaps
- If value is `'random'`, pick randomly from non-random options for each scene/gap

---

## 3. UI Design

### TemplateStep Layout

Add a collapsible "Effects & Animations" section below existing settings:

```
┌─────────────────────────────────────┐
│ Template Picker (existing)          │
├─────────────────────────────────────┤
│ Project Settings (existing)         │
│  Topic, Scenes, Duration, Ratio,    │
│  Quality                            │
├─────────────────────────────────────┤
│ ▼ Effects & Animations              │
│                                     │
│  Scene Transitions                  │
│  [Fade] [Slide] [Wipe] [Flip]     │
│  [Clock] [🎲 Random]               │
│                                     │
│  Image Motion                       │
│  [Zoom In] [Zoom Out] [Pan ←]     │
│  [Pan →] [Pan ↑] [Pan ↓] [Pan ↔] │
│  [None] [🎲 Random]                │
│                                     │
│  Text Animation                     │
│  [Slide Up] [Slide Left]           │
│  [Typewriter] [Pop] [Fade In]      │
│  [🎲 Random]                        │
└─────────────────────────────────────┘
```

### EffectSelector Component

New reusable component: `src/components/wizard/effect-selector.tsx`

- Takes `options: { id, label, description }[]`, `value`, `onChange`
- Renders a grid of selectable cards (same styling pattern as existing selectors)
- Selected state: blue ring highlight
- Used 3× on TemplateStep (transition, image motion, text animation)

### Collapsible Section

Defaults expanded. Chevron toggle to collapse/expand. Smooth height animation.

---

## 4. Pipeline Threading

### Files Modified

| File | Change |
|---|---|
| `src/lib/effects.ts` | **NEW** — type definitions, option arrays, resolver function |
| `src/components/wizard/effect-selector.tsx` | **NEW** — reusable effect picker component |
| `src/remotion/animation-utils.ts` | **NEW** — shared `getImageTransform()` and `getTextStyle()` utilities |
| `src/lib/stores/wizard-store.ts` | Add `sceneTransition`, `imageMotion`, `textAnimation` to state, `initializeFromProject()`, `saveDraft()` |
| `src/app/wizard/[id]/steps/TemplateStep.tsx` | Add collapsible Effects section with 3 EffectSelector instances |
| `src/app/api/wizard/draft/route.ts` | Accept + persist 3 new fields |
| `src/app/api/wizard/render/route.ts` | Pass effect settings in Inngest event payload |
| `src/lib/inngest/functions.ts` | Resolve random → concrete arrays, pass to `renderVideo()` |
| `src/lib/render/render-video.ts` | Update `RenderInput` type with resolved effect arrays |
| `src/remotion/VideoComposition.tsx` | Map transition IDs to Remotion presentations per-scene gap |
| `src/remotion/templates/SlideshowScene.tsx` | Use `imageMotion`/`textAnimation` props via `animation-utils.ts` |
| `src/remotion/templates/ComparisonScene.tsx` | Same — replace hardcoded slide-in with configurable effects |
| `src/remotion/templates/FactCardScene.tsx` | Same — replace hardcoded pop-in with configurable effects |
| `src/remotion/Root.tsx` | Update default props schema |
| `src/lib/supabase/types.ts` | Regenerate after migration |
| `supabase/migrations/YYYYMMDDHHMMSS_add_scene_effects.sql` | **NEW** — 3 columns with CHECK constraints |

### Data Flow

```
User selects effects in TemplateStep
  → wizard store state updated
  → saveDraft API writes to projects table
  → RenderStep sends to render API
  → Inngest event includes sceneTransition, imageMotion, textAnimation
  → Inngest function resolves 'random' to per-scene arrays
  → renderVideo() receives resolved arrays
  → Remotion inputProps include sceneTransitions[], imageMotions[], textAnimations[]
  → VideoComposition maps transition IDs to presentations
  → Scene components use animation-utils for image/text effects
```

---

## 5. Remotion Implementation

### VideoComposition.tsx — Transitions

Replace hardcoded `fade()` with a presentation lookup:

```ts
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';
import { clockWipe } from '@remotion/transitions/clock-wipe';

const presentationMap: Record<ResolvedTransition, () => TransitionPresentation> = {
  'fade': () => fade(),
  'slide': () => slide({ direction: 'from-right' }),
  'wipe': () => wipe(),
  'flip': () => flip(),
  'clock-wipe': () => clockWipe(),
};
```

Each `<TransitionSeries.Transition>` uses `presentationMap[sceneTransitions[i]]()`.

### animation-utils.ts — Shared Helpers

New file: `src/remotion/animation-utils.ts`

**`getImageTransform(motion, progress)`** — returns `React.CSSProperties` (transform + transformOrigin):
- `zoom-in`: scale(1 + 0.1 * progress)
- `zoom-out`: scale(1.1 - 0.1 * progress)
- `pan-left`: translateX(-5% * progress)
- `pan-right`: translateX(5% * progress)
- `pan-up`: translateY(-5% * progress)
- `pan-down`: translateY(5% * progress)
- `pan-horizontal`: translateX(3% * sin(progress * 2π))
- `none`: identity

**`getTextStyle(animation, frame, startFrame, fps)`** — returns `React.CSSProperties` (opacity + transform):
- `slide-up`: opacity 0→1 + translateY(30→0) over 0.5s from startFrame
- `slide-left`: opacity 0→1 + translateX(30→0) over 0.5s
- `typewriter`: opacity 1, `clipPath: inset(0 ${100 - revealPercent}% 0 0)` (progressive reveal)
- `pop`: opacity 0→1 + scale(0→1.1→1.0) over 0.4s (with overshoot)
- `fade-in`: opacity 0→1 over 0.5s

### Scene Components

All 3 scene components (Slideshow, Comparison, FactCard) receive `imageMotion` and `textAnimation` as props. Replace their hardcoded animation logic with calls to `getImageTransform()` and `getTextStyle()`. This simplifies each component and ensures consistent animation behavior.

---

## 6. Testing

### Unit Tests
- `src/__tests__/lib/effects.test.ts` — type/value coverage, resolver function (specific + random modes)
- `src/__tests__/components/wizard/effect-selector.test.ts` — renders options, selection state, onChange callback
- `src/__tests__/remotion/animation-utils.test.ts` — each motion/animation returns correct CSS properties at key frames
- Wizard store updates — `sceneTransition`/`imageMotion`/`textAnimation` init, persistence, reset

### Manual E2E Verification
1. New project → Template step shows Effects section with all 3 selectors
2. Pick effects → save draft → reload → selections persist
3. Pick "Random" → render → video has varied effects per scene
4. Pick specific effects → render → video uses chosen effects consistently
5. All 3 templates (slideshow, comparison, fact-card) respect settings
6. `npm run test` passes, `npm run lint` clean, `npm run build` succeeds

---

## 7. Backlog Entry

**Epic 22: Scene Transitions & Animation Effects**
**Description:** Add user-configurable transitions between scenes and animation effects within scenes. Three granular selectors (transition type, image motion, text animation) with a "random" option that varies per scene. Settings live on the Template step in a collapsible "Effects & Animations" section.

Stories:
- **22.1:** Create `src/lib/effects.ts` — types, option arrays, resolver function
- **22.2:** DB migration — 3 new columns (`scene_transition`, `image_motion`, `text_animation`) with CHECK constraints
- **22.3:** Build `EffectSelector` component (`src/components/wizard/effect-selector.tsx`)
- **22.4:** Add collapsible Effects section to TemplateStep with 3 selectors
- **22.5:** Update wizard store — new state fields, `initializeFromProject()`, `saveDraft()`
- **22.6:** Update draft API route — accept + persist 3 new fields
- **22.7:** Thread effects through render pipeline — render API, Inngest function (with random resolution), `RenderInput`
- **22.8:** Create `src/remotion/animation-utils.ts` — shared `getImageTransform()` and `getTextStyle()`
- **22.9:** Update `VideoComposition.tsx` — transition presentation mapping per scene gap
- **22.10:** Update 3 Remotion scene components — use `imageMotion`/`textAnimation` props via animation-utils
- **22.11:** Update `Root.tsx` default props
- **22.12:** Tests + E2E verification
