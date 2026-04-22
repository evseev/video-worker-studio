# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.6.0] — 2026-04-22

### Added
- **Centralized Gemini helper module** — introduced `src/lib/ai/gemini.ts` to keep text/embedding model selection and Gemini error wrapping in one shared place.
- **Gemini helper unit coverage** — added `src/__tests__/lib/ai/gemini.test.ts` to lock down missing-key, invalid-model, and provider-error paths.

### Changed
- **Wizard AI route helpers** now read model names from env-backed helpers instead of duplicating model setup and error handling logic.
- **Contributor runbook fallback** — AGENTS guidance now explicitly falls back to `.agents/skills/gstack/...` when `.claude/skills/...` references are missing.

## [0.4.5.0] — 2026-04-21

### Added
- **Subject de-duplication memory** — generation now tracks a per-scene `subjectKey` and avoids repeated subjects across long chunked scenarios by carrying an exclusion set between chunks.
- **Cross-video subject memory** — successful renders persist subject keys so future videos can avoid recently used subjects from the same user.

### Changed
- **Template AI prompts and schemas** (slideshow, comparison, fact-card) now require `subjectKey` and include strict "do not reuse subjects" guidance.
- **Structure generation** now retries collision-heavy chunks once with an expanded exclusion list.

### For Contributors
- New migration: `20260421120000_add_video_subjects.sql` adds pgvector-backed `video_subjects` plus `worker_insert_video_subjects` RPC.
- New env flags: `SUBJECT_MEMORY_ENABLED`, `SUBJECT_MEMORY_LIMIT`, `SUBJECT_MEMORY_MAX`.
- Type generation note: regenerate `src/lib/supabase/types.ts` from Supabase after applying migration in environments with CLI auth.

## [0.4.4.1] — 2026-04-20 — Epic 24: Scalable Scene Count & Duration

### Added
- **Expanded scene controls** — Template step now supports 3-120 scenes and 3-15 seconds per scene with slider + numeric inputs, plus a live total-duration readout.
- **Large-project guardrails** — UI warning bands now appear for long durations (>10 min and >20 min) to help users avoid expensive configurations accidentally.
- **Batched Pinterest fetching** — asset downloads are now processed in env-configurable batches (`PINTEREST_BATCH_SIZE`, `PINTEREST_BATCH_PAUSE_MS`, `PINTEREST_CONCURRENCY`) with inter-batch pauses to reduce provider throttling risk.
- **Progressive asset loading** — Preview step consumes streamed NDJSON batches and updates scene thumbnails incrementally as each batch completes.

### Changed
- **Render timeout budgeting** — Lambda render timeout now scales with total video duration (floor 8m, cap 40m) instead of a fixed timeout.
- **AI structure generation at scale** — large scene counts switch to chunked structure generation for better output reliability.
- **Request validation** — wizard routes now validate scene settings against shared min/max constraints.
- **Local backend output behavior** — when `RENDER_BACKEND=local`, final MP4 stays in `public/local_renders` and is served directly to the UI instead of uploading to Supabase Storage.

### For Contributors
- New helper module: `src/lib/video-constraints.ts`.
- New UI component: `src/components/wizard/range-slider-input.tsx`.
- New tests for constraints and large-project pipeline behavior, including `fetch-assets-batched.test.ts` and `template-step.test.tsx`.

## [0.4.4.0] — 2026-04-20 — Epic 23: Video Title & Scene Caption Field

### Added
- **Dedicated video title** — the catchy title generated at the Idea step now sticks around instead of getting discarded. It persists to a new `projects.video_title` column, is editable on the Script step ("Video Title" input in the YouTube Metadata section), and is used as the published title on the project page (with the long topic as a fallback for existing projects).
- **Separate on-screen caption field** — every scene now has a dedicated `captionText` for what's shown on screen, distinct from `scriptText` (reserved for voiceover narration). The Preview step now edits Caption instead of Script. For comparison videos, captions are short and specific (e.g. "Tom Cruise") rather than the full narration sentence.

### Changed
- **Preview step scene cards** (slideshow, comparison, fact-card) — the on-screen caption textarea is now labeled "Caption (on-screen)" and is bound to `captionText`. `scriptText` is still editable on the Script step so the voiceover flow stays wired.
- **Gemini prompts + schemas** for all three templates now emit both `scriptText` (1-2 sentences of narration) and `captionText` (3-8 word on-screen caption) with template-specific guidance.

### Fixed
- **YouTube publish title** — no longer shows the long topic/description sentence when a short idea title is available.

### Backward Compatibility
- Existing projects without `video_title` automatically fall back to `topic` for YouTube export.
- Existing scenes without `captionText` fall back to `scriptText` at render time, so legacy drafts render identically.

### For Contributors
- New migration: `20260420120000_add_video_title.sql` adds `projects.video_title text`. Regenerate `src/lib/supabase/types.ts` from the database after applying (Row/Insert/Update already updated).
- New helper: `src/remotion/caption-fallback.ts` exports `resolveCaption(captionText, scriptText)` — used by all three Remotion scene components so the fallback rule lives in one place.
- Draft JSON now carries `videoTitle` and per-scene `captionText`; both flow through `wizard-store`, `/api/wizard/draft`, and the Inngest `video/generate` event payload.
- New tests: `src/__tests__/remotion/caption-fallback.test.ts`; plus expanded coverage in `wizard-store.test.ts` (videoTitle + captionText) and `preview-step.test.tsx` (Caption edit binding).

## [0.4.3.0] — 2026-04-07

### Added
- **Comparison caption styles** — choose how the bottom line and side labels look: Minimal, Bold viral, Bottom strip, Split labels, or Glowing neon, each with a mini-preview on the Preview step.
- **Comparison overlay mode** — show only the side labels, only the bottom caption, or both, without leaving the wizard.
- **Reliable render retries** — starting a render from the dashboard with only `projectId` still works: the server merges your saved project row and draft with the request so Inngest always receives full scenes and settings.

### Changed
- **Glowing style** — larger caption and label type plus more padding under the bottom caption bar so the line reads clearly in the final video.

### Fixed
- **Render API errors** — failed updates or Inngest queue errors now return a readable `error` string instead of an empty JSON body.
- **Fetch assets (single-slot)** — keywords are derived from normalized scenes so TypeScript and PostgREST agree on types.

### For Contributors
- New migrations: `20260404115959_ensure_caption_style_column.sql`, `20260404120000_glowing_caption_comparison_overlay.sql` — extend `caption_style` with `glowing`, add `comparison_overlay_mode`. Regenerate `src/lib/supabase/types.ts` from the database after applying.
- New modules: `src/lib/merge-render-payload.ts`, `src/lib/comparison-caption-styles.ts`; tests under `src/__tests__/lib/merge-render-payload.test.ts` and `src/__tests__/components/wizard/caption-style-selector.test.tsx`.

## [0.4.2.0] — 2026-03-27

### Added
- **Configurable scene transitions** — choose from Fade, Slide, Wipe, Flip, or Clock Wipe between scenes, or pick Random for a different transition at each cut. Settings live in a new collapsible "Effects & Animations" section on the Template step.
- **Image motion effects** — select how images move during each scene: Zoom In, Zoom Out, Pan Left/Right/Up/Down, Horizontal Sway, Vertical Sway, or None. Random picks a different motion per scene.
- **Text animations** — control how captions appear: Slide Up, Slide Left, Typewriter, Pop, Fade In, or Random. Replaces the old hardcoded slide-up on every template.

### For Contributors
- New `src/lib/effects.ts` — type definitions, option arrays, and random resolver functions for all three effect categories.
- New `src/remotion/animation-utils.ts` — shared `getImageTransform()` and `getTextStyle()` utilities replace per-component animation code.
- New `src/components/wizard/effect-selector.tsx` — reusable grid selector component used 3x on TemplateStep.
- DB migration adds `scene_transition`, `image_motion`, `text_animation` columns to `projects` (with CHECK constraints).
- "Random" values resolve to concrete per-scene arrays in Inngest before reaching Remotion (deterministic Lambda rendering).
- 38 new tests across effects, animation-utils, and EffectSelector.

## [0.4.1.0] — 2026-03-25

### Added
- **Image repositioning** — hover any image thumbnail in the Preview step to reveal a drag-to-pan control. Drag to reposition which part of the image is visible in the final video. Works across all three templates (Slideshow, Comparison, Fact Card).
- **Render-accurate preview thumbnails** — preview thumbnails now match the exact aspect ratio of the render slot (e.g., narrow portrait panels for Comparison in 9:16 video) so what you see in preview matches the final output.

### Fixed
- **Asset refresh no longer mixes images across scenes** — single-asset refreshes now use unique download directories, preventing Pinterest images from different searches from leaking into each other.
- **Asset refresh API no longer crashes** when scenes are sent without an assets array (missing `assets` field in `normalizeScene`).
- **Asset refresh response now reads the correct slot** — fixed response extraction to always read `assets[0]` since single-slot refreshes return results at index 0.

### For Contributors
- `AssetSlot` type gains optional `objectPosition?: string` field — stores CSS objectPosition values (e.g., "50% 50%"), persisted in `draft_scenes` JSONB.
- New `DraggableImage` component at `src/components/DraggableImage.tsx` — shared hover/drag-to-pan with refresh button, used by all SceneCard types.
- `objectPosition` threaded through full render pipeline: wizard store → Inngest → RenderInput → VideoComposition → Remotion scene components.
- `fetchAssets` now uses `batch-{timestamp}-{index}` directories to prevent cross-call collisions.
- 10 new tests (8 for DraggableImage, 2 for wizard store objectPosition behavior).

## [0.4.0.0] — 2026-03-25

### Added
- **Template system with 3 structural archetypes** — replaced cosmetic template presets with Slideshow, Comparison, and Fact Card archetypes that drive the entire video pipeline: AI scene generation, asset fetching, preview layout, and Remotion rendering.
- **6-step wizard flow** — new Template step at the start lets you pick an archetype and configure project settings (topic, scene count, duration, aspect ratio, quality) before moving to Idea, Refine, Script, Preview, and Render.
- **Template-specific AI prompts and schemas** — each archetype has its own AI prompt, Zod schema, and scene data model so the AI generates structurally correct scripts per template.
- **Multi-slot asset fetching** — Comparison and Fact Card templates fetch 2 images per scene (left/right or hero/thumbnail) instead of just 1.
- **3 new Remotion scene components** — `SlideshowScene`, `ComparisonScene`, and `FactCardScene` under `src/remotion/templates/` replace the single generic `Scene.tsx`.
- **Template-specific scene cards** — each archetype has its own `SceneCard` component with slot-aware asset pickers and layout previews.
- **Dashboard improvements** — "New Video" now goes straight to the Template step; completed project cards show video thumbnails.

### Changed
- Scene data model uses a discriminated union with `searchKeywords[]` and `assets: AssetSlot[]` instead of flat `searchKeyword`/`assetUrl`.
- Caption styles removed as a standalone concept — visual styling is now controlled by each template archetype.
- Video quality values unified to `720p`/`1080p`/`4k`.

### Removed
- `src/components/wizard/template-selector.tsx` (replaced by TemplateStep)
- `src/components/wizard/caption-style-selector.tsx` (absorbed into templates)
- `src/lib/caption-styles.ts` (absorbed into templates)
- `src/remotion/Scene.tsx` (replaced by 3 template-specific scene components)
- Legacy wizard step components (`idea-step.tsx`, `script-step.tsx`, `render-step.tsx`, `scene-card.tsx`)

### For contributors
- New `src/templates/` directory with isolated modules per archetype (config, prompt, schema, types, SceneCard).
- New `src/remotion/templates/` directory with Remotion scene components.
- Template registry at `src/templates/index.ts` for looking up configs by template ID.
- Design document at `docs/designs/2026-03-24-template-system-design.md`.

## [0.3.4.0] - 2026-03-24

### Added
- **YouTube SEO metadata generation** — after generating your scene script, the AI automatically creates an SEO-optimized YouTube video description (200-300 words with hashtags) and 20-30 discoverable tags. Both are editable in a collapsible "YouTube Metadata" section below your scenes.
- **Target keywords input** — optional field in the Refine step where you can enter keywords you want to rank for on YouTube. These get woven into your generated description and tags.
- **Metadata export on project page** — completed projects now show a "YouTube Metadata" section with copy-to-clipboard buttons for title, description, and tags, plus a "Download .txt" button that exports everything in one file.
### For contributors
- New `POST /api/wizard/generate-seo` endpoint and `generateSeoMetadata()` AI helper.
- Database migration adds `video_description` and `video_tags` columns to `projects`.
- 6 new tests covering SEO store fields and prompt generation.

## [0.3.3.0] - 2026-03-24

### Fixed
- **Multiple asset candidates restored** — the image picker that lets you choose from 3 image options per scene was lost during the 5-step wizard refactor. It's back: fetch images and you'll see 3 thumbnail options per scene to pick from.
- Asset selection now persists immediately — picking a different thumbnail saves your choice to the server, so it survives page refreshes and tab closures.

### Added
- **32 regression tests** covering the wizard store, SceneCard asset picker, fetch-assets API route, PreviewStep fetch behavior, and the fetch-assets function — prevents the multi-asset feature from silently disappearing again.

## [0.3.2.0] - 2026-03-24

### Fixed
- Videos now actually render at your chosen aspect ratio and quality — previously all videos defaulted to 9:16 portrait regardless of your selection.
- Quality setting `hd` / `fullhd` / `4k` now maps to the correct pixel dimensions (was only matching a legacy `720p` label).

### Added
- **4K video rendering** — select 4K quality for 2160p output in both portrait and landscape.
- **Aspect-ratio-aware previews** — template preview cards and scene image thumbnails in the wizard now match your chosen aspect ratio (landscape or portrait) instead of always showing portrait.
- **Smarter AI prompts** — the AI now knows your exact scene count and duration when writing scripts, instead of always assuming "5–8 scenes, 30–60 seconds." Longer videos get appropriately sized scripts.
- **Orientation-aware asset search** — Pinterest image searches now include orientation hints (`landscape` or `portrait`) so fetched images better match your video format.

### Changed
- All LLM prompt strings moved to a centralized config (`src/lib/ai/prompts.ts`) with builder functions — no more scattered hardcoded prompt text across the codebase.
- Scene duration in the render pipeline is now driven by your settings instead of a hardcoded 5-second constant.

## [0.3.1.0] - 2026-03-23

### Added
- You can now **refine your video idea with AI** — the new Refine step enhances your concept into 3 viral alternatives and scores each one's trend potential (0–100) before you commit.
- **Template selection with visual previews** — pick from 5 Remotion templates (Slideshow, Fact Card, Compilation, Comparison, Evolution) with SVG layout mockups showing exactly what each style looks like.
- **Scene preview and editing** — drag-and-drop to reorder scenes, delete scenes you don't need, re-fetch images per scene, and edit script text and search keywords inline.
- **In-app video player** — completed videos now play directly in the wizard with a Download MP4 button, instead of redirecting to a raw URL.
- **Video settings at project creation** — set scene count, scene duration, aspect ratio (9:16 / 16:9), and quality (HD / Full HD / 4K) right from the dashboard's "New Video" modal.
- **Render progress and error handling** — the Render step shows a live progress spinner while your video is being processed, and displays inline error messages with a retry button if something goes wrong.

### Changed
- The wizard is now a **5-step flow** (Idea → Refine → Script → Preview → Render) instead of the previous 3 steps, with state managed by a Zustand store for reliable persistence across page refreshes.
- Template names now match the actual Remotion rendering templates — replaced `minimalist`, `bold`, `neon`, `corporate` with the real template IDs used by the video engine.
- Completed projects on the dashboard now link to the wizard's Render step (with video player) instead of opening the raw video URL.

### For contributors
- Wizard refactored from a single 376-line `client.tsx` into a Zustand store (`src/lib/stores/wizard-store.ts`) and 5 step components under `src/app/wizard/[id]/steps/`.
- Three previously unused API endpoints (`enhance-idea`, `validate-trend`, `generate-structure`) are now wired into the frontend.

## [0.3.0.0] - 2026-03-20

### Added
- **Video delivery page** (`/projects/[id]`) — watch completed videos in-app with HTML5 player, download MP4, retry failed renders, and see pipeline progress for in-flight projects.
- **API security** — all wizard routes now require authentication (the ideas route was previously open). Rate limiting protects against abuse: AI calls capped at 10/min, renders at 3/min per user.
- **Scene editing** — reorder scenes (up/down), delete individual scenes, add blank scenes, and refresh images per scene.
- **Multiple asset candidates** — fetch 3 image options per scene from Pinterest (parallelized with concurrency limit of 4), click to pick which one to use.
- **Video configuration** — choose aspect ratio (9:16 portrait or 16:9 landscape) and quality (720p or 1080p) before rendering. Remotion compositions now accept dynamic dimensions.
- **Background music** — 5 preset royalty-free tracks (upbeat, chill, dramatic, corporate, epic) with in-browser audio preview. Music renders as a Remotion `<Audio>` layer with fade-in/fade-out.
- **Caption styles** — 4 presets (Minimal White, Bold Viral, Bottom Strip, Split Labels) that control font, color, background, and position in the rendered video.
- **Voice-over upload** — upload MP3/WAV (up to 50MB) through a dedicated API route with server-side MIME validation. Renders as a separate audio layer in Remotion at higher volume than music.
- **Toast notification system** — Zustand-powered toasts with auto-dismiss, replacing silent `console.error` in wizard components.
- **Error boundaries** with Sentry capture on `/wizard/[id]` and `/projects/[id]` routes.
- **Vitest test infrastructure** — 10 tests covering `withAuth`, rate limiting, path aliases, and setup verification.
- 5 database migrations for new columns (`aspect_ratio`, `video_quality`, `background_music`, `caption_style`, `voiceover_url`) with CHECK constraints.

### Changed
- **Dashboard** decomposed into 5 sub-components (`ProjectCard`, `StatusBadge`, `EmptyState`, `CreateModal`, `DeleteModal`). Replaced 5-second polling with **Supabase Realtime** subscription for instant status updates.
- **Wizard** decomposed into step components (`IdeaStep`, `ScriptStep`, `RenderStep`, `SceneCard`, `TemplateSelector`). `RenderStep` is a container with slots for sub-components.
- **Inngest worker** `updateStatus()` now throws on RPC failure instead of silently logging — Inngest retries automatically.
- Dashboard cards now link to `/projects/[id]` for all non-draft projects instead of raw video URLs.
- Completed projects redirect from wizard to project detail page instead of raw MP4 URL.
- Render route now checks project status server-side to prevent double-submit (returns 409 if already processing).

### Fixed
- `/api/wizard/ideas` had **no authentication** — anyone could call it. Now protected via `withAuth()`.
- Fragile path manipulation in `fetch-assets` route (`.split('/public')`) replaced with `path.relative()`.
- Zod validation added for Gemini ideas response (was raw `JSON.parse` without schema check).
- Typed Inngest worker event data properly (removed `eslint-disable any`).
- `render_error_context` added to Supabase types (was missing, causing unsafe cast).
- Blob URL memory leak in voiceover upload — now properly revoked on re-upload and remove.

## [0.2.3.0] - 2026-03-19

### Added
- You can **delete a project** from the dashboard; the app removes the database row, cascades scenes, and cleans up rendered files in Storage (and local temp assets when possible).
- The **dashboard auto-refreshes** every few seconds while any project is still drafting, generating, or rendering—no more stale status badges.
- The **wizard** now walks Idea → Script → Render: AI hook ideas, script + Pinterest images per scene, then pick a template (`minimalist`, `bold`, `neon`, `corporate`) and start the render from the UI.
- **Local Remotion renders** now upload the finished MP4 to Supabase Storage so completed projects get a real `video_url`, same idea as Lambda output.

### For contributors
- Six **AWS-focused agent skills** live under `.agents/skills/` (`aws-s3`, `aws-billing`, `aws-ec2`, `aws-cloudwatch`, `aws-lambda`, `aws-iam`) for AI-assisted cloud operations—see `AGENTS.md`.

### Changed
- Clearer **readability** on descriptive copy in the dashboard and wizard (16px-class body text).
- **Stricter Storage policies** for worker uploads; **render pipeline** handles local asset URLs and Lambda polling more reliably.

### Fixed
- Worker could not update project error context in some setups—**grants** corrected.
- Removed unused wizard **dead code** (`startGeneration`).

## [0.2.2.0] - 2026-03-19

### Added
- Added six AWS-focused skills (`aws-s3`, `aws-billing`, `aws-ec2`, `aws-cloudwatch`, `aws-lambda`, `aws-iam`) under `.agents/skills/` for infrastructure and operations workflows.
- Documented the AWS skill catalog in `AGENTS.md` so the team can route cloud tasks through dedicated specialists.

### Changed
- Updated Remotion dependencies to `4.0.436` and pinned exact versions in `package.json` / `package-lock.json` for deterministic installs.
- Updated the Remotion entrypoint (`src/remotion/index.ts`) to register the root composition with `registerRoot(RemotionRoot)`.

## [0.2.1.0] - 2026-03-18

### Added
- Added comprehensive support for viral video templates (`slideshow`, `comparison`, `evolution`, `compilation`, `fact_card`).
- The AI scene generator (Gemini integration via `@google/genai`) now dynamically builds script structure based on the chosen template archetype.
- Remotion composition now visually adapts layout, text colors, background overlays, and subtitle position constraints depending on the selected `template`.
- End-to-end integration of the `template` parameter from the client payload to the background workers (Inngest) and target Lambda rendering backend (`@remotion/lambda`).
- Integrated Sentry.io for robust error monitoring, tracking, and observability across the client, server, and edge environments.

### Fixed
- Fixed TypeScript `any` type lint warnings in the API routes.

## [0.2.0] - 2026-03-16

### Added
- Integrated Supabase for user authentication and project ownership.
- Integrated Inngest for reliable background processing of long-running video generation tasks.
- Added middleware to protect application routes from unauthenticated access.
- Moved video asset fetching and generation logic into asynchronous Inngest functions.

### Security
- Fixed a critical command injection vulnerability in the asset fetching module by switching to `execFile` and safely passing arguments.

## [0.1.1] - 2025-05-22

### Changed
- Configured asset download path to use `public/tmp_assets` via `TMP_ASSETS_PATH` environment variable.
- Improved asset fetching logic to ensure target directory exists before starting downloads.
- Updated ESLint configuration to ignore `.venv` and `public/tmp_assets` for faster and more reliable linting.
- Fixed unused `os` import in `fetch-assets.ts`.

### Security
- Verified that temporary assets are ignored by Git to avoid leaking user data or bloating the repository.
