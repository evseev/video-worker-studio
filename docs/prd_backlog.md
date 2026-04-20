# Project: Video Worker Studio MVP

## Epic 1: Scaffold & Infrastructure Setup
**Description:** Initialize the Next.js, Supabase, and Inngest environments, setting up the basic routing and styling.

*   [x] **Story 1.1:** Initialize Next.js App Router project with Tailwind CSS and Zustand.
*   [x] **Story 1.2:** Initialize Supabase project (local & hosted) and run initial migrations.
*   [x] **Story 1.3:** Setup Supabase Auth with standard Email/Password and GitHub OAuth providers.
*   [x] **Story 1.4:** Setup Inngest client and integrate the API route (`/api/inngest`) for background workers.

## Epic 2: Core Data Modeling
**Description:** Implementing the Supabase tables and basic CRUD operations.

*   [x] **Story 2.1:** Create `Project` table (id, user_id, topic, status, video_url).
*   [x] **Story 2.2:** Create `Scene` table (id, project_id, sequence_order, script_text, search_keywords, asset_url).
*   [x] **Story 2.3:** Expose RLS policies and Supabase types to the frontend.

## Epic 3: User Interface for Generation
**Description:** The front-end experience for users to input ideas and view their generated video.

*   [x] **Story 3.1:** Build the "Dashboard" UI listing previous Projects and their status.
*   [x] **Story 3.2:** Build the "New Project" Wizard: A simple text input for "Topic/Goal" and a "Generate Video" button.
*   [x] **Story 3.3:** Build the "Pending/Generating" UI state that polls or listens for status updates.

## Epic 4: Automated AI Pipeline Worker
**Description:** The single background worker that orchestrates Gemini and asset fetching automatically without human interaction.

*   [x] **Story 4.1:** Write the `VideoGenerationWorker` using Inngest. Step 1: Call Gemini (via `@google/generative-ai`) to generate a JSON structure of scenes (script + keywords).
*   [x] **Story 4.2:** Step 2: Iterate through generated scenes within the worker and call the `pinterest-dl` CLI tool to fetch the best Pinterest asset URL for each `searchKeyword`.
*   [x] **Story 4.3:** Step 3: Save all `Scene` rows and their `asset_url` to Supabase. Update Project status to `rendering`.

## Epic 5: Video Rendering Engine & Delivery
**Description:** Taking the completed database rows and compiling them into an MP4 file.

*   [x] **Story 5.1:** Scaffold the Remotion project (using `npx skills add remotion-dev/skills`).
*   [x] **Story 5.2:** Build the Remotion `Composition` that fetches project/scene data and renders it.
*   [x] **Story 5.3:** Set up the `RenderWorker` to trigger an AWS Lambda render (`@remotion/lambda`).
*   [x] **Story 5.4:** Handle the AWS Lambda callback, save the MP4 URL to the DB, and update Project status to `completed`.
*   [x] **Story 5.5:** Build the "Final Result" page featuring a video player with the rendered MP4 and a download button.

## Epic 6: AI Generation Wizard & Templates
**Description:** Implement robust wizard for multi-step drafting, template selection, and dynamic AI script generation.

*   [x] **Story 6.1:** Build multi-step Wizard UI (Idea Enhancer, Structure Generation, Render).
*   [x] **Story 6.2:** Create draft mode saving & resuming capability using `PUT /api/wizard/draft`.
*   [x] **Story 6.3:** Integrate 5 distinct video templates (`slideshow`, `comparison`, `evolution`, `compilation`, `fact_card`).
*   [x] **Story 6.4:** Modify Gemini structured output formatting to dynamically adapt to the selected video template.
*   [x] **Story 6.5:** Update Remotion compositing logic to visually render distinct overlays/typography according to the template.

## Epic 7: Video Delivery & Playback
**Description:** In-app video viewing, download, and retry for failed renders.

*   [x] **Story 7.1:** Create `/projects/[id]` server page with status-aware views (player for completed, progress for in-flight, error+retry for failed).
*   [x] **Story 7.2:** Build `VideoPlayer` component with HTML5 `<video>`, poster frame, play/pause, fullscreen.
*   [x] **Story 7.3:** Add download button with sanitized filename (`{topic}-{id}.mp4`).
*   [x] **Story 7.4:** Retry button for failed projects — re-dispatches Inngest event, resets status.
*   [x] **Story 7.5:** Update dashboard cards to link non-draft projects to `/projects/[id]` instead of raw URLs.

## Epic 8: Wizard Hardening & Error Handling
**Description:** Reliable wizard flow with auth enforcement, input validation, and user-facing error states.

*   [x] **Story 8.1:** Extract shared `withAuth()` wrapper to `src/lib/api/with-auth.ts` — validates session, returns 401, passes user to handler.
*   [x] **Story 8.2:** Refactor all 8 wizard API routes to use `withAuth()` wrapper. Fix missing auth on `/api/wizard/ideas`.
*   [x] **Story 8.3:** Add Zod validation for Gemini ideas response (`IdeasResponseSchema`).
*   [x] **Story 8.4:** Fix `updateStatus()` in Inngest worker — throw on RPC failure instead of silent logging (enables Inngest retry).
*   [x] **Story 8.5:** Add double-submit prevention on render route (server-side status check, returns 409 if already processing).
*   [x] **Story 8.6:** Fix fragile path manipulation in `fetch-assets` route (replace `.split('/public')` with `path.relative()`).

## Epic 9: Component Decomposition & UX Polish
**Description:** Break monolithic components, add missing UX states, make it feel like a real product.

*   [x] **Story 9.1:** Extract dashboard into sub-components (`ProjectCard`, `StatusBadge`, `EmptyState`, `CreateModal`, `DeleteModal`).
*   [x] **Story 9.2:** Replace 5-second dashboard polling with Supabase Realtime subscription on `projects` table.
*   [x] **Story 9.3:** Extract wizard into step components (`IdeaStep`, `ScriptStep`, `RenderStep` container, `SceneCard`, `TemplateSelector`).
*   [x] **Story 9.4:** Design `RenderStep` as container with slots for future sub-components (VideoConfig, Music, Captions, Voiceover).
*   [x] **Story 9.5:** Add `error.tsx` route error boundaries for `/wizard/[id]` and `/projects/[id]` with Sentry capture + retry.
*   [x] **Story 9.6:** Build toast notification system (Zustand store + auto-dismiss). Replace `console.error` with user-facing toasts in all wizard components.

## Epic 10: Scene Editing Capabilities
**Description:** Users can reorder, delete, add, and refresh individual scenes in the wizard.

*   [x] **Story 10.1:** Scene reordering with up/down buttons per scene card.
*   [x] **Story 10.2:** Delete individual scene (disabled if only 1 scene remains).
*   [x] **Story 10.3:** Add new blank scene at end of list.
*   [x] **Story 10.4:** Per-scene asset refresh — re-fetch image for one scene with its keyword.

## Epic 11: Caption Style System
**Description:** Users choose from 4 caption style presets that affect rendered video output.

*   [x] **Story 11.1:** Define 4 caption presets in `src/lib/caption-styles.ts` (Minimal White, Bold Viral, Bottom Strip, Split Labels).
*   [x] **Story 11.2:** Build `CaptionStyleSelector` component with mini visual previews.
*   [x] **Story 11.3:** Add `caption_style` column to projects table (new migration + CHECK constraint).
*   [x] **Story 11.4:** Thread `captionStyle` through render pipeline (wizard → API → DB → Inngest → Remotion inputProps).
*   [x] **Story 11.5:** Implement style-aware caption rendering in Remotion `Scene.tsx` (font, color, background, position).

## Epic 12: Video Configuration (Aspect Ratio & Quality)
**Description:** Users select aspect ratio and quality before rendering.

*   [x] **Story 12.1:** Build `VideoConfigSelector` component (9:16/16:9, 720p/1080p).
*   [x] **Story 12.2:** Add `aspect_ratio` and `video_quality` columns to projects (migration + CHECK constraints).
*   [x] **Story 12.3:** Create `resolveVideoDimensions()` utility in `src/lib/render/dimensions.ts`.
*   [x] **Story 12.4:** Thread settings through pipeline and update Remotion to accept dynamic width/height.
*   [x] **Story 12.5:** Update Lambda and local render calls with correct dimensions.

## Epic 13: Background Music
**Description:** Users can optionally add background music from a preset library.

*   [x] **Story 13.1:** Define 5 royalty-free music presets in `src/lib/music-presets.ts`.
*   [x] **Story 13.2:** Build `MusicSelector` component with "No music" option and 5-second audio preview.
*   [x] **Story 13.3:** Add `background_music` column to projects (migration).
*   [x] **Story 13.4:** Thread music URL through pipeline to Remotion inputProps.
*   [x] **Story 13.5:** Add `<Audio>` component to Remotion `VideoComposition.tsx` with fade-in/fade-out.

## Epic 14: Automated Testing Infrastructure
**Description:** Establish test framework and write critical-path tests.

*   [x] **Story 14.1:** Bootstrap Vitest with `@testing-library/react`, `@testing-library/jest-dom`, jsdom, path aliases, coverage config.
*   [x] **Story 14.2:** Write tests for `withAuth()` wrapper (auth check, handler invocation, error handling, rate limit integration).
*   [x] **Story 14.3:** Write tests for rate limiter (under limit, over limit, window reset, key independence).
*   [ ] **Story 14.4:** Bootstrap Playwright E2E (critical-path test: login → wizard → render → dashboard).
*   [ ] **Story 14.5:** CI integration (add test commands to pipeline).

## Epic 15: Rate Limiting & Security Hardening
**Description:** Protect API routes from abuse, harden security for public-facing app.

*   [x] **Story 15.1:** Implement in-memory sliding window rate limiter (`src/lib/rate-limit.ts`). AI: 10 req/min, Render: 3 req/min, General: 60 req/min per user.
*   [x] **Story 15.2:** Integrate rate limiting into `withAuth()` wrapper with configurable tiers.
*   [x] **Story 15.3:** Apply rate limit tiers to all wizard routes (AI routes → `"ai"`, render → `"render"`, others → `"general"`).

## Epic 16: Voice-Over Upload
**Description:** Users can upload an MP3/WAV voice-over file that gets mixed into the final video.

*   [x] **Story 16.1:** Build `VoiceoverUpload` component with drag-and-drop, 50MB max, client-side type validation.
*   [x] **Story 16.2:** Create `/api/wizard/upload-voiceover` route with server-side MIME validation and project ownership check.
*   [x] **Story 16.3:** Add `voiceover_url` column to projects (migration).
*   [x] **Story 16.4:** Thread voiceover URL through pipeline to Remotion. Render as `<Audio>` at 0.9 volume.

## Epic 17: Multiple Asset Candidates Per Scene
**Description:** Fetch 3 image options per scene, let user pick which to use.

*   [x] **Story 17.1:** Update `fetchAssets` to support multi-image fetch (`-n 3`) with parallelized batching (concurrency limit 4).
*   [x] **Story 17.2:** Add `multipleAssets` flag to fetch-assets API route, returning `assetOptions[]` per scene.
*   [x] **Story 17.3:** Update `SceneCard` with asset picker showing up to 3 thumbnail options with click-to-select.
*   [x] **Story 17.4:** Wire up multi-asset fetch and asset selection in `ScriptStep`.

## Epic 18: Complete User Flow & Wizard Refactor
**Description:** Expand the wizard from 3 steps to 5 steps, wire unused API endpoints, fix template alignment, and add in-app video delivery.

*   [x] **Story 18.1:** Create Zustand wizard store (`src/lib/stores/wizard-store.ts`) and split monolithic `client.tsx` into 5 step components.
*   [x] **Story 18.2:** Build Idea step with video settings inputs (scene count, duration, aspect ratio, quality).
*   [x] **Story 18.3:** Build Refine step wiring `/api/wizard/enhance-idea` and `/api/wizard/validate-trend` endpoints.
*   [x] **Story 18.4:** Build Script step with 5 correct Remotion template cards and `/api/wizard/generate-structure` integration.
*   [x] **Story 18.5:** Build Preview step with drag-and-drop scene reorder, per-scene image fetch/re-fetch, and scene deletion.
*   [x] **Story 18.6:** Build Render step with progress polling, in-app HTML5 video player, download button, and error retry.
*   [x] **Story 18.7:** Enhance dashboard "New Video" modal with video settings; update completed project links to use in-app player.

## Epic 19: Aspect Ratio & Settings Propagation + Prompt Centralization
**Description:** Ensure user-configured aspect ratio, video quality, scene count, and scene duration are respected throughout the entire pipeline — not just at render time. Centralize all LLM prompts into a single config file with dynamic parameters.

*   [x] **Story 19.1:** Fix critical bug: RenderStep now sends `aspectRatio` and `videoQuality` to render API (was always defaulting to 9:16).
*   [x] **Story 19.2:** Fix `resolveVideoDimensions()` to handle `hd`/`fullhd`/`4k` quality names and add 4K resolution support.
*   [x] **Story 19.3:** Make template preview SVGs in ScriptStep adapt to selected aspect ratio (portrait vs landscape layouts).
*   [x] **Story 19.4:** Make scene preview thumbnails in PreviewStep adapt to aspect ratio (portrait: `w-20 h-28`, landscape: `w-28 h-20`).
*   [x] **Story 19.5:** Pass aspect ratio to AI script generation so search keywords target orientation-appropriate images.
*   [x] **Story 19.6:** Append orientation hints (`landscape`/`portrait`) to Pinterest search keywords in fetch-assets route.
*   [x] **Story 19.7:** Create centralized prompts config (`src/lib/ai/prompts.ts`) with builder functions accepting `sceneCount`, `sceneDuration`, `aspectRatio`.
*   [x] **Story 19.8:** Replace hardcoded "5-8 scenes" / "30-60 seconds" / "short-form" in all LLM prompts with dynamic values from user settings.
*   [x] **Story 19.9:** Pass `sceneDuration` through render pipeline (RenderStep → render API → Inngest → renderVideo) instead of hardcoded 5s constant.

## Video Worker Studio MVP Tasks (Implemented)

### Planning and Setup
*   [x] Define project specification
*   [x] Bootstrap Next.js, app router, tailwind
*   [x] Set up Remotion
*   [x] Configure Pinterest download tool for asset fetching

### Core Application
*   [x] Build authentication UI
*   [x] Set up Supabase schema (users, projects, assets, etc.)
    *   [x] Ensure cascade delete is configured for projects
*   [x] Build projects dashboard
    *   [x] Add delete project functionality
*   [x] Build MVP Wizard UI Components
    *   [x] Create `PUT /api/wizard/draft` endpoint
    *   [x] Dashboard: Redirect new projects to Wizard and support resuming Drafts
    *   [x] Create `/app/wizard/[id]/page.tsx` and `<WizardClient />`
    *   [x] Wizard Step 1: Idea Enhancer & Trend Validation
    *   [x] Wizard Step 2: Structure Generation & Scene Editor
    *   [x] Wizard Step 3: Render and Submit
*   [x] Build Remotion Templates (Slideshow, Compilation, Evolution, Comparison, Fact Card)
*   [x] Implement video rendering pipeline (Inngest -> Remotion renderer -> Supabase storage)

### Orchestration (Inngest + AI)
*   [x] Define Inngest functions for asynchronous logic
*   [x] Implement Google Gemini agent calls for idea generation and structure
*   [x] Implement local asset fetching worker

### Polish
*   [x] Styling / UI components
*   [x] Error handling, loading states

## Epic 20: Template System — 3 Structural Archetypes
**Description:** Replace cosmetic template presets with 3 structural template archetypes (Slideshow, Comparison, Fact Card) that drive the entire video pipeline: AI scene generation, asset fetching, preview layout, and Remotion rendering. Replaces Epics 6.3/6.5 and Epic 11 (caption styles absorbed into templates).
**Design:** `docs/designs/2026-03-24-template-system-design.md`
**Plan:** `docs/superpowers/plans/2026-03-24-template-system.md`

*   [x] **Story 20.1:** Create template types, configs, and registry (`src/templates/` — types.ts, index.ts, slideshow/, comparison/, fact-card/ configs).
*   [x] **Story 20.2:** Create template-specific AI prompts and Zod/Gemini schemas per archetype.
*   [x] **Story 20.3:** Update wizard store with new Scene union type, 6-step WizardStep, multi-slot asset actions.
*   [x] **Story 20.4:** Update AI generation pipeline (`wizard.ts`, `generate-structure` route) to use template-specific prompts and schemas.
*   [x] **Story 20.5:** Update asset fetching route for multi-slot (1 or 2 keywords per scene based on template).
*   [x] **Story 20.6:** Create 3 Remotion scene components (`SlideshowScene`, `ComparisonScene`, `FactCardScene`) under `src/remotion/templates/`.
*   [x] **Story 20.7:** Update `VideoComposition.tsx` and `Root.tsx` for template-based scene dispatch.
*   [x] **Story 20.8:** Build TemplateStep (wizard Step 1) with template picker + project settings form (topic, scene count, duration, aspect ratio, quality).
*   [x] **Story 20.9:** Update wizard client for 6-step flow; update IdeaStep, ScriptStep, RenderStep for template-aware behavior.
*   [x] **Story 20.10:** Create template-specific SceneCard components and update PreviewStep.
*   [x] **Story 20.11:** Update render pipeline (render route, Inngest functions, render-video.ts) — remove captionStyle, pass template-typed scenes.
*   [x] **Story 20.12:** Remove old files (template-selector.tsx, caption-style-selector.tsx, caption-styles.ts, Scene.tsx).
*   [x] **Story 20.13:** E2E verification for all 3 templates, fix dashboard routing, video thumbnails.

## Epic 21: Image Crop & Positioning
**Description:** Add per-asset pan controls so users can adjust which area of an image is visible in the final video. Pan-only model (no zoom) using CSS `objectPosition`. Hover-to-reveal drag-to-pan interaction inline on SceneCard thumbnails. Position auto-persists in `draft_scenes` JSONB (no DB migration).

**Spec:** `docs/superpowers/specs/2026-03-25-image-crop-positioning-design.md`
**Plan:** `docs/superpowers/plans/2026-03-25-image-crop-positioning.md`

*   [x] **Story 21.1:** Add `objectPosition?: string` to `AssetSlot` in `src/templates/types.ts`.
*   [x] **Story 21.2:** Reset `objectPosition` on asset swap in wizard store `selectAsset` action + unit tests.
*   [x] **Story 21.3:** Reset `objectPosition` on asset refresh in `PreviewStep` (`fetchAllAssets` and `handleRefreshAsset`).
*   [x] **Story 21.4:** Build shared `DraggableImage` component (`src/components/DraggableImage.tsx`) — hover overlay, pointer-event drag-to-pan, position clamping, refresh button relocation + unit tests.
*   [x] **Story 21.5:** Integrate `DraggableImage` into all 3 SceneCard types (slideshow, comparison, fact-card).
*   [x] **Story 21.6:** Thread `objectPosition` through render pipeline — `VideoGenerateScene`, `RenderInput`, `VideoCompositionProps`, and all 3 Remotion scene components.
*   [x] **Story 21.7:** E2E verification — full test suite, TypeScript check, manual verification across all templates.

## Epic 22: Scene Transitions & Animation Effects
**Description:** Add user-configurable transitions between scenes and animation effects within scenes. Three granular selectors (transition type, image motion, text animation) with a "random" option that varies per scene. Settings live on the Template step in a collapsible "Effects & Animations" section.

**Spec:** `docs/superpowers/specs/2026-03-27-transitions-and-effects-design.md`
**Plan:** `docs/superpowers/plans/2026-03-27-transitions-and-effects.md`

*   [x] **Story 22.1:** Create `src/lib/effects.ts` — types, option arrays, resolver function + tests.
*   [x] **Story 22.2:** DB migration — 3 new columns (`scene_transition`, `image_motion`, `text_animation`) with CHECK constraints + update `types.ts`.
*   [x] **Story 22.3:** Create `src/remotion/animation-utils.ts` — shared `getImageTransform()` and `getTextStyle()` + tests.
*   [x] **Story 22.4:** Build `EffectSelector` component (`src/components/wizard/effect-selector.tsx`) + tests.
*   [x] **Story 22.5:** Update wizard store — add 3 effect fields to `VideoSettings` and `DEFAULT_SETTINGS`.
*   [x] **Story 22.6:** Add collapsible Effects & Animations section to TemplateStep with 3 `EffectSelector` instances.
*   [x] **Story 22.7:** Thread effects through render pipeline — render route, Inngest function (with random resolution), `RenderInput`.
*   [x] **Story 22.8:** Update `VideoComposition.tsx` — per-scene transition presentation mapping, pass motion/animation to scenes.
*   [x] **Story 22.9:** Update `SlideshowScene.tsx` — replace hardcoded Ken Burns with configurable `imageMotion` + `textAnimation`.
*   [x] **Story 22.10:** Update `ComparisonScene.tsx` — replace hardcoded slide-in with configurable effects.
*   [x] **Story 22.11:** Update `FactCardScene.tsx` — replace hardcoded pop-in with configurable effects.
*   [x] **Story 22.12:** Update `Root.tsx` default props + `RenderStep.tsx` submission.
*   [x] **Story 22.13:** Final verification — tests, lint, build, update backlog and TODOS.

## Epic 23: Video Title & Scene Caption Field
**Description:** Two small but critical fixes. (1) The catchy video title generated at the Idea step is now persisted to a new `projects.video_title` column, editable on the Script step, and used as the YouTube publish title on the project page (with `topic` as fallback). (2) Separate on-screen captions from voiceover narration: every scene gains a new `captionText` field (rendered by Remotion, edited on the Preview step) while `scriptText` stays reserved for voiceover. Example: for a "most famous Hollywood stars of the 1990s" comparison, each scene's `captionText` is just the actor's name (e.g. "Tom Cruise"), not the full narration sentence.

**Plan:** `.cursor/plans/epic-23-title-captions_b8566a39.plan.md`

*   [x] **Story 23.1:** DB migration `20260420120000_add_video_title.sql` adds `projects.video_title` column + regenerate `src/lib/supabase/types.ts`.
*   [x] **Story 23.2:** Wire `video_title` through wizard store, `/api/wizard/draft`, IdeaStep (capture `idea.title`), and ScriptStep (editable title input).
*   [x] **Story 23.3:** Use `project.video_title ?? project.topic` in `YouTubeMetadataExport` on `/projects/[id]`.
*   [x] **Story 23.4:** Add `captionText` to `BaseScene`, all three Gemini/Zod schemas, and all three template prompts with per-template guidance (short names for comparison, headlines for fact-card, punchy summaries for slideshow).
*   [x] **Story 23.5:** Include `captionText` in `toScene()` and thread it through Inngest (`VideoGenerateScene`, `renderScenes` mapping) and `VideoComposition.tsx` to every Remotion scene component, with `scriptText` fallback via shared `resolveCaption` helper.
*   [x] **Story 23.6:** Preview step SceneCards (slideshow, comparison, fact-card) edit `captionText` instead of `scriptText`; `addScene` defaults `captionText` to `""`.
*   [x] **Story 23.7:** Update affected tests (wizard-store, preview-step, merge-render-payload) and add Remotion `resolveCaption` fallback unit tests.
*   [x] **Story 23.8:** Update `AGENTS.md` projects row table, `CHANGELOG.md`, and this backlog with Epic 23 entry.