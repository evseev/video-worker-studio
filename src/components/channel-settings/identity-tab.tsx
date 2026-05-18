"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/types";

type Channel = Tables<"channels">;

export function IdentityTab({ channel, onSaved }: { channel: Channel; onSaved: (c: Channel) => void }) {
  const [name, setName] = useState(channel.name);
  const [slug, setSlug] = useState(channel.slug);
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
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
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

  async function upload(kind: "logo" | "thumbnail", file: File) {
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    const path = kind === "logo" ? "upload-logo" : "upload-thumbnail";
    const res = await fetch(`/api/channels/${channel.id}/${path}`, { method: "POST", body: fd });
    const body = (await res.json()) as { error?: string; logoUrl?: string; thumbnailUrl?: string };
    if (!res.ok) {
      setErr(body.error ?? "Upload failed");
      return;
    }
    if (body.logoUrl) {
      onSaved({ ...channel, logo_url: body.logoUrl });
    }
    if (body.thumbnailUrl) {
      onSaved({ ...channel, thumbnail_template_url: body.thumbnailUrl });
    }
  }

  return (
    <form onSubmit={save} className="space-y-6 max-w-lg">
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-violet-500/50"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Slug</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none focus:border-violet-500/50"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm text-zinc-400">Logo</p>
          {channel.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.logo_url} alt="" className="mb-2 h-20 w-20 rounded-lg object-cover" />
          ) : null}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-violet-600 file:px-2 file:py-1 file:text-white"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload("logo", f);
            }}
          />
        </div>
        <div>
          <p className="mb-2 text-sm text-zinc-400">Thumbnail template</p>
          {channel.thumbnail_template_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.thumbnail_template_url} alt="" className="mb-2 h-20 w-20 rounded-lg object-cover" />
          ) : null}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-violet-600 file:px-2 file:py-1 file:text-white"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload("thumbnail", f);
            }}
          />
        </div>
      </div>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save identity"}
      </button>
    </form>
  );
}
