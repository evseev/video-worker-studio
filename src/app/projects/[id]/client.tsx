"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Tables } from "@/lib/supabase/types";

type Project = Tables<"projects">;
type Scene = Tables<"scenes">;

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  processing: "Generating...",
  rendering: "Rendering...",
  completed: "Completed",
  failed_ai: "AI Generation Failed",
  failed_render: "Render Failed",
};

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "processing" || status === "rendering";
  const isFailed = status === "failed_ai" || status === "failed_render";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
        isActive
          ? "bg-violet-500/15 text-violet-300"
          : isFailed
            ? "bg-red-500/15 text-red-400"
            : status === "completed"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-zinc-500/15 text-zinc-400"
      }`}
    >
      {isActive && (
        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
      )}
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function VideoPlayer({ videoUrl, topic }: { videoUrl: string; topic: string }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-black">
      <video
        src={videoUrl}
        controls
        className="w-full aspect-video"
        poster=""
      >
        <track kind="captions" label={topic} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

function DownloadButton({
  videoUrl,
  topic,
  projectId,
}: {
  videoUrl: string;
  topic: string;
  projectId: string;
}) {
  const filename = `${topic.replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase()}-${projectId.slice(0, 8)}.mp4`;

  return (
    <a
      href={videoUrl}
      download={filename}
      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
      Download MP4
    </a>
  );
}

function RetryButton({
  onRetry,
  isRetrying,
}: {
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={isRetrying}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isRetrying ? "animate-spin" : ""}
      >
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
      {isRetrying ? "Retrying..." : "Retry"}
    </button>
  );
}

function SceneList({ scenes }: { scenes: Scene[] }) {
  if (scenes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-400">
        Scenes ({scenes.length})
      </h3>
      <div className="grid gap-3">
        {scenes.map((scene) => (
          <div
            key={scene.id}
            className="flex gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 text-sm font-medium">
              {scene.sequence_order + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-200">{scene.script_text}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {scene.search_keywords}
              </p>
            </div>
            {scene.asset_url && (
              <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scene.asset_url}
                  alt={`Scene ${scene.sequence_order + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
      aria-label={`Copy ${label}`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function YouTubeMetadataExport({ project }: { project: Project }) {
  const description = project.video_description;
  const tags = project.video_tags;

  if (!description && !tags) return null;

  function downloadMetadata() {
    const content = [
      "TITLE",
      project.topic,
      "",
      "DESCRIPTION",
      description || "(none)",
      "",
      "TAGS",
      tags || "(none)",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.topic.replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase()}-metadata.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">YouTube Metadata</h3>
        <button
          type="button"
          onClick={downloadMetadata}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
          </svg>
          Download .txt
        </button>
      </div>

      {/* Title */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Title</span>
          <CopyButton text={project.topic} label="title" />
        </div>
        <p className="text-sm text-zinc-200">{project.topic}</p>
      </div>

      {/* Description */}
      {description && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Description</span>
            <CopyButton text={description} label="description" />
          </div>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{description}</p>
        </div>
      )}

      {/* Tags */}
      {tags && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tags</span>
            <CopyButton text={tags} label="tags" />
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.split(",").map((tag, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 bg-violet-500/10 text-violet-300 text-xs rounded-full"
              >
                {tag.trim()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorDetails({ project }: { project: Project }) {
  const errorContext = project.render_error_context as {
    message?: string;
    timestamp?: string;
    step?: string;
  } | null;

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
      <h3 className="text-sm font-medium text-red-400 mb-2">Error Details</h3>
      {errorContext?.message ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-300">{errorContext.message}</p>
          {errorContext.step && (
            <p className="text-xs text-zinc-500">
              Failed at: {errorContext.step}
            </p>
          )}
          {errorContext.timestamp && (
            <p className="text-xs text-zinc-500">
              {new Date(errorContext.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">
          {project.status === "failed_ai"
            ? "AI script generation failed. This can happen if the topic is too vague or the AI service is temporarily unavailable."
            : "Video rendering failed. This can happen due to asset issues or render timeouts."}
        </p>
      )}
    </div>
  );
}

function ProcessingView({ project }: { project: Project }) {
  const stage =
    project.status === "rendering" ? "Rendering video..." : "Generating content...";

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-6">
        <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
      <h2 className="text-lg font-medium text-zinc-200 mb-2">{stage}</h2>
      <p className="text-sm text-zinc-400 max-w-md">
        {project.status === "rendering"
          ? "Your video is being rendered. This usually takes 1-3 minutes."
          : "AI is generating your script and fetching assets. This usually takes 30-60 seconds."}
      </p>
    </div>
  );
}

export function ProjectDetailClient({
  project: initialProject,
  scenes,
}: {
  project: Project;
  scenes: Scene[];
}) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [isRetrying, setIsRetrying] = useState(false);

  const isCompleted = project.status === "completed" && project.video_url;
  const isFailed =
    project.status === "failed_ai" || project.status === "failed_render";
  const isProcessing =
    project.status === "processing" || project.status === "rendering";

  async function handleRetry() {
    setIsRetrying(true);
    try {
      const res = await fetch("/api/wizard/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (res.ok) {
        setProject({ ...project, status: "processing" });
        router.refresh();
      }
    } catch {
      // Error handled by withAuth wrapper returning 500
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-3 inline-flex items-center gap-1 cursor-pointer"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to library
            </button>
            <h1 className="text-xl font-semibold text-zinc-100 truncate">
              {project.topic}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={project.status} />
              {project.selected_template && (
                <span className="text-xs text-zinc-500">
                  {project.selected_template}
                </span>
              )}
              <span className="text-xs text-zinc-500">
                {new Date(project.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Main content — status-aware */}
        <div className="space-y-6">
          {isCompleted && (
            <>
              <VideoPlayer
                videoUrl={project.video_url!}
                topic={project.topic}
              />
              <div className="flex items-center gap-3">
                <DownloadButton
                  videoUrl={project.video_url!}
                  topic={project.topic}
                  projectId={project.id}
                />
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/wizard/${project.id}?step=${project.wizard_step || "idea"}`
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] cursor-pointer"
                >
                  Edit in Wizard
                </button>
              </div>
              <YouTubeMetadataExport project={project} />
            </>
          )}

          {isProcessing && <ProcessingView project={project} />}

          {isFailed && (
            <div className="space-y-4">
              <ErrorDetails project={project} />
              <div className="flex items-center gap-3">
                <RetryButton
                  onRetry={handleRetry}
                  isRetrying={isRetrying}
                />
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/wizard/${project.id}?step=${project.wizard_step || "idea"}`
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] cursor-pointer"
                >
                  Edit in Wizard
                </button>
              </div>
            </div>
          )}

          {project.status === "draft" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-zinc-400 mb-4">
                This project is still a draft.
              </p>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/wizard/${project.id}?step=${project.wizard_step || "idea"}`
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 cursor-pointer"
              >
                Continue in Wizard
              </button>
            </div>
          )}

          {/* Scene list for completed/failed projects */}
          {(isCompleted || isFailed) && <SceneList scenes={scenes} />}
        </div>
      </div>
    </div>
  );
}
