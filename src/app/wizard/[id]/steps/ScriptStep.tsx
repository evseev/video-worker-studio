"use client";

import { useState } from "react";
import type { WizardState } from "@/lib/stores/wizard-store";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";
import { useToast } from "@/components/ui/toast";

type Props = { store: StoreApi<WizardState> };

export function ScriptStep({ store }: Props) {
  const { projectId, topic, scenes, setScenes, selectedTemplate, refinedIdea, settings, targetKeywords, videoDescription, videoTags, setVideoDescription, setVideoTags, saveProgress, setStep } = useStore(store);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingSeo, setGeneratingSeo] = useState(false);
  const [seoExpanded, setSeoExpanded] = useState(true);

  const addToast = useToast();
  const ideaText = refinedIdea?.selectedIdea || topic;

  async function fetchSeoMetadata(generatedScenes: { scriptText: string }[]) {
    setGeneratingSeo(true);
    try {
      const res = await fetch("/api/wizard/generate-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          idea: ideaText,
          scenes: generatedScenes.map((s) => ({ scriptText: s.scriptText })),
          targetKeywords,
          sceneCount: settings.sceneCount,
          sceneDuration: settings.sceneDuration,
        }),
      });
      if (!res.ok) throw new Error("SEO generation failed");
      const data = await res.json();
      if (data.description) setVideoDescription(data.description);
      if (data.tags) setVideoTags(data.tags);
    } catch {
      addToast("Failed to generate YouTube metadata. You can retry with the button below.", "error");
    } finally {
      setGeneratingSeo(false);
    }
  }

  async function generateScript() {
    if (!ideaText.trim()) return;
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/wizard/generate-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, idea: ideaText, template: selectedTemplate, aspectRatio: settings.aspectRatio, sceneCount: settings.sceneCount, sceneDuration: settings.sceneDuration }),
      });
      const data = await res.json();
      if (data.scenes) {
        setScenes(data.scenes);
        fetchSeoMetadata(data.scenes);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingScript(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-white mb-2">Generate your script</h2>
      <p className="text-zinc-400 mb-8 text-base">Let AI write your scene-by-scene script based on your idea and template.</p>

      {/* Generate Script */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm text-zinc-400">Generating for: </span>
            <span className="text-sm text-zinc-200 font-medium">{ideaText.slice(0, 80)}{ideaText.length > 80 ? "..." : ""}</span>
          </div>
          <div className="text-xs text-zinc-500 capitalize">{selectedTemplate.replace("-", " ")} template</div>
        </div>
        <button
          onClick={generateScript}
          disabled={generatingScript || !ideaText.trim()}
          className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {generatingScript ? "Writing script..." : "Generate Script with AI"}
        </button>
      </div>

      {/* Scene List */}
      {scenes.length > 0 && (
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-medium text-zinc-400">Generated Scenes ({scenes.length})</h3>
          {scenes.map((scene, idx) => (
            <div key={idx} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
              <div className="mb-2 flex justify-between items-center">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Scene {idx + 1}</span>
                <input
                  type="text"
                  value={scene.searchKeywords?.[0] ?? ""}
                  onChange={(e) => {
                    const updatedKeywords = [...(scene.searchKeywords ?? [])];
                    updatedKeywords[0] = e.target.value;
                    store.getState().updateScene(idx, { searchKeywords: updatedKeywords });
                  }}
                  className="px-2 py-1 bg-white/[0.06] border border-white/10 rounded text-xs text-zinc-300 w-1/2 focus:outline-none focus:border-violet-500/50"
                  placeholder="Search keyword"
                />
              </div>
              <textarea
                value={scene.scriptText}
                onChange={(e) => {
                  store.getState().updateScene(idx, { scriptText: e.target.value });
                }}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-violet-500/50 min-h-[60px] resize-y"
                placeholder="Script text"
              />
            </div>
          ))}
        </div>
      )}

      {/* YouTube SEO Metadata */}
      {scenes.length > 0 && (
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setSeoExpanded(!seoExpanded)}
            className="flex items-center gap-2 w-full text-left cursor-pointer group"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-zinc-500 transition-transform ${seoExpanded ? "rotate-90" : ""}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              YouTube Metadata
            </h3>
            {generatingSeo && (
              <div className="w-3 h-3 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
            )}
          </button>

          {seoExpanded && (
            <div className="mt-4 space-y-4">
              {/* Description */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  Video Description
                </label>
                <textarea
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/50 min-h-[120px] resize-y"
                  placeholder={generatingSeo ? "Generating description..." : "YouTube video description"}
                  disabled={generatingSeo}
                />
              </div>

              {/* Tags */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  Video Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {videoTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-500/10 text-violet-300 text-xs rounded-full"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setVideoTags(videoTags.filter((_, i) => i !== idx))}
                        className="text-violet-400/50 hover:text-violet-300 cursor-pointer"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder={generatingSeo ? "Generating tags..." : "Add a tag and press Enter"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.currentTarget.value.trim()) {
                      e.preventDefault();
                      setVideoTags([...videoTags, e.currentTarget.value.trim()]);
                      e.currentTarget.value = "";
                    }
                  }}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
                  disabled={generatingSeo}
                />
              </div>

              {/* Regenerate button */}
              <button
                type="button"
                onClick={() => fetchSeoMetadata(scenes)}
                disabled={generatingSeo}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {generatingSeo ? "Regenerating..." : "Regenerate Metadata"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-white/[0.06]">
        <button
          onClick={() => setStep("refine")}
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
              wizard_step: "preview",
              template: selectedTemplate,
              video_description: state.videoDescription,
              video_tags: state.videoTags.join(", "),
              draft_scenes: { scenes: state.scenes, settings: state.settings, refinedIdea: state.refinedIdea, targetKeywords: state.targetKeywords, videoDescription: state.videoDescription, videoTags: state.videoTags },
            });
            setStep("preview");
          }}
        >
          Continue to Preview
        </button>
      </div>
    </div>
  );
}
