import { describe, it, expect } from "vitest";
import path from "path";
import { getLocalRenderRemovalTargets } from "@/lib/projects/delete-project-assets";

describe("delete-project-assets local render paths", () => {
  it("includes channel-scoped path then legacy flat path when channelId is set", () => {
    const targets = getLocalRenderRemovalTargets("proj-1", "chan-1");
    expect(targets).toHaveLength(2);
    expect(targets[0]).toBe(path.join(process.cwd(), "public", "local_renders", "chan-1", "proj-1.mp4"));
    expect(targets[1]).toBe(path.join(process.cwd(), "public", "local_renders", "proj-1.mp4"));
  });

  it("includes only legacy path when channelId is absent", () => {
    const targets = getLocalRenderRemovalTargets("proj-2", undefined);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toBe(path.join(process.cwd(), "public", "local_renders", "proj-2.mp4"));
  });
});
