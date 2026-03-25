"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { WizardState } from "@/lib/stores/wizard-store";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";
import { MusicSelector } from "@/components/wizard/music-selector";
import { VoiceoverUpload } from "@/components/wizard/voiceover-upload";

type Props = { store: StoreApi<WizardState> };

const QUALITY_LABELS: Record<string, string> = { hd: "HD (720p)", fullhd: "Full HD (1080p)", "4k": "4K (2160p)" };

export function RenderStep({ store }: Props) {
  const { projectId, scenes, selectedTemplate, settings, projectStatus, videoUrl, renderErrorContext, saveProgress, setStep } = useStore(store);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [backgroundMusic, setBackgroundMusic] = useState<string | null>(null);
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const router = useRouter();

  const isProcessing = projectStatus === "processing" || projectStatus === "rendering";
  const isCompleted = projectStatus === "completed" && !!videoUrl;
  const isFailed = projectStatus === "failed_render" || projectStatus === "failed_ai";

  // Clear local isRendering flag once the server status takes over
  useEffect(() => {
    if (isProcessing || isCompleted || isFailed) {
      setIsRendering(false);
    }
  }, [isProcessing, isCompleted, isFailed]);

  const totalDuration = scenes.length * settings.sceneDuration;

  async function startRender() {
    setIsRendering(true);
    setRenderError(null);
    try {
      const res = await fetch("/api/wizard/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, scenes, template: selectedTemplate, aspectRatio: settings.aspectRatio, videoQuality: settings.quality, sceneDuration: settings.sceneDuration, backgroundMusic, voiceoverUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("Render API error:", res.status, body);
        throw new Error(body.error || "Failed to start render");
      }
      // Start polling by refreshing the server component
      router.refresh();
    } catch (error) {
      console.error("Render error:", error);
      setRenderError("Failed to start render. Please try again.");
      setIsRendering(false);
    }
  }

  async function retryRender() {
    await startRender();
  }

  // Completed state — video player + download
  if (isCompleted) {
    return (
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-2xl font-semibold text-white mb-2">Your video is ready!</h2>
        <p className="text-zinc-400 mb-8 text-base">Watch the preview below or download the final MP4.</p>

        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden mb-6">
          <video
            src={videoUrl}
            controls
            className="w-full"
            style={{ maxHeight: "70vh" }}
          />
        </div>

        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-zinc-500 block mb-1">Template</span>
              <span className="text-zinc-200">{selectedTemplate}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block mb-1">Scenes</span>
              <span className="text-zinc-200">{scenes.length}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block mb-1">Aspect Ratio</span>
              <span className="text-zinc-200">{settings.aspectRatio}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block mb-1">Duration</span>
              <span className="text-zinc-200">~{totalDuration}s</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
          <a
            href={videoUrl}
            download
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download MP4
          </a>
        </div>
      </div>
    );
  }

  // Processing state — polling
  if (isProcessing || isRendering) {
    return (
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-2xl font-semibold text-white mb-2">Rendering your video</h2>
        <p className="text-zinc-400 mb-8 text-base">This may take a few minutes. You can leave and come back.</p>

        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-10 flex flex-col items-center gap-6 mb-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-white font-medium mb-1">
              {projectStatus === "rendering" ? "Rendering video..." : "Processing scenes..."}
            </p>
            <p className="text-sm text-zinc-500">
              {scenes.length} scenes &middot; {selectedTemplate} template
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Failed state
  if (isFailed) {
    const errorMsg = renderErrorContext && typeof renderErrorContext === "object" && "message" in (renderErrorContext as Record<string, unknown>)
      ? (renderErrorContext as { message: string }).message
      : "An error occurred during rendering.";

    return (
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-2xl font-semibold text-white mb-2">Rendering failed</h2>
        <p className="text-zinc-400 mb-8 text-base">Something went wrong. You can try again.</p>

        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 mb-6">
          <p className="text-red-300 text-sm">{errorMsg}</p>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={() => setStep("preview")}
            className="px-4 py-2.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Back to Preview
          </button>
          <button
            onClick={retryRender}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Retry Render
          </button>
        </div>
      </div>
    );
  }

  // Pre-render state — summary + generate button
  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-white mb-2">Ready to render</h2>
      <p className="text-zinc-400 mb-8 text-base">Review your settings and generate the final video.</p>

      {/* Summary */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-8">
        <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Render Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-zinc-500 block mb-1">Scenes</span>
            <span className="text-lg text-white font-medium">{scenes.length}</span>
          </div>
          <div>
            <span className="text-xs text-zinc-500 block mb-1">Template</span>
            <span className="text-lg text-white font-medium">{selectedTemplate}</span>
          </div>
          <div>
            <span className="text-xs text-zinc-500 block mb-1">Aspect Ratio</span>
            <span className="text-lg text-white font-medium">{settings.aspectRatio}</span>
          </div>
          <div>
            <span className="text-xs text-zinc-500 block mb-1">Quality</span>
            <span className="text-lg text-white font-medium">{QUALITY_LABELS[settings.quality] || settings.quality}</span>
          </div>
          <div>
            <span className="text-xs text-zinc-500 block mb-1">Scene Duration</span>
            <span className="text-lg text-white font-medium">{settings.sceneDuration}s</span>
          </div>
          <div>
            <span className="text-xs text-zinc-500 block mb-1">Est. Total Duration</span>
            <span className="text-lg text-white font-medium">~{totalDuration}s</span>
          </div>
        </div>
      </div>

      {/* Background Music */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6">
        <MusicSelector selected={backgroundMusic} onSelect={setBackgroundMusic} />
      </div>

      {/* Voiceover */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-8">
        <VoiceoverUpload
          voiceoverUrl={voiceoverUrl}
          onUpload={async (file) => {
            const form = new FormData();
            form.append("file", file);
            form.append("projectId", projectId);
            const res = await fetch("/api/wizard/upload-voiceover", { method: "POST", body: form });
            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();
            setVoiceoverUrl(data.voiceoverUrl);
          }}
          onRemove={() => setVoiceoverUrl(null)}
        />
      </div>

      {/* Render Error */}
      {renderError && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-red-300 text-sm">{renderError}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-white/[0.06]">
        <button
          onClick={() => setStep("preview")}
          className="px-4 py-2.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          Back
        </button>
        <button
          disabled={isRendering || scenes.length === 0}
          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          onClick={startRender}
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
  );
}
