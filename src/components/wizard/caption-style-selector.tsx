import { CAPTION_STYLES } from "@/lib/caption-styles";

export function CaptionStyleSelector({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (styleId: string) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Caption Style</h3>
      <div className="grid grid-cols-2 gap-3">
        {CAPTION_STYLES.map((style) => (
          <button
            key={style.id}
            onClick={() => onSelect(style.id)}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selected === style.id
                ? "bg-violet-500/10 border-violet-500 text-white"
                : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20"
            }`}
          >
            {/* Mini preview */}
            <div
              className="h-8 rounded-md mb-2 flex items-end justify-center overflow-hidden"
              style={{ backgroundColor: "#111" }}
            >
              <span
                className="text-[10px] leading-tight px-1.5 py-0.5 truncate max-w-full"
                style={{
                  color: style.color,
                  fontWeight: style.fontWeight,
                  backgroundColor: style.backgroundColor ?? "transparent",
                }}
              >
                Sample Text
              </span>
            </div>
            <div className="font-medium text-sm mb-0.5">{style.name}</div>
            <div className="text-xs opacity-70">{style.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
