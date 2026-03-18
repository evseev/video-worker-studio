"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/lib/supabase/types";

type Project = Tables<"projects">;

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  processing: "Generating…",
  rendering: "Rendering…",
  completed: "Completed",
  failed_ai: "AI Error",
  failed_render: "Render Error",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium status-${status}`}
    >
      {(status === "processing" || status === "rendering") && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-glow" />
      )}
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const isDraft = project.status === "draft";
  const href = isDraft
    ? `/wizard/${project.id}?step=${project.wizard_step || "idea"}`
    : project.status === "completed" && project.video_url
    ? project.video_url
    : "#";

  return (
    <a
      href={href}
      className="group block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-white/[0.12] hover:bg-white/[0.04] hover:shadow-lg hover:shadow-violet-500/5"
    >
      {/* Thumbnail placeholder */}
      <div className="aspect-video rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-white/[0.04] flex items-center justify-center mb-4 overflow-hidden">
        {project.status === "completed" ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400 group-hover:scale-110 transition-transform">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
          </svg>
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
      <div className="flex items-center justify-between">
        <StatusBadge status={project.status} />
        <span className="text-xs text-zinc-500">
          {new Date(project.created_at).toLocaleDateString()}
        </span>
      </div>
    </a>
  );
}

export function Dashboard({
  user,
  projects: initialProjects,
}: {
  user: User;
  projects: Project[];
}) {
  const projects = initialProjects;
  const [topic, setTopic] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  const supabase = createClient();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setCreating(true);

    // Insert project
    const { data: project, error } = await supabase
      .from("projects")
      .insert({ topic: topic.trim(), user_id: user.id, status: "draft" })
      .select()
      .single();

    if (error) {
      console.error("Failed to create project:", error, JSON.stringify(error));
      setCreating(false);
      return;
    }

    // Redirect directly to the wizard UI
    router.push(`/wizard/${project.id}?step=idea`);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <span className="text-base font-bold text-white tracking-tight">
              Video Worker
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">My Videos</h1>
            <p className="text-sm text-zinc-400">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Video
          </button>
        </div>

        {/* New Project Modal Overlay */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/[0.06] bg-[#12121d] p-8 shadow-2xl">
              <h2 className="text-xl font-semibold text-white mb-2">Create a new video</h2>
              <p className="text-sm text-zinc-400 mb-6">
                Describe what your video should be about. Our AI will handle the script, visuals, and rendering.
              </p>
              <form onSubmit={handleCreate}>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. 5 tips for better sleep that most people ignore"
                  required
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 transition-all focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none mb-4"
                />
                <div className="flex items-center gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !topic.trim()}
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {creating ? "Creating…" : "Generate Video"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-zinc-300 mb-1">No videos yet</h3>
            <p className="text-sm text-zinc-500 mb-6">
              Create your first AI-generated video in seconds.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-indigo-500 cursor-pointer"
            >
              Create your first video
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
