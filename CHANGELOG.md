# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.4.0] - 2026-03-23

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
