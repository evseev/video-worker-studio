# Database Schema (Scope Reduced MVP)

The system relies on Supabase PostgreSQL for persistent storage.

## 1. `users` (managed by Supabase Auth)
Supabase handles the core `auth.users` table.

## 2. `projects`
Tracks the global state of a video generation request.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, Default `uuid_generate_v4()` | Unique identifier |
| `user_id` | `uuid` | FK to `auth.users(id)` | Owner of the project |
| `channel_id` | `uuid` | FK to `channels(id)` **ON DELETE RESTRICT** | Editorial channel; required after Epic 25 backfill |
| `topic` | `text` | Not Null | The user's input prompt |
| `status` | `text` | Not Null, Default `'draft'`| Enum: `'draft'`, `'processing'`, `'rendering'`, `'completed'`, `'failed_ai'`, `'failed_render'` |
| `video_url` | `text` | Nullable | Public URL of the final rendered MP4 |
| `selected_template` | `text` | Nullable | The ID of the video template chosen (`'slideshow'`, `'comparison'`, `'fact-card'`) |
| `wizard_step` | `text` | Nullable | Current wizard step state |
| `draft_scenes` | `jsonb` | Nullable | Draft scene payload while editing in wizard |
| `trend_validation_data` | `jsonb` | Nullable | Stored trend-validation response metadata |
| `render_error_context` | `jsonb` | Nullable | Structured render failure context |
| `aspect_ratio` | `text` | Not Null, Default `'9:16'`, CHECK `IN ('9:16','16:9')` | Video aspect ratio (portrait or landscape) |
| `video_quality` | `text` | Not Null, Default `'1080p'`, CHECK `IN ('720p','1080p','4k')` | Render quality |
| `background_music` | `text` | Nullable | Selected music preset ID (e.g., `'upbeat'`, `'chill'`) or null for no music |
| `caption_style` | `text` | Nullable, CHECK `IN ('minimal','bold','strip','split','glowing')` | Caption style preset (comparison template) |
| `comparison_overlay_mode` | `text` | Not Null, Default `'both'`, CHECK `IN ('labels','caption','both')` | Comparison template: show labels, bottom caption, or both |
| `voiceover_url` | `text` | Nullable | URL to user-uploaded voice-over audio (MP3/WAV) in Supabase Storage |
| `video_description` | `text` | Nullable | AI-generated SEO-optimized YouTube video description |
| `video_tags` | `text` | Nullable | Comma-separated YouTube tags for discoverability |
| `scene_transition` | `text` | Not Null, Default `'fade'`, CHECK `IN ('fade','slide','wipe','flip','clock-wipe','random')` | Scene transition effect between scenes |
| `image_motion` | `text` | Not Null, Default `'zoom-in'`, CHECK `IN ('zoom-in','zoom-out','pan-left','pan-right','pan-up','pan-down','pan-horizontal','pan-vertical','none','random')` | Image motion effect within scenes |
| `text_animation` | `text` | Not Null, Default `'slide-up'`, CHECK `IN ('slide-up','slide-left','typewriter','pop','fade-in','random')` | Text/caption entry animation |
| `created_at` | `timestamptz` | Default `now()` | Timestamp |
| `updated_at` | `timestamptz` | Default `now()` | Timestamp |

## 2b. `channels` (Epic 25)

Per-user editorial workspaces. RLS: all CRUD where `user_id = auth.uid()`.

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK `auth.users` |
| `name`, `slug` | `text` | Display name + unique slug per user |
| `niche`, `target_language`, `target_audience`, `tone` | `text` | AI / wizard **channelContext** |
| `youtube_handle`, `youtube_channel_id` | `text` | Linked public channel |
| `youtube_meta` | `jsonb` | Cached snapshot (`fetched_at`, `top_videos`, optional `error`); 24h freshness enforced in app (`isYoutubeMetaFresh`) |
| `default_settings` | `jsonb` | Channel defaults / last snapshot (validated with Zod at write boundary) |
| `subject_memory_lookback` | `int` | How many completed projects on the channel feed cross-video exclusions |
| `watermark_position`, `watermark_opacity` | text / numeric | Remotion overlay |
| `logo_url`, `thumbnail_template_url` | `text` | URLs under `channel-assets` |

## 2c. `channel_topic_ideas` & `channel_scene_presets`

Topic backlog and named wizard preset rows keyed by `channel_id`. RLS uses ownership through `channels` (typically `EXISTS` subquery); no denormalized `user_id` on these tables.

## 3. `scenes`
Represents the individual blocks of a video timeline.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, Default `uuid_generate_v4()` | Unique identifier |
| `project_id` | `uuid` | FK to `projects(id)` **ON DELETE CASCADE** | Parent project |
| `sequence_order` | `int` | Not Null | 0-indexed position in the timeline |
| `script_text` | `text` | Not Null | The caption/voiceover text for this scene |
| `search_keywords` | `text` | Not Null | The query used to fetch the background asset |
| `asset_url` | `text` | Nullable | The Pinterest image URL (fetched by the worker) |
| `created_at` | `timestamptz` | Default `now()` | Timestamp |

## 4. `video_subjects` (subject memory)

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `channel_id` | `uuid` | FK to `channels` — cross-video memory is **channel-scoped** (ADR 003) |
| `project_id` | `uuid` | FK to `projects` |
| `subject_key` / `subject_normalized` | `text` | Dedupe identity |
| `embedding` | `vector` (optional) | Similarity ranking for exclusions |
| `created_at` | `timestamptz` | |

## 5. Worker RPC Functions

The background worker updates data through SECURITY DEFINER RPC functions:

- `worker_insert_scenes(p_project_id, p_scenes)`
- `worker_update_project_status(p_project_id, p_status, p_video_url)`
- `worker_update_project_error(p_project_id, p_error_context)`
- `worker_insert_video_subjects(p_channel_id, p_project_id, p_rows)` — subject rows for channel-scoped memory
- `worker_create_default_channel_for_user(p_user_id)` — idempotent `"My Channel"` backfill
- `worker_update_channel_youtube_meta(p_channel_id, p_meta)` — worker/service updates to cached YouTube JSON

### Migration / backfill (Epic 25)

`projects.channel_id` backfill and related steps run in **SQL transactions** with `EXCLUSIVE` lock on `projects` and verification gates between phases so orphan NULL `channel_id` rows cannot leak before `NOT NULL` + FK. Full replay is validated against a **database snapshot** in staging (see design doc verification); there is no lightweight in-repo integration test for that race window.

## 6. Storage

- **`renders`** — Lambda / uploaded final MP4s (existing).
- **`channel-assets`** — `{channelId}/*` logos and thumbnails; RLS policies restrict writes to the channel owner (see migration `20260513140500_channel_assets_storage_rls.sql`).

## Row Level Security (RLS)

All tables must have RLS enabled.
*   **Projects/Scenes**: Users can only access rows where `user_id = auth.uid()`.
*   **Channels** and channel-derived rows (`channel_topic_ideas`, `channel_scene_presets`, `video_subjects`): Policies tie access to owning `channels.user_id = auth.uid()` (or equivalent `EXISTS` on `channels`).
*   Workers (Inngest) use SECURITY DEFINER RPC functions to bypass RLS for background updates (for example setting `video_url`, inserting scenes, inserting `video_subjects`).

## Application deletes

Deleting a project from the app (`DELETE /api/projects/[id]`, authenticated, owner-only) removes the `projects` row. Child `scenes` rows are removed via **ON DELETE CASCADE** on `scenes.project_id`. The route handler also attempts to delete the rendered MP4 in Supabase Storage (when the URL matches the expected shape) and to remove local temp assets under `TMP_ASSETS_PATH`; failures there are surfaced as warnings but do not block row deletion.

**Channel delete:** `DELETE /api/channels/[id]` with `?force=true` walks projects via `forceDeleteChannelCascade`; partial failures return **207** and leave the channel row for retry. Empty channels run `deleteEmptyChannelWithArtifacts` (storage prefix + local render subdir + row).
