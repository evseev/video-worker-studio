"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/types";

type Channel = Tables<"channels">;

export function AiContextTab({ channel, onSaved }: { channel: Channel; onSaved: (c: Channel) => void }) {
  const [niche, setNiche] = useState(channel.niche ?? "");
  const [targetLanguage, setTargetLanguage] = useState(channel.target_language ?? "");
  const [targetAudience, setTargetAudience] = useState(channel.target_audience ?? "");
  const [tone, setTone] = useState(channel.tone ?? "");
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
          niche: niche.trim() || null,
          target_language: targetLanguage.trim() || null,
          target_audience: targetAudience.trim() || null,
          tone: tone.trim() || null,
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
    <form onSubmit={save} className="max-w-lg space-y-4">
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Niche</label>
        <input
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="e.g. tech educational"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-violet-500/50"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Target language</label>
        <input
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          placeholder="e.g. en"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-violet-500/50"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Target audience</label>
        <textarea
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          rows={2}
          placeholder="e.g. curious adults 25–44"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-violet-500/50"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Tone</label>
        <textarea
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          rows={2}
          placeholder="e.g. energetic, factual"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-violet-500/50"
        />
      </div>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save AI context"}
      </button>
    </form>
  );
}
