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
   - User navigates to `/wizard` and creates a blank project (Status: `draft`).
   - The user selects a visual template, enters a topic prompt, and configures the video.
   - They click "Generate" which transitions the status to `processing` and dispatches the `video/generate` Inngest event.

### Worker Engine: `VideoGenerationWorker`
Regardless of the pathway, the heavy lifting occurs inside the Inngest worker:

- **Step 1: AI Script Generation.** Calls Gemini 2.5 Flash via `@google/generative-ai` using a system prompt to output a structured JSON array of scenes. Each scene includes `{ scriptText, searchKeyword }`.
- **Step 2: Asset Fetching.** Iterates over scenes and invokes `pinterest-dl` via CLI to fetch one Pinterest image per scene keyword.
- **Step 3: Database Commit.** Writes all new `Scene` records to Supabase with the attached `asset_url` and `script_text`. Updates the `Project` status to `rendering`.
- **Step 4: Trigger Render.** Dispatches the `@remotion/lambda` or local bundler render function with the Project ID and `selected_template`.

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
