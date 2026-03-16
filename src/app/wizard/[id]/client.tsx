"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Tables } from "@/lib/supabase/types";

type Project = Tables<"projects">;

export function WizardClient({ project }: { project: Project }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStep = searchParams.get("step") || project.wizard_step || "idea";
  const [currentStep, setCurrentStep] = useState(urlStep);
  const [saving, setSaving] = useState(false);
  const [topic, setTopic] = useState(project.topic || "");

  // Step 1 State
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [ideas, setIdeas] = useState<{title: string, description: string, trendScore: number}[]>(
    project.trend_validation_data ? (typeof project.trend_validation_data === "string" ? JSON.parse(project.trend_validation_data) : project.trend_validation_data) as any : []
  );

  // Step 2 State
  const [generatingScript, setGeneratingScript] = useState(false);
  const [scenes, setScenes] = useState<{scriptText: string, searchKeyword: string}[]>(
    project.draft_scenes ? (typeof project.draft_scenes === "string" ? JSON.parse(project.draft_scenes) : project.draft_scenes) as any : []
  );

  // Step 3 State
  const [selectedTemplate, setSelectedTemplate] = useState<string>("minimalist");
  const [isRendering, setIsRendering] = useState(false);

  // Update URL when step changes, without reloading the page
  useEffect(() => {
    if (urlStep !== currentStep) {
      router.replace(`/wizard/${project.id}?step=${currentStep}`, { scroll: false });
    }
  }, [currentStep, project.id, router, urlStep]);

  async function saveProgress(updates: Partial<Project>) {
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
  }

  async function generateIdeas() {
    if (!topic.trim()) return;
    setGeneratingIdeas(true);
    try {
      const res = await fetch("/api/wizard/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setIdeas(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingIdeas(false);
    }
  }

  async function generateScript() {
    if (!topic) return;
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/wizard/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
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

  async function startGeneration() {
    setSaving(true);
    try {
      await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, topic, scenes }),
      });
      // Redirect or go to a progress screen, etc.
      window.location.href = `/project/${project.id}`;
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

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
              <span className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${currentStep === "idea" ? "bg-white/[0.1] text-white" : "text-zinc-500"}`}>Idea</span>
              <span className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${currentStep === "script" ? "bg-white/[0.1] text-white" : "text-zinc-500"}`}>Script</span>
              <span className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${currentStep === "render" ? "bg-white/[0.1] text-white" : "text-zinc-500"}`}>Render</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {currentStep === "idea" && (
            <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-semibold text-white mb-2">Refine your idea</h2>
              <p className="text-zinc-400 mb-8">Let's find the best angle for your topic.</p>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-8">
                <label className="block text-sm font-medium text-zinc-300 mb-2">Your Original Topic</label>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
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
                      onClick={() => {
                        setTopic(idea.description);
                        // Optional: auto-advance
                      }}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h4 className="text-white font-medium group-hover:text-violet-400 transition-colors">{idea.title}</h4>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-medium shrink-0">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                          {idea.trendScore}/100
                        </div>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed">{idea.description}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-6 border-t border-white/[0.06]">
                <button 
                  disabled={!topic.trim()}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={async () => {
                    await saveProgress({ topic, wizard_step: "script" });
                    setCurrentStep("script");
                  }}
                >
                  Continue to Script
                </button>
              </div>
            </div>
          )}

          {currentStep === "script" && (
            <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-semibold text-white mb-2">Generate Script</h2>
              <p className="text-zinc-400 mb-8">Let AI write a script and pick templates for your video.</p>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-8">
                <button
                  onClick={generateScript}
                  disabled={generatingScript || !topic.trim()}
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {generatingScript ? "Writing script..." : "Generate Script with AI"}
                </button>
              </div>

              {scenes.length > 0 && (
                <div className="space-y-4 mb-8">
                  <h3 className="text-sm font-medium text-zinc-400">Generated Scenes</h3>
                  {scenes.map((scene, idx) => (
                    <div key={idx} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                      <div className="mb-2 flex justify-between items-center">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Scene {idx + 1}</span>
                        <input
                          type="text"
                          value={scene.searchKeyword}
                          onChange={(e) => {
                            const newScenes = [...scenes];
                            newScenes[idx].searchKeyword = e.target.value;
                            setScenes(newScenes);
                          }}
                          className="px-2 py-1 bg-white/[0.06] border border-white/10 rounded text-xs text-zinc-300 w-1/2 focus:outline-none focus:border-violet-500/50"
                          placeholder="Search keyword"
                        />
                      </div>
                      <textarea
                        value={scene.scriptText}
                        onChange={(e) => {
                          const newScenes = [...scenes];
                          newScenes[idx].scriptText = e.target.value;
                          setScenes(newScenes);
                        }}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/50 min-h-[80px] resize-y"
                        placeholder="Script text"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-6 border-t border-white/[0.06]">
                <button 
                  disabled={scenes.length === 0}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={async () => {
                    await saveProgress({ wizard_step: "render" }); // Could save the script here
                    setCurrentStep("render");
                  }}
                >
                  Continue to Finalize
                </button>
              </div>
            </div>
          )}

          {currentStep === "render" && (
            <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-semibold text-white mb-2">Final Polish</h2>
              <p className="text-zinc-400 mb-8">Choose a visual template and start rendering your final video.</p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {["minimalist", "bold", "neon", "corporate"].map((templateOption) => (
                  <button
                    key={templateOption}
                    onClick={() => setSelectedTemplate(templateOption)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedTemplate === templateOption
                        ? "bg-violet-500/10 border-violet-500 text-white"
                        : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    <div className="font-medium capitalize mb-1">{templateOption}</div>
                    <div className="text-xs opacity-70">
                      Visual style for text overlays and transitions.
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex justify-end pt-6 border-t border-white/[0.06] gap-4">
                <button 
                  disabled={isRendering}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  onClick={async () => {
                    setIsRendering(true);
                    try {
                      const res = await fetch("/api/wizard/render", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          projectId: project.id,
                          scenes,
                          template: selectedTemplate
                        })
                      });
                      if (!res.ok) throw new Error("Failed to start render");
                      
                      router.push("/");
                    } catch (error) {
                      console.error("Render error:", error);
                      alert("Failed to start render. Please try again.");
                      setIsRendering(false);
                    }
                  }}
                >
                  {isRendering ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Starting Render...
                    </>
                  ) : (
                    "Generate Video"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
