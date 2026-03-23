"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";

type Idea = { title: string; description: string; trendScore: number };

export function IdeaStep({
  topic,
  initialIdeas,
  onTopicChange,
  onContinue,
}: {
  topic: string;
  initialIdeas: Idea[];
  onTopicChange: (topic: string) => void;
  onContinue: (topic: string) => void;
}) {
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas);
  const addToast = useToast();

  async function generateIdeas() {
    if (!topic.trim()) return;
    setGeneratingIdeas(true);
    try {
      const res = await fetch("/api/wizard/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!res.ok) throw new Error("Failed to generate ideas");
      const data = await res.json();
      if (Array.isArray(data)) {
        setIdeas(data);
      }
    } catch {
      addToast("Failed to generate ideas. Please try again.", "error");
    } finally {
      setGeneratingIdeas(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-white mb-2">Refine your idea</h2>
      <p className="text-zinc-400 mb-8 text-base">Let&apos;s find the best angle for your topic.</p>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-8">
        <label className="block text-base font-medium text-zinc-300 mb-2">Your Original Topic</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500/50"
          />
          <button
            onClick={generateIdeas}
            disabled={generatingIdeas || !topic.trim()}
            className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generatingIdeas ? "Thinking..." : "Generate Hooks"}
          </button>
        </div>
      </div>

      {ideas.length > 0 && (
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-medium text-zinc-400">AI Suggested Angles</h3>
          {ideas.map((idea, idx) => (
            <div
              key={idx}
              className="group cursor-pointer bg-white/[0.02] border border-white/[0.06] hover:border-violet-500/50 hover:bg-violet-500/[0.02] rounded-xl p-5 transition-all"
              onClick={() => onTopicChange(idea.description)}
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

      <div className="flex justify-end pt-6 border-t border-white/[0.06]">
        <button
          disabled={!topic.trim()}
          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onContinue(topic)}
        >
          Continue to Script
        </button>
      </div>
    </div>
  );
}
