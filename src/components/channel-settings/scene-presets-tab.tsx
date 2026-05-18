"use client";

import { useCallback, useEffect, useState } from "react";
import type { Tables } from "@/lib/supabase/types";

type Preset = Tables<"channel_scene_presets">;

export function ScenePresetsTab({ channelId }: { channelId: string }) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/channels/${channelId}/scene-presets`);
    const body = (await res.json()) as { presets?: Preset[]; error?: string };
    if (!res.ok) {
      setErr(body.error ?? "Failed to load");
      return;
    }
    setPresets(body.presets ?? []);
  }, [channelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removePreset(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/channels/${channelId}/scene-presets/${id}`, { method: "DELETE" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(body.error ?? "Delete failed");
        return;
      }
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-zinc-400">
        Save and apply scene templates from the video wizard (Template step). This library is per-channel.
      </p>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {presets.length === 0 ? (
        <p className="text-sm text-zinc-500">No presets saved yet.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
          {presets.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">{p.name}</p>
                <p className="text-xs text-zinc-500">{p.template_id}</p>
              </div>
              <button
                type="button"
                disabled={busyId === p.id}
                onClick={() => void removePreset(p.id)}
                className="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
