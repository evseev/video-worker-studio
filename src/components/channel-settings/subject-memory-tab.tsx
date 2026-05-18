"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/types";

type Channel = Tables<"channels">;

export function SubjectMemoryTab({ channel, onSaved }: { channel: Channel; onSaved: (c: Channel) => void }) {
  const [lookback, setLookback] = useState(channel.subject_memory_lookback);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_memory_lookback: lookback }),
      });
      const body = (await res.json()) as { channel?: Channel; error?: string };
      if (!res.ok || !body.channel) {
        setErr(body.error ?? "Save failed");
        setBusy(false);
        return;
      }
      onSaved(body.channel);
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">
            Completed-project lookback (1–50)
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={lookback}
            onChange={(e) => setLookback(Number(e.target.value))}
            className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-violet-500/50"
          />
        </div>
        {err ? <p className="text-sm text-red-400">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save lookback"}
        </button>
      </form>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
        {/* TODO(Epic 25 Phase C / Story 25.11): Clear subject memory for this channel (channel-scoped deletes). */}
        Clearing stored subjects for this channel will ship in Phase C (Story 25.11).
      </div>
    </div>
  );
}
