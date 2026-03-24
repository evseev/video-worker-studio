"use client";

import { useState } from "react";
import type { WizardState } from "@/lib/stores/wizard-store";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";

type Props = { store: StoreApi<WizardState> };

const TEMPLATES = [
  { id: "Slideshow", label: "Slideshow", desc: "Single image with caption overlay", icon: "slideshow" },
  { id: "Fact Card", label: "Fact Card", desc: "White card overlay on image", icon: "factcard" },
  { id: "Compilation", label: "Compilation", desc: "Centered uppercase text", icon: "compilation" },
  { id: "Comparison", label: "Comparison", desc: "Side-by-side comparison style", icon: "comparison" },
  { id: "Evolution", label: "Evolution", desc: "Timeline progression style", icon: "evolution" },
];

function TemplatePreview({ icon }: { icon: string }) {
  // Mini SVG layout previews for each template
  return (
    <div className="w-full aspect-[9/16] bg-black/30 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
      {icon === "slideshow" && (
        <svg width="48" height="80" viewBox="0 0 48 80" fill="none">
          <rect x="4" y="4" width="40" height="50" rx="2" fill="rgba(139,92,246,0.2)" stroke="rgba(139,92,246,0.4)" strokeWidth="1" />
          <rect x="8" y="58" width="32" height="4" rx="1" fill="rgba(255,255,255,0.3)" />
          <rect x="12" y="65" width="24" height="3" rx="1" fill="rgba(255,255,255,0.15)" />
        </svg>
      )}
      {icon === "factcard" && (
        <svg width="48" height="80" viewBox="0 0 48 80" fill="none">
          <rect x="4" y="4" width="40" height="72" rx="2" fill="rgba(139,92,246,0.15)" />
          <rect x="8" y="30" width="32" height="30" rx="6" fill="rgba(255,255,255,0.9)" />
          <rect x="14" y="38" width="20" height="3" rx="1" fill="rgba(0,0,0,0.3)" />
          <rect x="16" y="44" width="16" height="2" rx="1" fill="rgba(0,0,0,0.15)" />
          <rect x="16" y="49" width="16" height="2" rx="1" fill="rgba(0,0,0,0.15)" />
        </svg>
      )}
      {icon === "compilation" && (
        <svg width="48" height="80" viewBox="0 0 48 80" fill="none">
          <rect x="4" y="4" width="40" height="72" rx="2" fill="rgba(139,92,246,0.15)" />
          <rect x="8" y="32" width="32" height="5" rx="1" fill="rgba(255,255,255,0.4)" />
          <rect x="12" y="40" width="24" height="3" rx="1" fill="rgba(255,255,255,0.2)" />
          <text x="24" y="28" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontWeight="bold">#1</text>
        </svg>
      )}
      {icon === "comparison" && (
        <svg width="48" height="80" viewBox="0 0 48 80" fill="none">
          <rect x="4" y="4" width="18" height="50" rx="2" fill="rgba(139,92,246,0.2)" stroke="rgba(139,92,246,0.3)" strokeWidth="1" />
          <rect x="26" y="4" width="18" height="50" rx="2" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.3)" strokeWidth="1" />
          <line x1="24" y1="4" x2="24" y2="54" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <rect x="8" y="60" width="32" height="4" rx="1" fill="rgba(255,255,255,0.3)" />
        </svg>
      )}
      {icon === "evolution" && (
        <svg width="48" height="80" viewBox="0 0 48 80" fill="none">
          <rect x="4" y="4" width="40" height="72" rx="2" fill="rgba(139,92,246,0.15)" />
          <circle cx="12" cy="20" r="3" fill="rgba(139,92,246,0.4)" />
          <line x1="12" y1="23" x2="12" y2="40" stroke="rgba(139,92,246,0.3)" strokeWidth="1" />
          <circle cx="12" cy="43" r="3" fill="rgba(139,92,246,0.4)" />
          <line x1="12" y1="46" x2="12" y2="60" stroke="rgba(139,92,246,0.3)" strokeWidth="1" />
          <circle cx="12" cy="63" r="3" fill="rgba(139,92,246,0.4)" />
          <rect x="20" y="18" width="20" height="3" rx="1" fill="rgba(255,255,255,0.3)" />
          <rect x="20" y="41" width="20" height="3" rx="1" fill="rgba(255,255,255,0.3)" />
          <rect x="20" y="61" width="20" height="3" rx="1" fill="rgba(255,255,255,0.3)" />
        </svg>
      )}
    </div>
  );
}

export function ScriptStep({ store }: Props) {
  const { projectId, topic, scenes, setScenes, selectedTemplate, setSelectedTemplate, refinedIdea, saveProgress, setStep } = useStore(store);
  const [generatingScript, setGeneratingScript] = useState(false);

  const ideaText = refinedIdea?.selectedIdea || topic;

  async function generateScript() {
    if (!ideaText.trim()) return;
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/wizard/generate-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, idea: ideaText, template: selectedTemplate }),
      });
      const data = await res.json();
      if (data.scenes) {
        setScenes(data.scenes);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingScript(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-white mb-2">Choose template & generate script</h2>
      <p className="text-zinc-400 mb-8 text-base">Select a visual style, then let AI write your scene-by-scene script.</p>

      {/* Template Selection */}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Video Template</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => setSelectedTemplate(tmpl.id)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedTemplate === tmpl.id
                  ? "bg-violet-500/10 border-violet-500 text-white"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20"
              }`}
            >
              <TemplatePreview icon={tmpl.icon} />
              <div className="font-medium text-sm mb-0.5">{tmpl.label}</div>
              <div className="text-xs opacity-60 leading-tight">{tmpl.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Generate Script */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm text-zinc-400">Generating for: </span>
            <span className="text-sm text-zinc-200 font-medium">{ideaText.slice(0, 80)}{ideaText.length > 80 ? "..." : ""}</span>
          </div>
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
                  value={scene.searchKeyword}
                  onChange={(e) => {
                    store.getState().updateScene(idx, { searchKeyword: e.target.value });
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
              draft_scenes: { scenes: state.scenes, settings: state.settings, refinedIdea: state.refinedIdea },
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
