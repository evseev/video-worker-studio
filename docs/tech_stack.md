# Technical Architecture and Stack Recommendation

Based on the MVP requirements of Video Worker Studio—rapid iteration, high dependency on AI orchestrations, heavy asynchronous job processing, and rendering capabilities—the following technology stack is recommended.

## 1. Frontend: Next.js + React + Tailwind CSS
We need a robust framework capable of providing strong UX/UI on the client side, while having built-in capacities for server-side API proxying and SSR.

*   **Framework:** Next.js 16.1
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS + shadcn/ui. This provides pre-built, accessible, and fast UI components for a clean, modern SaaS look.
*   **State Management:** Zustand (for complex frontend state like the timeline/scene editor) and React Query / SWR (for data fetching and polling server jobs).
*   **Forms & Validation:** React Hook Form + Zod.

## 2. Backend API & Core Orchestration: Node.js + Fastify
To keep the mental model unified and allow sharing of Zod schemas between the backend and frontend, a TypeScript backend is strongly recommended.

*   **Runtime:** Node.js
*   **Framework:** Fastify. This serves as our robust backend API and worker host, decoupled from Next.js 16.1.
*   **Validation:** Zod. Crucial for ensuring that external LLM outputs exactly match our expected data structures.
*   **AI Integration Framework:** OpenAI SDK / Gemini CLI for AI orchestration.

## 3. Database: PostgreSQL via Supabase
Relational data modeling is perfect here because Video Projects have structured relations (Project -> Scenes -> Assets).

*   **Database:** PostgreSQL.
*   **ORM:** Prisma. Administered and connected via Supabase MCP for robust AI database access.
*   **Hosting:** Supabase (gives us Auth and Storage out of the box). 

## 4. Job Queue & Asynchronous Workers: BullMQ
For asynchronous processing, a robust local job queue is preferred to run alongside the Fastify Node.js server.

*   **Tool:** BullMQ (backed by local Redis).
*   **Why:** Excellent Node.js performance and native support for complex background jobs, retries, and decoupled processes.
*   **Webhooks:** Utilizing Cloudflare tunnel (`webhook.topstm.com`) to route webhook signals into the local BullMQ/Fastify environment.

## 5. Video Rendering Engine: Remotion
Traditional video generation involves ffmpeg scripts which are notoriously hard to manage and layout. 

*   **Framework:** Remotion (React for Video).
*   **Why:** It allows us to build video templates using standard React, HTML, and CSS (meaning we can use our exact frontend styling skills to design video scenes). Remotion can run in a serverless environment (via AWS Lambda / Remotion Lambda) to render MP4s highly efficiently in parallel.
*   **Fallback:** If Remotion is unsuitable for any reason, use FFmpeg wrappers (Fluent-ffmpeg) in a Dockerized worker, but Remotion is heavily favored for web-developer productivity.

## 6. TTS and Asset APIs
*   **TTS:** ElevenLabs or OpenAI TTS for natural voice-over generation.
*   **Assets:** Custom `pinscrape-dl` CLI skill for high-fidelity Pinterest scraping, alongside general Pexels/Unsplash assets.

## 7. Storage: AWS S3 or Supabase Storage
*   **Purpose:** Storing user avatars, downloaded Pinterest images, generated audio clips, and final rendered `.mp4` files.
*   **Delivery:** Served via a CDN (Cloudflare or built-in AWS CloudFront/Supabase CDN).

---

## 8. Summary of the MVP Stack

| Area | Technology |
| :--- | :--- |
| **Monorepo** | Turborepo / pnpm |
| **Frontend** | Next.js 16.1, React, Tailwind CSS, shadcn/ui, Zustand |
| **Backend API** | Node.js + Fastify, TypeScript |
| **Database** | PostgreSQL (hosted on Supabase, via Supabase MCP) |
| **ORM** | Prisma |
| **Auth & Storage** | Supabase Auth (Magic Link) |
| **Background Jobs** | BullMQ + Redis + Cloudflare Tunnel Webhooks |
| **AI LLM** | OpenAI / Gemini CLI via strict JSON/Schema |
| **Video Engine** | Remotion + AWS Lambda (via remotion-dev/skills) |
