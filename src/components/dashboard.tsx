"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/lib/supabase/types";
import { ProjectCard } from "./dashboard/project-card";
import { EmptyState } from "./dashboard/empty-state";
import { DeleteModal, type DeleteState } from "./dashboard/delete-modal";
import { ChannelSwitcher } from "@/components/channel-switcher";
import { CreateModal } from "@/components/dashboard/create-modal";
import { useToast } from "@/components/ui/toast";
import { useActiveChannel } from "@/lib/hooks/use-active-channel";

type Project = Tables<"projects"> & {
  channels?: { id: string; name: string; logo_url: string | null } | null;
};

function DashboardInner({
  user,
  projects: initialProjects,
}: {
  user: User;
  projects: Project[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTopic, setCreateTopic] = useState("");
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const addToast = useToast();
  const { activeChannelId, setActiveChannelId, channels, isLoading } = useActiveChannel();

  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

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
            setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
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

  const filteredProjects = activeChannelId
    ? projects.filter((p) => p.channel_id === activeChannelId)
    : projects;

  const activeChannelName =
    channels.find((c) => c.id === activeChannelId)?.name ??
    channels[0]?.name ??
    null;

  const openCreateModal = useCallback(() => {
    setCreateTopic("");
    setCreateOpen(true);
  }, []);

  const handleCreateSubmit = useCallback(
    async (
      e: React.FormEvent,
      { copyLastSettings, topicIdeaId }: { copyLastSettings: boolean; topicIdeaId?: string | null }
    ) => {
      e.preventDefault();
      setCreating(true);
      const targetChannelId = activeChannelId ?? channels[0]?.id;
      if (!targetChannelId) {
        setCreating(false);
        return;
      }

      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: targetChannelId,
            copyLastSettings,
            topic: createTopic.trim(),
            ...(topicIdeaId ? { topicIdeaId } : {}),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { project?: Project; error?: string };
        if (!res.ok || !body.project) {
          const msg =
            body.error ?? (res.ok ? "Invalid response from server." : `Could not create project (${res.status}).`);
          addToast(msg, "error");
          return;
        }
        setCreateOpen(false);
        router.push(`/wizard/${body.project.id}?step=template`);
      } catch {
        addToast("Network error. Try again.", "error");
      } finally {
        setCreating(false);
      }
    },
    [activeChannelId, addToast, channels, createTopic, router]
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
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <span className="text-base font-bold text-white tracking-tight hidden sm:inline">
                Video Worker
              </span>
            </div>
            <ChannelSwitcher
              channels={channels}
              activeChannelId={activeChannelId}
              setActiveChannelId={setActiveChannelId}
              isLoading={isLoading}
            />
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-sm text-zinc-400 truncate max-w-[160px] sm:max-w-none">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">My Videos</h1>
            <p className="text-base text-zinc-400">
              {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""}
              {activeChannelId ? ` on ${activeChannelName ?? "this channel"}` : ""}
            </p>
          </div>
          <button
            onClick={openCreateModal}
            disabled={!activeChannelId && channels.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 disabled:opacity-50 cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Video
          </button>
        </div>

        {createOpen ? (
          <CreateModal
            key={activeChannelId ?? channels[0]?.id ?? "no-channel"}
            topic={createTopic}
            creating={creating}
            channelId={activeChannelId ?? channels[0]?.id ?? null}
            channelName={activeChannelName}
            onTopicChange={setCreateTopic}
            onSubmit={handleCreateSubmit}
            onClose={() => {
              if (!creating) setCreateOpen(false);
            }}
          />
        ) : null}

        {deleteState && (
          <DeleteModal
            state={deleteState}
            busy={deleteBusy}
            error={deleteError}
            onConfirm={handleConfirmDelete}
            onClose={closeDeleteModal}
          />
        )}

        {filteredProjects.length === 0 ? (
          <EmptyState onCreateClick={openCreateModal} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={`${project.id}:${String(project.video_url ?? "")}`}
                project={project}
                channelName={project.channels?.name ?? null}
                showChannelPill={!activeChannelId}
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

export function Dashboard(props: { user: User; projects: Project[] }) {
  return <DashboardInner {...props} />;
}
