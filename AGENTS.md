---
description: Main Agents instructions
alwaysApply: true
---

# AGENTS.md — Video Worker Studio Operating Manual

> Read this before touching any code. It defines what's allowed, what's owned by whom, and what will break if you ignore it.

---

## 0. Mandatory Agent Preflight (Read Before Any Action)

This preflight is mandatory for every run and every delegated run.

Required sequence:
1. Read this entire `AGENTS.md` file first.
2. Confirm applicable constraints before doing anything else (tool call, edit, shell command, commit, PR action, or browser action).
3. When delegating work, require each subagent to perform the same preflight before taking action.

Scope of enforcement:
- Primary agent
- Subagents
- Skill-driven workflows

Non-compliance rule:
- If any action is started before `AGENTS.md` is read, stop immediately, discard that execution path, and restart from preflight.

---

## 1. Stack (non-negotiable)

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 16.x |
| Language | TypeScript (strict) | 5.x |
| Styling | Tailwind CSS v4 | 4.x |
| Database | Supabase PostgreSQL | via `@supabase/supabase-js` |
| Auth | Supabase Auth + SSR | `@supabase/ssr` |
| AI | Google Gemini | `@google/generative-ai` — model: `gemini-2.5-flash` |
| Job Queue | Inngest | v3 |
| Video | Remotion (Lambda default, local fallback) | 4.x |
| Monitoring | Sentry | `@sentry/nextjs` v10 |
| State | Zustand | v5 |
| Validation | Zod | v4 |

**Do not introduce** new dependencies without a clear reason. No `axios`, no `moment`, no `lodash`. Use native `fetch`, `Date`, and array methods.

---

## 2. Folder Structure & Ownership

```
src/
  app/                   # Next.js pages & route handlers
    api/
      generate/          # POST /api/generate — dispatches Inngest event
      inngest/           # POST /api/inngest — Inngest webhook sink (must stay public)
      projects/          # CRUD for projects table
      wizard/            # Wizard-specific API routes (draft, ideas, enhance-idea, validate-trend,
                         #   generate-structure, script, fetch-assets, upload-voiceover, render)
    auth/                # Auth callback route (Supabase magic link)
    login/               # Login page
    projects/[id]/       # Project detail page (video player, download, retry)
    wizard/[id]/         # Interactive multi-step wizard UI
      client.tsx         # Wizard orchestrator (Zustand store init + step routing)
      page.tsx           # Server component (auth + project fetch)
      steps/             # 6 step components
        TemplateStep.tsx # Template archetype + project settings (topic, scenes, duration, ratio, quality)
        IdeaStep.tsx     # AI hook suggestions for chosen topic
        RefineStep.tsx   # AI enhance + trend validation
        ScriptStep.tsx   # AI script generation (template-specific prompts)
        PreviewStep.tsx  # Asset preview + drag-and-drop reorder
        RenderStep.tsx   # Render summary + progress + video player
  components/
    DraggableImage.tsx   # Shared hover-to-reveal drag-to-pan image component (used by all SceneCards)
    dashboard.tsx        # Dashboard orchestrator (imports sub-components)
    dashboard/           # Dashboard sub-components
      project-card.tsx
      status-badge.tsx
      empty-state.tsx
      create-modal.tsx
      delete-modal.tsx
    wizard/              # Shared wizard sub-components
      video-config-selector.tsx
      music-selector.tsx
      voiceover-upload.tsx
    ui/
      toast.tsx           # Toast notification system (Zustand store)
  lib/
    api/
      with-auth.ts       # Shared auth + rate limiting wrapper for API routes
    ai/
      prompts.ts         # Centralized LLM prompt templates (all AI prompts live here)
      generate-script.ts # Gemini script generation
      fetch-assets.ts    # Pinterest asset scraping via pinterest-dl (supports multi-asset)
      wizard.ts          # Wizard-specific AI helpers (enhanceIdea, validateTrend, generateStructure)
    inngest/
      client.ts          # Inngest client singleton
      functions.ts       # VideoGenerationWorker — the ONLY Inngest function
    render/
      render-video.ts    # Remotion render dispatcher (Lambda default, local fallback)
      dimensions.ts      # Video dimension resolver (aspect ratio × quality → width/height)
    stores/
      wizard-store.ts    # Zustand store for wizard state (scenes, settings, refinedIdea)
    projects/
      delete-project-assets.ts # Storage + temp cleanup when deleting a project
    music-presets.ts     # 5 royalty-free music track presets
    rate-limit.ts        # In-memory sliding window rate limiter
    supabase/
      client.ts          # Browser client (anon key)
      server.ts          # Server client (uses cookies)
      middleware.ts      # Session refresh helper
      types.ts           # Auto-generated DB types — DO NOT HAND-EDIT
  templates/             # Template system (3 structural archetypes)
    types.ts             # TemplateId, TemplateConfig, Scene union types
    index.ts             # Template registry and lookup
    slideshow/           # Single-image slideshow archetype
      config.ts, prompt.ts, schema.ts, types.ts, SceneCard.tsx
    comparison/          # Side-by-side comparison archetype
      config.ts, prompt.ts, schema.ts, types.ts, SceneCard.tsx
    fact-card/           # Two-image identity/fact card archetype
      config.ts, prompt.ts, schema.ts, types.ts, SceneCard.tsx
  remotion/              # Remotion composition and rendering
    Root.tsx
    VideoComposition.tsx # Template-based scene dispatch
    templates/           # Remotion scene components per archetype
      SlideshowScene.tsx
      ComparisonScene.tsx
      FactCardScene.tsx
  middleware.ts           # Auth guard (blocks all routes except public ones)

supabase/
  migrations/            # SQL migration files — append only, never edit existing
```

**Ownership rules:**
- `src/lib/` — pure logic, no React, no UI imports
- `src/app/api/` — thin handlers only; delegate to `src/lib/`
- `src/remotion/` — Remotion-only code; do not import app logic here
- `src/components/` — shared UI components; no direct DB calls (use API routes)

---

## 3. Architecture Constraints

- **No direct DB access from components.** Components call API routes or Server Actions. Only `lib/supabase/server.ts` and Inngest workers touch the DB directly.
- **Inngest is the only job runner.** Do not add `setTimeout`, `setInterval`, or other async fire-and-forget patterns in route handlers. All background work goes through Inngest events.
- **RLS is active.** Row-Level Security is enforced on all tables. The Inngest worker bypasses RLS via SECURITY DEFINER RPC functions (`worker_insert_scenes`, `worker_update_project_status`, `worker_update_project_error`). Do not bypass RLS any other way.
- **The Inngest webhook endpoint (`/api/inngest`) must remain unauthenticated.** The middleware matcher explicitly excludes it. Do not add auth to this route.
- **Remotion renders on AWS Lambda by default.** The worker dispatches renders via `@remotion/lambda`, while `RENDER_BACKEND=local` remains a fallback for rollback and debugging.
- **Sentry is the observability layer.** Do not add other error tracking tools. Sentry is initialised in `src/instrumentation.ts` and `src/instrumentation-client.ts`.

---

## 4. Database Rules

### Schema (current tables)
| Table | Key columns |
|---|---|
| `projects` | `id`, `user_id`, `topic`, `status`, `selected_template`, `wizard_step`, `draft_scenes`, `trend_validation_data`, `video_url`, `render_error_context`, `aspect_ratio`, `video_quality`, `background_music`, `voiceover_url`, `video_description`, `video_tags` |
| `scenes` | `id`, `project_id`, `sequence_order`, `script_text`, `search_keywords`, `asset_url` |

### Project status lifecycle
```
draft → processing → rendering → completed
                 ↘ failed_ai
                              ↘ failed_render
```

- `draft`: Created by wizard, not yet sent to worker.
- `processing`: Worker is generating script + fetching assets.
- `rendering`: Scenes saved; Remotion is compiling.
- `completed`: `video_url` is set.
- `failed_ai` / `failed_render`: Terminal error states.

### Migration rules
- **All schema changes go in `supabase/migrations/` as numbered SQL files.** Never run ad-hoc `ALTER TABLE` against production.
- **Never edit existing migration files.** Add a new file only.
- Filename format: `YYYYMMDDHHMMSS_description.sql`
- Update `src/lib/supabase/types.ts` after any schema change (run `supabase gen types typescript` or update manually).
- `types.ts` is the source of truth for all TypeScript DB types — **do not hand-edit it mid-session** without regenerating from actual schema.

---

## 5. Coding Conventions

- **TypeScript strict mode always.** No `any` except when interfacing with untyped third-party responses (and even then, wrap in a Zod schema at the boundary).
- **Zod v4 for all AI output validation.** Gemini responses must be parsed through a Zod schema before use.
- **Supabase client selection:**
  - Browser / Client Components → `src/lib/supabase/client.ts`
  - Server Components / Route Handlers → `src/lib/supabase/server.ts`
  - Inngest workers → `createClient()` with anon key for SECURITY DEFINER RPC calls (bypasses RLS)
  - Local render storage uploads require `SUPABASE_SERVICE_ROLE_KEY` (service role must not be `NEXT_PUBLIC_`)
- **Tailwind v4 class syntax.** Use `bg-white/10` not `bg-white/[0.1]`. Use `bg-linear-to-br` not `bg-gradient-to-br`.
- **No inline styles.** All styling via Tailwind utility classes.
- **Path alias `@/`** maps to `src/`. Use it everywhere; do not use relative `../../` imports across domain boundaries.
- **No `console.log` in component code.** Use `console.log` only inside Inngest workers/lib functions for pipeline tracing.

---

## 6. API Contract Rules

| Route | Method | Auth required | Purpose |
|---|---|---|---|
| `/api/inngest` | POST | ❌ Public | Inngest webhook sink — never add auth |
| `/api/generate` | POST | ✅ | Dispatch `video/generate` Inngest event |
| `/api/projects/[id]` | DELETE | ✅ | Delete a project |
| `/api/wizard/draft` | PUT | ✅ | Save wizard draft progress |
| `/api/wizard/ideas` | POST | ✅ | Generate idea options |
| `/api/wizard/enhance-idea` | POST | ✅ | Enhance a raw topic |
| `/api/wizard/validate-trend` | POST | ✅ | Validate trend signals |
| `/api/wizard/generate-structure` | POST | ✅ | Generate scene structure |
| `/api/wizard/script` | POST | ✅ | Generate scene scripts |
| `/api/wizard/fetch-assets` | POST | ✅ | Fetch scene assets from Pinterest (supports multi-asset mode) |
| `/api/wizard/upload-voiceover` | POST | ✅ | Upload voice-over audio file (MP3/WAV, max 50MB) |
| `/api/wizard/generate-seo` | POST | ✅ | Generate YouTube SEO metadata (description + tags) |
| `/api/wizard/render` | POST | ✅ | Dispatch wizard render job (with video config, music, template) |

- Route handlers must return `NextResponse.json()` consistently.
- All authenticated routes must validate the Supabase session and return `401` if missing.
- Do not put business logic in route handlers — delegate to `src/lib/`.

---

## 7. "Do Not Touch" Areas

| File / Area | Reason |
|---|---|
| `src/lib/supabase/types.ts` | Auto-generated; regenerate from schema, do not hand-edit |
| `supabase/migrations/*.sql` (existing files) | Append-only; history must be immutable |
| `src/middleware.ts` matcher | Carefully tuned to exclude Inngest + Sentry routes |
| `worker_insert_scenes` RPC | Bypasses RLS; changing signature breaks the worker |
| `worker_update_project_status` RPC | Same as above |
| `worker_update_project_error` RPC | Same as above |
| `.env.local` | Never commit; never log env values |

---

## 8. Testing Expectations

- **Vitest** + `@testing-library/react` + `@testing-library/jest-dom` is the configured test framework (since v0.3.0.0).
- Tests live in `src/__tests__/`, organized by module path (e.g., `src/__tests__/lib/api/with-auth.test.ts`).
- Run tests: `npm run test` (single run), `npm run test:watch` (watch mode), `npm run test:coverage` (with coverage).
- Baseline verification:
  1. `npm run test` — all tests pass
  2. `npm run lint` — zero lint errors (ESLint)
  3. `npm run build` — production build succeeds
- Every new feature epic should include tests for its new code paths.

---

## 9. PR / Change Rules

- Keep PRs focused: one concern per PR.
- Every PR that touches `supabase/migrations/` must include a note about what the migration adds/changes and whether a `types.ts` update is needed.
- Every PR that changes the Inngest worker pipeline must manually verify the full `draft → completed` flow locally before merging.
- Do not merge with broken `npm run build` or `npm run lint`.
- Sentry source maps are uploaded during `next build` — ensure `SENTRY_AUTH_TOKEN` is set in CI.

---

## 10. Performance & Security Guardrails

- **Never log or return secrets.** Supabase keys, Gemini API key, Sentry DSN — none of these should appear in client-side code or logs.
- **`NEXT_PUBLIC_` env vars are exposed to the browser.** Only put values in `NEXT_PUBLIC_` that are safe to be public (Supabase URL and anon key are intentionally public; service role key must never be `NEXT_PUBLIC_`).
- **Remotion renders are async and cost-sensitive.** Keep per-user render concurrency constrained in Inngest and apply a global cap to avoid runaway Lambda spend.
- **Pinterest scraping is rate-limited by `pinterest-dl`.** Do not increase the number of scenes beyond 10 without testing scrape reliability.
- **Video files are large.** Remotion output goes to `/tmp` then immediately uploaded to Supabase Storage and deleted. Do not persist render artifacts on disk.

---

## 11. Boundaries

- **Ask first**
  - Large cross-package refactors.
  - New dependencies with broad impact.
  - Destructive data or migration changes.
- **Never**
  - Commit secrets, credentials, or tokens.
  - Edit generated files by hand when a generation workflow exists.
  - Use destructive git operations unless explicitly requested.

---

## 12. Documentation Files

| File | Description |
|---|---|
| `README.md` | Project overview, setup instructions, architecture diagram |
| `AGENTS.md` | This file — agent operating manual, stack, constraints, folder ownership |
| `CHANGELOG.md` | User-facing release notes (Keep a Changelog format) |
| `TODOS.md` | Engineering follow-ups and deferred work |
| `VERSION` | Current version number (semver: `X.Y.Z.W`) |
| `docs/project_spec.md` | Product specification — vision, user flow, requirements |
| `docs/system_architecture.md` | Component overview and dependency graph |
| `docs/database_schema.md` | PostgreSQL tables, RLS policies, RPC functions |
| `docs/tech_stack.md` | Technology choices and rationale |
| `docs/workflow_design.md` | Pipeline design, failure modes, retries |
| `docs/ux_specification.md` | Screen-by-screen layout and interactions |
| `docs/prd_backlog.md` | Product backlog (21 epics; Epics 1–20 complete, Epic 21 planned) |
| `docs/mvp_development_plan.md` | Original development roadmap |
| `docs/designs/remotion-lambda-migration.md` | Render architecture design |
| `docs/designs/2026-03-24-template-system-design.md` | Template system design (3 archetypes) |
| `docs/adr/001-gemini-3-flash-upgrade.md` | Architecture decision record |

---

## 13. gstack Skills

Use `.agents/skills/gstack/browse` for all web browsing.

| Skill Path | Your specialist | What they do |
|-------|----------------|--------------|
| `.agents/skills/gstack/plan-ceo-review` | **CEO / Founder** | Rethink the problem. Find the 10-star product hiding inside the request. |
| `.agents/skills/gstack/plan-eng-review` | **Eng Manager** | Lock in architecture, data flow, diagrams, edge cases, and tests. |
| `.agents/skills/gstack/plan-design-review` | **Senior Designer** | Rates each design dimension 0-10, then edits the plan to get there. |
| `.agents/skills/gstack/design-consultation` | **Design Partner** | Build a complete design system from scratch. |
| `.agents/skills/gstack/review` | **Staff Engineer** | Find the bugs that pass CI but blow up in production. |
| `.agents/skills/gstack/ship` | **Release Engineer** | Sync main, run tests, audit coverage, push, open PR. |
| `.agents/skills/gstack/browse` | **QA Engineer** | Real Chromium browser, real clicks, real screenshots. |
| `.agents/skills/gstack/qa` | **QA Lead** | Test your app, find bugs, fix them with atomic commits, re-verify. |
| `.agents/skills/gstack/qa-only` | **QA Reporter** | Same as /qa but report only — no code changes. |
| `.agents/skills/gstack/design-review` | **Designer Who Codes** | Same audit as /plan-design-review, then fixes what it finds. |
| `.agents/skills/gstack/setup-browser-cookies` | **Session Manager** | Import cookies from your real browser into the headless session. |
| `.agents/skills/gstack/retro` | **Eng Manager** | Team-aware weekly retro. Per-person breakdowns, shipping streaks. |
| `.agents/skills/gstack/office-hours` | **YC Office Hours** | Forcing questions on demand, users, and product. |
| `.agents/skills/gstack/debug` | **Debugger** | Systematic root-cause debugging. Iron Law: no fixes without investigation. |
| `.agents/skills/gstack/document-release` | **Technical Writer** | Update all project docs to match what you just shipped. |

---

## 14. AWS Skills

Use these AWS-focused skills for cloud infrastructure, operations, and cost management tasks.

| Skill Path | Your specialist | What they do |
|-------|----------------|--------------|
| `.agents/skills/aws-s3` | **Cloud Storage Architect** | Manages S3 buckets, objects, lifecycle rules, replication, access controls, and pre-signed URLs with least-privilege IAM practices. |
| `.agents/skills/aws-billing` | **Cloud Cost Manager** | Orchestrates AWS budgets, spend exploration, and usage reporting via AWS CLI for proactive cost control. |
| `.agents/skills/aws-ec2` | **Compute Infrastructure Architect** | Launches and manages EC2 instances, AMIs, EBS volumes, security groups, Elastic IPs, and Auto Scaling with least-privilege IAM guidance. |
| `.agents/skills/aws-cloudwatch` | **Observability Architect** | Builds and manages CloudWatch alarms, dashboards, log queries, metric filters, EventBridge rules, and anomaly detection. |
| `.agents/skills/aws-lambda` | **Serverless Architecture Specialist** | Creates, deploys, and operates Lambda functions, versions, aliases, layers, event mappings, and concurrency controls. |
| `.agents/skills/aws-iam` | **Identity & Access Architect** | Designs and manages IAM users, roles, policies, trust relationships, access keys, MFA, and policy simulation with strict least privilege. |
