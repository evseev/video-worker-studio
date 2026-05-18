"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/types";
import { StatusBadge } from "./status-badge";

type Project = Tables<"projects">;

export function ProjectCard({
  project,
  channelName,
  showChannelPill,
  onRequestDelete,
}: {
  project: Project;
  channelName?: string | null;
  showChannelPill?: boolean;
  onRequestDelete: (project: Project) => void;
}) {
  const [videoBroken, setVideoBroken] = useState(false);

  const isDraft = project.status === "draft";
  const isCompleted = project.status === "completed";
  const href = isDraft
    ? `/wizard/${project.id}?step=${project.wizard_step || "template"}`
    : `/projects/${project.id}`;

  return (
    <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all hover:border-white/[0.12] hover:bg-white/[0.04] hover:shadow-lg hover:shadow-violet-500/5 group">
      <button
        type="button"
        aria-label={`Delete project: ${project.topic}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRequestDelete(project);
        }}
        className="absolute right-3 top-3 z-10 rounded-lg border border-white/10 bg-[#0a0a0f]/90 p-2 text-zinc-500 opacity-80 transition-all hover:border-red-500/30 hover:bg-red-950/40 hover:text-red-400 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500/30 cursor-pointer"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <line x1="10" x2="10" y1="11" y2="17" />
          <line x1="14" x2="14" y1="11" y2="17" />
        </svg>
      </button>
      <a href={href} className="block p-5">
        <div className="aspect-video rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-white/[0.04] flex items-center justify-center mb-4 overflow-hidden relative">
          {isCompleted && project.video_url && !videoBroken ? (
            <>
              <video
                src={project.video_url}
                preload="metadata"
                muted
                playsInline
                className="w-full h-full object-cover"
                onError={() => {
                  setVideoBroken(true);
                }}
                onLoadedData={(e) => {
                  // Seek to 1 second for a better thumbnail frame
                  (e.target as HTMLVideoElement).currentTime = 1;
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white drop-shadow-lg group-hover:scale-110 transition-transform">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
                </svg>
              </div>
            </>
          ) : (
            <div className="text-zinc-600">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
          )}
        </div>
        <h3 className="text-sm font-medium text-zinc-200 truncate mb-2">
          {project.topic}
        </h3>
        {showChannelPill && channelName ? (
          <div className="mb-2">
            <span className="inline-flex rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-400">
              {channelName}
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <StatusBadge status={project.status} />
          <span className="text-xs text-zinc-500">
            {new Date(project.created_at).toLocaleDateString()}
          </span>
        </div>
      </a>
    </div>
  );
}
