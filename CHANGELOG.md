# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
