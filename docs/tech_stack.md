# Technical Architecture and Stack

Based on the MVP requirements of Video Worker Studio—rapid iteration, high dependency on AI orchestrations, heavy asynchronous job processing, and rendering capabilities—the following technology stack is currently implemented.

## 1. Frontend: Next.js + React + Tailwind CSS
We need a robust framework capable of providing strong UX/UI on the client side, while having built-in capacities for server-side API routing.

*   **Framework:** Next.js 16+ (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS v4.
*   **State Management:** Zustand for wizard state management (`src/lib/stores/wizard-store.ts`); React Hooks for component-local state.

## 2. Backend API & Core Orchestration: Next.js Route Handlers
We utilize Next.js API routes (`src/app/api`) to handle backend functionality and serve as the orchestrator for webhooks and job queues.

*   **Framework:** Next.js Server Components and API Routes.
*   **Validation:** Zod v4. Crucial for ensuring that external LLM outputs exactly match our expected data structures.
*   **AI Integration:** Google Gemini 2.5 Flash (`@google/generative-ai`) for extremely fast structured generation.
*   **Observability:** Sentry (`@sentry/nextjs`) is integrated to track errors, profiling, and traces across both the edge/serverless boundaries and frontend.

## 3. Database: PostgreSQL via Supabase
Relational data modeling for tracking Video Projects and Scenes.

*   **Database:** PostgreSQL (hosted on Supabase).
*   **Client:** Supabase JavaScript Client (`@supabase/supabase-js`). (Prisma was evaluated but we use direct Supabase client for lighter footprint).
*   **Auth:** Supabase Auth (handled via Next.js middleware and server/client utilities in `src/lib/supabase`).

## 4. Job Queue & Asynchronous Workers: Inngest
For asynchronous processing and preventing long-running API routes from timing out, we use a managed worker queue.

*   **Tool:** Inngest (`inngest`).
*   **Why:** Serverless-friendly, eliminates the need to run local Redis/BullMQ. It allows us to declare complex step-functions (retries, timeouts, waiting) natively within Next.js API Routes.
*   **Usage:** Defines background jobs (e.g. `process-video`) that run deterministically and update the Supabase database.

## 5. Video Rendering Engine: Remotion
Video generation natively structured as React code.

*   **Framework:** Remotion.
*   **Capability:** Allows us to build video templates (e.g. `slideshow`, `split`) using standard React, HTML, and CSS. The templates are stored in `src/remotion`.
*   **Rendering:** Can render using `@remotion/bundler` and `@remotion/renderer` either on the server or via AWS Lambda.

## 6. TTS and Asset APIs
*   **Assets:** `pinterest-dl` executed via local `execFile` in the Inngest worker.
*   *(Future)* TTS: ElevenLabs or standard Web Speech APIs.

## 7. Storage
*   **Purpose:** Storing user avatars, downloaded Pinterest images, generated audio clips, and final rendered `.mp4` files.
*   **Delivery:** Currently mocked as URLs, but will use AWS S3 Storage.

---

## 8. Summary of the MVP Stack

| Area | Technology |
| :--- | :--- |
| **Framework** | Next.js 16+ (App Router) |
| **Frontend** | React, Tailwind CSS v4 |
| **Backend API** | Next.js Route Handlers |
| **Database** | PostgreSQL (Supabase) via `@supabase/supabase-js` |
| **Auth** | Supabase Auth (Middleware protected) |
| **Background Jobs** | Inngest (Serverless queues + step functions) |
| **AI LLM** | Google Gemini (Gemini 3 Flash) |
| **Validation** | Zod (v4) |
| **Video Engine** | Remotion |
| **Observability** | Sentry (`@sentry/nextjs`) |
