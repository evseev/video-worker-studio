"use client";

import { useState, useCallback } from "react";
import type { WizardState } from "@/lib/stores/wizard-store";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";
import type { Scene } from "@/templates/types";
import { SlideshowSceneCard } from "@/templates/slideshow/SceneCard";
import { ComparisonSceneCard } from "@/templates/comparison/SceneCard";
import { FactCardSceneCard } from "@/templates/fact-card/SceneCard";

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
          template: store.getState().selectedTemplate,
        }),
      });
      const data = await res.json();
      if (data.scenes) {
        const updatedScenes: typeof currentScenes = data.scenes;
        const newScenes = currentScenes.map((scene, idx) => {
          const returnedScene = updatedScenes[idx];
          if (!returnedScene) return scene;
          const assets = scene.assets.map((slot, slotIdx) => {
            const options = returnedScene.assets?.[slotIdx]?.options;
            if (!options || options.length === 0) return slot;
            return { ...slot, options, url: options[0], selectedIndex: 0, objectPosition: undefined };
          });
          return { ...scene, assets };
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

  async function handleRefreshAsset(sceneIdx: number, slotIdx: number) {
    setFetchingScene(sceneIdx);
    try {
      const scene = scenes[sceneIdx];
      const keyword = scene.searchKeywords[slotIdx] ?? scene.searchKeywords[0] ?? "";
      const res = await fetch("/api/wizard/fetch-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scenes: [{ searchKeywords: [keyword] }],
          multipleAssets: true,
          aspectRatio: settings.aspectRatio,
          template: selectedTemplate,
        }),
      });
      const data = await res.json();
      const options: string[] = data.scenes?.[0]?.assets?.[0]?.options ?? [];
      if (options.length > 0) {
        const currentScene = store.getState().scenes[sceneIdx];
        const assets = [...currentScene.assets];
        assets[slotIdx] = { ...assets[slotIdx], options, url: options[0], selectedIndex: 0, objectPosition: undefined };
        store.getState().updateScene(sceneIdx, { assets } as Partial<Scene>);
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

  function removeScene(idx: number) {
    if (scenes.length > 1) store.getState().removeScene(idx);
  }

  function reorderScenes(from: number, to: number) {
    store.getState().reorderScenes(from, to);
  }

  function handleSelectAsset(sceneIdx: number, slotIdx: number, assetIdx: number) {
    selectAsset(sceneIdx, slotIdx, assetIdx);
    const state = store.getState();
    state.saveProgress({
      draft_scenes: { scenes: state.scenes, settings: state.settings, refinedIdea: state.refinedIdea },
    });
  }

  function addScene() {
    const blankScene: Scene = {
      template: selectedTemplate,
      scriptText: "",
      searchKeywords: selectedTemplate === "slideshow" ? [""] : ["", ""],
      assets: selectedTemplate === "slideshow" ? [{}] : [{}, {}],
      ...(selectedTemplate === "comparison" ? { leftLabel: "", rightLabel: "" } : {}),
      ...(selectedTemplate === "fact-card" ? { title: "", subtitle: "", facts: [] } : {}),
    } as Scene;
    setScenes([...scenes, blankScene]);
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
        <div className="flex gap-3">
          <button
            onClick={addScene}
            className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg text-sm transition-colors flex items-center gap-2 cursor-pointer"
          >
            + Add Scene
          </button>
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
      </div>

      {/* Scene List */}
      <div className="space-y-3 mb-8">
        {scenes.map((scene, idx) => {
          const commonProps = {
            scene,
            index: idx,
            totalScenes: scenes.length,
            aspectRatio: settings.aspectRatio,
            onUpdate: (updates: Partial<Scene>) => updateScene(idx, updates),
            onRemove: () => removeScene(idx),
            onMoveUp: () => reorderScenes(idx, idx - 1),
            onMoveDown: () => reorderScenes(idx, idx + 1),
            onRefreshAsset: (slotIdx: number) => handleRefreshAsset(idx, slotIdx),
            onSelectAsset: (slotIdx: number, assetIdx: number) => handleSelectAsset(idx, slotIdx, assetIdx),
            refreshingAsset: fetchingScene === idx,
          };

          return (
            <div
              key={idx}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={dragIdx === idx ? "opacity-70 ring-1 ring-violet-500 rounded-xl" : ""}
            >
              {scene.template === "comparison" ? (
                <ComparisonSceneCard {...commonProps} scene={scene} onUpdate={(u) => updateScene(idx, u as Partial<Scene>)} />
              ) : scene.template === "fact-card" ? (
                <FactCardSceneCard {...commonProps} scene={scene} onUpdate={(u) => updateScene(idx, u as Partial<Scene>)} />
              ) : (
                <SlideshowSceneCard {...commonProps} scene={scene} onUpdate={(u) => updateScene(idx, u as Partial<Scene>)} />
              )}
            </div>
          );
        })}
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
