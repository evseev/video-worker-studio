# Video Worker Studio

An AI-powered short-form video generation pipeline. Give it a topic, get back a fully rendered MP4. The system uses Gemini 3.0 Flash for scriptwriting, Pinterest for sourcing visual assets, and Remotion for programmatic video rendering — all orchestrated by Inngest as a durable background workflow.

## How It Works

There are **two** ways to generate videos:

**1. One-Click Generation:**
```text
User enters topic → Gemini writes script → Pinterest assets fetched → Remotion renders MP4 → Supabase stores video
```
Triggered via `/api/generate` and powered entirely by a 5-step Inngest background worker.

**2. Video Generation Wizard:**
```text
Draft Idea → Enhance Setup → Structure Scenes → Final Script → Fetch Assets → Render Video
```
A multi-step interactive pipeline directly in the app UI, giving granular user control before rendering in the background. Powered by `/api/wizard/*` endpoints.

The core rendering pipeline (whether triggered immediately or after the wizard) relies on these components:

| Step | What happens | Tech |
|---|---|---|
| 1. **Generate Script** | AI writes a scene-by-scene script with visual keywords | Gemini 3.0 Flash |
| 2. **Fetch Assets** | Downloads a background image per scene from Pinterest | `pinterest-dl` CLI |
| 3. **Save Scenes** | Commits scenes to the database via RPC (bypasses RLS) | Supabase PostgreSQL |
| 4. **Render Video** | Compiles scenes into an MP4 with transitions | Remotion SSR |
| 5. **Upload Video** | Stores the final video and updates the project record | Supabase Storage |

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router, React 19, TypeScript)
- **Database & Auth:** [Supabase](https://supabase.com) (PostgreSQL, Row Level Security, Auth, Storage)
- **Background Jobs:** [Inngest](https://inngest.com) (durable step functions with retries)
- **AI:** [Google Gemini 3.0 Flash](https://ai.google.dev) via `@google/generative-ai`
- **Video Rendering:** [Remotion](https://remotion.dev) (server-side rendering with `@remotion/renderer`)
- **Asset Sourcing:** [`pinterest-dl`](https://github.com/sean-yt/pinterest-dl) (CLI image downloader)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com)
- **Client State:** [Zustand](https://zustand.docs.pmnd.rs)
- **Validation:** [Zod v4](https://zod.dev) (LLM output validation at trust boundary)

## Prerequisites

- **Node.js** ≥ 20
- **npm** (comes with Node)
- **Python 3** + `pip` (for `pinterest-dl`)
- A **Supabase** project with the schema from [`docs/database_schema.md`](docs/database_schema.md)
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com)
- **Inngest Dev Server** (or a production Inngest account)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url> && cd video-worker-studio
npm install
```

### 2. Install `pinterest-dl`

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install pinterest-dl
```

### 3. Configure environment

Copy the example and fill in your values:

```bash
cp .env.local.example .env.local
```

Required environment variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | *(optional)* Service role key for storage uploads |
| `GEMINI_API_KEY` | Google Gemini API key |
| `PINTEREST_DL_BIN` | Absolute path to the `pinterest-dl` binary (e.g. `/path/to/.venv/bin/pinterest-dl`) |
| `INNGEST_EVENT_KEY` | Inngest event key (`local` for dev) |
| `INNGEST_SIGNING_KEY` | Inngest signing key (empty for local dev) |
| `INNGEST_BASE_URL` | Base URL where Inngest can reach your app |
| `TMP_ASSETS_PATH` | Directory for downloaded assets (default: `public/tmp_assets`) |

### 4. Set up the database

Apply the schema from [`docs/database_schema.md`](docs/database_schema.md) to your Supabase project. The key tables are:

- **`projects`** — tracks each video generation request and its status
- **`scenes`** — stores the individual scene data (script, keywords, asset URL)
- **`user_settings`** — optional credits/preferences

You'll also need two RPC functions used by the worker:
- `worker_update_project_status(p_project_id, p_status, p_video_url)`
- `worker_insert_scenes(p_project_id, p_scenes)`

Both should be `SECURITY DEFINER` to bypass RLS for background processing.

### 5. Run the dev server

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — Inngest Dev Server
npx inngest-cli@latest dev
```

The app runs at [http://localhost:3000](http://localhost:3000) and the Inngest dashboard at [http://localhost:8288](http://localhost:8288).

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run remotion:preview` | Open Remotion Studio for visual previewing |
| `npm run remotion:render` | Manually render a video to `out/video.mp4` |

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── generate/       # POST endpoint to trigger one-click video generation
│   │   ├── inngest/        # Inngest webhook endpoint
│   │   └── wizard/         # Multi-step endpoints (draft, enhance-idea, script, etc.)
│   ├── auth/               # Supabase auth callback handler
│   ├── login/              # Login page
│   ├── wizard/             # Interactive video generation UI workflows
│   ├── page.tsx            # Dashboard (server component, auth-gated)
│   └── layout.tsx          # Root layout
├── components/
│   └── dashboard.tsx       # Main dashboard UI
├── lib/
│   ├── ai/                 # Gemini integration, prompts, scripts, asset fetching
│   ├── ai/
│   │   ├── generate-script.ts   # Gemini script generation + Zod validation
│   │   └── fetch-assets.ts      # pinterest-dl asset downloader
│   ├── inngest/
│   │   ├── client.ts            # Inngest client instance
│   │   └── functions.ts         # VideoGenerationWorker (5-step pipeline)
│   ├── render/
│   │   ├── render-video.ts      # Remotion server-side renderer
│   │   └── upload-storage.ts    # Supabase Storage uploader
│   └── supabase/                # Supabase client helpers (server, browser, middleware)
├── remotion/
│   ├── index.ts                 # Remotion entry point
│   ├── Root.tsx                 # Remotion root component
│   ├── VideoComposition.tsx     # Main video composition with transitions
│   └── Scene.tsx                # Individual scene component
└── middleware.ts                # Supabase auth session refresh
docs/
├── system_architecture.md       # Architecture overview
├── database_schema.md           # PostgreSQL schema
├── tech_stack.md                # Tech stack rationale
├── workflow_design.md           # Pipeline design
├── ux_specification.md          # UX spec
└── prd_backlog.md               # Product backlog
```

## Architecture

```text
┌─────────────┐       ┌───────────────────┐       ┌─────────────────┐
│   Browser   │──────▶│  Next.js App      │◀─────▶│   Supabase      │
│  (React 19) │       │  (App Router)     │       │  DB / Auth /    │
└─────────────┘       └────────┬────────┬─┘       │  Storage        │
                               │ POST   │         └─────────────────┘
                               │        │                 ▲
              ┌────────────────┘        └────────────────┐│
              │                                          ││
              ▼                                          ▼│
    ┌──────────────────┐                       ┌────────────────┐
    │ /api/wizard/*    │    (Optional Flow)    │ /api/generate  │
    │ Interactive Gen  │                       │ (One-Click)    │
    └──────────────────┘                       └────────┬───────┘
              │                                         │
              └────────────────┐       ┌────────────────┘
                               ▼       ▼
                       ┌──────────────────────┐
                       │  Inngest Event Bus   │
                       └───────────┬──────────┘
                                   ▼
                       ┌──────────────────────┐
                       │ VideoGeneration Worker|
                       │  1. Gemini Script    │
                       │  2. Pinterest DL     │
                       │  3. Save Scenes      │
                       │  4. Remotion SSR     │
                       │  5. Upload MP4       │
                       └──────────────────────┘
```

## Documentation

Detailed design docs are in the [`docs/`](docs/) directory:

- [System Architecture](docs/system_architecture.md)
- [Database Schema](docs/database_schema.md)
- [Tech Stack](docs/tech_stack.md)
- [Workflow Design](docs/workflow_design.md)
- [UX Specification](docs/ux_specification.md)
- [Product Backlog](docs/prd_backlog.md)

## License

Private project.
