import { DraggableImage } from "@/components/DraggableImage";
import type { SlideshowScene } from "@/templates/types";

type SceneCardProps = {
  scene: SlideshowScene;
  index: number;
  totalScenes: number;
  aspectRatio: string;
  onUpdate: (updates: Partial<SlideshowScene>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRefreshAsset: (slotIdx: number) => void;
  onSelectAsset: (slotIdx: number, assetIdx: number) => void;
};

export function SlideshowSceneCard({
  scene,
  index,
  totalScenes,
  aspectRatio,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onRefreshAsset,
  onSelectAsset,
}: SceneCardProps) {
  const slot = scene.assets[0];
  const displayUrl = slot?.url ?? slot?.options?.[slot?.selectedIndex ?? 0];
  const hasOptions = slot?.options && slot.options.length > 1;
  // Preview thumbnail matches video aspect ratio (full-frame image)
  const thumbAR = aspectRatio === "16:9" ? "16/9" : "9/16";

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 flex gap-4 group">
      {/* Reorder + image column */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Move scene up"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>

        <div className="w-20 bg-black/50 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center relative" style={{ aspectRatio: thumbAR }}>
          <DraggableImage
            src={displayUrl ?? ""}
            alt={scene.searchKeywords[0] ?? ""}
            objectPosition={slot?.objectPosition}
            onPositionChange={(pos) => {
              const assets = [...scene.assets];
              assets[0] = { ...assets[0], objectPosition: pos };
              onUpdate({ assets } as Partial<SlideshowScene>);
            }}
            onRefresh={() => onRefreshAsset(0)}
            className="w-full h-full"
          />
        </div>

        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === totalScenes - 1}
          className="p-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Move scene down"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Scene {index + 1}</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={scene.searchKeywords[0] ?? ""}
              onChange={(e) => onUpdate({ searchKeywords: [e.target.value] })}
              className="px-2 py-1 bg-white/[0.06] border border-white/10 rounded text-xs text-zinc-300 w-40 focus:outline-none focus:border-violet-500/50"
              placeholder="Search keyword"
            />
            {totalScenes > 1 && (
              <button
                type="button"
                onClick={onRemove}
                className="p-1 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                aria-label={`Delete scene ${index + 1}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" x2="6" y1="6" y2="18" />
                  <line x1="6" x2="18" y1="6" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Caption (on-screen)</label>
          <textarea
            value={scene.captionText ?? ""}
            onChange={(e) => onUpdate({ captionText: e.target.value })}
            className="w-full flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-violet-500/50 min-h-[60px] resize-y"
            placeholder="Short on-screen caption — 3-8 words"
          />
        </div>

        {/* Asset options picker */}
        {hasOptions && (
          <div className="flex gap-2 mt-1">
            {slot!.options!.map((url, assetIdx) => (
              <button
                key={assetIdx}
                type="button"
                onClick={() => onSelectAsset(0, assetIdx)}
                className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  (slot?.selectedIndex ?? 0) === assetIdx
                    ? "border-violet-500 ring-1 ring-violet-500/50"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Option ${assetIdx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
