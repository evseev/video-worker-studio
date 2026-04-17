# System Architecture (Scope Reduced MVP)

The system is a Next.js (App Router) web app backed by Supabase and Inngest. It provides both a "One-Click Generation" pipeline and an "Interactive Video Wizard".

## 1. Web Frontend (Next.js)
*   **Role:** User authentication, project dashboard (create draft with video settings, delete project, periodic refresh while jobs are active), one-click creation endpoint (`/api/generate`), and a 6-step interactive wizard (`/wizard/[id]`: Template → Idea → Refine → Script → Preview → Render). The Comparison template adds Preview-step controls for caption styling and overlay visibility (labels / caption / both).
*   **Tech:** React (Server Components + Client Components), Tailwind CSS, Zustand (wizard state store at `src/lib/stores/wizard-store.ts`).
*   **State:** Dashboard uses timed `router.refresh()` while any project is `draft`, `processing`, or `rendering`. Wizard uses Zustand store initialized from `draft_scenes` JSONB with URL-based step navigation. Project status flows `draft` → `processing` → `rendering` → `completed` (or terminal failure states).
*   **Video Delivery:** `/projects/[id]` provides status-aware views — HTML5 video player for completed projects, progress display for in-flight, error details + retry for failed.
*   **API Middleware:** All wizard routes share a `withAuth()` wrapper providing auth validation and per-tier rate limiting.

## 2. API & Backend Services (Next.js Route Handlers + Supabase)
*   **Database:** Supabase PostgreSQL handles relational data (`Project`, `Scene`).
*   **Auth:** Supabase Auth providing JWTs consumed by Next.js middleware.
*   **Storage:** Supabase Storage (`renders` bucket) holds finished MP4s; `DELETE /api/projects/[id]` removes the project row (scenes cascade) and best-effort storage/temp cleanup via `lib/projects/delete-project-assets`.
*   **Orchestration:** The `/api/inngest` route acts as the webhook sink for the Inngest execution engine.
*   **Observability:** Sentry (`@sentry/nextjs`) is deployed across the frontend and API routes to track errors, unhandled exceptions, and request performance.

## 3. Worker Engine (Inngest)
Coordinates the heavy lifting outside the HTTP request lifecycle and prevents edge/serverless timeouts.
*   **`VideoGenerationWorker`**: A linear step-function worker:
    1.  Calls Gemini 2.5 Flash to generate the script and asset search terms (using centralized prompt templates from `src/lib/ai/prompts.ts` with dynamic scene count, duration, and aspect ratio).
    2.  Loops through the output and uses `pinterest-dl` to find image assets for each scene (with orientation hints matching the target aspect ratio).
    3.  Commits the fully populated scenes to Supabase and advances project status.
    4.  *(Depending on flow)* Triggers the render or waits for user approval.

## 4. Video Rendering (Remotion + AWS Lambda/Local)
*   **Role:** Converts the structured JSON (`Project` + `Scenes`) into an MP4 using React-based template components (`SlideshowScene`, `ComparisonScene`, `FactCardScene`) dispatched by `selected_template`.
*   **Tech:** Remotion via `@remotion/lambda` or local bundler.
*   **Flow:** The system formats project data into input props (including dynamic aspect ratio, quality, and scene duration from user settings), triggers the render process, and upon completion updates the `Project.video_url`.

## Dependency Graph

```ascii
[ User Browser ]
       | (HTTP / WSS for realtime)
       v
[ Next.js Web App ] <---> [ Supabase DB / Auth ]
       | (Dispatches Event)
       |--> (Monitored by Sentry)
       v
[ Inngest Engine ]
       | (Triggers Worker via Webhook)
       v
[ VideoGenerationWorker ]
       |---> [ Gemini 2.5 Flash API ] (Script / Keywords)
       |---> [ `pinterest-dl` CLI ] (Pinterest Assets)
       |---> [ Supabase DB ] (Save complete Scenes)
       |---> [ @remotion/lambda ] (Trigger Render)
                     |
                     v
             [ AWS Lambda ] (Compiles MP4)
                     | (Webhook Callback)
                     v
             [ Next.js API Route ] ---> [ Supabase DB ] (Save MP4 URL)
```
