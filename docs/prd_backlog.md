# Project: Video Worker Studio MVP (Scope Reduced)

## Epic 1: Scaffold & Infrastructure Setup
**Description:** Initialize the Next.js, Supabase, and Inngest environments, setting up the basic routing and styling.

*   [x] **Story 1.1:** Initialize Next.js App Router project with Tailwind CSS and Zustand.
*   [x] **Story 1.2:** Initialize Supabase project (local & hosted) and run initial migrations.
*   [x] **Story 1.3:** Setup Supabase Auth with standard Email/Password and GitHub OAuth providers.
*   [x] **Story 1.4:** Setup Inngest client and integrate the API route (`/api/inngest`) for background workers.

## Epic 2: Core Data Modeling
**Description:** Implementing the Prisma schemas (or Supabase tables) and basic CRUD operations.

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

*   [x] **Story 4.1:** Write the `VideoGenerationWorker` using Inngest. Step 1: Call Gemini (via `google-genai` SDK) to generate a JSON structure of Scenes (script + keywords).
*   [x] **Story 4.2:** Step 2: Iterate through generated Scenes within the worker and call the `pinscrape-dl` CLI skill to fetch the best Pinterest asset URL for each `searchKeyword`.
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
