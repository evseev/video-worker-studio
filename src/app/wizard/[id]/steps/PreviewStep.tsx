"use client";

import { useState, useCallback } from "react";
import type { WizardState } from "@/lib/stores/wizard-store";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";

type Props = { store: StoreApi<WizardState> };

export function PreviewStep({ store }: Props) {
  const { projectId, scenes, setScenes, selectedTemplate, settings, saveProgress, setStep } = useStore(store);
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
        body: JSON.stringify({ projectId, scenes: currentScenes, aspectRatio: store.getState().settings.aspectRatio }),
      });
      const data = await res.json();
      if (data.assets) {
        const newScenes = currentScenes.map((scene, idx) => ({
          ...scene,
          assetUrl: data.assets[idx]?.file_path || scene.assetUrl,
        }));
        store.getState().setScenes(newScenes);
        const state = store.getState();
        await state.saveProgress({ draft_scenes: { scenes: newScenes, settings: state.settings, refinedIdea: state.refinedIdea } });
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
        body: JSON.stringify({ projectId, scenes: [scene], aspectRatio: settings.aspectRatio }),
      });
      const data = await res.json();
      if (data.assets?.[0]?.file_path) {
        store.getState().updateScene(idx, { assetUrl: data.assets[0].file_path });
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
            className={`bg-white/[0.02] border rounded-xl p-4 flex gap-4 transition-all ${
              dragIdx === idx ? "border-violet-500 opacity-70" : "border-white/[0.06]"
            }`}
          >
            {/* Drag Handle */}
            <div className="flex flex-col items-center justify-center gap-1 cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>
            </div>

            {/* Image Preview */}
            <div className={`${settings.aspectRatio === "16:9" ? "w-28 h-20" : "w-20 h-28"} shrink-0 bg-black/50 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center relative group/img`}>
              {scene.assetUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={scene.assetUrl} alt={scene.searchKeyword} className="w-full h-full object-cover" />
                  <button
                    onClick={() => fetchSceneAsset(idx)}
                    disabled={fetchingScene === idx}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  >
                    {fetchingScene === idx ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => fetchSceneAsset(idx)}
                  disabled={fetchingScene === idx}
                  className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
                >
                  {fetchingScene === idx ? (
                    <div className="w-4 h-4 border-2 border-zinc-500/30 border-t-zinc-400 rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span className="text-[10px]">Fetch</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Scene Content */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Scene {idx + 1}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={scene.searchKeyword}
                    onChange={(e) => store.getState().updateScene(idx, { searchKeyword: e.target.value })}
                    className="px-2 py-1 bg-white/[0.06] border border-white/10 rounded text-xs text-zinc-300 w-40 focus:outline-none focus:border-violet-500/50"
                    placeholder="Search keyword"
                  />
                  <button
                    onClick={() => {
                      if (scenes.length > 1) {
                        store.getState().removeScene(idx);
                      }
                    }}
                    disabled={scenes.length <= 1}
                    className="p-1 text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-30 cursor-pointer"
                    title="Delete scene"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <textarea
                value={scene.scriptText}
                onChange={(e) => store.getState().updateScene(idx, { scriptText: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50 min-h-[50px] resize-y"
                placeholder="Script text"
              />
            </div>
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
