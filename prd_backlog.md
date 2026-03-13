# PRD Backlog (Epics & User Stories)

_This document outlines the Linear backlog for the MVP of Video Worker Studio._

## Epic 1: Foundation & Authentication
**Description:** Set up the basic monorepo, database connections, and user login so we can identify who owns which video projects.

*   **Story 1.1:** Setup Next.js App Router Monorepo with Tailwind & shadcn/ui.
*   **Story 1.2:** Configure Supabase Database and Prisma ORM with initial schema.
*   **Story 1.3:** Implement Magic Link authentication via Supabase Auth.
*   **Story 1.4:** Build the global navigation layout (Header, Logout, User Profile dropdown).

## Epic 2: Project Management & Library
**Description:** The core ability to create a project, save it to the database, and view past projects.

*   **Story 2.1:** Build the "My Videos" library page listing past projects.
*   **Story 2.2:** Build the project creation modal (Topic input, aspect ratio select).
*   **Story 2.3:** Implement the backend API route to create a `Project` in the DB and redirect to the editor.

## Epic 3: AI Orchestration & Idea Enhancement
**Description:** Integrating the BullMQ background worker queue and connecting our first LLM to generate ideas and titles.

*   **Story 3.1:** Setup Fastify backend with BullMQ queue and local Redis, exposing webhooks via Cloudflare Tunnel (`webhook.topstm.com`).
*   **Story 3.2:** Write the `IdeaEnhancement` background worker that uses OpenAI or Gemini CLI with the `IdeaEnhancerSchema`.
*   **Story 3.3:** Build the "Idea Stage" UI: Poll the DB for job completion and display the 3-5 title options as selectable cards.
*   **Story 3.4:** Implement title selection logic (saves `selectedTitle` to the DB and advances `ProjectStatus`).

## Epic 4: Scene Parsing & Asset Sourcing
**Description:** Converting a selected title into a timeline of scenes and fetching the corresponding visual assets from external APIs.

*   **Story 4.1:** Write the `SceneGenerator` worker that generates the timeline JSON and saves `Scene` rows to the DB.
*   **Story 4.2:** Build the "Structure Stage" UI to display the generated scenes in a timeline view.
*   **Story 4.3:** Write the `AssetFetcher` worker that invokes the `pinscrape-dl` CLI skill for fetching Pinterest assets based on each scene's `searchKeywords`.
*   **Story 4.4:** Build the "Asset Stage" UI: Show the selected asset for each scene and allow the user to click to view/swap alternate options.

## Epic 5: Video Rendering Engine
**Description:** Taking the completed JSON manifest of a project and compiling it into an MP4 file.

*   **Story 5.1:** Scaffold the Remotion project (using `npx skills add remotion-dev/skills`).
*   **Story 5.2:** Build the Remotion `Composition` that parses the `RenderManifest`.
*   **Story 5.3:** Set up the `RenderWorker` to trigger an AWS Lambda render (`@remotion/lambda`) natively as per the official docs.
*   **Story 5.4:** Handle the AWS Lambda payload/callback via the `webhook.topstm.com` tunnel and save the MP4 URL to the DB.

## Epic 6: TTS & Audio (Optional MVP)
**Description:** Adding voice-over capabilities to the generated videos.

*   **Story 6.1:** Integrate ElevenLabs API in the `SceneGenerator` worker to synthesize `ttsText` into MP3 files.
*   **Story 6.2:** Upload TTS MP3s to Supabase Storage and save the URLs to the `Scene` rows.
*   **Story 6.3:** Update the Remotion composition to play the audio tracks synchronously with the scene durations.

## Epic 7: Final Delivery & UX Polish
**Description:** Polishing the final screen where the user views and downloads their video, alongside error handling.

*   **Story 7.1:** Build the "Final Result" page featuring a video player with the rendered MP4.
*   **Story 7.2:** Add "Download Video" button.
*   **Story 7.3:** Implement global error boundary and retry buttons for failed background jobs.
*   **Story 7.4:** Add loading skeleton states across all generation phases.
