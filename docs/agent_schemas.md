# AI Agent Schema (Scope Reduced MVP)

The AI generation pipeline consists of a single Gemini prompting pipeline that accepts the user topic and returns the structured script and visual prompts needed to assemble the video. 

## The Orchestrator Prompt

**Model:** `gemini-2.5-flash` (via `@google/generative-ai`)

**System Prompt Example:**
```text
You are an expert short-form video scriptwriter (TikTok/Reels/Shorts).
Given a user TOPIC, generate a high-retention video script.
The script must be broken into a sequence of scenes.

For each scene, provide:
1. "scriptText": The actual words that will be spoken (used for captions/TTS).
2. "searchKeyword": A single, highly descriptive keyword phrase (e.g., "moody cinematic coffee shop desk") that will be passed to a Pinterest image scraper to find the background asset. 

RULES:
- Video should be 30-60 seconds (roughly 5-10 scenes).
- Hook the viewer in the first scene.
- Output MUST be valid JSON adhering strictly to the required schema.
```

**JSON Output Schema:**

```ts
import { z } from 'zod';

export const VideoScriptSchema = z.object({
  scenes: z.array(z.object({
    scriptText: z.string().describe("The spoken hook/line for this scene."),
    searchKeyword: z.string().describe("The Pinterest query to find a cinematic background image. E.g. 'dark academia desk'"),
  }))
});

export type VideoScriptOutput = z.infer<typeof VideoScriptSchema>;
```

**Inngest Worker Usage:**

The Inngest `VideoGenerationWorker` calls Gemini using this prompt and schema. 
It then parses the JSON and immediately invokes `pinterest-dl` locally. 

```ts
// Pseudocode worker logic
export default inngest.createFunction(
  { id: "generate-video" },
  { event: "video/generate" },
  async ({ event, step }) => {
    
    // 1. Call Gemini
    const script = await step.run("generate-script", async () => {
        model: 'gemini-2.5-flash',
        contents: event.data.topic,
        responseSchema: VideoScriptSchema
      return response.text();
    });

    // 2. Fetch Assets (parallel map)
    const scenes = JSON.parse(script).scenes;
    const scenesWithAssets = await step.run("fetch-assets", async () => {
      return Promise.all(scenes.map(async (scene, i) => {
        const assetUrl = await execPromise(`pinterest-dl search "${scene.searchKeyword}" -n 1`);
        return {
          sequenceOrder: i,
          scriptText: scene.scriptText,
          searchKeywords: scene.searchKeyword,
          assetUrl: parsePinscrapeOutput(assetUrl)
        }
      }));
    });

    // 3. Save to Supabase
    await step.run("save-scenes", async () => {
      await db.scenes.insert(scenesWithAssets.map(s => ({ ...s, projectId: event.data.projectId })));
      await db.projects.update({ status: 'rendering' }).where({ id: event.data.projectId });
    });

    // 4. Trigger Remotion Render
    await step.run("trigger-render", async () => {
       await fetch('https://lambda-render-url...', { body: JSON.stringify({ projectId: event.data.projectId }) });
    });
  }
);
```
