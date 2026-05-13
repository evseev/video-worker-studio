"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewChannelPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = (await res.json()) as { channel?: { id: string }; error?: string };
      if (!res.ok || !body.channel) {
        setErr(body.error ?? "Could not create channel");
        setBusy(false);
        return;
      }
      router.push(`/channels/${body.channel.id}/settings`);
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-6 py-10">
      <div className="mx-auto max-w-md">
        <Link href="/channels" className="text-sm text-zinc-400 hover:text-white">
          ← All channels
        </Link>
        <h1 className="mt-6 text-2xl font-bold">Create channel</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="ch-name" className="mb-1 block text-sm text-zinc-400">
              Name
            </label>
            <input
              id="ch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-violet-500/50"
              placeholder="e.g. Tech Facts"
            />
          </div>
          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="w-full rounded-lg bg-linear-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}
