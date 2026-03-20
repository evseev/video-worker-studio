# MVP Development Plan — Video Worker Studio

> From proof-of-concept (v0.2.3.0) to shippable MVP.
> 11 epics, 4 phases, ~55 tasks.

---

## Current State (Epics 1-6 Complete)

| Epic | Status |
|------|--------|
| E1: Scaffold & Infrastructure | Done |
| E2: Core Data Modeling | Done |
| E3: User Interface for Generation | Done |
| E4: Automated AI Pipeline Worker | Done |
| E5: Video Rendering Engine & Delivery | Done |
| E6: AI Generation Wizard & Templates | Done |

---

## Phase 1: Foundation (P0)

### E7: Video Delivery & Playback

**Goal:** Users can watch completed videos in-app, download them, and retry failed renders.

| # | Task | Files |
|---|------|-------|
| E7.1 | Create `/projects/[id]` server page with status-aware views (player / progress / error+retry) | NEW `src/app/projects/[id]/page.tsx` |
| E7.2 | Build `VideoPlayer` component (HTML5 `<video>`, poster, play/pause, fullscreen) | NEW `src/components/video-player.tsx` |
| E7.3 | Add download button with proper filename `{topic}-{id}.mp4` | `src/components/video-player.tsx` |
| E7.4 | Retry button for failed projects (re-dispatch Inngest event, reset status) | `src/app/projects/[id]/page.tsx` |
| E7.5 | Update dashboard cards: draft → wizard, others → `/projects/[id]` | `src/components/dashboard.tsx` |
| E7.6 | Show pipeline progress stage on project detail page | Consider `progress_stage` column |

**Effort:** ~2 days human / ~3-4 hours CC

---

### E8: Wizard Hardening & Error Handling

**Goal:** The wizard flow is reliable — errors surface to users, inputs are validated, auth is enforced.

| # | Task | Files |
|---|------|-------|
| E8.1 | Extract shared `withAuth()` wrapper (validates session, returns 401, passes user to handler) | NEW `src/lib/api/with-auth.ts` |
| E8.2 | Add Zod validation to all 8 wizard routes using `withAuth` wrapper. Fix fragile path handling in fetch-assets | All `src/app/api/wizard/*/route.ts` |
| E8.3 | Add user-facing error banners in wizard. Check `res.ok` before parsing JSON | `src/app/wizard/[id]/client.tsx` |
| E8.4 | Saving indicator with success/failure confirmation | `src/app/wizard/[id]/client.tsx` |
| E8.5 | Prevent double-submit on render (server-side status check) | `src/app/api/wizard/render/route.ts` |
| E8.6 | Add Sentry breadcrumbs to wizard AI calls | All wizard API routes |
| E8.7 | Fix `updateStatus()` to throw on RPC failure (Inngest retries). Add anon key comment | `src/lib/inngest/functions.ts` |

**Effort:** ~2 days human / ~3-4 hours CC

---

### E14: Automated Testing Infrastructure

**Goal:** Bootstrap test framework FIRST (E14.1 is prerequisite for all epics), then each epic writes its own tests alongside implementation.

| # | Task | Files |
|---|------|-------|
| E14.1 | **(PREREQUISITE)** Bootstrap Vitest with path aliases, jsdom, coverage | NEW `vitest.config.ts`, `package.json` |
| E14.2 | Unit tests for existing AI modules (mocked Gemini, Zod validation) | NEW `src/__tests__/lib/ai/` |
| E14.3 | Unit tests for existing render-video (mocked Lambda/bundler) | NEW `src/__tests__/lib/render/` |
| E14.4 | Bootstrap Playwright E2E (one critical-path test) | NEW `playwright.config.ts` |
| E14.5 | CI integration and AGENTS.md update | `package.json`, `AGENTS.md` |

**NOTE:** All NEW code tests are written alongside each epic (E7-E17), not backfilled.

**Effort:** ~2 days human / ~3-4 hours CC

---

## Phase 2: Quality & Editing (P0-P1)

### E9: Component Decomposition & UX Polish

**Goal:** Break monolithic components, add missing UX states, make it feel like a real product.

**Dependencies:** E7

| # | Task | Files |
|---|------|-------|
| E9.1 | Extract dashboard sub-components. Replace polling with Supabase Realtime subscription | `src/components/dashboard/` |
| E9.2 | Extract wizard steps. Design RenderStep as container with sub-component slots | `src/components/wizard/` |
| E9.3 | Add loading skeletons for dashboard and wizard | NEW `src/components/ui/skeleton.tsx` |
| E9.4 | Add `error.tsx` route boundaries with Sentry capture | `src/app/wizard/[id]/error.tsx`, `src/app/projects/[id]/error.tsx` |
| E9.5 | Build toast notification system (Zustand store + portal) | NEW `src/components/ui/toast.tsx` |
| E9.6 | Responsive polish for mobile | Various components |
| E9.7 | Keyboard shortcuts (Escape for modals, Enter for forms) | Various components |

**Effort:** ~2 days human / ~4-5 hours CC

---

### E10: Scene Editing Capabilities

**Goal:** Users can reorder, delete, add, and regenerate individual scenes in the wizard.

**Dependencies:** E9

| # | Task | Files |
|---|------|-------|
| E10.1 | Drag-and-drop scene reordering (HTML5 native, no new dep) | `src/components/wizard/ScriptStep.tsx` |
| E10.2 | Delete individual scene with confirmation | `src/components/wizard/ScriptStep.tsx` |
| E10.3 | Add new blank scene at end | `src/components/wizard/ScriptStep.tsx` |
| E10.4 | Regenerate single scene script (Gemini with context) | `src/app/api/wizard/script/route.ts` |
| E10.5 | Per-scene asset refresh with editable keyword | `src/app/api/wizard/fetch-assets/route.ts` |

**Effort:** ~2 days human / ~3-4 hours CC

---

### E15: Rate Limiting & Security Hardening

**Goal:** Protect API routes from abuse, harden security for public-facing app.

| # | Task | Files |
|---|------|-------|
| E15.1 | In-memory rate limiter (AI: 10/min, render: 3/min, general: 60/min) | NEW `src/lib/rate-limit.ts` |
| E15.2 | CSRF protection (Origin header verification) | `src/middleware.ts` |
| E15.3 | Input sanitization (max-length, no injection) | All API routes + client |
| E15.4 | Audit Supabase RLS policies | `supabase/migrations/` |
| E15.5 | Request body size limits on scene-accepting routes | Draft and render routes |

**Effort:** ~1 day human / ~2-3 hours CC

---

## Phase 3: Features (P1)

### E12: Video Configuration (Aspect Ratio & Quality)

**Goal:** Users select aspect ratio (16:9, 9:16) and quality (720p, 1080p) before rendering.

| # | Task | Files |
|---|------|-------|
| E12.1 | Aspect ratio + quality selectors in wizard Render step | `src/components/wizard/RenderStep.tsx` |
| E12.2 | DB migration: `aspect_ratio`, `video_quality` columns | `supabase/migrations/`, `src/lib/supabase/types.ts` |
| E12.3 | Thread settings through pipeline (draft → Inngest → Remotion) | `src/lib/inngest/functions.ts` |
| E12.4 | Dynamic Remotion composition dimensions (replace hardcoded 1080x1920) | `src/remotion/Root.tsx` |
| E12.5 | Landscape layout in Scene.tsx (caption position, image cropping) | `src/remotion/Scene.tsx` |
| E12.6 | Update Lambda and local render calls with correct dimensions | `src/lib/render/render-video.ts` |

**Effort:** ~1.5 days human / ~2-3 hours CC

---

### E13: Background Music

**Goal:** Users can optionally add background music from a preset library.

| # | Task | Files |
|---|------|-------|
| E13.1 | Curate 5-8 royalty-free tracks (Supabase Storage or `/public/music/`) | Asset files |
| E13.2 | Music selector with audio preview in wizard Render step | `src/components/wizard/RenderStep.tsx` |
| E13.3 | DB migration: `background_music` column | `supabase/migrations/`, `src/lib/supabase/types.ts` |
| E13.4 | Thread music URL through pipeline | `src/lib/inngest/functions.ts` |
| E13.5 | Add `<Audio>` to Remotion with fade-in/fade-out | `src/remotion/VideoComposition.tsx` |

**Effort:** ~1 day human / ~2 hours CC

---

### E11: Caption Style System

**Goal:** Users choose from 4 caption style presets that affect rendered output.

**Dependencies:** E13

| # | Task | Files |
|---|------|-------|
| E11.1 | Define 4 presets (Minimal White, Bold Viral, Bottom Strip, Split Labels) | NEW `src/lib/caption-styles.ts` |
| E11.2 | Caption style selector grid in wizard Render step | `src/components/wizard/RenderStep.tsx` |
| E11.3 | DB migration: `caption_style` column | `supabase/migrations/`, `src/lib/supabase/types.ts` |
| E11.4 | Thread captionStyle through pipeline | `src/lib/inngest/functions.ts` |
| E11.5 | Implement 4 caption rendering modes in Scene.tsx | `src/remotion/Scene.tsx` |
| E11.6 | Google Font loading for caption presets | `@remotion/google-fonts` |

**Effort:** ~1.5 days human / ~2-3 hours CC

---

## Phase 4: Polish (P1-P2)

### E17: Multiple Asset Candidates Per Scene

**Goal:** Fetch 3 image options per scene, let user pick which to use.

**Dependencies:** E10

| # | Task | Files |
|---|------|-------|
| E17.1 | Update fetchAssets: `-n 1` → `-n 3`, parallelize with concurrency limit 3-4 | `src/lib/ai/fetch-assets.ts` |
| E17.2 | Update draft_scenes schema: `assetOptions[]` + `selectedAssetIndex` | JSONB schema change |
| E17.3 | Asset picker UI: 3 thumbnails per scene, click to select | `src/components/wizard/SceneCard.tsx` |
| E17.4 | Tavily fallback when Pinterest returns <3 results | `src/lib/ai/fetch-assets.ts` |

**Effort:** ~1.5 days human / ~3 hours CC

---

### E16: Voice-Over Upload

**Goal:** Users can upload an MP3/WAV voice-over that gets mixed into the final video.

**Dependencies:** E13, E17

| # | Task | Files |
|---|------|-------|
| E16.1 | File upload component (drag-and-drop, 50MB max, type validation) | NEW `src/components/wizard/VoiceoverUpload.tsx` |
| E16.2 | Upload to Supabase Storage + DB migration (`voiceover_url`) | `supabase/migrations/`, `src/lib/supabase/types.ts` |
| E16.3 | Add voiceover `<Audio>` to Remotion (louder than music) | `src/remotion/VideoComposition.tsx` |
| E16.4 | Preview uploaded voiceover before rendering | `src/components/wizard/VoiceoverUpload.tsx` |

**Effort:** ~1.5 days human / ~3 hours CC

---

## Implementation Order

```
E14.1 (Vitest bootstrap) ──► PREREQUISITE FOR ALL

Phase 1 (after E14.1):
  E14.2-E14.5 (Existing code tests + Playwright) ───────────►
  E8  (Wizard Hardening + withAuth) ──►
  E7  (Video Delivery) ─────►

Phase 2 (after E7, E8):
  E9  (Component Decomp + Realtime + RenderStep container) ──────►
  E15 (Security) ──►
  E10 (Scene Editing) ──────────► (after E9)

Phase 3 (after E9):
  E12 (Aspect Ratio) ─►
  E13 (Music) ──►
  E11 (Captions) ────► (after E13)

Phase 4 (after E10, E11):
  E17 (Multiple Assets + parallel fetch) ──► (after E10)
  E16 (Voice-Over) ──► (after E17)
```

---

## Database Migrations Required

| Epic | Migration | Columns Added |
|------|-----------|---------------|
| E7 | `*_add_progress_stage.sql` | `progress_stage text` on projects (optional) |
| E11 | `*_add_caption_style.sql` | `caption_style text` on projects |
| E12 | `*_add_video_config.sql` | `aspect_ratio text`, `video_quality text` on projects |
| E13 | `*_add_background_music.sql` | `background_music text` on projects |
| E16 | `*_add_voiceover_url.sql` | `voiceover_url text` on projects |

After each migration: `supabase gen types typescript` → update `src/lib/supabase/types.ts`.

---

## Verification Checklist

After each epic:
1. `npm run lint` — zero errors
2. `npm run build` — production build succeeds
3. `npm run test` — all tests pass (once E14 done)
4. Manual smoke test of affected flow

Full E2E after all epics:
1. Login → create project → wizard opens
2. Enter idea → 3 hooks → select one
3. Generate script → scenes with images → reorder/delete/add scenes
4. Render step → caption style, aspect ratio, quality, music, voiceover
5. Render → progress on detail page → completed → watch + download
6. Failed → error details → retry → succeeds

---

## Effort Summary

| Phase | Epics | Human Team | CC + gstack |
|-------|-------|-----------|-------------|
| Phase 1 | E7, E8, E14 | ~1.5 weeks | ~12-14 hours |
| Phase 2 | E9, E10, E15 | ~1 week | ~10-12 hours |
| Phase 3 | E12, E13, E11 | ~4 days | ~7-8 hours |
| Phase 4 | E17, E16 | ~3 days | ~6 hours |
| **Total** | **11 epics** | **~4 weeks** | **~35-40 hours** |

---

## Engineering Review Summary

Reviewed 2026-03-20. All 7 issues resolved. Lake Score: 7/7 (complete option chosen every time).

| # | Decision | Impact |
|---|----------|--------|
| 1 | Shared `withAuth()` API helper | DRY auth across 8 routes → `src/lib/api/with-auth.ts` |
| 2 | Supabase Realtime for dashboard | Replace 5s polling → instant updates, less DB load |
| 3 | `updateStatus()` throws on error | No silent worker failures → Inngest retries automatically |
| 4 | Defer client Zod parsing | API validation in E8.2 prevents bad writes |
| 5 | RenderStep as container | Sub-component slots → cleaner feature epic integration |
| 6 | Tests alongside each epic | E14.1 first, then every epic writes its own tests |
| 7 | Parallel asset fetch | Concurrency limit 3-4 → ~3-4x faster multi-asset fetch |
