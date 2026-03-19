# Screen-by-Screen UX Specification

This document details the layout, state requirements, and primary user interactions for the current MVP of Video Worker Studio.

---

## 1. Login / Landing Screen
**Purpose:** Entry point for creators.
*   **Layout:** Simple, centered login card with a compelling headline.
*   **Components:** 
    *   Email/Password input field or OAuth buttons.
*   **Interactions:** User logs in and is redirected to the Dashboard.

## 2. Dashboard (`/dashboard`)
**Purpose:** View past projects, check statuses, and start new ones.
*   **Layout:** Sidebar navigation. Main content area contains a grid of project cards and a "One-Click Quick Start" bar.
*   **Components:** 
    *   **Quick Start Form:** A text input and template dropdown allowing users to generate a video in one click without entering the wizard.
    *   **"Advanced Wizard" CTA:** A button that creates a `draft` project and drops the user into the interactive wizard.
    *   **Project Grid:** Shows cards with thumbnail, title, status (`draft`, `processing`, `rendering`, `completed`), and created date.
*   **Interactions:** 
    *   Submit Quick Start -> Project is created, Inngest job dispatched, card appears in "processing" state.
    *   Click "Advanced Wizard" -> API creates a blank `draft` Project -> Navigates to `/wizard/[id]`.

## 3. Interactive Wizard (`/wizard/[id]`)
**Purpose:** A guided, step-by-step experience to construct a video project.
*   **Layout:** Centered card with a stepped progress bar at the top (`Template -> Script -> Settings -> Generate`).

### Step 1: Template Selection
*   **Components:** Grid of available Remotion templates (e.g., "Slideshow", "Split Screen", "Quote").
*   **Interactions:** User selects a template. State updates locally.

### Step 2: Scripting & Topic
*   **Components:** Large text area for the user to describe the video topic.
*   **Interactions:** User types their prompt. This is what the Gemini 2.5 Flash model will use to build the scenes.

### Step 3: Settings & Review
*   **Components:** Summary of choices. Future expansion point for specific LLM instructions, duration sliders, and asset style selectors.
*   **Interactions:** User confirms settings.

### Step 4: Generating
*   **Components:** A loading state with playful text ("Summoning AI...", "Painting pixels...").
*   **Interactions:** 
    *   Click "Generate" -> Makes `PUT /api/projects/[id]` to save `topic` and `selected_template`.
    *   Makes `POST /api/generate` to dispatch the Inngest worker.
    *   The wizard begins polling (or subscribing via Supabase realtime) for the project status to change to `completed`.
    *   When `completed`, it displays the final video or provides a link to download.

## 4. Final Result & Render Screen (Within Wizard or Dashboard Card)
*   **Components:**
    *   Video Player (native HTML5 or Remotion Player) playing the resulting MP4.
    *   "Download MP4" button.
*   **Interactions:** 
    *   Click Download -> Triggers file download.
