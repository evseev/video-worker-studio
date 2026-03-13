# JSON Schemas for AI Agents

To guarantee that the LLMs return processable, deterministic data, we enforce the following JSON schemas (compatible with OpenAI's `response_format` JSON Schema or Zod schema validation).

## Agent 1: Idea Enhancement & Title Generator
**Input:** The raw project `initialPrompt` (e.g., "A motivational video for software engineers about debugging").
**Goal:** Generate 3 distinct video hooks/titles and rationalize them.

### JSON Schema (Zod equivalent)
```ts
import { z } from "zod";

export const IdeaEnhancerSchema = z.object({
  topic: z.string().describe("A concise 1-3 word topic summary of the video"),
  persona: z.string().describe("The target audience persona (e.g. 'Stressed programmers')"),
  options: z.array(z.object({
    title: z.string().describe("A clickbaity, high-retention title for the video (max 50 chars)"),
    hook: z.string().describe("The first 3 seconds of the video text. Must grab attention immediately."),
    rationale: z.string().describe("Why this angle works for the current social media algorithm")
  })).min(3).max(5).describe("List of 3 to 5 generated ideas")
});
```

---

## Agent 2: Scene & Structure Generator
**Input:** The selected title, hook, target duration (e.g., 30s), and calculated scene count (e.g., 6 scenes for 30s).
**Goal:** Break the video down into exact scenes that add up to the target duration.

### JSON Schema (Zod equivalent)
```ts
export const SceneGeneratorSchema = z.object({
  scenes: z.array(z.object({
    sequenceOrder: z.number().int().describe("The 1-indexed order of this scene"),
    durationSecs: z.number().min(2).max(10).describe("Duration of this scene in seconds. Fast pacing is preferred (3-5s)."),
    visualPrompt: z.string().describe("A specific aesthetic description of the image/graphic to show. E.g. 'A dark moody neon coding setup'"),
    searchKeywords: z.array(z.string()).length(3).describe("3 specific SEO keywords to search on Pinterest to find this image"),
    captionText: z.string().describe("The exact text to overlay on the screen for this scene. Keep it extremely punchy (max 8 words)."),
    ttsText: z.string().describe("The text the AI voice should speak during this scene. Should sync emotionally with the captionText."),
    transitionIn: z.enum(["none", "fade", "slide-left", "zoom-in"]).describe("Transition from previous scene"),
    kenBurnsEffect: z.enum(["none", "pan-left", "pan-right", "zoom-in", "zoom-out"]).describe("Slow camera movement applied to the background image")
  })).describe("Array of scenes. The sum of durationSecs MUST equal the requested target duration."),
});
```

---

## Agent 3: Asset Sourcing Classifier (Optional / Fallback)
*(Note: Often asset sourcing just involves passing the `searchKeywords` to an API directly. However, if using an LLM to evaluate search results from an API to pick the best one out of 10, this schema is used).*

**Input:** The `visualPrompt`, and a JSON array of fetched Pinterest API results containing `id`, `description`, `url`.
**Goal:** Select the single best image ID from the provided list that matches the prompt and filtering rules (e.g. portrait mode).

### JSON Schema (Zod equivalent)
```ts
export const AssetSelectorSchema = z.object({
  selectedResultId: z.string().describe("The ID of the best matching image from the provided search results"),
  confidenceScore: z.number().min(0).max(100).describe("How confident are you that this image matches the visual prompt aesthetically?"),
  reasoning: z.string().describe("Why this image was selected over the others")
});
```

---

## Render Manifest (Internal Contract)
This is **not** an LLM schema, but rather the strictly typed JSON object that the Core API builds and sends to the Video Rendering Worker (Remotion). The Renderer requires zero "thinking"—it merely executes this payload.

### JSON Payload Structure
```ts
export const RenderManifestSchema = z.object({
  projectId: z.string(),
  globalSettings: z.object({
    fps: z.number().default(30),
    width: z.number().default(1080),
    height: z.number().default(1920),
    fontFamily: z.string().default("Inter"),
    musicTrackUrl: z.string().url().optional()
  }),
  scenes: z.array(z.object({
    durationInFrames: z.number(),
    backgroundAssetUrl: z.string().url(),
    backgroundType: z.enum(["IMAGE", "VIDEO"]),
    kenBurnsEffect: z.string(),
    transitionType: z.string(),
    overlays: z.array(z.object({
      type: z.enum(["TEXT_CAPTION"]),
      text: z.string(),
      startFrame: z.number(),
      endFrame: z.number()
    })),
    audioVoiceOverUrl: z.string().url().optional()
  }))
});
```
