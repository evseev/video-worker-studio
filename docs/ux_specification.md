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
    *   **New Video:** Opens a modal with a topic textarea; submitting creates a `draft` project and navigates to `/wizard/[id]?step=idea`.
    *   **Project Grid:** Cards show topic, status badge (`draft`, `processing`, `rendering`, `completed`, `failed_ai`, `failed_render`), created date, and a delete (trash) control.
    *   **Auto-refresh:** While any visible project is `draft`, `processing`, or `rendering`, the dashboard refreshes on an interval so status updates without a manual reload.
*   **Interactions:** 
    *   Click a **draft** card → `/wizard/[id]` at the saved `wizard_step`.
    *   Click a **completed** card with `video_url` → opens the MP4 URL.
    *   Delete → confirm modal → `DELETE /api/projects/[id]`; optional warnings if storage/temp cleanup partially fails.

## 3. Interactive Wizard (`/wizard/[id]`)
**Purpose:** A guided flow to refine a topic, generate a script with assets, pick a template, and start rendering.
*   **Layout:** Full-width layout with sticky header (back to home, topic title, step labels: **Idea**, **Script**, **Render**). URL query `?step=` tracks the active step.

### Step: Idea
*   **Components:** Topic input; optional **Generate Hooks** (AI-suggested angles) from `/api/wizard/ideas`.
*   **Interactions:** Continue saves `topic` / `wizard_step` via `/api/wizard/draft` and moves to Script.

### Step: Script
*   **Components:** **Generate Script with AI** (`/api/wizard/script`); list of scenes with editable keywords and script text; **Fetch Images for Scenes** (`/api/wizard/fetch-assets`).
*   **Interactions:** Continue advances to Render when at least one scene exists; draft scenes persist through `/api/wizard/draft`.

### Step: Render
*   **Components:** Grid of style presets (e.g. minimalist, bold, neon, corporate). **Generate Video** calls `/api/wizard/render` with `projectId`, `scenes`, and `template`.
*   **Interactions:** On success, user is returned to the dashboard (`/`); status progresses via the worker/render pipeline. Errors surface with a simple alert and the button re-enables.

## 4. Final Result & Render Screen (Within Wizard or Dashboard Card)
*   **Components:**
    *   Video Player (native HTML5 or Remotion Player) playing the resulting MP4.
    *   "Download MP4" button.
*   **Interactions:** 
    *   Click Download -> Triggers file download.
