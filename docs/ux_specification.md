# Screen-by-Screen UX Specification

This document details the layout, state requirements, and primary user interactions for the MVP of Video Worker Studio.

---

## 1. Login / Landing Screen
**Purpose:** Entry point for creators.
*   **Layout:** Simple, centered login card with a compelling headline ("Generate viral videos effortlessly").
*   **Components:** 
    *   Email input field for Magic Link login.
    *   OAuth buttons (e.g., "Continue with Google").
*   **Interactions:** Submit email -> See "Check your inbox" toast.

## 2. Library (Dashboard)
**Purpose:** View past projects and start new ones.
*   **Layout:** Standard SaaS layout. Left sidebar (or top navbar) for navigation. Main content area contains a grid of project cards.
*   **Components:** 
    *   "New Project" prominent CTA button.
    *   Grid of Video Cards (Thumbnail, Title, Status badge, Date created).
*   **Interactions:** 
    *   Click "New Project" -> Opens Project Setup Modal.
    *   Click existing project -> Navigates to the project editor at its current state.

## 3. Project Setup Modal
**Purpose:** Capture initial raw intent from the user.
*   **Layout:** Overlay modal on the Library screen.
*   **Components:**
    *   Textarea for "What is this video about?" (e.g., "A day in the life of a software engineer").
    *   Dropdown for Aspect Ratio (9:16 default).
    *   Slider or Dropdown for Target Duration (15s, 30s, 60s).
    *   "Generate Ideas" primary button.
*   **Interactions:** Submit -> API creates `Project` -> Navigates to `/project/[id]/idea`.

## 4. Phase 1: Idea Selection Screen (`/project/[id]/idea`)
**Purpose:** User chooses the best angle/hook from LLM-generated options.
*   **Layout:** Two-column split. Left side shows the original prompt. Right side shows a vertical list of 3-5 "Idea Cards".
*   **State:** If the job is `PENDING` or `PROCESSING`, show a loading skeleton with playful text ("Brainstorming viral hooks...").
*   **Components:**
    *   Idea Card: Shows `Title` (large font), `Hook` (subtitle), and `Rationale` (small text).
    *   "Select this Idea" button on each card.
*   **Interactions:** Click "Select" -> Saves to DB -> Background job starts -> Navigates to Phase 2.

## 5. Phase 2: Structure & Timeline Screen (`/project/[id]/structure`)
**Purpose:** Review the generated script and scene breakdown.
*   **Layout:** Vertical timeline or storyboard grid.
*   **State:** Loading skeleton while LLM generates scenes.
*   **Components:**
    *   Header: Shows the selected Title.
    *   Scene Blocks: Numbered list. Each block displays `duration`, `visualPrompt`, `captionText`, and `ttsText`.
    *   "Approve Script & Fetch Assets" CTA (sticky at bottom).
*   **Interactions:** User can technically click to edit a caption here, but primary action is clicking "Approve" -> Background job starts -> Navigates to Phase 3.

## 6. Phase 3: Asset Review & Polish Screen (`/project/[id]/assets`)
**Purpose:** The core editor where users replace bad AI-selected images before rendering.
*   **Layout:** Two-pane editor. 
    *   *Left Pane:* Scrollable list of scenes.
    *   *Right Pane:* Visual preview of the currently selected scene's asset.
*   **State:** Assets fetch asynchronously. Shows skeleton on images until loaded.
*   **Components:**
    *   Scene Item: Thumbnail of selected asset + caption text.
    *   Asset Explorer (Right Pane): Shows the currently active image. Below it, a horizontal scrolling list of 4 "Alternative Images" fetched from the API.
    *   "Upload Custom Image" button.
    *   "Generate Video" primary CTA.
*   **Interactions:** 
    *   Click alternative image -> Swaps the `isSelected` flag in the DB instantly.
    *   Edit caption textarea -> Debounced save to DB.
    *   Click "Generate Video" -> Pushes render job -> Navigates to Phase 4.

## 7. Phase 4: Final Result & Render Screen (`/project/[id]/render`)
**Purpose:** Wait for render, play video, and download.
*   **Layout:** Centered focus view.
*   **State:** If job `PROCESSING`, show a rich progress bar or circular progress indicator ("Rendering your video in the cloud...").
*   **Components:**
    *   Video Player (native HTML5 or Remotion Player) playing the resulting MP4.
    *   "Download MP4" button.
    *   "Edit Assets & Rerender" fallback button.
*   **Interactions:** 
    *   Click Download -> Triggers file download.
    *   Click Rerender -> Navigates back to Phase 3, deleting the MP4 URL from DB.
