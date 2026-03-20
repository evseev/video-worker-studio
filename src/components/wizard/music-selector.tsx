"use client";

import { useRef, useState } from "react";
import { MUSIC_PRESETS } from "@/lib/music-presets";

export function MusicSelector({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (trackId: string | null) => void;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function togglePreview(trackId: string, url: string) {
    if (playing === trackId) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.volume = 0.3;
    audio.play().catch(() => {});
    // Stop after 5 seconds
    setTimeout(() => {
      audio.pause();
      setPlaying((cur) => (cur === trackId ? null : cur));
    }, 5000);
    audio.onended = () => setPlaying(null);
    audioRef.current = audio;
    setPlaying(trackId);
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Background Music</h3>
      <div className="space-y-2">
        {/* No music option */}
        <button
          onClick={() => onSelect(null)}
          className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
            selected === null
              ? "bg-violet-500/10 border-violet-500 text-white"
              : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20"
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </div>
          <div>
            <div className="font-medium text-sm">No music</div>
            <div className="text-xs opacity-70">Video without background audio</div>
          </div>
        </button>

        {MUSIC_PRESETS.map((track) => (
          <div
            key={track.id}
            className={`w-full p-3 rounded-xl border transition-all flex items-center gap-3 ${
              selected === track.id
                ? "bg-violet-500/10 border-violet-500 text-white"
                : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20"
            }`}
          >
            {/* Preview button */}
            <button
              type="button"
              onClick={() => togglePreview(track.id, track.url)}
              className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 hover:bg-white/[0.1] transition-colors cursor-pointer"
              aria-label={playing === track.id ? "Stop preview" : `Preview ${track.name}`}
            >
              {playing === track.id ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>

            {/* Track info — click to select */}
            <button
              type="button"
              onClick={() => onSelect(track.id)}
              className="flex-1 text-left cursor-pointer"
            >
              <div className="font-medium text-sm">{track.name}</div>
              <div className="text-xs opacity-70">{track.mood}</div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
