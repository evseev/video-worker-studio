"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/lib/supabase/types";
import { ProjectCard } from "./dashboard/project-card";
import { EmptyState } from "./dashboard/empty-state";
import { CreateModal } from "./dashboard/create-modal";
import { DeleteModal, type DeleteState } from "./dashboard/delete-modal";

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

function ProjectCard({
  project,
  onRequestDelete,
}: {
  project: Project;
  onRequestDelete: (project: Project) => void;
}) {
  const isDraft = project.status === "draft";
  const isCompleted = project.status === "completed";
  const href = isDraft
    ? `/wizard/${project.id}?step=${project.wizard_step || "idea"}`
    : isCompleted
      ? `/wizard/${project.id}?step=render`
      : "#";

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
      <a
        href={href}
        className="block p-5"
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
    </div>
  );
}

export function Dashboard({
  user,
  projects: initialProjects,
}: {
  user: User;
  projects: Project[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [topic, setTopic] = useState("");
  const [sceneCount, setSceneCount] = useState(6);
  const [sceneDuration, setSceneDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [quality, setQuality] = useState<"hd" | "fullhd" | "4k">("fullhd");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Supabase Realtime: subscribe to project status changes
  useEffect(() => {
    const channel = supabase
      .channel("projects-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Project;
            setProjects((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setProjects((prev) => prev.filter((p) => p.id !== deleted.id));
          } else if (payload.eventType === "INSERT") {
            const inserted = payload.new as Project;
            setProjects((prev) => [inserted, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projects, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setCreating(true);

    // Insert project with video settings
    const draftScenes = {
      scenes: [],
      settings: { sceneCount, sceneDuration, aspectRatio, quality },
    };
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        topic: topic.trim(),
        user_id: user.id,
        status: "draft",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draft_scenes: draftScenes as any,
      })
      .select()
      .single();

  // Sync with server data when it changes (e.g. after navigation)
  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!topic.trim()) return;
      setCreating(true);

      const { data: project, error } = await supabase
        .from("projects")
        .insert({ topic: topic.trim(), user_id: user.id, status: "draft" })
        .select()
        .single();

      if (error) {
        console.error("Failed to create project:", error);
        setCreating(false);
        return;
      }

      router.push(`/wizard/${project.id}?step=idea`);
    },
    [topic, supabase, user.id, router]
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function closeDeleteModal() {
    setDeleteState(null);
    setDeleteError(null);
    setDeleteBusy(false);
  }

  async function handleConfirmDelete() {
    if (!deleteState || deleteState.phase !== "confirm") return;
    const { project } = deleteState;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const body = (await res.json()) as { error?: string; warnings?: string[] };
      if (!res.ok) {
        setDeleteError(body.error ?? "Could not delete this project.");
        setDeleteBusy(false);
        return;
      }
      setDeleteState({ phase: "success", warnings: body.warnings ?? [] });
      setDeleteBusy(false);
      router.refresh();
    } catch {
      setDeleteError("Network error. Try again.");
      setDeleteBusy(false);
    }
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">My Videos</h1>
            <p className="text-base text-zinc-400">
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

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/[0.06] bg-[#12121d] p-8 shadow-2xl">
              <h2 className="text-xl font-semibold text-white mb-2">Create a new video</h2>
              <p className="text-base text-zinc-400 mb-6">
                Describe what your video should be about. Our AI will handle the script, visuals, and rendering.
              </p>
              <form onSubmit={handleCreate}>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. 5 tips for better sleep that most people ignore"
                  required
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-zinc-500 transition-all focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none mb-4"
                />

                {/* Video Settings */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Scenes</label>
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={sceneCount}
                      onChange={(e) => setSceneCount(Math.max(2, Math.min(100, parseInt(e.target.value) || 6)))}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Duration/scene (sec)</label>
                    <input
                      type="number"
                      min={2}
                      max={60}
                      value={sceneDuration}
                      onChange={(e) => setSceneDuration(Math.max(2, Math.min(60, parseInt(e.target.value) || 5)))}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Aspect Ratio</label>
                    <div className="flex gap-1.5">
                      {(["9:16", "16:9"] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setAspectRatio(r)}
                          className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            aspectRatio === r
                              ? "bg-violet-500/20 border border-violet-500 text-white"
                              : "bg-white/[0.04] border border-white/10 text-zinc-400 hover:border-white/20"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Quality</label>
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value as "hd" | "fullhd" | "4k")}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
                    >
                      <option value="hd">HD (720p)</option>
                      <option value="fullhd">Full HD (1080p)</option>
                      <option value="4k">4K (2160p)</option>
                    </select>
                  </div>
                </div>

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

        {deleteState && (
          <DeleteModal
            state={deleteState}
            busy={deleteBusy}
            error={deleteError}
            onConfirm={handleConfirmDelete}
            onClose={closeDeleteModal}
          />
        )}

        {projects.length === 0 ? (
          <EmptyState onCreateClick={() => setShowForm(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onRequestDelete={(p) => {
                  setDeleteError(null);
                  setDeleteState({ phase: "confirm", project: p });
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
