import { inngest } from "./client";
import { generateScript } from "@/lib/ai/generate-script";
import { fetchAssets } from "@/lib/ai/fetch-assets";
import { renderVideo } from "@/lib/render/render-video";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Supabase client for background workers — uses RPC functions with SECURITY DEFINER
function getWorkerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Helper: update project status via RPC (bypasses RLS) */
async function updateStatus(db: ReturnType<typeof getWorkerClient>, projectId: string, status: string, videoUrl: string | null = null) {
  const { error } = await db.rpc("worker_update_project_status", {
    p_project_id: projectId,
    p_status: status,
    p_video_url: videoUrl,
  });
  if (error) console.error(`[updateStatus] Failed to set ${status}:`, error);
}

const RenderErrorContextSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
  step: z.literal("render-video"),
});

async function updateRenderError(
  db: ReturnType<typeof getWorkerClient>,
  projectId: string,
  context: z.infer<typeof RenderErrorContextSchema>
) {
  const parsed = RenderErrorContextSchema.parse(context);
  const { error } = await db.rpc("worker_update_project_error", {
    p_project_id: projectId,
    p_error_context: parsed,
  });
  if (error) {
    console.error("[updateRenderError] Failed to persist render error context:", error);
  }
}

/**
 * VideoGenerationWorker
 *
 * Triggered when a new project is created. Orchestrates:
 *  1. AI script generation (Gemini)
 *  2. Asset fetching (pinterest-dl)
 *  3. DB commit of scenes (via RPC)
 *  4. Video rendering (Remotion Lambda by default, local fallback)
 *  5. Status update with final video URL
 */
export const generateVideo = inngest.createFunction(
  {
    id: "generate-video",
    retries: 2,
    concurrency: {
      limit: 3,
      key: "event.data.userId",
    },
  },
  { event: "video/generate" },
  async ({ event, step }) => {
    const { projectId, topic, scenes: passedScenes, template } = event.data as {
      projectId: string;
      topic?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scenes?: any[];
      template?: string;
      userId?: string;
    };

    const db = getWorkerClient();

    // Step 1: Generate script via Gemini (or use passed scenes)
    const scenes = passedScenes || await step.run("generate-script", async () => {
      console.log(`[generate-script] Project: ${projectId}, Topic: ${topic}`);
      try {
        if (!topic) throw new Error("Topic is required if scenes are not provided");
        const result = await generateScript(topic);
        console.log(`[generate-script] Generated ${result.length} scenes`);
        return result;
      } catch (err) {
        await updateStatus(db, projectId, "failed_ai");
        throw err;
      }
    });

    // Step 2: Fetch assets from Pinterest for each scene
    const scenesWithAssets = await step.run("fetch-assets", async () => {
      console.log(`[fetch-assets] Fetching assets for ${scenes.length} scenes`);
      try {
        // Only fetch if assetUrl is not already present
        const keywordsToFetch = scenes.map((s) => s.assetUrl ? null : s.searchKeyword);
        const fetchResults = await fetchAssets(
          keywordsToFetch as string[],
          projectId
        );
        
        return scenes.map((scene, i) => {
          if (scene.assetUrl) return scene;
          return {
            ...scene,
            assetUrl: fetchResults[i] || null,
          };
        });
      } catch (err) {
        await updateStatus(db, projectId, "failed_ai");
        throw err;
      }
    });

    // Step 3: Save scenes to Supabase via RPC (bypasses RLS)
    await step.run("save-scenes", async () => {
      console.log(`[save-scenes] Saving ${scenesWithAssets.length} scenes`);

      const scenesPayload = scenesWithAssets.map((scene, i) => ({
        sequence_order: i,
        script_text: scene.scriptText,
        search_keywords: scene.searchKeyword,
        asset_url: scene.assetUrl,
      }));

      const { error } = await db.rpc("worker_insert_scenes", {
        p_project_id: projectId,
        p_scenes: scenesPayload,
      });

      if (error) {
        console.error("[save-scenes] Insert error:", error);
        throw error;
      }

      await updateStatus(db, projectId, "rendering");
    });

    // Step 4: Render video with Remotion
    const videoUrl = await step.run("render-video", async () => {
      console.log(`[render-video] Rendering project ${projectId}`);
      try {
        const renderScenes = scenesWithAssets.map((s) => ({
          scriptText: s.scriptText,
          assetUrl: s.assetUrl,
        }));
        return await renderVideo({ projectId, scenes: renderScenes, template });
      } catch (err) {
        await updateStatus(db, projectId, "failed_render");
        await updateRenderError(db, projectId, {
          message: err instanceof Error ? err.message : "Unknown render error",
          timestamp: new Date().toISOString(),
          step: "render-video",
        });
        throw err;
      }
    });

    await updateStatus(db, projectId, "completed", videoUrl);

    return { projectId, videoUrl, sceneCount: scenesWithAssets.length };
  }
);
