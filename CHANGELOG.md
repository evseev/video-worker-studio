# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3.0] - 2026-03-19

### Added
- Added comprehensive AWS infrastructure skill set including `aws-s3`, `aws-billing`, `aws-ec2`, `aws-cloudwatch`, `aws-lambda`, and `aws-iam`.
- Implemented project deletion flow with local asset cleanup and Supabase storage removal.
- Enhanced Dashboard with auto-refresh (5s interval) for active projects.
- Improved Wizard UI with "Generate Hooks" and "Fetch Images" functionality.
- Added template selection (`minimalist`, `bold`, `neon`, `corporate`) to the render step.
- Added support for local Remotion rendering with automatic Supabase storage upload.

### Changed
- Improved accessibility by bumping base font size to 16px for descriptive text in Dashboard and Wizard.
- Hardened Supabase storage policies for worker uploads.
- Refined `render-video` module to handle local asset URLs and Lambda polling more reliably.

### Fixed
- Fixed worker grants for project error updates.
- Removed unused `startGeneration` dead code in Wizard client.

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
