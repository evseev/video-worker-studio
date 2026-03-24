"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "zustand";
import type { Tables } from "@/lib/supabase/types";
import { createWizardStore, type WizardStep, type WizardStoreApi } from "@/lib/stores/wizard-store";
import { IdeaStep } from "./steps/IdeaStep";
import { RefineStep } from "./steps/RefineStep";
import { ScriptStep } from "./steps/ScriptStep";
import { PreviewStep } from "./steps/PreviewStep";
import { RenderStep } from "./steps/RenderStep";

type Project = Tables<"projects">;

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "idea", label: "Idea" },
  { key: "refine", label: "Refine" },
  { key: "script", label: "Script" },
  { key: "preview", label: "Preview" },
  { key: "render", label: "Render" },
];

export function WizardClient({ project }: { project: Project }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeRef = useRef<WizardStoreApi | null>(null);

  if (!storeRef.current) {
    storeRef.current = createWizardStore(project);
    // Sync URL step param into store on init
    const urlStep = searchParams.get("step") as WizardStep | null;
    if (urlStep && STEPS.some((s) => s.key === urlStep)) {
      storeRef.current.setState({ currentStep: urlStep });
    }
  }

  const store = storeRef.current;
  const { currentStep, topic, saving, projectStatus } = useStore(store);

  // Sync project prop changes (from server refresh) into store
  // Use status + video_url as deps to ensure effect fires when data changes
  // (not just when the object reference changes)
  const projectStatus_server = project.status;
  const videoUrl_server = project.video_url;
  useEffect(() => {
    store.getState().syncFromProject(project);
  }, [projectStatus_server, videoUrl_server, project, store]);

  // Update URL when step changes
  useEffect(() => {
    const urlStep = searchParams.get("step");
    if (urlStep !== currentStep) {
      router.replace(`/wizard/${project.id}?step=${currentStep}`, { scroll: false });
    }
  }, [currentStep, project.id, router, searchParams]);

  // Poll for status updates during rendering
  useEffect(() => {
    if (projectStatus === "processing" || projectStatus === "rendering") {
      const interval = setInterval(() => router.refresh(), 5000);
      return () => clearInterval(interval);
    }
  }, [projectStatus, router]);

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
              {STEPS.map((step, idx) => (
                <span
                  key={step.key}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    currentStep === step.key
                      ? "bg-white/[0.1] text-white"
                      : STEPS.findIndex((s) => s.key === currentStep) > idx
                        ? "text-zinc-400"
                        : "text-zinc-600"
                  }`}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {currentStep === "idea" && <IdeaStep store={store} />}
          {currentStep === "refine" && <RefineStep store={store} />}
          {currentStep === "script" && <ScriptStep store={store} />}
          {currentStep === "preview" && <PreviewStep store={store} />}
          {currentStep === "render" && <RenderStep store={store} />}
        </div>
      </main>
    </div>
  );
}
