"use client";

import { useCallback, useEffect, useState } from "react";
import type { Tables } from "@/lib/supabase/types";
import { isYoutubeMetaFresh, parseStoredYoutubeMeta } from "@/lib/youtube/types";

type Channel = Tables<"channels">;

export function YoutubeTab({ channel, onSaved }: { channel: Channel; onSaved: (c: Channel) => void }) {
  const [handle, setHandle] = useState(channel.youtube_handle ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bgNote, setBgNote] = useState<string | null>(null);

  const meta = parseStoredYoutubeMeta(channel.youtube_meta);
  const fresh = isYoutubeMetaFresh(channel.youtube_meta);

  const runRefresh = useCallback(
    async (force: boolean) => {
      setErr(null);
      const res = await fetch(`/api/channels/${channel.id}/youtube/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const body = (await res.json()) as { channel?: Channel; refreshed?: boolean; error?: string };
      if (!res.ok || !body.channel) {
        setErr(body.error ?? "Refresh failed");
        return;
      }
      onSaved(body.channel);
      if (body.refreshed) {
        setBgNote("YouTube data updated.");
      }
    },
    [channel.id, onSaved]
  );

  useEffect(() => {
    setHandle(channel.youtube_handle ?? "");
  }, [channel.youtube_handle]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/channels/${channel.id}/youtube/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      const body = (await res.json()) as { channel?: Channel; error?: string };
      if (cancelled) return;
      if (res.ok && body.channel) {
        onSaved(body.channel);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channel.id, onSaved]);

  async function saveHandle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_handle: handle.trim() || null }),
      });
      const body = (await res.json()) as { channel?: Channel; error?: string };
      if (!res.ok || !body.channel) {
        setErr(body.error ?? "Save failed");
        return;
      }
      onSaved(body.channel);
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setErr(null);
    setBgNote(null);
    try {
      const resSave = await fetch(`/api/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_handle: handle.trim() || null }),
      });
      const saveBody = (await resSave.json()) as { channel?: Channel; error?: string };
      if (!resSave.ok || !saveBody.channel) {
        setErr(saveBody.error ?? "Could not save handle");
        return;
      }
      onSaved(saveBody.channel);
      await runRefresh(true);
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-zinc-400">
        Link your public YouTube handle. Performance data is cached for 24 hours; this tab refreshes in the
        background when you open settings.
      </p>

      <form onSubmit={saveHandle} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">YouTube handle</label>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@yourchannel"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none focus:border-violet-500/50"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50"
          >
            Save handle
          </button>
          <button
            type="button"
            disabled={busy || !handle.trim()}
            onClick={() => void verify()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Verify &amp; refresh
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runRefresh(true)}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-50"
          >
            Force refresh
          </button>
        </div>
      </form>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {bgNote ? <p className="text-sm text-emerald-400">{bgNote}</p> : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Cached performance</h3>
          <span className="text-xs text-zinc-500">{fresh ? "Fresh (≤24h)" : "Stale or empty"}</span>
        </div>
        {meta?.error ? <p className="text-xs text-amber-300">Last error: {meta.error}</p> : null}
        {channel.youtube_channel_id ? (
          <p className="mb-2 text-xs text-zinc-500">Channel id: {channel.youtube_channel_id}</p>
        ) : null}
        {meta?.channel_title ? (
          <p className="mb-3 text-sm text-zinc-200">Title: {meta.channel_title}</p>
        ) : null}
        {!meta?.top_videos?.length ? (
          <p className="text-sm text-zinc-500">No top videos cached yet. Save a handle and verify.</p>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-200">
            {meta.top_videos.map((v) => (
              <li key={v.id}>
                <span className="font-medium">{v.title}</span>{" "}
                <span className="text-zinc-500">({v.view_count.toLocaleString()} views)</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
