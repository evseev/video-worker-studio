import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAssets } from "@/lib/ai/fetch-assets";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, scenes } = await request.json();

    if (!projectId || !scenes || !Array.isArray(scenes)) {
      return NextResponse.json(
        { error: "projectId and scenes array are required" },
        { status: 400 }
      );
    }

    const keywords = scenes.map(s => s.searchKeyword);
    const localPaths = await fetchAssets(keywords, projectId);

    const assetRecords = [];
    
    // Create asset records in the DB
    for (let i = 0; i < localPaths.length; i++) {
        const filePath = localPaths[i];
        if (filePath) {
            // Need to store a relative URL or correct path for the frontend
            // path is like /Users/evs/www/video-worker-studio/public/tmp_assets/...
            // The frontend expects /tmp_assets/... 
            const publicPath = filePath.split('/public')[1] || filePath;
            
            const { data: asset, error } = await supabase
              .from("assets")
              .insert({
                project_id: projectId,
                file_path: publicPath,
                type: "image",
                metadata: { sceneIndex: i, keyword: keywords[i] }
              })
              .select("*")
              .single();
              
            if (!error && asset) {
              assetRecords.push(asset);
            }
        }
    }

    // Update wizard step
    await supabase
      .from("projects")
      .update({ wizard_step: "assets" })
      .eq("id", projectId)
      .eq("user_id", user.id);

    return NextResponse.json({ 
        assets: assetRecords,
        localPaths
    });
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    return NextResponse.json(
      { error: "Failed to fetch assets" },
      { status: 500 }
    );
  }
}
