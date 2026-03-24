"use client";

import { useStore } from "zustand";
import { allTemplates } from "@/templates";
import type { TemplateId } from "@/templates/types";
import type { WizardStoreApi } from "@/lib/stores/wizard-store";

export function TemplateStep({ store }: { store: WizardStoreApi }) {
  const { topic, setTopic, selectedTemplate, settings, saveProgress, setStep } = useStore(store);
  const isLandscape = settings.aspectRatio === "16:9";

  const canContinue = topic.trim().length > 0 && !!selectedTemplate;

  return (
    <div className="mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-white mb-2">Choose a template</h2>
      <p className="text-zinc-400 mb-8 text-base">Pick a visual style for your video, then configure your project settings.</p>

      {/* Template Picker */}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Video Template</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {allTemplates.map((tmpl) => {
            const isSelected = selectedTemplate === tmpl.id;
            return (
              <button
                key={tmpl.id}
                onClick={() => store.getState().setSelectedTemplate(tmpl.id as TemplateId)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-violet-500/10 border-violet-500"
                    : "bg-white/[0.02] border-white/[0.06] hover:border-white/20"
                }`}
              >
                <TemplatePreview templateId={tmpl.id} isLandscape={isLandscape} isSelected={isSelected} />
                <div className={`font-semibold text-sm mb-1 ${isSelected ? "text-white" : "text-zinc-200"}`}>
                  {tmpl.name}
                </div>
                <div className="text-xs text-zinc-500 leading-tight mb-2">{tmpl.description}</div>
                <div className="text-xs text-zinc-600 leading-snug mb-2 italic">{tmpl.useCases}</div>
                <div className={`text-xs font-medium ${isSelected ? "text-violet-400" : "text-zinc-600"}`}>
                  {tmpl.assetsPerScene} image{tmpl.assetsPerScene > 1 ? "s" : ""} per scene
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Project Settings */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6">
        <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Project Settings</h3>

        {/* Topic */}
        <div className="mb-5">
          <label className="block text-sm text-zinc-400 mb-1">Video Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500/50"
            placeholder="e.g. 5 tips for better sleep that most people ignore"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Scene Count */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Number of Scenes</label>
            <select
              value={settings.sceneCount}
              onChange={(e) =>
                store.getState().setSettings({ sceneCount: parseInt(e.target.value) })
              }
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
            >
              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <option key={n} value={n}>
                  {n} scenes
                </option>
              ))}
            </select>
          </div>

          {/* Scene Duration */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Duration per Scene</label>
            <select
              value={settings.sceneDuration}
              onChange={(e) =>
                store.getState().setSettings({ sceneDuration: parseInt(e.target.value) })
              }
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
            >
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
              <option value={7}>7 seconds</option>
              <option value={10}>10 seconds</option>
            </select>
          </div>

          {/* Aspect Ratio */}
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
                  {ratio === "9:16" ? "9:16 Shorts" : "16:9 YouTube"}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Video Quality</label>
            <select
              value={settings.quality}
              onChange={(e) =>
                store.getState().setSettings({ quality: e.target.value as "hd" | "fullhd" | "4k" })
              }
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
            >
              <option value="hd">720p</option>
              <option value="fullhd">1080p</option>
              <option value="4k">4K</option>
            </select>
          </div>
        </div>
      </div>

      {/* Continue */}
      <div className="flex justify-end pt-6 border-t border-white/[0.06]">
        <button
          disabled={!canContinue}
          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          onClick={async () => {
            const state = store.getState();
            await saveProgress({
              topic: state.topic,
              template: state.selectedTemplate,
              wizard_step: "idea",
              draft_scenes: { scenes: state.scenes, settings: state.settings, refinedIdea: state.refinedIdea },
            });
            setStep("idea");
          }}
        >
          Continue to Idea
        </button>
      </div>
    </div>
  );
}

function TemplatePreview({
  templateId,
  isLandscape,
  isSelected,
}: {
  templateId: string;
  isLandscape: boolean;
  isSelected: boolean;
}) {
  const vw = isLandscape ? 80 : 48;
  const vh = isLandscape ? 48 : 80;
  const accent = isSelected ? "rgba(139,92,246," : "rgba(99,102,241,";

  return (
    <div
      className={`w-full ${isLandscape ? "aspect-[16/9]" : "aspect-[9/16]"} bg-black/30 rounded-lg mb-3 flex items-center justify-center overflow-hidden`}
    >
      {/* Slideshow: single large image rect with text bar at bottom */}
      {templateId === "slideshow" && (
        <svg width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} fill="none">
          {/* Main image area */}
          <rect
            x="4"
            y="4"
            width={vw - 8}
            height={vh - 8}
            rx="3"
            fill={`${accent}0.15)`}
            stroke={`${accent}0.4)`}
            strokeWidth="1"
          />
          {/* Text bar overlay at bottom */}
          <rect
            x="4"
            y={vh - 20}
            width={vw - 8}
            height="16"
            rx="0"
            fill="rgba(0,0,0,0.55)"
          />
          <rect x="10" y={vh - 16} width={vw - 28} height="3" rx="1" fill="rgba(255,255,255,0.7)" />
          <rect x="10" y={vh - 11} width={vw - 36} height="2" rx="1" fill="rgba(255,255,255,0.35)" />
        </svg>
      )}

      {/* Comparison: two side-by-side rects with VS label */}
      {templateId === "comparison" && (
        <svg width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} fill="none">
          {/* Left image */}
          <rect
            x="4"
            y="4"
            width={vw / 2 - 6}
            height={vh - 8}
            rx="3"
            fill={`${accent}0.2)`}
            stroke={`${accent}0.35)`}
            strokeWidth="1"
          />
          {/* Right image */}
          <rect
            x={vw / 2 + 3}
            y="4"
            width={vw / 2 - 6}
            height={vh - 8}
            rx="3"
            fill="rgba(59,130,246,0.2)"
            stroke="rgba(59,130,246,0.35)"
            strokeWidth="1"
          />
          {/* VS badge */}
          <circle cx={vw / 2} cy={vh / 2} r="6" fill="rgba(255,255,255,0.9)" />
          <text
            x={vw / 2}
            y={vh / 2 + 3}
            textAnchor="middle"
            fill="rgba(0,0,0,0.7)"
            fontSize="5"
            fontWeight="bold"
          >
            VS
          </text>
        </svg>
      )}

      {/* Fact Card: large bg image, card below with thumbnail + text lines */}
      {templateId === "fact-card" && (
        <svg width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} fill="none">
          {/* Background image (top portion) */}
          <rect
            x="4"
            y="4"
            width={vw - 8}
            height={vh * 0.52}
            rx="3"
            fill={`${accent}0.15)`}
            stroke={`${accent}0.3)`}
            strokeWidth="1"
          />
          {/* Fact card overlay */}
          <rect
            x="8"
            y={vh * 0.44}
            width={vw - 16}
            height={vh * 0.5}
            rx="4"
            fill="rgba(255,255,255,0.93)"
          />
          {/* Thumbnail square inside card */}
          <rect
            x="13"
            y={vh * 0.48}
            width={vh * 0.16}
            height={vh * 0.16}
            rx="2"
            fill={`${accent}0.35)`}
          />
          {/* Text lines inside card */}
          <rect x={13 + vh * 0.16 + 5} y={vh * 0.49} width={vw - 40} height="3" rx="1" fill="rgba(0,0,0,0.4)" />
          <rect x={13 + vh * 0.16 + 5} y={vh * 0.49 + 6} width={vw - 48} height="2" rx="1" fill="rgba(0,0,0,0.2)" />
          {/* Divider */}
          <line
            x1="13"
            y1={vh * 0.48 + vh * 0.16 + 5}
            x2={vw - 13}
            y2={vh * 0.48 + vh * 0.16 + 5}
            stroke="rgba(0,0,0,0.1)"
            strokeWidth="0.5"
          />
          {/* Fact rows */}
          <rect x="13" y={vh * 0.48 + vh * 0.16 + 9} width={vw - 40} height="2" rx="1" fill="rgba(0,0,0,0.15)" />
          <rect x="13" y={vh * 0.48 + vh * 0.16 + 14} width={vw - 44} height="2" rx="1" fill="rgba(0,0,0,0.1)" />
        </svg>
      )}
    </div>
  );
}
