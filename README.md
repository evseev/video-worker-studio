# Video Worker Studio

An AI-powered video generation platform. Give it a topic, get back a fully rendered MP4. The system uses Gemini 2.5 Flash for scriptwriting, Pinterest for sourcing visual assets, and Remotion for programmatic video rendering — all orchestrated by Inngest as a durable background workflow. Supports both short-form and long-form videos with configurable scene count, scene duration, aspect ratio (9:16 / 16:9), and quality (HD / Full HD / 4K).

## How It Works

There are **two** ways to generate videos:

**1. One-Click Generation:**
```text
User enters topic → Gemini writes script → Pinterest assets fetched → Remotion renders MP4 → Supabase stores video
```
Triggered via `/api/generate` and powered entirely by a 5-step Inngest background worker.

**2. Video Generation Wizard:**
```text
Template (archetype + settings) → Idea (AI hooks) → Refine (AI enhance + trend score) → Script (template-specific scenes) → Preview (assets + reorder) → Render (progress + player)
```
A six-step interactive flow at `/wizard/[id]`, powered by a Zustand state store. The first step selects one of 3 structural template archetypes (Slideshow, Comparison, Fact Card) that drives the entire pipeline. Draft progress is saved via `/api/wizard/draft`. The wizard uses `/api/wizard/*` endpoints (ideas, enhance-idea, validate-trend, generate-structure, script, generate-seo, fetch-assets, upload-voiceover, render). On the **Preview** step, **Comparison** projects can pick **caption styles** (including a glowing neon look) and whether to show **side labels**, the **bottom caption**, or **both**. **`POST /api/wizard/render`** merges the request with the saved project row and draft so retries (for example from the dashboard with only `projectId`) still send full scenes and settings to Inngest.

The core rendering pipeline (whether triggered immediately or after the wizard) relies on these components:

| Step | What happens | Tech |
|---|---|---|
| 1. **Generate Script** | AI writes a scene-by-scene script with visual keywords (adapts to scene count, duration, and aspect ratio) | Gemini 2.5 Flash |
| 2. **Fetch Assets** | Downloads a background image per scene from Pinterest | `pinterest-dl` CLI |
| 3. **Save Scenes** | Commits scenes to the database via RPC (bypasses RLS) | Supabase PostgreSQL |
| 4. **Render Video** | Compiles scenes into an MP4 with transitions | Remotion Lambda (default) or local (`RENDER_BACKEND=local`) |
| 5. **Persist Result** | Stores the final video URL and updates project status | Supabase PostgreSQL |

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router, React 19, TypeScript)
- **Database & Auth:** [Supabase](https://supabase.com) (PostgreSQL, Row Level Security, Auth, Storage)
- **Background Jobs:** [Inngest](https://inngest.com) (durable step functions with retries)
- **AI:** [Google Gemini 2.5 Flash](https://ai.google.dev) via `@google/generative-ai`
- **Video Rendering:** [Remotion](https://remotion.dev) with `@remotion/lambda` (default) and local fallback
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

Create `.env.local` and fill in your values.

Required environment variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (required for server-side project/storage operations) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `PINTEREST_DL_BIN` | Absolute path to the `pinterest-dl` binary (e.g. `/path/to/.venv/bin/pinterest-dl`) |
| `PINTEREST_BATCH_SIZE` | Number of keyword fetches per Pinterest batch before pausing (default: `60`) |
| `PINTEREST_BATCH_PAUSE_MS` | Pause between Pinterest batches in milliseconds (default: `10000`) |
| `PINTEREST_CONCURRENCY` | Parallel fetches inside one Pinterest batch (default: `6`) |
| `SUBJECT_MEMORY_ENABLED` | Enable cross-video subject memory de-duplication (default: `true`) |
| `SUBJECT_MEMORY_LIMIT` | Number of latest completed user projects used for de-dup context (default: `10`) |
| `SUBJECT_MEMORY_MAX` | Maximum historical subject keys passed to the LLM as exclusions (default: `200`) |
| `INNGEST_EVENT_KEY` | Inngest event key (`local` for dev) |
| `INNGEST_SIGNING_KEY` | Inngest signing key (empty for local dev) |
| `INNGEST_BASE_URL` | Base URL where Inngest can reach your app |
| `TMP_ASSETS_PATH` | Directory for downloaded assets, **relative to the app root** (default: `public/tmp_assets`). Avoid absolute paths or `..` segments so cleanup stays scoped. |
| `LOCAL_RENDER_ASSET_BASE_URL` | Base URL for local renders (e.g. `http://localhost:3000`) |
| `RENDER_BACKEND` | `lambda` (default) or `local` |
| `REMOTION_AWS_REGION` | AWS region for Remotion Lambda |
| `REMOTION_LAMBDA_FUNCTION_NAME` | Remotion Lambda function name |
| `REMOTION_SERVE_URL` | Remotion site URL used for Lambda renders |
| `REMOTION_OUTPUT_BUCKET` | Optional. When set, Lambda output deletion requires the URL’s bucket to match this value (and key `videos/{projectId}.mp4`). When unset, deletion still runs for recognized S3 URL shapes with that key—set this in production to constrain which bucket can be targeted. |
| `AWS_ACCESS_KEY_ID` | AWS credentials for Lambda render calls |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for Lambda render calls |

### 4. Set up the database

Apply the schema from [`docs/database_schema.md`](docs/database_schema.md) to your Supabase project. The key tables are:

- **`projects`** — tracks each video generation request and its status
- **`scenes`** — stores the individual scene data (script, keywords, asset URL)
You'll also need two RPC functions used by the worker:
- `worker_update_project_status(p_project_id, p_status, p_video_url)`
- `worker_insert_scenes(p_project_id, p_scenes)`
- `worker_update_project_error(p_project_id, p_error_context)`

Both should be `SECURITY DEFINER` to bypass RLS for background processing.

If you use the local render fallback (`RENDER_BACKEND=local`), final MP4 files are written to `public/local_renders` and served directly from your app (for example `/local_renders/<projectId>.mp4`) instead of being uploaded to Supabase Storage.

### 5. Run the dev server

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — Inngest Dev Server
npx inngest-cli@latest dev
# or
npm exec --yes --package=inngest-cli@latest -- inngest-cli dev
```

The app runs at [http://localhost:3000](http://localhost:3000) and the Inngest dashboard at [http://localhost:8288](http://localhost:8288).

**Deleting a project:** From the dashboard, use the trash control on a project card. The app calls `DELETE /api/projects/[id]`, removes the `projects` row (child `scenes` rows cascade), deletes objects in the `renders` bucket when possible, and cleans up local temp assets under `TMP_ASSETS_PATH`.

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
│   │   ├── projects/[id]/  # Delete endpoint for a project
│   │   └── wizard/         # Wizard endpoints (draft, ideas, enhance-idea, structure, script, generate-seo, fetch-assets, upload-voiceover, render)
│   ├── auth/               # Supabase auth callback handler
│   ├── login/              # Login page
│   ├── wizard/[id]/        # Interactive video generation wizard
│   │   ├── client.tsx      # Wizard orchestrator (Zustand store init + step routing)
│   │   ├── page.tsx        # Server component (auth + project fetch)
│   │   └── steps/          # 6 steps: Template, Idea, Refine, Script, Preview (comparison caption/overlay on Comparison), Render
│   ├── page.tsx            # Dashboard (server component, auth-gated)
│   └── layout.tsx          # Root layout
├── components/
│   ├── dashboard.tsx       # Main dashboard UI
│   └── DraggableImage.tsx  # Shared hover-to-reveal drag-to-pan image component
├── lib/
│   ├── ai/
│   │   ├── prompts.ts           # Centralized LLM prompt templates (dynamic scene count, duration, aspect ratio)
│   │   ├── generate-script.ts   # Gemini script generation + Zod validation
│   │   ├── wizard.ts            # AI helpers (enhanceIdea, validateTrend, generateStructure, generateSeoMetadata)
│   │   └── fetch-assets.ts      # pinterest-dl asset downloader
│   ├── comparison-caption-styles.ts  # Comparison caption presets + overlay helpers (shared with Remotion)
│   ├── merge-render-payload.ts  # Merge JSON body with DB row + draft for /api/wizard/render
│   ├── effects.ts               # Scene transition, image motion, text animation types + random resolver
│   ├── stores/
│   │   └── wizard-store.ts      # Zustand store for wizard state management
│   ├── projects/
│   │   └── delete-project-assets.ts  # Storage + temp cleanup when deleting a project
│   ├── inngest/
│   │   ├── client.ts            # Inngest client instance
│   │   └── functions.ts         # VideoGenerationWorker (5-step pipeline)
│   ├── render/
│   │   ├── render-video.ts      # Remotion Lambda renderer (local fallback optional)
│   │   └── dimensions.ts        # Video dimension resolver (aspect ratio × quality → width/height)
│   └── supabase/                # Supabase client helpers (server, browser, middleware)
├── templates/                       # Template system (3 structural archetypes)
│   ├── types.ts                     # TemplateId, TemplateConfig, Scene union types
│   ├── index.ts                     # Template registry and lookup
│   ├── slideshow/                   # Single-image slideshow archetype
│   ├── comparison/                  # Side-by-side comparison archetype
│   └── fact-card/                   # Two-image identity/fact card archetype
├── remotion/
│   ├── index.ts                 # Remotion entry point
│   ├── Root.tsx                 # Remotion root component
│   ├── VideoComposition.tsx     # Template-based scene dispatch
│   ├── animation-utils.ts      # Shared image motion + text animation helpers
│   └── templates/               # Remotion scene components per archetype
│       ├── SlideshowScene.tsx
│       ├── ComparisonScene.tsx
│       └── FactCardScene.tsx
└── middleware.ts                # Supabase auth session refresh
docs/
├── adr/001-gemini-3-flash-upgrade.md  # Architecture decision records
├── project_spec.md              # Product specification
├── system_architecture.md       # Architecture overview
├── database_schema.md           # PostgreSQL schema
├── tech_stack.md                # Tech stack rationale
├── workflow_design.md           # Pipeline design
├── ux_specification.md          # UX spec
├── prd_backlog.md               # Product backlog (23 epics)
├── mvp_development_plan.md      # Original development roadmap
└── designs/remotion-lambda-migration.md # Render architecture design
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
                       │  4. Remotion render  │
                       │  5. Upload / URL     │
                       └──────────────────────┘
```

## Documentation

| File | Description |
|---|---|
| [README.md](README.md) | This file — project overview, setup, and architecture |
| [AGENTS.md](AGENTS.md) | Agent operating manual — stack, constraints, folder ownership |
| [CHANGELOG.md](CHANGELOG.md) | Release history and user-facing change notes |
| [TODOS.md](TODOS.md) | Engineering follow-ups and deferred work |
| [VERSION](VERSION) | Current version number (semver) |

Detailed design docs are in the [`docs/`](docs/) directory:

- [Project Specification](docs/project_spec.md) — product vision, user flow, and requirements
- [System Architecture](docs/system_architecture.md) — component overview and dependency graph
- [Database Schema](docs/database_schema.md) — PostgreSQL tables, RLS, and RPC functions
- [Tech Stack](docs/tech_stack.md) — technology choices and rationale
- [Workflow Design](docs/workflow_design.md) — pipeline design and failure modes
- [UX Specification](docs/ux_specification.md) — screen-by-screen layout and interactions
- [Product Backlog](docs/prd_backlog.md) — epics and stories (24 epics; Epics 1-24 complete)
- [MVP Development Plan](docs/mvp_development_plan.md) — original development roadmap
- [Remotion Lambda Migration](docs/designs/remotion-lambda-migration.md) — render architecture design
- [Template System Design](docs/designs/2026-03-24-template-system-design.md) — 3 structural archetypes design
- [Transitions & Effects Design](docs/superpowers/specs/2026-03-27-transitions-and-effects-design.md) — configurable scene transitions and animation effects
- [Gemini 3 Flash Upgrade ADR](docs/adr/001-gemini-3-flash-upgrade.md) — architecture decision record

Optional **AWS agent skills** for AI-assisted ops (S3, Lambda, IAM, etc.) live under [`.agents/skills/`](.agents/skills/) (see [`AGENTS.md`](AGENTS.md)).

## License

Private project.
