import path from "path";

/**
 * Resolves channel-scoped local Remotion output paths (dev / `RENDER_BACKEND=local`).
 * Kept separate from `render-video.ts` so unit tests do not load the Remotion bundler graph.
 */
export function resolveChannelScopedLocalRenderPaths(args: {
  cwd: string;
  baseUrl: string;
  channelId: string;
  projectId: string;
}): { outputDir: string; outputPath: string; publicUrl: string } {
  const base = args.baseUrl.replace(/\/$/, "");
  const outputDir = path.join(args.cwd, "public", "local_renders", args.channelId);
  const outputPath = path.join(outputDir, `${args.projectId}.mp4`);
  const publicUrl = `${base}/local_renders/${args.channelId}/${args.projectId}.mp4`;
  return { outputDir, outputPath, publicUrl };
}
