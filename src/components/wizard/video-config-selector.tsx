const ASPECT_RATIOS = [
  { value: "9:16", label: "9:16 Portrait", desc: "YouTube Shorts, TikTok, Reels" },
  { value: "16:9", label: "16:9 Landscape", desc: "YouTube, standard widescreen" },
] as const;

const QUALITY_OPTIONS = [
  { value: "720p", label: "HD 720p", desc: "Fast render, smaller file" },
  { value: "1080p", label: "Full HD 1080p", desc: "High quality, recommended" },
] as const;

export function VideoConfigSelector({
  aspectRatio,
  videoQuality,
  onAspectRatioChange,
  onVideoQualityChange,
}: {
  aspectRatio: string;
  videoQuality: string;
  onAspectRatioChange: (value: string) => void;
  onVideoQualityChange: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">Aspect Ratio</h3>
        <div className="grid grid-cols-2 gap-3">
          {ASPECT_RATIOS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onAspectRatioChange(opt.value)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                aspectRatio === opt.value
                  ? "bg-violet-500/10 border-violet-500 text-white"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20"
              }`}
            >
              <div className="font-medium text-sm mb-0.5">{opt.label}</div>
              <div className="text-xs opacity-70">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">Video Quality</h3>
        <div className="grid grid-cols-2 gap-3">
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onVideoQualityChange(opt.value)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                videoQuality === opt.value
                  ? "bg-violet-500/10 border-violet-500 text-white"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20"
              }`}
            >
              <div className="font-medium text-sm mb-0.5">{opt.label}</div>
              <div className="text-xs opacity-70">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
