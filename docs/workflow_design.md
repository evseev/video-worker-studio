# Multi-Agent Workflow Design (Scope Reduced MVP)

The MVP workflow has two major pathways: an automated "One-Click" pipeline and an interactive "Wizard" pipeline. Both rely heavily on the Next.js API Routes and Inngest for execution.

## High-Level Pipeline

### Pathway A: One-Click Generation
1. **User Request (Web)**
   - User inputs a text prompt and selects a video template via the web interface.
   - Saves a new `Project` row (Status: `processing`).
   - Dispatches the `video/generate` Inngest event.

### Pathway B: Interactive Wizard
1. **User Request (Web)**
   - User creates a `draft` project from the dashboard (with video settings: scene count, duration, aspect ratio, quality) and lands on `/wizard/[id]` (steps: **Template** → **Idea** → **Refine** → **Script** → **Preview** → **Render**). State is managed via a Zustand store.
   - **Template:** user picks one of three archetypes (Slideshow, Comparison, Fact Card), topic, scene count, duration, aspect ratio, quality, and effect settings (transitions, image motion, text animation); progress saved with `/api/wizard/draft`.
   - **Idea:** topic + optional AI “hook” suggestions via `/api/wizard/ideas`; progress saved with `/api/wizard/draft`.
   - **Refine:** `/api/wizard/enhance-idea` transforms the raw idea into 3 viral concepts; `/api/wizard/validate-trend` scores viral potential (0-100) with reasoning and hook suggestions.
   - **Script:** user selects a Remotion template (Slideshow, Fact Card, Compilation, Comparison, Evolution); `/api/wizard/generate-structure` generates template-aware scenes with editable script text and search keywords; `/api/wizard/generate-seo` auto-generates YouTube SEO metadata (description + tags) using scene content and optional target keywords.
   - **Preview:** `/api/wizard/fetch-assets` attaches Pinterest images per scene; user can drag-and-drop reorder, delete, and re-fetch individual scene assets. For **Comparison**, the user can choose caption styling and whether to show labels, the bottom caption, or both.
   - **Render:** user reviews render summary and calls `/api/wizard/render`, which merges the request with the saved project and draft, updates the project row, and dispatches the background render job. Completed videos are shown in an in-app player with download.
   - **Contrast:** One-click generation without the wizard is Pathway A (`POST /api/generate` on a `processing` project and `video/generate`).

### Worker Engine: `VideoGenerationWorker`
Regardless of the pathway, the heavy lifting occurs inside the Inngest worker:

- **Step 1: AI Script Generation.** Calls Gemini 2.5 Flash via `@google/generative-ai` using centralized prompt templates (`src/lib/ai/prompts.ts`) that dynamically adapt to the user's configured scene count, scene duration, and aspect ratio. Outputs a structured JSON array of scenes. Each scene includes `{ scriptText, searchKeyword }`.
- **Step 2: Asset Fetching.** Iterates over scenes and invokes `pinterest-dl` via CLI to fetch one Pinterest image per scene keyword (with orientation hints — `landscape` or `portrait` — appended to keywords based on the target aspect ratio).
- **Step 3: Database Commit.** Writes all new `Scene` records to Supabase with the attached `asset_url` and `script_text`. Updates the `Project` status to `rendering`.
- **Step 4: Trigger Render.** Dispatches the `@remotion/lambda` or local bundler render function with the Project ID, `selected_template`, aspect ratio, video quality, and scene duration.

### Remotion Rendering Engine
- Fetches the Project and Scenes from Supabase.
- Compiles the MP4 on AWS Lambda or local compute.
- A webhook hits our server when the job finishes, updating the `Project` status to `completed` and saving the MP4 URL.

## Observability & Sentry
- All steps are wrapped in Sentry instrumentation (`@sentry/nextjs`). Frontend wizard steps log breadcrumbs and interaction metrics.
- The Inngest worker logs timing spans for Gemini calls and Image scraping.

## Failure Modes & Retries
The pipeline handles failures cleanly without blocking the main event loops:

1. **AI Parse Failure:** If Gemini 2.5 Flash outputs malformed JSON, Inngest automatically retries the function (up to configured limits). If it fails permanently, the Project status becomes `failed_ai`.
2. **Asset Failure:** If `pinterest-dl` finds no assets, the scene stores a null asset path and rendering proceeds with the composition fallback behavior.
3. **Render Failure:** If AWS Lambda / the bundler crashes (e.g., out of memory or timeout), the webhook parses the failure and sets the Project status to `failed_render`.

The user is prompted to try generating a new video from scratch in all failure scenarios.
