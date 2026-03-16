# Multi-Agent Workflow Design (Scope Reduced MVP)

The MVP workflow has been streamlined to minimize state management and human interaction. The entire AI generation pipeline executes automatically in the background.

## High-Level Pipeline

1. **User Request (Web)**
   - User inputs a single text prompt via the web interface.
   - Saves a new `Project` row (Status: `processing`).
   - Dispatches the `generate_video` Inngest event.

2. **Inngest Worker: `VideoGenerationWorker`**
   - **Step 1: AI Script Generation.** Calls Gemini (via `google-genai` SDK) using a system prompt to output a structured JSON array of Scenes. Each scene includes a `{ script_text, search_keywords }`.
   - **Step 2: Asset Fetching.** Iterates over the array of Scenes. For each scene's `search_keywords`, invokes the `pinscrape-dl` CLI tool locally on the server to scrape the top Pinterest image URL.
   - **Step 3: Database Commit.** Writes all new `Scene` records to Supabase with the attached `asset_url` and `script_text`. Updates the `Project` status to `rendering`.
   - **Step 4: Trigger Render.** Dispatches the `@remotion/lambda` render function with the Project ID.

3. **Remotion Rendering Engine**
   - Fetches the Project and Scenes from Supabase.
   - Compiles the MP4 on AWS Lambda.
   - A webhook hits our server when the Lambda job finishes, updating the `Project` status to `completed` and saving the MP4 URL.

## Failure Modes & Retries

Since the pipeline is fully automated, user interaction during failures is binary:

1. **AI Parse Failure:** If Gemini outputs mallformed JSON, Inngest automatically retries the function (up to 3 times). If it fails permanently, the Project status becomes `failed_ai`.
2. **Asset Failure:** If `pinscrape-dl` finds no assets, the pipeline falls back to a placeholder color block so the render does not crash.
3. **Render Failure:** If AWS Lambda crashes (e.g., out of memory or timeout), the webhook parses the failure and sets the Project status to `failed_render`.

The user is prompted to try generating a new video from scratch in all failure scenarios.
