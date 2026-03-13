# System Architecture (Scope Reduced MVP)

The system is a Next.js (App Router) web app backed by Supabase and Inngest. It provides a simple, automated "Idea to Video" pipeline.

## 1. Web Frontend (Next.js)
*   **Role:** User authentication, project dashboard, and simple wizard input for generating videos.
*   **Tech:** React (Server Components + Client Components), Tailwind CSS, Zustand (client state).
*   **State:** Polling or subscribing to Supabase real-time to watch the `Project` status change from `processing` -> `rendering` -> `completed`.

## 2. API & Backend Services (Next.js Route Handlers + Supabase)
*   **Database:** Supabase PostgreSQL handles relational data (`Project`, `Scene`).
*   **Auth:** Supabase Auth providing JWTs consumed by Next.js middleware.
*   **Storage:** Supabase Storage (if needed for intermediate caching, otherwise Remotion handles MP4s).
*   **Orchestration:** The `/api/inngest` route acts as the webhook sink for the Inngest execution engine.

## 3. Worker Engine (Inngest)
Coordinates the heavy lifting outside the HTTP request lifecycle.
*   **`VideoGenerationWorker`**: A linear step-function worker:
    1.  Calls Gemini AI to generate the script and asset search terms.
    2.  Loops through the output and uses `pinscrape-dl` to find image assets for each scene.
    3.  Commits the fully populated scenes to Supabase and triggers the render.

## 4. Video Rendering (Remotion + AWS Lambda)
*   **Role:** Converts the structured JSON (`Project` + `Scenes`) into an MP4.
*   **Tech:** `@remotion/lambda`.
*   **Flow:** The Inngest worker kicks off the Lambda render and provides a webhook URL (pointing back to a Next.js API route). When Lambda finishes, Remotion hits the webhook, and the API updates the `Project.video_url`.

## Dependency Graph

```ascii
[ User Browser ]
       | (HTTP / WSS for realtime)
       v
[ Next.js Web App ] <---> [ Supabase DB / Auth ]
       | (Dispatches Event)
       v
[ Inngest Engine ]
       | (Triggers Worker via Webhook)
       v
[ VideoGenerationWorker ]
       |---> [ Gemini API ] (Script / Keywords)
       |---> [ `pinscrape-dl` CLI ] (Pinterest Assets)
       |---> [ Supabase DB ] (Save complete Scenes)
       |---> [ @remotion/lambda ] (Trigger Render)
                     |
                     v
             [ AWS Lambda ] (Compiles MP4)
                     | (Webhook Callback)
                     v
             [ Next.js API Route ] ---> [ Supabase DB ] (Save MP4 URL)
```
