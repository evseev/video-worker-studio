import { renderMediaOnLambda, getRenderProgress, type AwsRegion } from "@remotion/lambda/client";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

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
const COMPOSITION_ID = "VideoWorker";
const DEFAULT_LAMBDA_POLL_MS = 4_000;
const DEFAULT_LAMBDA_TIMEOUT_MS = 16 * 60 * 1_000;

type RenderBackend = "lambda" | "local";

function resolveRenderBackend(): RenderBackend {
  return process.env.RENDER_BACKEND === "local" ? "local" : "lambda";
}

function setAwsCredentialAliases(): void {
  if (!process.env.AWS_ACCESS_KEY_ID && process.env.REMOTION_AWS_ACCESS_KEY_ID) {
    process.env.AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID;
  }

  if (!process.env.AWS_SECRET_ACCESS_KEY && process.env.REMOTION_AWS_SECRET_ACCESS_KEY) {
    process.env.AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
  }

  if (!process.env.AWS_SESSION_TOKEN && process.env.REMOTION_AWS_SESSION_TOKEN) {
    process.env.AWS_SESSION_TOKEN = process.env.REMOTION_AWS_SESSION_TOKEN;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getLambdaConfig() {
  setAwsCredentialAliases();

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      "Missing AWS credentials. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (or REMOTION_AWS_ACCESS_KEY_ID/REMOTION_AWS_SECRET_ACCESS_KEY)."
    );
  }

  const region = (process.env.REMOTION_AWS_REGION ?? process.env.AWS_REGION) as AwsRegion | undefined;
  if (!region) {
    throw new Error("Missing REMOTION_AWS_REGION (or AWS_REGION) for lambda rendering");
  }

  return {
    region,
    functionName: requireEnv("REMOTION_LAMBDA_FUNCTION_NAME"),
    serveUrl: requireEnv("REMOTION_SERVE_URL"),
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Renders a video and returns a public URL.
 */
export async function renderVideo(input: RenderInput): Promise<string> {
  const backend = resolveRenderBackend();
  if (backend === "local") {
    return renderVideoLocally(input);
  }
  return renderVideoOnLambda(input);
}

async function renderVideoOnLambda(input: RenderInput): Promise<string> {
  const { projectId, scenes, template } = input;
  const { region, functionName, serveUrl } = getLambdaConfig();

  const sceneDurationFrames = SCENE_DURATION_SECONDS * FPS;
  const totalFrames =
    scenes.length * sceneDurationFrames -
    Math.max(0, scenes.length - 1) * TRANSITION_FRAMES;

  const inputProps = {
    scenes,
    sceneDurationFrames,
    transitionFrames: TRANSITION_FRAMES,
    template,
  };

  console.log(`[render] Starting Lambda render for project ${projectId}`);
  const started = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: COMPOSITION_ID,
    codec: "h264",
    outName: `videos/${projectId}.mp4`,
    privacy: "public",
    forceDurationInFrames: totalFrames,
    inputProps,
  });

  const startedAt = Date.now();
  while (true) {
    const progress = await getRenderProgress({
      renderId: started.renderId,
      bucketName: started.bucketName,
      functionName,
      region,
    });

    if (progress.fatalErrorEncountered) {
      const firstError = progress.errors[0];
      throw new Error(firstError?.message ?? "Lambda render failed");
    }

    if (progress.done) {
      if (!progress.outputFile) {
        throw new Error("Lambda render completed without output URL");
      }

      console.log(`[render] Lambda render complete for project ${projectId}`);
      return progress.outputFile;
    }

    if (Date.now() - startedAt > DEFAULT_LAMBDA_TIMEOUT_MS) {
      throw new Error(`Lambda render timed out after ${DEFAULT_LAMBDA_TIMEOUT_MS}ms`);
    }

    await wait(DEFAULT_LAMBDA_POLL_MS);
  }
}

async function renderVideoLocally(input: RenderInput): Promise<string> {
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
  await fs.promises.mkdir(outputDir, { recursive: true });

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

  const uploadedUrl = await uploadLocalRender(outputPath, projectId);
  console.log(`[render] Local render complete and uploaded: ${uploadedUrl}`);
  return uploadedUrl;
}

async function uploadLocalRender(filePath: string, projectId: string): Promise<string> {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );

  const fileBuffer = await fs.promises.readFile(filePath);
  const storagePath = `videos/${projectId}.mp4`;

  const { error: uploadError } = await supabase.storage
    .from("renders")
    .upload(storagePath, fileBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from("renders").getPublicUrl(storagePath);
  return data.publicUrl;
}
