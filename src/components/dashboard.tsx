"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/lib/supabase/types";
import { ProjectCard } from "./dashboard/project-card";
import { EmptyState } from "./dashboard/empty-state";
import { DeleteModal, type DeleteState } from "./dashboard/delete-modal";

type Project = Tables<"projects">;

export function Dashboard({
  user,
  projects: initialProjects,
}: {
  user: User;
  projects: Project[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [creating, setCreating] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Sync with server data when it changes (e.g. after navigation)
  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const handleCreate = useCallback(async () => {
    setCreating(true);

    let channelId: string | undefined;
    const { data: existingChannel } = await supabase
      .from("channels")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingChannel?.id) {
      channelId = existingChannel.id;
    } else {
      const { data: createdId, error: channelErr } = await supabase.rpc("worker_create_default_channel_for_user", {
        p_user_id: user.id,
      });
      if (channelErr || !createdId) {
        console.error("Failed to ensure default channel:", channelErr);
        setCreating(false);
        return;
      }
      channelId = createdId as string;
    }

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        topic: "",
        user_id: user.id,
        channel_id: channelId,
        status: "draft",
        wizard_step: "template",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create project:", error);
      setCreating(false);
      return;
    }

    router.push(`/wizard/${project.id}?step=template`);
  }, [supabase, user.id, router]);

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
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 disabled:opacity-50 cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {creating ? "Creating…" : "New Video"}
          </button>
        </div>


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
          <EmptyState onCreateClick={handleCreate} />
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
