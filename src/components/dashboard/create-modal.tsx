"use client";

import { useEffect, useState } from "react";
import type { Tables } from "@/lib/supabase/types";

type TopicIdea = Tables<"channel_topic_ideas">;

function shortenForSelect(text: string, max = 72): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function CreateModal({
  topic,
  creating,
  channelId,
  channelName,
  onTopicChange,
  onSubmit,
  onClose,
}: {
  topic: string;
  creating: boolean;
  channelId?: string | null;
  channelName?: string | null;
  onTopicChange: (value: string) => void;
  onSubmit: (
    e: React.FormEvent,
    meta: { copyLastSettings: boolean; topicIdeaId?: string | null }
  ) => void | Promise<void>;
  onClose: () => void;
}) {
  const [copyLastSettings, setCopyLastSettings] = useState(true);
  const [backlogIdeas, setBacklogIdeas] = useState<TopicIdea[]>([]);
  const [backlogLoad, setBacklogLoad] = useState<"idle" | "loading" | "error">("idle");
  const [selectedTopicIdeaId, setSelectedTopicIdeaId] = useState<string | null>(null);

  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    void (async () => {
      setBacklogLoad("loading");
      try {
        const res = await fetch(`/api/channels/${channelId}/topic-ideas?status=backlog`);
        const body = (await res.json()) as { ideas?: TopicIdea[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setBacklogLoad("error");
          return;
        }
        setBacklogIdeas(body.ideas ?? []);
        setBacklogLoad("idle");
      } catch {
        if (!cancelled) setBacklogLoad("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const displayIdeas = channelId ? backlogIdeas : [];
  const displayLoad = channelId ? backlogLoad : "idle";

  function handleBacklogSelect(value: string) {
    if (value === "") {
      setSelectedTopicIdeaId(null);
      return;
    }
    setSelectedTopicIdeaId(value);
    const row = backlogIdeas.find((i) => i.id === value);
    if (row) {
      onTopicChange(row.idea_text);
    }
  }

  function clearBacklogPick() {
    setSelectedTopicIdeaId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-[#12121d] p-8 shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-2">Create a new video</h2>
        {channelName ? (
          <p className="text-sm text-violet-300/90 mb-4">
            Creating on <span className="font-semibold text-white">{channelName}</span>
          </p>
        ) : null}
        <p className="text-base text-zinc-400 mb-6">
          Describe what your video should be about. Our AI will handle the script, visuals, and rendering.
        </p>
        <form
          onSubmit={(e) => {
            void onSubmit(e, {
              copyLastSettings,
              ...(selectedTopicIdeaId ? { topicIdeaId: selectedTopicIdeaId } : {}),
            });
          }}
        >
          {channelId ? (
            <div className="mb-4 space-y-2">
              <label htmlFor="create-video-backlog" className="block text-sm text-zinc-400">
                Pick from backlog (optional)
              </label>
              {displayLoad === "loading" ? (
                <p className="text-sm text-zinc-500">Loading backlog…</p>
              ) : displayLoad === "error" ? (
                <p className="text-sm text-red-400">Could not load topic backlog.</p>
              ) : displayIdeas.length === 0 ? (
                <p className="text-sm text-zinc-500">No backlog topics yet.</p>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    id="create-video-backlog"
                    value={selectedTopicIdeaId ?? ""}
                    onChange={(e) => handleBacklogSelect(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 cursor-pointer"
                  >
                    <option value="">Custom topic only</option>
                    {displayIdeas.map((idea) => (
                      <option key={idea.id} value={idea.id}>
                        {shortenForSelect(idea.idea_text)}
                      </option>
                    ))}
                  </select>
                  {selectedTopicIdeaId ? (
                    <button
                      type="button"
                      onClick={clearBacklogPick}
                      className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      Clear pick
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
          <label htmlFor="create-video-topic" className="sr-only">
            Video topic
          </label>
          <textarea
            id="create-video-topic"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder="e.g. 5 tips for better sleep that most people ignore"
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder-zinc-500 transition-all focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none mb-4"
          />
          <label className="mb-6 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-sm text-zinc-300 select-none">Use last video&apos;s settings</span>
            <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
              <input
                type="checkbox"
                checked={copyLastSettings}
                onChange={(e) => setCopyLastSettings(e.target.checked)}
                className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                role="switch"
                aria-checked={copyLastSettings}
              />
              <span className="h-7 w-12 rounded-full bg-zinc-700 transition-colors peer-checked:bg-violet-600 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#12121d]" />
              <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </span>
          </label>
          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !topic.trim()}
              className="rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {creating ? "Creating…" : "Generate Video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
