"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Tables } from "@/lib/supabase/types";
import { IdeaStep } from "@/components/wizard/idea-step";
import { ScriptStep } from "@/components/wizard/script-step";
import { RenderStep } from "@/components/wizard/render-step";
import type { SceneData } from "@/components/wizard/scene-card";

type Project = Tables<"projects">;

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function WizardClient({ project }: { project: Project }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStep = searchParams.get("step") || project.wizard_step || "idea";
  const [currentStep, setCurrentStep] = useState(urlStep);
  const [saving, setSaving] = useState(false);
  const [topic, setTopic] = useState(project.topic || "");
  const [scenes, setScenes] = useState<SceneData[]>(
    parseJsonField(project.draft_scenes, [])
  );

  const ideas = parseJsonField<{ title: string; description: string; trendScore: number }[]>(
    project.trend_validation_data, []
  );

  useEffect(() => {
    if (urlStep !== currentStep) {
      router.replace(`/wizard/${project.id}?step=${currentStep}`, { scroll: false });
    }
  }, [currentStep, project.id, router, urlStep]);

  const saveProgress = useCallback(
    async (updates: Record<string, unknown>) => {
      setSaving(true);
      try {
        await fetch("/api/wizard/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id, ...updates }),
        });
      } catch (e) {
        console.error("Failed to save progress", e);
      } finally {
        setSaving(false);
      }
    },
    [project.id]
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl shrink-0">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-base font-medium text-white tracking-tight">
              {topic || "New Video"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-zinc-500">Saving...</span>}
            <div className="flex items-center bg-white/[0.04] rounded-lg p-1">
              {["idea", "script", "render"].map((step) => (
                <span
                  key={step}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors capitalize ${
                    currentStep === step ? "bg-white/[0.1] text-white" : "text-zinc-500"
                  }`}
                >
                  {step}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {currentStep === "idea" && (
            <IdeaStep
              topic={topic}
              initialIdeas={ideas}
              onTopicChange={setTopic}
              onContinue={async (finalTopic) => {
                await saveProgress({ topic: finalTopic, wizard_step: "script" });
                setCurrentStep("script");
              }}
            />
          )}

          {currentStep === "script" && (
            <ScriptStep
              topic={topic}
              projectId={project.id}
              sceneCount={project.scene_count}
              scenes={scenes}
              onScenesChange={setScenes}
              saveProgress={saveProgress}
              onContinue={async () => {
                await saveProgress({ wizard_step: "render", draft_scenes: scenes });
                setCurrentStep("render");
              }}
            />
          )}

          {currentStep === "render" && (
            <RenderStep
              projectId={project.id}
              scenes={scenes}
              defaultAspectRatio={project.aspect_ratio}
              defaultVideoQuality={project.video_quality}
              sceneDuration={project.scene_duration}
            >
              {/* Future sub-components: CaptionStyleSelector, VideoConfigSelector, MusicSelector, VoiceoverUpload */}
            </RenderStep>
          )}
        </div>
      </main>
    </div>
  );
}
