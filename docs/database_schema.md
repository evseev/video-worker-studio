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
| `selected_template` | `text` | Nullable | The ID of the video template chosen (e.g., `'slideshow'`, `'split'`) |
| `wizard_step` | `text` | Nullable | Current wizard step state |
| `draft_scenes` | `jsonb` | Nullable | Draft scene payload while editing in wizard |
| `trend_validation_data` | `jsonb` | Nullable | Stored trend-validation response metadata |
| `render_error_context` | `jsonb` | Nullable | Structured render failure context |
| `created_at` | `timestamptz` | Default `now()` | Timestamp |
| `updated_at` | `timestamptz` | Default `now()` | Timestamp |

## 3. `scenes`
Represents the individual blocks of a video timeline.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, Default `uuid_generate_v4()` | Unique identifier |
| `project_id` | `uuid` | FK to `projects(id)` | Parent project |
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
