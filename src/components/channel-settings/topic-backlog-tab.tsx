"use client";

import { useCallback, useEffect, useState } from "react";
import type { Tables } from "@/lib/supabase/types";

type TopicIdea = Tables<"channel_topic_ideas">;

export function TopicBacklogTab({ channelId }: { channelId: string }) {
  const [ideas, setIdeas] = useState<TopicIdea[]>([]);
  const [manual, setManual] = useState("");
  const [persist, setPersist] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/channels/${channelId}/topic-ideas`);
    const body = (await res.json()) as { ideas?: TopicIdea[]; error?: string };
    if (!res.ok) {
      setErr(body.error ?? "Failed to load");
      return;
    }
    setIdeas(body.ideas ?? []);
  }, [channelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function suggest() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/channels/${channelId}/suggest-topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 10, persist }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(body.error ?? "Suggest failed");
        return;
      }
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manual.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/channels/${channelId}/topic-ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea_text: manual.trim() }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(body.error ?? "Add failed");
        return;
      }
      setManual("");
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void suggest()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Suggest topics (AI)
        </button>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={persist}
            onChange={(e) => setPersist(e.target.checked)}
            className="rounded border-white/20"
          />
          Auto-save to backlog
        </label>
      </div>

      <form onSubmit={addManual} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Add a manual topic idea…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50"
        />
        <button
          type="submit"
          disabled={busy || !manual.trim()}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-400">Backlog</h3>
        {ideas.length === 0 ? (
          <p className="text-sm text-zinc-500">No ideas yet.</p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {ideas.map((row) => (
              <li key={row.id} className="px-4 py-3 text-sm">
                <p className="text-white">{row.idea_text}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {row.source} · {row.status}
                  {row.ai_reasoning ? ` — ${row.ai_reasoning}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
