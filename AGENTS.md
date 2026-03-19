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
| Video | Remotion (local bundler) | 4.x |
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
      wizard/            # Wizard-specific API routes
    auth/                # Auth callback route (Supabase magic link)
    login/               # Login page
    wizard/[id]/         # Interactive multi-step wizard UI
  components/
    dashboard.tsx        # Main dashboard component (project grid + quick-start)
  lib/
    ai/
      generate-script.ts # Gemini script generation
      fetch-assets.ts    # Pinterest asset scraping via pinscrape-dl
      wizard.ts          # Wizard-specific AI helpers
    inngest/
      client.ts          # Inngest client singleton
      functions.ts       # VideoGenerationWorker — the ONLY Inngest function
    render/
      render-video.ts    # Remotion local bundler render
      upload-storage.ts  # Supabase Storage upload
    supabase/
      client.ts          # Browser client (anon key)
      server.ts          # Server client (uses cookies)
      middleware.ts      # Session refresh helper
      types.ts           # Auto-generated DB types — DO NOT HAND-EDIT
  remotion/              # Remotion composition templates
    Root.tsx
    Scene.tsx
    VideoComposition.tsx
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
- **RLS is active.** Row-Level Security is enforced on all tables. The Inngest worker bypasses RLS via two SECURITY DEFINER RPC functions: `worker_insert_scenes` and `worker_update_project_status`. Do not bypass RLS any other way.
- **The Inngest webhook endpoint (`/api/inngest`) must remain unauthenticated.** The middleware matcher explicitly excludes it. Do not add auth to this route.
- **Remotion renders on AWS Lambda by default.** The worker dispatches renders via `@remotion/lambda`, while `RENDER_BACKEND=local` remains a fallback for emergency rollback and debugging.
- **Sentry is the observability layer.** Do not add other error tracking tools. Sentry is initialised in `src/instrumentation.ts` and `src/instrumentation-client.ts`.

---

## 4. Database Rules

### Schema (current tables)
| Table | Key columns |
|---|---|
| `projects` | `id`, `user_id`, `topic`, `status`, `selected_template`, `wizard_step`, `draft_scenes`, `video_url` |
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
  - Inngest workers → `createClient()` with anon key (RPC-only, bypasses RLS via SECURITY DEFINER)
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
| `/api/projects` | GET/POST | ✅ | List/create projects |
| `/api/projects/[id]` | GET/PUT | ✅ | Read/update a single project |
| `/api/wizard/[id]` | PUT | ✅ | Save wizard step progress |

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
| `.env.local` | Never commit; never log env values |

---

## 8. Testing Expectations

- No test framework is currently configured. **Before adding tests, open a discussion** about the framework (Vitest + Testing Library is the preferred choice).
- For now, manual smoke-testing is the baseline:
  1. `npm run dev` — app boots without errors
  2. `npm run lint` — zero lint errors (ESLint)
  3. `npm run build` — production build succeeds
- When a test framework is added: unit tests go in `src/__tests__/`, co-located tests are acceptable for lib functions.

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
- **Pinterest scraping is rate-limited by `pinscrape-dl`.** Do not increase the number of scenes beyond 10 without testing scrape reliability.
- **Video files are large.** Remotion output goes to `/tmp` then immediately uploaded to Supabase Storage and deleted. Do not persist render artifacts on disk.

---

## 11. gstack Skills

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

## 12. AWS Skills

Use these AWS-focused skills for cloud infrastructure, operations, and cost management tasks.

| Skill Path | Your specialist | What they do |
|-------|----------------|--------------|
| `.agents/skills/aws-s3` | **Cloud Storage Architect** | Manages S3 buckets, objects, lifecycle rules, replication, access controls, and pre-signed URLs with least-privilege IAM practices. |
| `.agents/skills/aws-billing` | **Cloud Cost Manager** | Orchestrates AWS budgets, spend exploration, and usage reporting via AWS CLI for proactive cost control. |
| `.agents/skills/aws-ec2` | **Compute Infrastructure Architect** | Launches and manages EC2 instances, AMIs, EBS volumes, security groups, Elastic IPs, and Auto Scaling with least-privilege IAM guidance. |
| `.agents/skills/aws-cloudwatch` | **Observability Architect** | Builds and manages CloudWatch alarms, dashboards, log queries, metric filters, EventBridge rules, and anomaly detection. |
| `.agents/skills/aws-lambda` | **Serverless Architecture Specialist** | Creates, deploys, and operates Lambda functions, versions, aliases, layers, event mappings, and concurrency controls. |
| `.agents/skills/aws-iam` | **Identity & Access Architect** | Designs and manages IAM users, roles, policies, trust relationships, access keys, MFA, and policy simulation with strict least privilege. |
