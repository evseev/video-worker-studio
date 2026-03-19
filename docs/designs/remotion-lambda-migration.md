# Design: Remotion AWS Lambda Migration

> **Status:** ACTIVE  
> **Author:** CEO Review — 2026-03-18  
> **Branch:** develop  
> **Supersedes:** n/a (first Lambda render design)

---

## Problem Statement

`renderVideo()` currently runs `@remotion/bundler` + `@remotion/renderer` **inside the Next.js process**. This means:

- Every render blocks a server thread — CPU-intensive work competing with HTTP request handling
- Remotion bundles the full Webpack config on every render call (~30-60s overhead)
- At >1 concurrent user rendering, the server degrades for all users
- No horizontal scale — one video renders at a time globally

## Decision

Replace local Remotion rendering with `@remotion/lambda`. Lambda handles bundling, frame-parallel encoding, and S3 upload. The Next.js/Inngest process becomes a thin dispatcher.

---

## Scope

### Accepted

| # | Change | Rationale |
|---|--------|-----------|
| Core | Replace `@remotion/bundler` + `@remotion/renderer` with `@remotion/lambda` | Primary goal |
| 2 | Lambda writes output directly to S3; store S3 URL in `projects.video_url` | Removes dedicated upload step in the Lambda path |
| 3 | Inngest user-keyed `concurrency` with `limit: 3` (`key: event.data.userId`) | Prevents same-user render pileups and caps cost |
| 4 | `render_error_context` JSONB column on `projects` + `worker_update_project_error` RPC | Silent `failed_render` with no debug info is unacceptable |

### Deferred

| # | Change | Why Deferred |
|---|--------|--------------|
| 1 | Real-time render progress (SSE/polling → dashboard %) | Needs SSE infrastructure; defer until Lambda is stable in prod |
| 5 | Provisioned concurrency (warm Lambda, eliminates cold starts) | ~$20/month cost; revisit when cold starts become user complaints |

---

## Architecture

### Before

```
Inngest Worker
  └─ step("render-video")
       └─ @remotion/bundler  (Webpack bundle, ~30s, blocks server CPU)
       └─ @remotion/renderer (H264 encode, ~60-90s, blocks server CPU)
       └─ writes to /tmp
  └─ step("upload-video")
       └─ reads /tmp → Supabase Storage upload
       └─ returns Supabase public URL
```

### After

```
Inngest Worker
  └─ step("render-video")
       └─ renderMediaOnLambda()
            │
            ▼
         AWS Lambda (Remotion managed)
            ├─ bundles Remotion (parallel, Lambda /tmp)
            ├─ renders H264 (frame-parallel across Lambda instances)
            └─ uploads to S3: s3://{bucket}/videos/{projectId}.mp4
            │
            returns S3 public URL
  └─ step("complete-project")
       └─ worker_update_project_status(projectId, "completed", s3Url)
```

**Eliminated in Lambda path:** the separate `upload-video` Inngest step.

---

## Data Flow

```
INPUT: { projectId, scenes[], template }
    │
    ▼
renderVideo()  [render-video.ts]
    │
    ├─ RENDER_BACKEND=lambda (default)
    │     └─ renderMediaOnLambda({
    │            functionName: REMOTION_LAMBDA_FUNCTION_NAME,
    │            region: REMOTION_AWS_REGION,
    │            serveUrl: REMOTION_SERVE_URL,
    │            composition: "VideoWorker",
    │            outName: `${projectId}.mp4`,
    │            inputProps: { scenes, template, ... }
    │          })
    │         → returns renderId, polls progress, then returns S3 URL
    │
    └─ RENDER_BACKEND=local (escape hatch)
          └─ legacy localRender() (kept but not default)

OUTPUT: S3 public URL  →  stored in projects.video_url

ON ERROR:
    ├─ worker_update_project_status(projectId, "failed_render")
    └─ worker_update_project_error(projectId, {
           message: err.message,
           timestamp: ISO8601,
           step: "render-video"
         })
```

---

## Database Changes

### New column

```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS render_error_context JSONB DEFAULT NULL;
```

### New RPC: `worker_update_project_error`

```sql
CREATE OR REPLACE FUNCTION worker_update_project_error(
  p_project_id UUID,
  p_error_context JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE projects
  SET
    render_error_context = p_error_context,
    updated_at = NOW()
  WHERE id = p_project_id;
END;
$$;
```

This follows the same SECURITY DEFINER pattern as `worker_insert_scenes` and `worker_update_project_status`.

---

## New Environment Variables

All server-only — **no `NEXT_PUBLIC_` prefix.**

```bash
RENDER_BACKEND=lambda                         # "lambda" | "local" — feature flag
SUPABASE_SERVICE_ROLE_KEY=...                # required when RENDER_BACKEND=local (Storage upload of MP4)
LOCAL_RENDER_ASSET_BASE_URL=http://localhost:3000 # base URL for /tmp_assets when running local renders
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
REMOTION_AWS_REGION=us-east-1
REMOTION_LAMBDA_FUNCTION_NAME=remotion-render-...
REMOTION_SERVE_URL=https://s3.us-east-1.amazonaws.com/remotion-.../...
```

Credential compatibility note: if `AWS_*` vars are missing, runtime aliases `REMOTION_AWS_ACCESS_KEY_ID` / `REMOTION_AWS_SECRET_ACCESS_KEY` into `AWS_*`.

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/render/render-video.ts` | Lambda dispatch by default with local render/upload fallback behind `RENDER_BACKEND=local` |
| `src/lib/inngest/functions.ts` | Remove `upload-video` step; add user-keyed `concurrency`; add Zod-validated error context capture |
| `src/lib/supabase/types.ts` | Regenerate after migration (`supabase gen types typescript`) — no manual edits |
| `supabase/migrations/20260318194000_add_render_error_context.sql` | New migration |
| `package.json` | Add `@remotion/lambda`; keep `@remotion/bundler` + `@remotion/renderer` for local fallback |
| `AGENTS.md` | Update Section 3 (remove "Remotion runs locally") and Section 10 |

---

## Error & Rescue Map

| Codepath | What Can Go Wrong | Rescued? | User Sees |
|---|---|---|---|
| `renderMediaOnLambda` | Lambda timeout (>14min) | ✅ catch → `failed_render` + error context | "Render failed" in UI |
| `renderMediaOnLambda` | Lambda OOM | ✅ catch → `failed_render` + error context | "Render failed" in UI |
| `renderMediaOnLambda` | Returns null/undefined URL | ✅ explicit throw before status update | "Render failed" in UI |
| `renderMediaOnLambda` | IAM AccessDenied | ✅ catch → `failed_render` + error context | "Render failed" in UI |
| `renderMediaOnLambda` | Lambda function not deployed | ⚠️ Inngest retries; startup check recommended | Retry, then "Render failed" |
| `worker_update_project_error` | RPC fails | ⚠️ log only; don't re-throw (status already set) | Status correct; no debug context |

---

## Security

- All 6 new env vars are server-only (no `NEXT_PUBLIC_` prefix)
- Local rendering uses `SUPABASE_SERVICE_ROLE_KEY` for Supabase Storage uploads (MP4) and expects storage policies restricted to `renders/videos/*`
- IAM role should be scoped: `s3:PutObject` on `s3://vws-renders/*` only — not `s3:*`
- Lambda receives `inputProps` from Inngest (server-controlled) — no user-supplied data enters Lambda directly
- S3 bucket public-read is acceptable: `projectId` is a UUID (not guessable); no PII in video
- `render_error_context` is JSONB — validate shape before storing (no raw user input captured)

---

## Deployment Runbook

Run these once per AWS account to set up infrastructure:

```bash
# 1. Add Lambda as dev dependency
npm install --save-dev @remotion/lambda

# 2. Set AWS credentials in .env.local (never commit)
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1

# 3. Deploy IAM policies (once per AWS account)
npx remotion lambda policies setup

# 4. Deploy Lambda function
npx remotion lambda functions deploy \
  --memory 3008 \
  --timeout 840 \
  --disk 10240
# → copy REMOTION_LAMBDA_FUNCTION_NAME from output

# 5. Deploy Remotion site (re-run when compositions change)
npx remotion lambda sites create src/remotion/index.ts \
  --site-name vws-render
# → copy REMOTION_SERVE_URL from output

# 6. Add all env vars to Vercel (prod) and .env.local (dev)
```

**Re-run step 5 every time you change `src/remotion/` compositions.** The serve URL changes; update `REMOTION_SERVE_URL` in Vercel.

---

## Rollback Plan

This is a **two-way door**:

```
1. Set RENDER_BACKEND=local in Vercel environment variables
2. Redeploy (Vercel: ~2 min)
3. In-flight renders may complete or fail depending on when config is read; new renders use local backend after deploy
4. No DB migration rollback needed (render_error_context column is additive/nullable)
```

---

## Open Questions / Pre-Implementation Decisions

- **AWS region:** `us-east-1` recommended (lowest Lambda cold start, Remotion default). Confirm before deploying.
- **S3 URL format:** Public bucket with UUID key (acceptable security posture) vs. pre-signed URLs (expire; more complex). **Decision: public bucket.**
- **RPC approach for errors:** New `worker_update_project_error` RPC (Approach A) vs. extending existing `worker_update_project_status`. **Decision: new RPC — don't touch existing signatures.**

---

## Performance Profile

| Dimension | Local (before) | Lambda (after) |
|---|---|---|
| Server CPU during render | Maxed out | Zero |
| Render time (5 scenes) | 60–120s | 20–40s |
| Cold start overhead | n/a | +8–15s (first render after idle) |
| Concurrent renders | 1 | Up to 3 (Inngest throttle) |
| Next.js responsiveness during render | Degraded | Unaffected |
| Cost per render | ~$0 (server CPU) | ~$0.01–0.05 |

These Lambda values are expected ranges until validated by production telemetry.

### Post-deploy measurement checklist

- Capture `P95` render duration for first 50 production renders and compare with local baseline
- Record cold-start frequency and median cold-start penalty
- Track Lambda cost per render and total daily render cost
- Verify `failed_render` rate does not regress after cutover

---

## Acceptance Test Matrix

| Scenario | Setup | Expected Result |
|---|---|---|
| Lambda happy path | `RENDER_BACKEND=lambda` + valid Lambda env vars | Project reaches `completed`; `projects.video_url` stores S3 URL |
| Local escape hatch | `RENDER_BACKEND=local` + `SUPABASE_SERVICE_ROLE_KEY` + `LOCAL_RENDER_ASSET_BASE_URL` | Project reaches `completed`; local render uploads to storage URL |
| Missing function name | Unset `REMOTION_LAMBDA_FUNCTION_NAME` | Project reaches `failed_render`; `render_error_context.message` shows env error |
| Invalid serve URL | Bad `REMOTION_SERVE_URL` | Project reaches `failed_render`; error context persisted |
| IAM access denied | Remove required IAM permission | Project reaches `failed_render`; error context persisted |
| Error RPC fails | Force `worker_update_project_error` failure | Status still set to `failed_render`; worker logs context RPC failure |

### Smoke gates before merge

1. `npm run dev` boots successfully
2. `npm run lint` returns zero lint errors
3. `npm run build` succeeds
4. Manual flow verifies `draft -> processing -> rendering -> completed` and one forced `failed_render`

---

## Future Work (Deferred)

See `TODOS.md` for:
- **P2:** Real-time render progress bar (SSE + `getRenderProgress()` polling)
- **P3:** Provisioned concurrency to eliminate cold starts
