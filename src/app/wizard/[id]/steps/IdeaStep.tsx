"use client";

import { useState } from "react";
import type { WizardState } from "@/lib/stores/wizard-store";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";

type Props = { store: StoreApi<WizardState> };

export function IdeaStep({ store }: Props) {
  const { topic, setTopic, setVideoTitle, selectedTemplate, settings, saveProgress, setStep } = useStore(store);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [ideas, setIdeas] = useState<{ title: string; description: string; trendScore: number }[]>([]);

  async function generateIdeas() {
    if (!topic.trim()) return;
    setGeneratingIdeas(true);
    try {
      const enrichedTopic = `${topic} (Template: ${selectedTemplate})`;
      const res = await fetch("/api/wizard/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: enrichedTopic, sceneCount: settings.sceneCount, sceneDuration: settings.sceneDuration }),
      });
      const data = await res.json();
      if (Array.isArray(data)) setIdeas(data);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingIdeas(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-white mb-2">Develop your idea</h2>
      <p className="text-zinc-400 mb-6 text-base">Generate viral angles and hook ideas for your video.</p>

      {/* Summary from Step 1 */}
      <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 mb-6 text-sm">
        <span className="text-zinc-500">Template:</span>
        <span className="text-zinc-200 font-medium capitalize">{selectedTemplate.replace("-", " ")}</span>
        <span className="text-zinc-600 mx-1">·</span>
        <span className="text-zinc-500">Topic:</span>
        <span className="text-zinc-200 font-medium truncate">{topic || <span className="text-zinc-600 italic">not set</span>}</span>
      </div>

      {/* Topic Input */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6">
        <label className="block text-base font-medium text-zinc-300 mb-2">Refine Your Topic</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500/50"
            placeholder="e.g. 5 tips for better sleep that most people ignore"
          />
          <button
            onClick={generateIdeas}
            disabled={generatingIdeas || !topic.trim()}
            className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            {generatingIdeas ? "Thinking..." : "Generate Hooks"}
          </button>
        </div>
      </div>

      {/* AI Suggested Angles */}
      {ideas.length > 0 && (
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-medium text-zinc-400">AI Suggested Angles</h3>
          {ideas.map((idea, idx) => (
            <div
              key={idx}
              className="group cursor-pointer bg-white/[0.02] border border-white/[0.06] hover:border-violet-500/50 hover:bg-violet-500/[0.02] rounded-xl p-5 transition-all"
              onClick={() => {
                setTopic(idea.description);
                setVideoTitle(idea.title);
              }}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <h4 className="text-white font-medium group-hover:text-violet-400 transition-colors">{idea.title}</h4>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-medium shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  {idea.trendScore}/100
                </div>
              </div>
              <p className="text-base text-zinc-400 leading-relaxed">{idea.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Continue */}
      <div className="flex justify-between pt-6 border-t border-white/[0.06]">
        <button
          onClick={() => setStep("template")}
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
              wizard_step: "refine",
              video_title: state.videoTitle,
              draft_scenes: { scenes: state.scenes, settings, refinedIdea: state.refinedIdea, videoTitle: state.videoTitle },
            });
            setStep("refine");
          }}
        >
          Continue to Refine
        </button>
      </div>
    </div>
  );
}
