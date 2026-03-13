import { inngest } from "./client";
import { generateScript } from "@/lib/ai/generate-script";
import { fetchAssets } from "@/lib/ai/fetch-assets";
import { renderVideo } from "@/lib/render/render-video";
import { uploadToStorage } from "@/lib/render/upload-storage";
import { createClient } from "@supabase/supabase-js";

// Supabase client for background workers — uses RPC functions with SECURITY DEFINER
function getWorkerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Helper: update project status via RPC (bypasses RLS) */
async function updateStatus(db: ReturnType<typeof getWorkerClient>, projectId: string, status: string, videoUrl?: string) {
  const { error } = await db.rpc("worker_update_project_status", {
    p_project_id: projectId,
    p_status: status,
    ...(videoUrl ? { p_video_url: videoUrl } : {}),
  });
  if (error) console.error(`[updateStatus] Failed to set ${status}:`, error);
}

/**
 * VideoGenerationWorker
 *
 * Triggered when a new project is created. Orchestrates:
 *  1. AI script generation (Gemini)
 *  2. Asset fetching (pinterest-dl)
 *  3. DB commit of scenes (via RPC)
 *  4. Video rendering (Remotion)
 *  5. Upload to Supabase Storage + update project URL
 */
export const generateVideo = inngest.createFunction(
  { id: "generate-video", retries: 2 },
  { event: "video/generate" },
  async ({ event, step }) => {
    const { projectId, topic } = event.data as {
      projectId: string;
      topic: string;
    };

    const db = getWorkerClient();

    // Step 1: Generate script via Gemini
    const scenes = await step.run("generate-script", async () => {
      console.log(`[generate-script] Project: ${projectId}, Topic: ${topic}`);
      try {
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
        const results = await fetchAssets(
          scenes.map((s) => s.searchKeyword),
          projectId
        );
        return scenes.map((scene, i) => ({
          ...scene,
          assetUrl: results[i] || null,
        }));
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
    const videoPath = await step.run("render-video", async () => {
      console.log(`[render-video] Rendering project ${projectId}`);
      try {
        const renderScenes = scenesWithAssets.map((s) => ({
          scriptText: s.scriptText,
          assetUrl: s.assetUrl,
        }));
        return await renderVideo({ projectId, scenes: renderScenes });
      } catch (err) {
        await updateStatus(db, projectId, "failed_render");
        throw err;
      }
    });

    // Step 5: Upload to Supabase Storage and update project
    const videoUrl = await step.run("upload-video", async () => {
      console.log(`[upload-video] Uploading rendered video for ${projectId}`);
      try {
        const url = await uploadToStorage(videoPath, projectId);
        await updateStatus(db, projectId, "completed", url);
        return url;
      } catch (err) {
        await updateStatus(db, projectId, "failed_render");
        throw err;
      }
    });

    return { projectId, videoUrl, sceneCount: scenesWithAssets.length };
  }
);
