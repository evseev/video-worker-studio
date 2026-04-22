# Screen-by-Screen UX Specification

This document details the layout, state requirements, and primary user interactions for the current MVP of Video Worker Studio.

---

## 1. Login / Landing Screen
**Purpose:** Entry point for creators.
*   **Layout:** Simple, centered login card with a compelling headline.
*   **Components:** 
    *   Email/Password input field or OAuth buttons.
*   **Interactions:** User logs in and is redirected to the Dashboard.

## 2. Dashboard (`/`)
**Purpose:** View past projects, check statuses, start new ones, and delete projects.
*   **Layout:** Top nav (branding, email, sign out). Main area: heading, project count, **New Video** button, and a responsive grid of project cards.
*   **Components:**
    *   **New Video:** Opens a modal with a topic textarea and video settings (scene count, scene duration, aspect ratio, quality); submitting creates a `draft` project with settings stored in `draft_scenes` JSONB and navigates to `/wizard/[id]?step=idea`.
    *   **Project Grid:** Cards show topic, status badge (`draft`, `processing`, `rendering`, `completed`, `failed_ai`, `failed_render`), created date, and a delete (trash) control.
    *   **Auto-refresh:** While any visible project is `draft`, `processing`, or `rendering`, the dashboard refreshes on an interval so status updates without a manual reload.
*   **Interactions:**
    *   Click a **draft** card → `/wizard/[id]` at the saved `wizard_step`.
    *   Click a **completed** card → `/wizard/[id]?step=render` to view the in-app video player with download option.
    *   Delete → confirm modal → `DELETE /api/projects/[id]`; optional warnings if storage/temp cleanup partially fails.

## 3. Interactive Wizard (`/wizard/[id]`)
**Purpose:** A 6-step guided flow: choose template and settings, then refine a topic, enhance the idea, generate a template-aware script, preview/edit scenes, and render the final video.
*   **Layout:** Full-width layout with sticky header (back to home, topic title, step progress: **Template** → **Idea** → **Refine** → **Script** → **Preview** → **Render**). URL query `?step=` tracks the active step. State is managed via a Zustand store initialized from the project's `draft_scenes` JSONB.

### Step: Idea
*   **Components:** Topic input; video settings (scene count, duration, aspect ratio, quality); optional **Generate Hooks** (AI-suggested angles) from `/api/wizard/ideas`.
*   **Interactions:** Continue saves `topic`, settings, and `wizard_step` via `/api/wizard/draft` and moves to Refine.

### Step: Refine
*   **Components:** Editable concept textarea; optional **Target Keywords** text input for YouTube SEO (keywords the user wants to rank for); **Enhance with AI** button (`/api/wizard/enhance-idea`) returns 3 refined concepts as selectable cards; selecting a concept auto-triggers **Trend Validation** (`/api/wizard/validate-trend`) showing a 0-100 trend score, reasoning, and suggested hooks.
*   **Interactions:** Continue saves refined idea data (including target keywords) and advances to Script.

### Step: Script
*   **Components:** Template selection grid (5 Remotion templates: Slideshow, Fact Card, Compilation, Comparison, Evolution) with SVG layout previews that adapt to the selected aspect ratio (portrait 9:16 or landscape 16:9); **Generate Script with AI** button (`/api/wizard/generate-structure`) generates template-aware scenes with orientation-appropriate search keywords; editable scene list with search keywords and script text per scene; collapsible **YouTube Metadata** section (auto-generated after scenes via `/api/wizard/generate-seo`) with editable video description (200-300 words with hashtags), tag pills with add/remove, and **Regenerate Metadata** button.
*   **Interactions:** Continue saves `draft_scenes`, `selected_template`, `video_description`, and `video_tags` and advances to Preview.

### Step: Preview
*   **Components:** Scene list with drag-and-drop reorder, per-scene image thumbnails (sized to match aspect ratio: portrait `w-20 h-28` or landscape `w-28 h-20`), editable script text and search keywords, per-scene **Re-fetch** button, scene delete, **Fetch All Images** bulk action (`/api/wizard/fetch-assets` with orientation hints), collapsible global settings panel (read-only: template, aspect ratio, quality, duration). For the **Comparison** template only: **Caption style** (five presets with mini-previews, including glowing neon) and **Overlay mode** (show side labels, bottom caption, or both).
*   **Interactions:** Continue advances to Render.

### Step: Render
*   **Pre-render state:** Render summary (scene count, template, aspect ratio, quality, estimated duration); **Generate Video** button calls `/api/wizard/render`.
*   **Rendering state:** Spinner with status polling via `router.refresh()` every 5 seconds.
*   **Completed state:** HTML5 `<video>` player with rendered MP4; **Download MP4** button; **Edit in Wizard** button; **YouTube Metadata** export section (title, description, tags with per-field copy-to-clipboard and **Download .txt** for all metadata); project metadata summary.
*   **Failed state:** Inline error message from `render_error_context`; **Retry Render** button; **Edit in Wizard** button.
