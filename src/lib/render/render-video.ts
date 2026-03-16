import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import * as path from "path";
import * as os from "os";

type RenderInput = {
  projectId: string;
  scenes: Array<{
    scriptText: string;
    assetUrl: string | null;
  }>;
  template?: string;
};

const SCENE_DURATION_SECONDS = 5;
const FPS = 30;
const TRANSITION_FRAMES = 15;

/**
 * Renders a video using Remotion's server-side renderer.
 * Returns the path to the rendered MP4 file.
 */
export async function renderVideo(input: RenderInput): Promise<string> {
  const { projectId, scenes } = input;

  console.log(`[render] Bundling Remotion for project ${projectId}...`);

  // Bundle the Remotion project
  const bundleLocation = await bundle({
    entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
    onProgress: (progress) => {
      if (progress % 25 === 0) {
        console.log(`[render] Bundle progress: ${progress}%`);
      }
    },
  });

  const sceneDurationFrames = SCENE_DURATION_SECONDS * FPS;
  const totalFrames =
    scenes.length * sceneDurationFrames -
    Math.max(0, scenes.length - 1) * TRANSITION_FRAMES;

  const inputProps = {
    scenes,
    sceneDurationFrames,
    transitionFrames: TRANSITION_FRAMES,
    template: input.template,
  };

  // Select the composition
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "VideoWorker",
    inputProps,
  });

  // Override duration based on actual scene count
  composition.durationInFrames = totalFrames;

  const outputDir = path.join(os.tmpdir(), "vws-renders");
  const outputPath = path.join(outputDir, `${projectId}.mp4`);

  console.log(`[render] Rendering ${scenes.length} scenes → ${outputPath}`);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => {
      if (Math.round(progress * 100) % 20 === 0) {
        console.log(`[render] Render progress: ${Math.round(progress * 100)}%`);
      }
    },
  });

  console.log(`[render] Complete: ${outputPath}`);
  return outputPath;
}
