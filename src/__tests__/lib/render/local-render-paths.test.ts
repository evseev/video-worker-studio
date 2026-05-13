import { describe, it, expect } from "vitest";
import { resolveChannelScopedLocalRenderPaths } from "@/lib/render/local-render-paths";

describe("local-render-paths", () => {
  it("scopes output under channel id", () => {
    const paths = resolveChannelScopedLocalRenderPaths({
      cwd: "/app",
      baseUrl: "http://localhost:3000/",
      channelId: "11111111-1111-1111-1111-111111111111",
      projectId: "22222222-2222-2222-2222-222222222222",
    });
    expect(paths.outputDir).toBe(
      "/app/public/local_renders/11111111-1111-1111-1111-111111111111"
    );
    expect(paths.outputPath).toBe(
      "/app/public/local_renders/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.mp4"
    );
    expect(paths.publicUrl).toBe(
      "http://localhost:3000/local_renders/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.mp4"
    );
  });
});
