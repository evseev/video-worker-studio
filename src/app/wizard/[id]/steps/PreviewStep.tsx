"use client";

import { useState, useCallback } from "react";
import type { WizardState } from "@/lib/stores/wizard-store";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";
import { SceneCard } from "@/components/wizard/scene-card";

type Props = { store: StoreApi<WizardState> };

export function PreviewStep({ store }: Props) {
  const { projectId, scenes, setScenes, updateScene, selectAsset, selectedTemplate, settings, saveProgress, setStep } = useStore(store);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchingScene, setFetchingScene] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const fetchAllAssets = useCallback(async () => {
    setFetchingAll(true);
    try {
      const currentScenes = store.getState().scenes;
      const res = await fetch("/api/wizard/fetch-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scenes: currentScenes,
          multipleAssets: true,
          aspectRatio: store.getState().settings.aspectRatio,
        }),
      });
      const data = await res.json();
      if (data.assetOptions) {
        const newScenes = currentScenes.map((scene, idx) => {
          const options = data.assetOptions[idx]?.options ?? [];
          return {
            ...scene,
            assetOptions: options.length > 0 ? options : scene.assetOptions,
            assetUrl: options[0] || scene.assetUrl,
            selectedAssetIndex: options.length > 0 ? 0 : scene.selectedAssetIndex,
          };
        });
        store.getState().setScenes(newScenes);
        const state = store.getState();
        await state.saveProgress({
          draft_scenes: { scenes: newScenes, settings: state.settings, refinedIdea: state.refinedIdea },
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingAll(false);
    }
  }, [projectId, store]);

  async function fetchSceneAsset(idx: number) {
    setFetchingScene(idx);
    try {
      const scene = scenes[idx];
      const res = await fetch("/api/wizard/fetch-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scenes: [{ searchKeyword: scene.searchKeyword }],
          multipleAssets: true,
          aspectRatio: settings.aspectRatio,
        }),
      });
      const data = await res.json();
      const options = data.assetOptions?.[0]?.options ?? [];
      if (options.length > 0) {
        store.getState().updateScene(idx, {
          assetOptions: options,
          assetUrl: options[0],
          selectedAssetIndex: 0,
        });
        const state = store.getState();
        await state.saveProgress({
          draft_scenes: { scenes: state.scenes, settings: state.settings, refinedIdea: state.refinedIdea },
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingScene(null);
    }
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) {
      store.getState().reorderScenes(dragIdx, idx);
      setDragIdx(idx);
    }
  }

  function handleDragEnd() {
    setDragIdx(null);
  }

  const QUALITY_LABELS: Record<string, string> = { hd: "HD (720p)", fullhd: "Full HD (1080p)", "4k": "4K (2160p)" };

  return (
    <div className="mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-white mb-2">Preview & Edit</h2>
      <p className="text-zinc-400 mb-6 text-base">Review your scenes, fetch images, reorder, and fine-tune before rendering.</p>

      {/* Global Settings Panel */}
      <div className="mb-6">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showSettings ? "rotate-90" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Video Settings
        </button>
        {showSettings && (
          <div className="mt-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-zinc-500 block mb-1">Template</span>
              <span className="text-sm text-zinc-200">{selectedTemplate}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block mb-1">Aspect Ratio</span>
              <span className="text-sm text-zinc-200">{settings.aspectRatio}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block mb-1">Quality</span>
              <span className="text-sm text-zinc-200">{QUALITY_LABELS[settings.quality] || settings.quality}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block mb-1">Scene Duration</span>
              <span className="text-sm text-zinc-200">{settings.sceneDuration}s</span>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-zinc-400">{scenes.length} scene{scenes.length !== 1 ? "s" : ""}</span>
        <button
          onClick={fetchAllAssets}
          disabled={fetchingAll || scenes.length === 0}
          className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
        >
          {fetchingAll ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Fetching Images...
            </>
          ) : (
            "Fetch All Images"
          )}
        </button>
      </div>

      {/* Scene List */}
      <div className="space-y-3 mb-8">
        {scenes.map((scene, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={dragIdx === idx ? "opacity-70 ring-1 ring-violet-500 rounded-xl" : ""}
          >
            <SceneCard
              scene={scene}
              index={idx}
              total={scenes.length}
              onScriptChange={(v) => updateScene(idx, { scriptText: v })}
              onKeywordChange={(v) => updateScene(idx, { searchKeyword: v })}
              onDelete={() => { if (scenes.length > 1) store.getState().removeScene(idx); }}
              onMoveUp={() => store.getState().reorderScenes(idx, idx - 1)}
              onMoveDown={() => store.getState().reorderScenes(idx, idx + 1)}
              onRefreshAsset={() => fetchSceneAsset(idx)}
              onSelectAsset={(assetIdx) => {
                selectAsset(idx, assetIdx);
                const state = store.getState();
                state.saveProgress({
                  draft_scenes: { scenes: state.scenes, settings: state.settings, refinedIdea: state.refinedIdea },
                });
              }}
              refreshingAsset={fetchingScene === idx}
            />
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-white/[0.06]">
        <button
          onClick={() => setStep("script")}
          className="px-4 py-2.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          Back
        </button>
        <button
          disabled={scenes.length === 0}
          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          onClick={async () => {
            const state = store.getState();
            await saveProgress({
              wizard_step: "render",
              draft_scenes: { scenes: state.scenes, settings: state.settings, refinedIdea: state.refinedIdea },
            });
            setStep("render");
          }}
        >
          Continue to Render
        </button>
      </div>
    </div>
  );
}
