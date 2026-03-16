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
| `status` | `text` | Not Null, Default `'processing'`| Enum: `'processing'`, `'rendering'`, `'completed'`, `'failed_ai'`, `'failed_render'` |
| `video_url` | `text` | Nullable | S3/Cloudfront URL of the final rendered MP4 |
| `created_at` | `timestamptz` | Default `now()` | Timestamp |

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

## 4. `user_settings`
Optional table for future credit balances or profile preferences.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `user_id` | `uuid` | PK, FK to `auth.users(id)` | The user |
| `credits` | `int` | Default `10` | For rate-limiting or billing |

---

## Row Level Security (RLS)

All tables must have RLS enabled.
*   **Projects/Scenes/Settings**: Users can only `SELECT`, `INSERT`, `UPDATE`, or `DELETE` rows where `user_id = auth.uid()`.
*   Workers (Inngest) will use the `service_role` key to bypass RLS for background updates (e.g. setting the `video_url`).
