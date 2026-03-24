import { NextResponse } from "next/server";
import path from "path";
import { withAuth } from "@/lib/api/with-auth";
import { fetchAssets } from "@/lib/ai/fetch-assets";

export const POST = withAuth(async (request, { user, supabase }) => {
  const { projectId, scenes, multipleAssets, aspectRatio } = await request.json();

  if (!projectId || !scenes || !Array.isArray(scenes)) {
    return NextResponse.json(
      { error: "projectId and scenes array are required" },
      { status: 400 }
    );
  }

  const orientationHint = aspectRatio === "16:9" ? "landscape" : "portrait";
  const keywords = scenes.map((s: { searchKeyword: string }) => {
    const kw = s.searchKeyword;
    return orientationHint && kw ? `${kw} ${orientationHint}` : kw;
  });
  const publicDir = path.join(process.cwd(), "public");

  function toPublicPath(filePath: string): string {
    return `/${path.relative(publicDir, filePath)}`;
  }

  // Multi-asset mode: fetch 3 options per scene
  if (multipleAssets) {
    const allPaths = await fetchAssets(keywords, projectId, 3);

    const assetRecords = (allPaths as string[][]).map((paths, i) => ({
      options: paths.map((p) => toPublicPath(p)),
      keyword: keywords[i],
      sceneIndex: i,
    }));

    await supabase
      .from("projects")
      .update({ wizard_step: "assets" })
      .eq("id", projectId)
      .eq("user_id", user.id);

    return NextResponse.json({ assetOptions: assetRecords });
  }

  // Single-asset mode (backwards compatible)
  const localPaths = await fetchAssets(keywords, projectId);

  const assetRecords = (localPaths as (string | null)[]).map((filePath, i) => {
    if (filePath) {
      return {
        file_path: toPublicPath(filePath),
        type: "image" as const,
        metadata: { sceneIndex: i, keyword: keywords[i] },
      };
    }
    return {
      file_path: null,
      type: "none" as const,
      metadata: { sceneIndex: i, keyword: keywords[i] },
    };
  });

  await supabase
    .from("projects")
    .update({ wizard_step: "assets" })
    .eq("id", projectId)
    .eq("user_id", user.id);

  return NextResponse.json({ assets: assetRecords });
});
