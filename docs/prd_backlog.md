# Project: Video Worker Studio MVP (Scope Reduced)

## Epic 1: Scaffold & Infrastructure Setup
**Description:** Initialize the Next.js, Supabase, and Inngest environments, setting up the basic routing and styling.

*   **Story 1.1:** Initialize Next.js App Router project with Tailwind CSS and Zustand.
*   **Story 1.2:** Initialize Supabase project (local & hosted) and run initial migrations.
*   **Story 1.3:** Setup Supabase Auth with standard Email/Password and GitHub OAuth providers.
*   **Story 1.4:** Setup Inngest client and integrate the API route (`/api/inngest`) for background workers.

## Epic 2: Core Data Modeling
**Description:** Implementing the Prisma schemas (or Supabase tables) and basic CRUD operations.

*   **Story 2.1:** Create `Project` table (id, user_id, topic, status, video_url).
*   **Story 2.2:** Create `Scene` table (id, project_id, sequence_order, script_text, search_keywords, asset_url).
*   **Story 2.3:** Expose RLS policies and Supabase types to the frontend.

## Epic 3: User Interface for Generation
**Description:** The front-end experience for users to input ideas and view their generated video.

*   **Story 3.1:** Build the "Dashboard" UI listing previous Projects and their status.
*   **Story 3.2:** Build the "New Project" Wizard: A simple text input for "Topic/Goal" and a "Generate Video" button.
*   **Story 3.3:** Build the "Pending/Generating" UI state that polls or listens for status updates.

## Epic 4: Automated AI Pipeline Worker
**Description:** The single background worker that orchestrates Gemini and asset fetching automatically without human interaction.

*   **Story 4.1:** Write the `VideoGenerationWorker` using Inngest. Step 1: Call Gemini (via `google-genai` SDK) to generate a JSON structure of Scenes (script + keywords).
*   **Story 4.2:** Step 2: Iterate through generated Scenes within the worker and call the `pinscrape-dl` CLI skill to fetch the best Pinterest asset URL for each `searchKeyword`.
*   **Story 4.3:** Step 3: Save all `Scene` rows and their `asset_url` to Supabase. Update Project status to `rendering`.

## Epic 5: Video Rendering Engine & Delivery
**Description:** Taking the completed database rows and compiling them into an MP4 file.

*   **Story 5.1:** Scaffold the Remotion project (using `npx skills add remotion-dev/skills`).
*   **Story 5.2:** Build the Remotion `Composition` that fetches project/scene data and renders it.
*   **Story 5.3:** Set up the `RenderWorker` to trigger an AWS Lambda render (`@remotion/lambda`).
*   **Story 5.4:** Handle the AWS Lambda callback, save the MP4 URL to the DB, and update Project status to `completed`.
*   **Story 5.5:** Build the "Final Result" page featuring a video player with the rendered MP4 and a download button.
