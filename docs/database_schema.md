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

## 4. Worker RPC Functions

The background worker updates data through SECURITY DEFINER RPC functions:

- `worker_insert_scenes(p_project_id, p_scenes)`
- `worker_update_project_status(p_project_id, p_status, p_video_url)`
- `worker_update_project_error(p_project_id, p_error_context)`

---

## Row Level Security (RLS)

All tables must have RLS enabled.
*   **Projects/Scenes/Settings**: Users can only `SELECT`, `INSERT`, `UPDATE`, or `DELETE` rows where `user_id = auth.uid()`.
*   Workers (Inngest) use SECURITY DEFINER RPC functions to bypass RLS for background updates (for example setting `video_url` and `render_error_context`).

## Application deletes

Deleting a project from the app (`DELETE /api/projects/[id]`, authenticated, owner-only) removes the `projects` row. Child `scenes` rows are removed via **ON DELETE CASCADE** on `scenes.project_id`. The route handler also attempts to delete the rendered MP4 in Supabase Storage (when the URL matches the expected shape) and to remove local temp assets under `TMP_ASSETS_PATH`; failures there are surfaced as warnings but do not block row deletion.
