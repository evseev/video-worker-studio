# Epic 25 — Channels: Brand Hub for Multi-Channel Creators

**Date:** 2026-05-13
**Status:** Draft (pending eng review)
**Related plan:** `~/.cursor/plans/channels_epic_25_plan_45814f32.plan.md`

## Context

Video Worker Studio's primary persona is **a solo creator who runs multiple YouTube channels** (per [`docs/project_spec.md`](../project_spec.md) §6 and §13.4). The current data model assumes a single creator namespace per user: every project is owned directly by `auth.users.id`, all subject de-duplication (ADR-002) is user-scoped over the last 10 completed projects, and every per-video setting is picked fresh in the wizard with no awareness of which "brand" the video is being made for.

A creator running 4 channels today must:
- Re-pick template, aspect ratio, quality, music, captions, transitions, and motion every single video.
- Tolerate cross-channel subject collisions ("can't make this video on Channel A because I made the same one on Channel B 3 months ago").
- Manually keep tone/language/niche consistent across a series of videos on the same channel.
- Re-upload assets (logo, thumbnail reference) per video, since there's no place to store them.

This epic introduces a first-class **Channel** entity that owns brand identity, defaults, AI context, the YouTube link, the topic pipeline, and the de-duplication horizon. After Epic 25, "which channel?" becomes the *single* decision a creator makes per session; everything else inherits.

## Goals

1. Every project is owned by exactly one channel; existing projects are migrated transparently to a backfilled default channel.
2. Subject de-duplication is **channel-scoped**: same idea is unique within a channel's last N videos (default 5, configurable per channel); the same idea is fair game on a different channel.
3. New projects auto-inherit the channel's most recent project settings (template, aspect ratio, quality, music, voiceover, all effects, caption style, scene count/duration). One toggle to disable.
4. AI prompts (idea, structure, SEO) receive `channelContext` — niche, language, audience, tone — so output reflects channel voice automatically.
5. Channel logo uploads and renders as a watermark on every produced video; corner + opacity per-channel.
6. Linked YouTube channel surfaces public performance data; "Suggest topics" uses top performers + channel context to rank ideas.
7. Channel-scoped scene preset library: save current video setup as a named preset, reapply in one click.
8. Local rendered videos are namespaced per channel on disk: `public/local_renders/{channelId}/{projectId}.mp4`.

## Non-goals (deferred to TODOS.md / later epics)

- **Brand kit** (brand colors + Google Fonts preset applied to templates and captions). Touches every template; bigger diff than this epic should absorb.
- **YouTube OAuth + Analytics API** (retention, CTR, audience demographics). Requires verified-app flow with Google.
- **Auto-publish to YouTube** (publishing API, OAuth, draft sync).
- **Team / shared channels** (multi-user-per-channel collaboration).
- **Channel templates as exportable presets** (cross-user sharing).
- **Per-channel watermark scheduling** (e.g., "no watermark on first scene"). MVP: applied to every scene or none.

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backfill strategy | Single "My Channel" auto-created per user; all existing projects assigned to it; `projects.channel_id` made `NOT NULL` after backfill | Zero-downtime; reversible by rename; matches Strangler-Fig pattern |
| Channel selection UI | Top-nav dropdown switcher in the dashboard; URL `?channel=...` + localStorage fallback; wizard never asks | One decision per session, not per project |
| Subject memory scope | Last N completed projects on the same `channel_id` (N = `channels.subject_memory_lookback`, default 5) | Matches user requirement; per-channel override allows power users |
| AI context delivery | New `channelContext: { niche, targetLanguage, targetAudience, tone }` arg threaded through every prompt builder in [`src/lib/ai/prompts.ts`](../../src/lib/ai/prompts.ts) | Explicit > implicit (per AGENTS.md preference); no global state |
| YouTube API depth | Public Data API only (no OAuth); `@handle` → `channelId` resolution; per-video view/like/comment counts; cached in `channels.youtube_meta` with 24h TTL | Avoids OAuth ocean; gives 80% of value |
| Topic suggestions | New `/api/channels/[id]/suggest-topics` route: combines `channelContext` + top-N YouTube performers + excluded subjects → ranked ideas with reasoning | Creator workflow gold; reuses subject-memory exclusion |
| Watermark rendering | Channel logo overlaid via Remotion `<Img>` at configured corner + opacity, every scene; existing user "My Channel" defaults to `none` so old videos don't change | Reversibility — opt-in for new behavior |
| Scene preset storage | New `channel_scene_presets` table with `template_id` + `settings_json` JSONB blob; save/apply actions in wizard and settings page | Minimal schema; same shape as existing `default_settings` blob |
| Local render path | `public/local_renders/{channelId}/{projectId}.mp4`; cleanup tries channel-scoped path then legacy flat path | Separates per-channel renders on dev disks; safe with `.gitignore` wildcard |
| YouTube OAuth | Out of scope; defer to a dedicated epic | One ocean per epic |

## Architecture overview

```
                    +-------------------+
                    |   auth.users      |
                    +-------------------+
                              | 1:N
                              v
                    +-------------------+      +----------------------+
                    |    channels       |<-----| channel_topic_ideas  |
                    |  (brand hub)      |      +----------------------+
                    |                   |      +----------------------+
                    |                   |<-----| channel_scene_presets|
                    +-------------------+      +----------------------+
                       | 1:N           |
                       v               |  cached
              +-------------------+    |
              |    projects       |    |
              | (channel_id FK)   |    |
              +-------------------+    v
                 | 1:N          | 1:N  +----------------------+
                 v              v      | channels.youtube_meta|
        +-----------+   +---------------+  (JSONB cache,       |
        |  scenes   |   | video_subjects|   24h TTL)           |
        +-----------+   | (channel_id   |  +-------------------+
                        |  FK; scoped)  |
                        +---------------+

                    +-------------------+
                    | Supabase Storage  |
                    |  channel-assets/  |
                    |   {channelId}/    |
                    |     logo.{ext}    |
                    |     thumbnail.{ext}|
                    +-------------------+

                    Local-render path (dev only):
                    public/local_renders/{channelId}/{projectId}.mp4
```

### Data flow — creating a new video on a channel

```
Dashboard switcher (active channel) ── "New Video" click
        |
        v
[POST /api/projects?channel=X]
        |
        +-- fetch most-recent project on channel X (status != 'draft')
        +-- copy its settings into the new draft (toggle to disable)
        +-- INSERT projects { user_id, channel_id: X, settings... }
        v
Redirect to /wizard/{newProjectId}?step=template
        |
        v
Wizard (every AI route fetches channel for channelContext)
   - ideas, enhance-idea, validate-trend, generate-structure, generate-seo, script
   - prompts receive channelContext = { niche, language, audience, tone }
   - subject-memory query: WHERE channel_id = X AND status = 'completed' ORDER BY created_at DESC LIMIT lookback
        v
Render dispatch (Inngest worker)
   - reads channel row for watermark { logoUrl, position, opacity } and channelId
   - injects watermark prop into Remotion VideoComposition
   - local backend writes to public/local_renders/{channelId}/{projectId}.mp4
   - Lambda backend uploads to remote storage (unchanged)
```

## Data model

### New table: `channels`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK `auth.users` `ON DELETE CASCADE` |
| `name` | `text` | NOT NULL |
| `slug` | `text` | unique per user; auto-derived from name |
| `logo_url` | `text` | nullable; from `channel-assets/{id}/logo.{ext}` |
| `thumbnail_template_url` | `text` | nullable; example image |
| `niche` | `text` | e.g. "tech educational"; fed to AI |
| `target_language` | `text` | e.g. "en"; fed to AI |
| `target_audience` | `text` | e.g. "curious adults 25-44"; fed to AI |
| `tone` | `text` | e.g. "energetic, factual"; fed to AI |
| `youtube_handle` | `text` | e.g. `@example` |
| `youtube_channel_id` | `text` | resolved via Public API |
| `youtube_meta` | `jsonb` | cached `{ subscriberCount, topVideos: [...], fetched_at }` |
| `subject_memory_lookback` | `int` | default `5`, CHECK `1..50` |
| `watermark_position` | `text` | CHECK `IN ('tl','tr','bl','br','none')`, default `br` for new; `none` for backfilled |
| `watermark_opacity` | `numeric(3,2)` | default `0.70`, CHECK `0..1` |
| `default_settings` | `jsonb` | snapshot of last-applied wizard settings |
| `created_at`, `updated_at` | `timestamptz` | standard |

RLS: `auth.uid() = user_id` on SELECT/INSERT/UPDATE/DELETE.

### New columns on existing tables

- `projects.channel_id` — `uuid` FK `channels(id)` `ON DELETE RESTRICT`, `NOT NULL` after backfill.
- `video_subjects.channel_id` — `uuid` FK `channels(id)` `ON DELETE CASCADE`, backfilled from `projects.channel_id`. **`video_subjects.user_id` is dropped in the same migration** once `channel_id` is verified populated; `channel_id` becomes the single source of truth for ownership. Two new indexes on `(channel_id, created_at DESC)` and `(channel_id, subject_normalized)` replace `video_subjects_user_idx` and `video_subjects_norm_idx`.

### New table: `channel_topic_ideas`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `channel_id` | `uuid` | FK `channels` `ON DELETE CASCADE` |
| `idea_text` | `text` | NOT NULL |
| `source` | `text` | CHECK `IN ('manual','ai','youtube_performance')` |
| `status` | `text` | CHECK `IN ('backlog','shot','skipped')`, default `backlog` |
| `ai_reasoning` | `text` | nullable; why AI suggested it |
| `youtube_seed_video_id` | `text` | nullable; YouTube videoId that inspired the suggestion |
| `used_in_project_id` | `uuid` | nullable FK `projects` `ON DELETE SET NULL` |
| `created_at` | `timestamptz` | standard |

RLS: `EXISTS (SELECT 1 FROM channels WHERE channels.id = channel_id AND channels.user_id = auth.uid())` — no `user_id` denormalization; single source of truth on `channels`.

### New table: `channel_scene_presets`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `channel_id` | `uuid` | FK `channels` `ON DELETE CASCADE` |
| `name` | `text` | NOT NULL; unique per channel |
| `template_id` | `text` | CHECK matches existing template registry |
| `settings_json` | `jsonb` | snapshot of caption style, effects, music, transitions, motion, animation |
| `created_at` | `timestamptz` | standard |

RLS: same `EXISTS` pattern as `channel_topic_ideas`.

### Migration sequence

Each migration runs **inside a single transaction**, with explicit verification gates so a race-window row can never sneak through. If a verification fails, the transaction aborts and the migration leaves the DB in its pre-step state — safe to retry.

1. `YYYYMMDDHHMMSS_create_channels.sql` — table + RLS + worker RPCs (`worker_create_default_channel_for_user`, `worker_update_channel_youtube_meta`, `worker_persist_topic_suggestions`).
2. `YYYYMMDDHHMMSS_add_projects_channel_id.sql` — single transaction: `LOCK TABLE projects IN EXCLUSIVE MODE` → `ADD COLUMN channel_id uuid` (nullable) → call `worker_create_default_channel_for_user(user_id)` per distinct user and `UPDATE projects SET channel_id = ...` → verify `SELECT count(*) FROM projects WHERE channel_id IS NULL = 0` → `ALTER COLUMN channel_id SET NOT NULL` + add FK `ON DELETE RESTRICT`.
3. `YYYYMMDDHHMMSS_migrate_video_subjects.sql` — single transaction: `ADD COLUMN channel_id uuid` → backfill via `UPDATE video_subjects SET channel_id = projects.channel_id FROM projects WHERE projects.id = video_subjects.project_id` → verify zero NULL → `ALTER COLUMN channel_id SET NOT NULL` + add FK `ON DELETE CASCADE` → `DROP COLUMN user_id` + drop `video_subjects_user_idx` / `video_subjects_norm_idx` → create `video_subjects_channel_idx (channel_id, created_at DESC)` and `video_subjects_channel_norm_idx (channel_id, subject_normalized)` (vector index retained).
4. `YYYYMMDDHHMMSS_create_channel_topic_ideas.sql`.
5. `YYYYMMDDHHMMSS_create_channel_scene_presets.sql`.
6. `YYYYMMDDHHMMSS_channel_assets_storage_rls.sql` — Supabase Storage policies for the `renders` bucket (or new `channel-assets` bucket — TBD in Story 25.7): allow authenticated `INSERT`/`UPDATE`/`DELETE` to `channel-assets/{channelId}/*` only when `EXISTS (SELECT 1 FROM channels WHERE channels.id::text = (storage.foldername(name))[2] AND channels.user_id = auth.uid())`. Allow `SELECT` to anyone (logos render into public videos anyway).

After each migration, regenerate [`src/lib/supabase/types.ts`](../../src/lib/supabase/types.ts).

### New worker RPCs (SECURITY DEFINER)

- `worker_create_default_channel_for_user(p_user_id)` — idempotent; returns channel id.
- `worker_update_channel_youtube_meta(p_channel_id, p_meta JSONB)` — for the YouTube fetch background job.
- `worker_persist_topic_suggestions(p_channel_id, p_rows JSONB)` — for AI-suggested topics insertion.

## UX changes

### Dashboard

- Top-nav: channel switcher dropdown (Notion-style). Shows logo + name + project count badge. "Manage channels" link at bottom.
- Active channel filters the project grid; "All channels" view shows everything with a channel pill badge per card.
- "New Video" button creates a project on the active channel; modal shows "Creating on **{channel name}**" + "Use last video's settings" toggle (default on).

### `/channels/[id]/settings` (new page)

Tabs:
1. **Identity** — name, slug, logo upload, thumbnail-template upload.
2. **AI Context** — niche, target language, target audience, tone (free-text inputs with examples).
3. **YouTube** — `@handle` input with "Verify" button (calls Public Data API, populates name/subs/avatar preview). Shows top 10 video performers when linked.
4. **Defaults** — template / aspect ratio / quality / music / voiceover preference / captions / transitions / motion / animation — exact same controls as the wizard but persisted on the channel.
5. **Watermark** — corner picker (TL/TR/BL/BR/None) + opacity slider; preview pane showing logo overlaid on a sample frame.
6. **Subject Memory** — lookback count slider (1–50, default 5) + button "Clear subject memory for this channel" with confirm.
7. **Scene Presets** — list of named presets with rename/delete; new presets are added from the wizard via "Save current setup as preset".
8. **Topic Backlog** — list with status filter, "Add idea" button, "Suggest topics" button (calls AI), "Use this idea" jumps to wizard with prefilled topic.
9. **Danger Zone** — delete channel (blocked if videos exist with clear count; explicit "Force delete + cascade" path).

### Channel cascade delete mechanics

`projects.channel_id` is `ON DELETE RESTRICT` (intentional — we never want a silent cascade). The "Force delete + cascade" path in `DELETE /api/channels/[id]?force=true` is implemented as:

```
1. Verify ownership (auth.uid() = channels.user_id) — else 403.
2. SELECT id FROM projects WHERE channel_id = $1 — load child project ids.
3. For each project id:
     a. Call the existing project-delete pipeline (reuses
        `src/lib/projects/delete-project-assets.ts` + scenes cascade
        + video_subjects cascade + storage cleanup + local-render
        cleanup).
     b. On per-project failure, push to a `partial_failures[]` array
        and continue (don't abort the whole cascade).
4. After loop: if `partial_failures.length === 0`, DELETE channels row.
   Otherwise, return 207 with `{ deleted: N, failed: partial_failures }`
   and leave the channel row intact for the user to retry.
5. After channel row deletion, remove `channel-assets/{channelId}/` storage
   prefix and any remaining `public/local_renders/{channelId}/` directory.
```

This reuses the per-project cleanup code path verbatim — no duplicated cleanup logic.

### Active-channel selection contract

The dashboard's channel switcher is **UI-only state**. `useActiveChannel()` reads/writes URL `?channel=` + localStorage, but **every server-mutating request that depends on channel sends `channelId` explicitly in the request body**. The server validates ownership (`channels.user_id = auth.uid()`) before acting.

- `POST /api/projects` — body includes `{ channelId, copyLastSettings: boolean }`. Server fetches active channel, copies most-recent settings if requested, inserts project with that `channel_id`.
- All `/api/channels/[id]/*` routes derive channel from the path param.
- `/api/wizard/*` routes derive channel from `projects.channel_id` (looked up via `projectId` in the URL/body).

This eliminates cross-tab races: two tabs viewing different channels can each call "New Video" and each request lands deterministically on the channel its tab declared.

### Wizard

- No new step. `TemplateStep` shows the active channel name as a small badge top-right ("for **My Channel**") so the user always knows the context.
- "Save current setup as preset" button in `RenderStep` opens a name-prompt modal and writes to `channel_scene_presets`.
- `PreviewStep` watermark preview overlays the channel logo according to channel watermark settings.

## AI pipeline changes

### `src/lib/ai/prompts.ts`

Every prompt builder gains a `channelContext` parameter:

```ts
type ChannelContext = {
  niche?: string;
  targetLanguage?: string;
  targetAudience?: string;
  tone?: string;
};
```

A new `buildChannelContextPreamble(ctx: ChannelContext): string` helper produces an injectable block:

```
You are writing video content for a YouTube channel with the following identity:
- Niche: {niche}
- Target language: {targetLanguage}
- Target audience: {targetAudience}
- Tone: {tone}
Match this identity in word choice, structure, and pacing.
```

Empty fields are skipped. The preamble is prepended to existing system prompts in idea, enhance-idea, validate-trend, generate-structure, generate-seo, and script builders.

### `src/lib/ai/wizard.ts` + every `/api/wizard/*` route

Each route fetches the project's `channel_id`, joins to load the channel row, and passes `channelContext` to the prompt builder. Cached per-request via a small helper `getChannelForProject(supabase, projectId)` in `src/lib/channels/repository.ts`.

### Inngest worker (`generateVideo` in [src/lib/inngest/functions.ts](../../src/lib/inngest/functions.ts))

A new **`fetch-channel`** step is added at the top of the function:

```
Step 0: fetch-channel
  - SELECT channels.* FROM channels
    JOIN projects ON projects.channel_id = channels.id
    WHERE projects.id = $projectId
  - Returns: { channelId, niche, language, audience, tone,
               watermark: { logoUrl, position, opacity } }
  - Step-isolated → retryable independently
  - Event payload stays lean (just settings); channel data fetched once
```

Subsequent steps (`generate-script`, `fetch-assets`, `render-video`, `persist-subject-memory`) read `channel` from the step's return value. `render-video` passes `watermark` and `channelId` into `renderVideo()`. `persist-subject-memory` writes `channel_id` instead of `user_id`.

### `src/lib/ai/subject-memory.ts`

`getExcludedSubjectsForUser` is renamed to `getExcludedSubjectsForChannel(channelId, idea)`:

```ts
// Query becomes:
SELECT s.subject_key
FROM video_subjects s
JOIN projects p ON p.id = s.project_id
WHERE s.channel_id = $1
  AND p.status = 'completed'
ORDER BY s.created_at DESC
LIMIT (SELECT subject_memory_lookback FROM channels WHERE id = $1) * AVG_SUBJECTS_PER_PROJECT
```

The query is restructured to fetch from the channel's last N **completed projects** (N from `channels.subject_memory_lookback`, default 5), then dedupe and embed-rank as today.

`persistSubjectsForProject` is updated to also include `channel_id` in the inserted rows. `user_id` is no longer written — `video_subjects` has no `user_id` column after migration 3.

## YouTube Public Data API integration

### New module: `src/lib/youtube/public-api.ts`

```ts
export async function resolveHandleToChannelId(handle: string): Promise<string>
export async function fetchChannelSnippet(channelId: string): Promise<ChannelSnippet>
export async function fetchTopVideos(channelId: string, limit: number): Promise<VideoStats[]>
```

- API key from `YOUTUBE_API_KEY` env var.
- Endpoints used (all v3, public, key-only auth):
  - `channels?part=snippet,statistics,contentDetails&forHandle={handle}` — 1 quota unit.
  - `playlistItems?part=contentDetails&playlistId={uploadsPlaylistId}` — 1 unit per page.
  - `videos?part=statistics,snippet&id={ids}` — 1 unit per 50 videos.
- Cached in `channels.youtube_meta` with `fetched_at` timestamp; refresh only if older than 24h or user clicks "Refresh".
- **Settings-page load always serves the cached value immediately** (no inline blocking fetch). If `fetched_at` is missing or stale, a background `fetch()` to `/api/channels/[id]/youtube/refresh` runs in parallel and shows a "Refreshing…" badge until it returns. This keeps the page interactive even if YouTube is slow or down.
- Failures are surfaced via toast; topic suggestions degrade gracefully to content-based (no performance ranking).

### Topic suggestion route: `/api/channels/[id]/suggest-topics`

```
Input: channel_id, count (default 10)
1. Fetch channel row (niche, language, audience, tone).
2. Fetch youtube_meta — top videos capped at 10 (by views).
3. Fetch excluded subjects from subject-memory — capped at 50.
4. Truncate channelContext fields: niche/language/audience/tone each ≤ 200 chars.
5. Build Gemini prompt:
   - channelContext preamble
   - "Top-performing videos on this channel: {list of 10}"
   - "Excluded subjects (don't suggest these): {list of 50}"
   - "Generate {count} new video ideas that fit this channel's audience."
   - Each idea: { idea_text, ai_reasoning, inspired_by_video_id? }
6. Zod-validate response.
7. Optionally persist to channel_topic_ideas (auto-save toggle).
```

Input caps keep the prompt bounded regardless of how many videos the channel has or how long a subject memory grows.

## Watermark rendering in Remotion

### `src/remotion/VideoComposition.tsx` and three scene components

A new `Watermark` component:

```tsx
type WatermarkProps = {
  logoUrl?: string;
  position: 'tl' | 'tr' | 'bl' | 'br' | 'none';
  opacity: number;
};

export function Watermark({ logoUrl, position, opacity }: WatermarkProps) {
  if (!logoUrl || position === 'none') return null;
  const style = { /* position absolute, opacity, ~10% width, padding */ };
  return <Img src={logoUrl} style={style} />;
}
```

Mounted at the **composition root above all `<Sequence>` children** (single `<Img>` for the whole composition, not per-scene). Logo image is preloaded via Remotion's `delayRender()` / `continueRender()` so the first frame isn't blank when `logoUrl` is remote:

```tsx
const [handle] = useState(() => delayRender('watermark-logo-load'));
useEffect(() => {
  if (!logoUrl) { continueRender(handle); return; }
  const img = new Image();
  img.onload = () => continueRender(handle);
  img.onerror = () => continueRender(handle); // fail-soft: render without watermark
  img.src = logoUrl;
}, [logoUrl, handle]);
```

If preload fails (404/timeout), the render proceeds without the watermark rather than blocking — the channel may have had its logo deleted between dispatch and render. This is a logged warning, not a render failure.

The Inngest worker reads the channel row (via the new `fetch-channel` step) and passes `watermark` into `RenderInput` and on to Remotion `inputProps`. Default values for the backfilled "My Channel" force `position='none'` so existing user videos are unchanged.

## Local render path namespacing

Three files change:

- [`src/lib/render/render-video.ts`](../../src/lib/render/render-video.ts) line ~286: output dir becomes `public/local_renders/{channelId}/`; `mkdir recursive: true` already covers the new shape. URL becomes `${baseUrl}/local_renders/{channelId}/{projectId}.mp4`.
- [`src/lib/projects/delete-project-assets.ts`](../../src/lib/projects/delete-project-assets.ts) line ~128: `removeLocalRenderPublic` accepts `channelId`, tries the channel-scoped path first, falls back to legacy `public/local_renders/{projectId}.mp4` when the file is absent. Both paths are attempted on best-effort basis with warnings on failure.
- [`src/app/wizard/[id]/steps/RenderStep.tsx`](../../src/app/wizard/[id]/steps/RenderStep.tsx) lines 115, 247: the user-visible "Stored locally at …" label reflects the new path (needs `channelId` in scope — pull from store).

[`.gitignore`](../../.gitignore) already wildcard-ignores `/public/local_renders`, so per-channel subdirs are automatically excluded.

## Files to modify (Critical existing code)

- [`src/lib/ai/subject-memory.ts`](../../src/lib/ai/subject-memory.ts) — function rename + channel-scoped query.
- [`src/lib/ai/prompts.ts`](../../src/lib/ai/prompts.ts) — every prompt builder accepts `channelContext`.
- [`src/lib/ai/wizard.ts`](../../src/lib/ai/wizard.ts) + every `src/app/api/wizard/*` route — fetch channel, pass channelContext.
- [`src/components/dashboard.tsx`](../../src/components/dashboard.tsx) — channel switcher; `handleCreate` reads active channel + clones last project's settings.
- [`src/components/dashboard/create-modal.tsx`](../../src/components/dashboard/create-modal.tsx) — "Creating on channel X" badge + "Use last settings" toggle.
- [`src/remotion/VideoComposition.tsx`](../../src/remotion/VideoComposition.tsx) + 3 scene components — accept and render `watermark` prop.
- [`src/lib/inngest/functions.ts`](../../src/lib/inngest/functions.ts) — pass `watermark` + `channelContext` + `channelId` into render manifest.
- [`src/lib/render/render-video.ts`](../../src/lib/render/render-video.ts) + [`src/lib/projects/delete-project-assets.ts`](../../src/lib/projects/delete-project-assets.ts) + [`src/app/wizard/[id]/steps/RenderStep.tsx`](../../src/app/wizard/[id]/steps/RenderStep.tsx) — channel-namespaced local render path.
- [`src/lib/supabase/types.ts`](../../src/lib/supabase/types.ts) — regenerated after each migration.

## New files

- `supabase/migrations/2026MMDDHHMMSS_*.sql` (×5)
- `src/lib/channels/` — `repository.ts` (CRUD helpers used by API + worker), `defaults.ts` (settings copy logic), `types.ts`.
- `src/lib/youtube/public-api.ts` + `src/lib/youtube/types.ts`.
- `src/app/api/channels/route.ts` (GET list, POST create)
- `src/app/api/channels/[id]/route.ts` (GET, PATCH, DELETE)
- `src/app/api/channels/[id]/upload-logo/route.ts`
- `src/app/api/channels/[id]/upload-thumbnail/route.ts`
- `src/app/api/channels/[id]/topic-ideas/route.ts` (GET, POST)
- `src/app/api/channels/[id]/suggest-topics/route.ts`
- `src/app/api/channels/[id]/scene-presets/route.ts` (GET, POST)
- `src/app/api/channels/[id]/scene-presets/[presetId]/route.ts` (DELETE)
- `src/app/api/channels/[id]/youtube/refresh/route.ts`
- `src/app/channels/page.tsx` (list view)
- `src/app/channels/[id]/settings/page.tsx`
- `src/components/channel-switcher.tsx` (top-nav dropdown)
- `src/components/channel-settings/` (tab components per section)
- `src/components/wizard/save-preset-button.tsx`
- `src/components/wizard/apply-preset-button.tsx`
- `src/lib/hooks/use-active-channel.ts`
- `src/remotion/Watermark.tsx`
- `src/__tests__/` files mirroring the structure above.

## Story breakdown (20 stories, 5 phases)

### Phase A — Schema & backfill (DB-only, deployable independently)
- **25.1** `channels` table migration + RLS + worker RPCs.
- **25.2** `projects.channel_id` migration (add nullable → backfill via RPC → SET NOT NULL).
- **25.3** `video_subjects.channel_id` migration + backfill.
- **25.4** `channel_topic_ideas` + `channel_scene_presets` migrations.
- **25.5** Regenerate `src/lib/supabase/types.ts`.

### Phase B — Channel API + UI hub + infra
- **25.6** Channel CRUD API routes (block delete when projects exist; `?force=true` cascade using existing per-project delete pipeline).
- **25.7** Channel logo + thumbnail-template upload routes (5MB, `image/png|jpeg|webp`); 6th migration for channel-assets Storage RLS policies.
- **25.8** Channel-namespaced local render output (`render-video.ts`, `delete-project-assets.ts`, `RenderStep.tsx`) — moved here from Phase D because it's operational infra, not a feature.
- **25.9** Dashboard channel switcher + `useActiveChannel` hook (URL/localStorage UI-only; channelId in POST body contract).
- **25.10** `/channels/[id]/settings` page with all 9 tabs.

### Phase C — AI context + subject memory + copy-last-settings
- **25.11** Channel-scoped subject memory (`getExcludedSubjectsForChannel`); replace `user_id` writes with `channel_id` in `persistSubjectsForProject`.
- **25.12** Thread `channelContext` through every prompt builder + route via shared `getChannelContextForProject` helper.
- **25.13** Copy-last-settings on new project creation + UI toggle; Zod-validated read of `default_settings` JSONB at boundary.
- **25.14** Inngest worker: add `fetch-channel` step; pass `watermark` + channel data through render manifest.

### Phase D — YouTube + Topic backlog + Scene presets + Watermark
- **25.15** YouTube Public Data API client + 24h cache; settings-page serves cached value with background refresh.
- **25.16** Topic backlog UI + `/api/channels/[id]/suggest-topics` route (input caps: 10 top videos, 50 exclusions, channelContext fields ≤200 chars).
- **25.17** Scene preset library UI + save/apply actions in wizard.
- **25.18** Watermark rendering in Remotion (`Watermark.tsx` at composition root with `delayRender` preload + fail-soft on missing image).

### Phase E — Tests + docs
- **25.19** Tests (channel CRUD + RLS, channel cascade-delete partial-failure, subject-memory scoping, copy-last-settings, watermark with missing-logo path, YouTube API mocked, topic suggestion flow, RPC backfill correctness, channel-namespaced local render with legacy fallback, migration race-window prevention via transaction, cross-tab active-channel contract).
- **25.20** Docs (AGENTS.md folder convention + new `lib/channels/`, `lib/youtube/`, `lib/hooks/use-active-channel.ts`; prd_backlog.md Epic 25 stories; database_schema.md; project_spec.md; CHANGELOG.md; TODOS.md deferred items; new ADR `docs/adr/003-channel-scoped-subject-memory.md` superseding ADR-002's user-scoped query).

## Critical decisions / one-way doors

- **Default channel naming = "My Channel"** (per-user backfill). Two-way door (renameable).
- **Subject memory default lookback = 5.** Two-way door.
- **`projects.channel_id` NOT NULL** after backfill. One-way door (acceptable; product requires it).
- **`YOUTUBE_API_KEY` env var** introduced. Two-way door.
- **Watermark default off** for backfilled channels, **on** (`br`, opacity 0.7) for new channels. Two-way door.
- **Legacy local renders not migrated.** Pre-Epic-25 files stay at `public/local_renders/{projectId}.mp4`; cleanup tries both paths. Safe because `/public/local_renders/` is `.gitignored` and Lambda is the production default. Two-way door.

## Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration races: existing users with no projects vs. projects without users | Low | Medium | Idempotent RPC; backfill in deterministic order (users by id) |
| Adding NOT NULL on `projects.channel_id` fails if any row is unassigned | Medium | High | 3-step migration with explicit verification gate between steps; abort cleanly on remaining nulls |
| YouTube API quota exhaustion | Low | Low | 24h cache + per-request rate limit; degrade to no-performance suggestions |
| Watermark on 100-scene videos causes memory pressure in Remotion | Low | Medium | Single `<Img>` at composition root, not per-scene; verify with 60-scene render |
| RLS bypass via channel manipulation (user A reads user B's channel by id) | Medium | High | RLS policy: `auth.uid() = user_id` on every channel-derived table; test in 25.18 |
| Existing tests assume user-only ownership | High | Low | New channel-scoped RLS tests in 25.18; regenerate existing fixtures |
| Local-render cleanup misses legacy files after migration | Medium | Low | Cleanup tries both paths; warn (not error) on miss |
| Subject memory scope change hides real cross-channel collisions | Low | Low | Per-channel `subject_memory_lookback` allows tuning; document in docs/adr/003 |

## Acceptance criteria (whole epic)

1. Existing users sign in and see all old projects under a backfilled "My Channel"; no data lost.
2. User can create a second channel "Tech Facts" with logo + niche="tech educational" + language="en" + audience="curious adults 25–44" + tone="energetic" + YouTube handle `@example`.
3. Switching the dashboard switcher to "Tech Facts" filters projects and pre-targets new projects.
4. New project on "Tech Facts" auto-inherits the last "Tech Facts" video's full settings.
5. AI script for a "Tech Facts" video reflects the channel's niche/language/audience/tone in word choice.
6. Subject memory excludes the last 5 completed "Tech Facts" subjects but allows the same on a different channel.
7. Linked YouTube channel surfaces top performers; "Suggest topics" returns ranked ideas combining performance + channel context + exclusions.
8. Rendered videos on "Tech Facts" show the logo as a watermark at bottom-right, 0.7 opacity.
9. Saving the current wizard setup as a named preset and applying it on a future project restores all settings.
10. Deleting "Tech Facts" while it has videos returns a clear error with a "Force delete + cascade" confirm dialog.
11. With `RENDER_BACKEND=local`, a "Tech Facts" video writes to `public/local_renders/{techFactsChannelId}/{projectId}.mp4`; a sibling channel's renders live in a separate subdirectory; deletion cleans both new-path and legacy-flat-path files.

## Feature preservation checklist (must not break)

- **Wizard 6-step flow** (template → idea → refine → script → preview → render) — channel only changes what data feeds into each step, not the steps themselves.
- **Draft saving/resuming** (Epic 6.2) — `draft_scenes` JSON shape unchanged.
- **Scene editing** (Epic 10) — unchanged.
- **Multiple asset candidates** (Epic 17) — unchanged.
- **Video config settings** (Epic 12) — preserved; channel just provides defaults.
- **Background music** (Epic 13) — preserved; channel provides default music ID.
- **Voiceover upload** (Epic 16) — preserved; stored at storage path unchanged.
- **Auth + rate limiting** (Epics 8, 15) — preserved; channel CRUD uses `withAuth()` wrapper.
- **Inngest worker pipeline** (Epic 4) — preserved; worker just gains channel context.
- **Subject de-duplication** (ADR-002) — preserved; query rebased on channel.
- **Aspect ratio + quality propagation** (Epic 19) — preserved; channel provides defaults.
- **Scene scale 3–120 with chunked AI generation** (Epic 24) — preserved; channelContext flows through chunked prompts.
- **Local render fallback** (`RENDER_BACKEND=local`) — preserved; output path namespaced per channel; cleanup handles both legacy and new shapes.

## Verification

1. **Migration replay on a copy of staging:** run all 5 migrations top-to-bottom on a database snapshot; assert every project has a channel, every video_subjects row has a channel, no row counts changed.
2. **Channel CRUD + RLS:** automated tests in 25.18 covering user A trying to read/write user B's channel.
3. **Subject memory regression:** load fixtures for two channels per user; assert exclusion list for a new project on channel A doesn't include subjects from channel B.
4. **AI prompt golden snapshots:** capture prompt bodies before/after for a fixture channel; assert channelContext preamble is present with all fields.
5. **YouTube API client:** unit tests with mocked fetch responses for handle resolution, channel snippet, top videos; cache TTL behavior.
6. **Watermark rendering:** Remotion preview test renders a 3-scene video with watermark at every corner + opacity; visual diff against snapshot.
7. **Topic suggestions:** end-to-end test with mocked YouTube + mocked Gemini → assert ranked output respects exclusions.
8. **Scene preset:** save preset → create new project → apply preset → assert all settings match.
9. **Local render namespacing:** unit test for `render-video.ts` path resolution + `delete-project-assets.ts` legacy-fallback path; manual local render verification.
10. **Full flow per channel** (smoke): create channel "A" + "B" → generate one video on each → verify watermark differs per channel + subjects are channel-scoped.

## Resolved during eng review (2026-05-13)

- **`channels.default_settings` includes scene_count and scene_duration** — full prefill per user ask.
- **YouTube fetch on "Verify" click is synchronous with 5s timeout** then cached; "Refresh" button re-fetches. Inngest is overkill for a 1s API call. Settings-page load uses background refresh (no inline blocking).
- **`video_subjects.user_id` is DROPPED** in migration 3 once `channel_id` is verified populated. `channel_id` is the single source of truth — boil the lake.
- **Channel cascade-delete reuses the per-project delete pipeline** in a loop; partial failures return 207 and leave the channel row intact for retry.
- **No `user_id` denormalization on `channel_topic_ideas` or `channel_scene_presets`** — RLS via `EXISTS` subquery on `channels`.
- **Migrations 2 and 3 run inside a single transaction** with explicit verification gates and an exclusive table lock; race-window NULL rows cannot leak.
- **Channel-asset Storage RLS gets its own migration** (file #6) — authenticated users can write to `channel-assets/{channelId}/*` only when they own the channel.
- **Watermark logo preloads via Remotion `delayRender`/`continueRender`** at the composition root, single `<Img>` above all sequences; fail-soft if image is missing at render time.
- **Active-channel state contract:** UI uses URL+localStorage; every server-mutating request sends `channelId` in body explicitly. Cross-tab races eliminated.
- **AI suggest-topics input caps:** top videos = 10, exclusions = 50, channelContext fields ≤ 200 chars each.

## ADRs created with this epic

- **ADR 003 — Channel-scoped subject memory** supersedes ADR-002 (which described user-scoped memory across the last 10 completed projects). The new design keeps the hybrid in-video / cross-video strategy but scopes the cross-video horizon to the channel.
