"use client";

import { useState } from "react";
import type { WizardState } from "@/lib/stores/wizard-store";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";

type Props = { store: StoreApi<WizardState> };

export function RefineStep({ store }: Props) {
  const { projectId, topic, settings, refinedIdea, setRefinedIdea, setTopic, targetKeywords, setTargetKeywords, saveProgress, setStep } = useStore(store);
  const [enhancing, setEnhancing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [enhancedIdeas, setEnhancedIdeas] = useState<string[]>(refinedIdea?.ideas || []);
  const [selectedIdea, setSelectedIdea] = useState(refinedIdea?.selectedIdea || "");
  const [trendData, setTrendData] = useState<{ score: number; reasoning: string; hooks: string[] } | null>(
    refinedIdea ? { score: refinedIdea.trendScore, reasoning: refinedIdea.trendReasoning, hooks: refinedIdea.trendHooks } : null
  );

  async function enhanceIdea() {
    setEnhancing(true);
    try {
      const res = await fetch("/api/wizard/enhance-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, idea: topic, sceneCount: settings.sceneCount, sceneDuration: settings.sceneDuration }),
      });
      const data = await res.json();
      if (data.ideas) {
        setEnhancedIdeas(data.ideas);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setEnhancing(false);
    }
  }

  async function validateTrend(idea: string) {
    setValidating(true);
    try {
      const res = await fetch("/api/wizard/validate-trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, idea }),
      });
      const data = await res.json();
      if (data.trendData) {
        setTrendData(data.trendData);
        setRefinedIdea({
          ideas: enhancedIdeas,
          selectedIdea: idea,
          trendScore: data.trendData.score,
          trendReasoning: data.trendData.reasoning,
          trendHooks: data.trendData.hooks,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setValidating(false);
    }
  }

  function handleSelectIdea(idea: string) {
    setSelectedIdea(idea);
    setTopic(idea);
    validateTrend(idea);
  }

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-white mb-2">Refine your idea</h2>
      <p className="text-zinc-400 mb-8 text-base">Let AI enhance your concept and validate its viral potential.</p>

      {/* Current Topic */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6">
        <label className="block text-sm font-medium text-zinc-400 mb-2">Your Current Concept</label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-violet-500/50 min-h-[80px] resize-y"
        />
        <button
          onClick={enhanceIdea}
          disabled={enhancing || !topic.trim()}
          className="mt-3 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {enhancing ? "Enhancing..." : "Enhance with AI"}
        </button>
      </div>

      {/* Target Keywords (optional) */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6">
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Target Keywords
          <span className="text-zinc-600 font-normal ml-1">(optional)</span>
        </label>
        <p className="text-xs text-zinc-500 mb-3">
          Enter keywords you want to rank for on YouTube. These will be used for SEO metadata generation.
        </p>
        <input
          type="text"
          value={targetKeywords}
          onChange={(e) => setTargetKeywords(e.target.value)}
          placeholder="e.g., productivity tips, morning routine, life hacks"
          className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-violet-500/50"
        />
      </div>

      {/* Enhanced Ideas */}
      {enhancedIdeas.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-medium text-zinc-400">Enhanced Concepts</h3>
          {enhancedIdeas.map((idea, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectIdea(idea)}
              className={`cursor-pointer rounded-xl p-4 transition-all border ${
                selectedIdea === idea
                  ? "bg-violet-500/10 border-violet-500 text-white"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-300 hover:border-violet-500/30"
              }`}
            >
              <p className="text-base leading-relaxed">{idea}</p>
            </div>
          ))}
        </div>
      )}

      {/* Trend Validation */}
      {validating && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
          <span className="text-zinc-400">Analyzing trend potential...</span>
        </div>
      )}

      {trendData && !validating && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-400">Trend Analysis</h3>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
              trendData.score >= 70
                ? "bg-emerald-500/10 text-emerald-400"
                : trendData.score >= 40
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-red-500/10 text-red-400"
            }`}>
              {trendData.score}/100
            </div>
          </div>
          <p className="text-zinc-300 text-sm mb-4">{trendData.reasoning}</p>
          {trendData.hooks.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Suggested Hooks</h4>
              <ul className="space-y-1.5">
                {trendData.hooks.map((hook, idx) => (
                  <li
                    key={idx}
                    onClick={() => { setTopic(hook); setSelectedIdea(hook); }}
                    className="text-sm text-violet-300 cursor-pointer hover:text-violet-200 transition-colors"
                  >
                    &rarr; {hook}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-white/[0.06]">
        <button
          onClick={() => setStep("idea")}
          className="px-4 py-2.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          Back
        </button>
        <button
          disabled={!topic.trim()}
          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          onClick={async () => {
            const state = store.getState();
            await saveProgress({
              topic,
              wizard_step: "script",
              draft_scenes: { scenes: state.scenes, settings: state.settings, refinedIdea: state.refinedIdea, targetKeywords: state.targetKeywords },
            });
            setStep("script");
          }}
        >
          Continue to Script
        </button>
      </div>
    </div>
  );
}
