"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ActiveChannelSummary } from "@/lib/hooks/use-active-channel";

export function ChannelSwitcher({
  channels,
  activeChannelId,
  setActiveChannelId,
  isLoading,
}: {
  channels: ActiveChannelSummary[];
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const active = channels.find((c) => c.id === activeChannelId) ?? null;
  const label = active ? active.name : "All channels";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors hover:bg-white/10 cursor-pointer"
      >
        {active?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active.logo_url} alt="" className="h-7 w-7 rounded-md object-cover" />
        ) : (
          <div className="h-7 w-7 rounded-md bg-linear-to-br from-violet-500/40 to-indigo-600/40" />
        )}
        <span className="max-w-[140px] truncate font-medium">{isLoading ? "Channels…" : label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" className="text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/10 bg-[#12121d] py-2 shadow-xl shadow-black/40">
          <button
            type="button"
            onClick={() => {
              setActiveChannelId(null);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-white/20 text-xs text-zinc-500">
              All
            </span>
            <span>All channels</span>
          </button>
          <div className="my-1 border-t border-white/5" />
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setActiveChannelId(c.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 cursor-pointer"
            >
              {c.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logo_url} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="h-7 w-7 shrink-0 rounded-md bg-linear-to-br from-violet-500/30 to-indigo-600/30" />
              )}
              <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
              <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-xs text-zinc-300">
                {c.project_count}
              </span>
            </button>
          ))}
          <div className="my-1 border-t border-white/5" />
          <Link
            href="/channels"
            className="block px-3 py-2 text-sm text-violet-400 hover:text-violet-300"
            onClick={() => setOpen(false)}
          >
            Manage channels
          </Link>
        </div>
      ) : null}
    </div>
  );
}
