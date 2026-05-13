"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Tables } from "@/lib/supabase/types";

type Channel = Tables<"channels">;

export function DangerZoneTab({
  channel,
  projectCount,
}: {
  channel: Channel;
  projectCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function deletePlain() {
    if (!confirm(`Delete channel “${channel.name}”? This cannot be undone.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/channels/${channel.id}`, { method: "DELETE" });
      const body = (await res.json()) as { error?: string; projectCount?: number };
      if (res.status === 409) {
        setMsg(
          body.error ??
            `This channel has ${body.projectCount ?? projectCount} project(s). Use force delete from the UI when ready.`
        );
        setBusy(false);
        return;
      }
      if (!res.ok) {
        setMsg(body.error ?? "Delete failed");
        setBusy(false);
        return;
      }
      router.push("/channels");
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteForce() {
    if (
      !confirm(
        "Force delete will remove every project on this channel and then delete the channel. Continue?"
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/channels/${channel.id}?force=true`, { method: "DELETE" });
      const body = (await res.json()) as { error?: string; failed?: { projectId: string; error: string }[] };
      if (res.status === 207) {
        setMsg(
          `Some projects failed to delete: ${(body.failed ?? []).map((f) => `${f.projectId}: ${f.error}`).join("; ")}`
        );
        setBusy(false);
        return;
      }
      if (!res.ok) {
        setMsg(body.error ?? "Delete failed");
        setBusy(false);
        return;
      }
      router.push("/channels");
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4 rounded-xl border border-red-500/20 bg-red-500/5 p-6">
      <p className="text-sm text-zinc-300">
        {projectCount > 0
          ? `This channel has ${projectCount} project(s). Deleting is blocked until you use force delete, which runs the per-project cleanup pipeline for each video.`
          : "This channel has no projects. You can delete it safely."}
      </p>
      {msg ? <p className="text-sm text-amber-300">{msg}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || projectCount > 0}
          onClick={deletePlain}
          className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-900/50 disabled:opacity-40"
        >
          Delete channel
        </button>
        <button
          type="button"
          disabled={busy || projectCount === 0}
          onClick={deleteForce}
          className="rounded-lg border border-red-600 bg-red-600/80 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
        >
          Force delete + cascade
        </button>
      </div>
    </div>
  );
}
