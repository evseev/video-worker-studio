"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/types";

type Channel = Tables<"channels">;

const POSITIONS = ["tl", "tr", "bl", "br", "none"] as const;

export function WatermarkTab({ channel, onSaved }: { channel: Channel; onSaved: (c: Channel) => void }) {
  const [position, setPosition] = useState(channel.watermark_position);
  const [opacity, setOpacity] = useState(Number(channel.watermark_opacity));
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
        body: JSON.stringify({
          watermark_position: position,
          watermark_opacity: opacity,
        }),
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
    <form onSubmit={save} className="max-w-lg space-y-6">
      <div>
        <p className="mb-2 text-sm text-zinc-400">Corner</p>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPosition(p)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium uppercase ${
                position === p
                  ? "border-violet-500 bg-violet-500/20 text-white"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">
          Opacity ({opacity.toFixed(2)})
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-full accent-violet-500"
        />
      </div>
      <p className="text-xs text-zinc-500">
        {/* TODO(Epic 25 Phase D / Story 25.18): Remotion watermark preview + render integration. */}
        Preview and rendered overlay are implemented in Phase D (Story 25.18).
      </p>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save watermark"}
      </button>
    </form>
  );
}
