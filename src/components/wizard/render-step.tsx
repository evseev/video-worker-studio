"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { TemplateSelector } from "./template-selector";
import { VideoConfigSelector } from "./video-config-selector";
import { MusicSelector } from "./music-selector";
import { CaptionStyleSelector } from "./caption-style-selector";
import { VoiceoverUpload } from "./voiceover-upload";
import type { SceneData } from "./scene-card";

export function RenderStep({
  projectId,
  scenes,
  children,
}: {
  projectId: string;
  scenes: SceneData[];
  children?: ReactNode;
}) {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState("minimalist");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [videoQuality, setVideoQuality] = useState("1080p");
  const [backgroundMusic, setBackgroundMusic] = useState<string | null>(null);
  const [captionStyle, setCaptionStyle] = useState("minimal");
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const addToast = useToast();

  async function handleRender() {
    setIsRendering(true);
    try {
      const res = await fetch("/api/wizard/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scenes,
          template: selectedTemplate,
          aspectRatio,
          videoQuality,
          backgroundMusic,
          captionStyle,
          voiceoverUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start render");
      }

      router.replace(`/projects/${projectId}`);
      router.refresh();
    } catch {
      addToast("Failed to start render. Please try again.", "error");
      setIsRendering(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-white mb-2">Final Polish</h2>
      <p className="text-zinc-400 mb-8 text-base">Choose your settings and start rendering your final video.</p>

      <div className="space-y-8 mb-8">
        <TemplateSelector
          selected={selectedTemplate}
          onSelect={setSelectedTemplate}
        />

        <VideoConfigSelector
          aspectRatio={aspectRatio}
          videoQuality={videoQuality}
          onAspectRatioChange={setAspectRatio}
          onVideoQualityChange={setVideoQuality}
        />

        <MusicSelector
          selected={backgroundMusic}
          onSelect={setBackgroundMusic}
        />

        <CaptionStyleSelector
          selected={captionStyle}
          onSelect={setCaptionStyle}
        />

        <VoiceoverUpload
          voiceoverUrl={voiceoverUrl}
          onUpload={async (file) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("projectId", projectId);
            const res = await fetch("/api/wizard/upload-voiceover", {
              method: "POST",
              body: formData,
            });
            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || "Upload failed");
            }
            const data = await res.json();
            setVoiceoverUrl(data.voiceoverUrl);
          }}
          onRemove={() => setVoiceoverUrl(null)}
        />

        {children}
      </div>

      <div className="flex justify-end pt-6 border-t border-white/[0.06] gap-4">
        <button
          disabled={isRendering}
          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          onClick={handleRender}
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
