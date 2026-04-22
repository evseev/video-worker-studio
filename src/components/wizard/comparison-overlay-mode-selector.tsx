"use client";

import type { ComparisonOverlayMode } from "@/lib/comparison-caption-styles";

const OPTIONS: { id: ComparisonOverlayMode; label: string; hint: string }[] = [
  { id: "labels", label: "Labels", hint: "Left & right labels only" },
  { id: "caption", label: "Caption", hint: "Bottom caption only" },
  { id: "both", label: "Both", hint: "Labels and caption" },
];

export function ComparisonOverlayModeSelector({
  value,
  onChange,
}: {
  value: ComparisonOverlayMode;
  onChange: (mode: ComparisonOverlayMode) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-400 mb-2">Text on screen</h3>
      <p className="text-xs text-zinc-500 mb-3">Choose what appears on each scene.</p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Comparison text visibility">
        {OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.id)}
              className={`px-3 py-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                selected
                  ? "bg-violet-500/10 border-violet-500 text-white"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20"
              }`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{opt.hint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
