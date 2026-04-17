"use client";

import {
  CAPTION_STYLE_OPTIONS,
  getComparisonCaptionStyles,
  type CaptionStyleId,
} from "@/lib/comparison-caption-styles";

const SAMPLE = "Preview text";

export function CaptionStyleSelector({
  value,
  onChange,
}: {
  value: CaptionStyleId;
  onChange: (id: CaptionStyleId) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Caption style</h3>
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        role="radiogroup"
        aria-label="Caption style"
      >
        {CAPTION_STYLE_OPTIONS.map((opt) => {
          const cap = getComparisonCaptionStyles(opt.id);
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.id)}
              className={`rounded-xl border text-left transition-all cursor-pointer overflow-hidden flex flex-col ${
                selected
                  ? "bg-violet-500/10 border-violet-500 ring-1 ring-violet-500/50"
                  : "bg-white/[0.02] border-white/[0.06] hover:border-white/20"
              }`}
            >
              <div
                className="h-16 flex items-center justify-center px-2 relative overflow-hidden"
                style={{ background: "#0a0a0f" }}
              >
                <div
                  className="w-full max-w-[140px] mx-auto flex items-center justify-center"
                  style={{
                    ...cap.bar,
                    position: "relative",
                    borderRadius: 6,
                    minHeight: 36,
                  }}
                >
                  <span
                    style={{
                      ...cap.text,
                      fontSize: Math.min(Number(cap.text.fontSize) || 14, 14),
                      lineHeight: 1.2,
                      display: "block",
                      transform: opt.id === "glowing" ? "scale(0.85)" : undefined,
                      transformOrigin: "center",
                    }}
                  >
                    {SAMPLE}
                  </span>
                </div>
              </div>
              <div className="px-2 py-2 border-t border-white/[0.06]">
                <div className="font-medium text-xs text-zinc-200">{opt.label}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
