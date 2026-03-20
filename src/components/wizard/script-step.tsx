"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { SceneCard, type SceneData } from "./scene-card";

export function ScriptStep({
  topic,
  projectId,
  scenes,
  onScenesChange,
  onContinue,
  saveProgress,
}: {
  topic: string;
  projectId: string;
  scenes: SceneData[];
  onScenesChange: (scenes: SceneData[]) => void;
  onContinue: () => void;
  saveProgress: (updates: Record<string, unknown>) => Promise<void>;
}) {
  const [generatingScript, setGeneratingScript] = useState(false);
  const [fetchingAssets, setFetchingAssets] = useState(false);
  const [refreshingScene, setRefreshingScene] = useState<number | null>(null);
  const addToast = useToast();

  async function generateScript() {
    if (!topic) return;
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/wizard/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!res.ok) throw new Error("Failed to generate script");
      const data = await res.json();
      if (data.scenes) {
        onScenesChange(data.scenes);
      }
    } catch (e) {
      addToast("Failed to generate script. Please try again.", "error");
    } finally {
      setGeneratingScript(false);
    }
  }

  async function fetchAllAssets() {
    setFetchingAssets(true);
    try {
      const res = await fetch("/api/wizard/fetch-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, scenes, multipleAssets: true }),
      });
      if (!res.ok) throw new Error("Failed to fetch assets");
      const data = await res.json();
      if (data.assetOptions) {
        const newScenes = scenes.map((scene, idx) => {
          const options = data.assetOptions[idx]?.options ?? [];
          return {
            ...scene,
            assetOptions: options.length > 0 ? options : scene.assetOptions,
            assetUrl: options[0] || scene.assetUrl,
            selectedAssetIndex: 0,
          };
        });
        onScenesChange(newScenes);
        await saveProgress({ draft_scenes: newScenes });
      }
    } catch {
      addToast("Failed to fetch images. Please try again.", "error");
    } finally {
      setFetchingAssets(false);
    }
  }

  async function refreshSceneAsset(index: number) {
    setRefreshingScene(index);
    try {
      const scene = scenes[index];
      const res = await fetch("/api/wizard/fetch-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scenes: [{ searchKeyword: scene.searchKeyword }],
          multipleAssets: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to refresh asset");
      const data = await res.json();
      const options = data.assetOptions?.[0]?.options ?? [];
      if (options.length > 0) {
        const newScenes = [...scenes];
        newScenes[index] = {
          ...scene,
          assetOptions: options,
          assetUrl: options[0],
          selectedAssetIndex: 0,
        };
        onScenesChange(newScenes);
        await saveProgress({ draft_scenes: newScenes });
      }
    } catch {
      addToast("Failed to refresh image. Please try again.", "error");
    } finally {
      setRefreshingScene(null);
    }
  }

  function selectAsset(sceneIndex: number, assetIndex: number) {
    const scene = scenes[sceneIndex];
    if (!scene.assetOptions?.[assetIndex]) return;
    const newScenes = [...scenes];
    newScenes[sceneIndex] = {
      ...scene,
      assetUrl: scene.assetOptions[assetIndex],
      selectedAssetIndex: assetIndex,
    };
    onScenesChange(newScenes);
  }

  function updateScene(index: number, field: keyof SceneData, value: string) {
    const newScenes = [...scenes];
    newScenes[index] = { ...newScenes[index], [field]: value };
    onScenesChange(newScenes);
  }

  function moveScene(from: number, to: number) {
    if (to < 0 || to >= scenes.length) return;
    const newScenes = [...scenes];
    const [moved] = newScenes.splice(from, 1);
    newScenes.splice(to, 0, moved);
    onScenesChange(newScenes);
  }

  function deleteScene(index: number) {
    if (scenes.length <= 1) return;
    const newScenes = scenes.filter((_, i) => i !== index);
    onScenesChange(newScenes);
  }

  function addScene() {
    onScenesChange([...scenes, { scriptText: "", searchKeyword: "" }]);
  }

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-white mb-2">Generate Script</h2>
      <p className="text-zinc-400 mb-8 text-base">Let AI write a script and pick templates for your video.</p>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-8">
        <button
          onClick={generateScript}
          disabled={generatingScript || !topic.trim()}
          className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {generatingScript ? "Writing script..." : "Generate Script with AI"}
        </button>
      </div>

      {scenes.length > 0 && (
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-medium text-zinc-400">
              Scenes ({scenes.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={addScene}
                className="text-xs px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded transition-colors cursor-pointer"
              >
                + Add Scene
              </button>
              <button
                onClick={fetchAllAssets}
                disabled={fetchingAssets}
                className="text-xs px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded transition-colors disabled:opacity-50"
              >
                {fetchingAssets ? "Fetching..." : "Fetch All Images"}
              </button>
            </div>
          </div>
          {scenes.map((scene, idx) => (
            <SceneCard
              key={idx}
              scene={scene}
              index={idx}
              total={scenes.length}
              onScriptChange={(v) => updateScene(idx, "scriptText", v)}
              onKeywordChange={(v) => updateScene(idx, "searchKeyword", v)}
              onDelete={() => deleteScene(idx)}
              onMoveUp={() => moveScene(idx, idx - 1)}
              onMoveDown={() => moveScene(idx, idx + 1)}
              onRefreshAsset={() => refreshSceneAsset(idx)}
              onSelectAsset={(assetIdx) => selectAsset(idx, assetIdx)}
              refreshingAsset={refreshingScene === idx}
            />
          ))}
        </div>
      )}

      <div className="flex justify-end pt-6 border-t border-white/[0.06]">
        <button
          disabled={scenes.length === 0}
          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onContinue}
        >
          Continue to Finalize
        </button>
      </div>
    </div>
  );
}
