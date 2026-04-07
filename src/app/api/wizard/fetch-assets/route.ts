import { NextResponse } from "next/server";
import path from "path";
import { withAuth } from "@/lib/api/with-auth";
import { fetchAssets } from "@/lib/ai/fetch-assets";

interface AssetSlot {
  options?: string[];
  [key: string]: unknown;
}

interface SceneNew {
  searchKeywords: string[];
  assets: AssetSlot[];
  [key: string]: unknown;
}

interface SceneLegacy {
  searchKeyword: string;
  [key: string]: unknown;
}

type Scene = SceneNew | SceneLegacy;

function normalizeScene(scene: Scene): SceneNew {
  if ("searchKeywords" in scene && Array.isArray(scene.searchKeywords)) {
    const s = scene as SceneNew;
    return { ...s, assets: s.assets ?? [] };
  }
  // Backward compatibility: convert singular searchKeyword → searchKeywords array
  const legacy = scene as SceneLegacy;
  return {
    ...legacy,
    searchKeywords: legacy.searchKeyword ? [legacy.searchKeyword] : [],
    assets: [],
  };
}

export const POST = withAuth(async (request, { user, supabase }) => {
  const { projectId, scenes, multipleAssets, aspectRatio, template } = await request.json();

  if (!projectId || !scenes || !Array.isArray(scenes)) {
    return NextResponse.json(
      { error: "projectId and scenes array are required" },
      { status: 400 }
    );
  }

  // For slideshow: orientation matches video aspect ratio (landscape video → landscape images)
  // For comparison/fact-card: image slots are portrait-shaped regardless of video aspect ratio
  //   (side-by-side splits or card layouts make each slot tall/narrow)
  const slideshowHint = aspectRatio === "16:9" ? "landscape" : "portrait";
  const multiSlotHint = "portrait";
  const orientationHint = (template === "comparison" || template === "fact-card")
    ? multiSlotHint
    : slideshowHint;
  const publicDir = path.join(process.cwd(), "public");

  function toPublicPath(filePath: string): string {
    return `/${path.relative(publicDir, filePath)}`;
  }

  function applyOrientation(kw: string | null): string | null {
    return orientationHint && kw ? `${kw} ${orientationHint}` : kw;
  }

  // Multi-asset mode: fetch 3 options per slot, supporting multiple slots per scene
  if (multipleAssets) {
    const normalizedScenes = (scenes as Scene[]).map(normalizeScene);

    // Build a flat list of (sceneIdx, slotIdx, keyword) entries
    const flatEntries: { sceneIdx: number; slotIdx: number; keyword: string | null }[] = [];
    for (let sceneIdx = 0; sceneIdx < normalizedScenes.length; sceneIdx++) {
      const scene = normalizedScenes[sceneIdx];
      const keywords = scene.searchKeywords;
      for (let slotIdx = 0; slotIdx < keywords.length; slotIdx++) {
        flatEntries.push({
          sceneIdx,
          slotIdx,
          keyword: applyOrientation(keywords[slotIdx] ?? null),
        });
      }
    }

    const flatKeywords = flatEntries.map((e) => e.keyword);
    const allPaths = await fetchAssets(flatKeywords, projectId, 3);

    // Map results back into scene.assets[slotIdx].options
    for (let i = 0; i < flatEntries.length; i++) {
      const { sceneIdx, slotIdx } = flatEntries[i];
      const paths = (allPaths as string[][])[i] ?? [];
      const scene = normalizedScenes[sceneIdx];

      // Ensure the assets array is long enough
      while (scene.assets.length <= slotIdx) {
        scene.assets.push({});
      }
      scene.assets[slotIdx].options = paths.map((p) => toPublicPath(p));
    }

    await supabase
      .from("projects")
      .update({ wizard_step: "assets" })
      .eq("id", projectId)
      .eq("user_id", user.id);

    return NextResponse.json({ scenes: normalizedScenes });
  }

  // Single-asset mode (backwards compatible)
  const normalizedSingle = (scenes as Scene[]).map(normalizeScene);
  const keywords = normalizedSingle.map((s) =>
    applyOrientation(s.searchKeywords[0] ?? null)
  );

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
