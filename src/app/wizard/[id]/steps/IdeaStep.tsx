"use client";

import { useState } from "react";
import type { WizardState } from "@/lib/stores/wizard-store";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";

type Props = { store: StoreApi<WizardState> };

export function IdeaStep({ store }: Props) {
  const { topic, setTopic, settings, saveProgress, setStep } = useStore(store);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [ideas, setIdeas] = useState<{ title: string; description: string; trendScore: number }[]>([]);

  async function generateIdeas() {
    if (!topic.trim()) return;
    setGeneratingIdeas(true);
    try {
      const res = await fetch("/api/wizard/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, sceneCount: settings.sceneCount, sceneDuration: settings.sceneDuration }),
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
      <h2 className="text-2xl font-semibold text-white mb-2">Start with your idea</h2>
      <p className="text-zinc-400 mb-8 text-base">Describe your video topic and configure basic settings.</p>

      {/* Topic Input */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6">
        <label className="block text-base font-medium text-zinc-300 mb-2">Your Topic</label>
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

      {/* Video Settings */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6">
        <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Video Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Number of Scenes</label>
            <input
              type="number"
              min={2}
              max={100}
              value={settings.sceneCount}
              onChange={(e) => store.getState().setSettings({ sceneCount: Math.max(2, Math.min(100, parseInt(e.target.value) || 6)) })}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Duration per Scene (sec)</label>
            <input
              type="number"
              min={2}
              max={60}
              value={settings.sceneDuration}
              onChange={(e) => store.getState().setSettings({ sceneDuration: Math.max(2, Math.min(60, parseInt(e.target.value) || 5)) })}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Aspect Ratio</label>
            <div className="flex gap-2">
              {(["9:16", "16:9"] as const).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => store.getState().setSettings({ aspectRatio: ratio })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    settings.aspectRatio === ratio
                      ? "bg-violet-500/20 border border-violet-500 text-white"
                      : "bg-white/[0.04] border border-white/10 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Quality</label>
            <select
              value={settings.quality}
              onChange={(e) => store.getState().setSettings({ quality: e.target.value as "hd" | "fullhd" | "4k" })}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
            >
              <option value="hd">HD (720p)</option>
              <option value="fullhd">Full HD (1080p)</option>
              <option value="4k">4K (2160p)</option>
            </select>
          </div>
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
              onClick={() => setTopic(idea.description)}
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
      <div className="flex justify-end pt-6 border-t border-white/[0.06]">
        <button
          disabled={!topic.trim()}
          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          onClick={async () => {
            await saveProgress({
              topic,
              wizard_step: "refine",
              draft_scenes: { scenes: store.getState().scenes, settings, refinedIdea: store.getState().refinedIdea },
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
