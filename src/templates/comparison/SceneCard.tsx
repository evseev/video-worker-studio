import { DraggableImage } from "@/components/DraggableImage";
import type { ComparisonScene } from "@/templates/types";

type SceneCardProps = {
  scene: ComparisonScene;
  index: number;
  totalScenes: number;
  aspectRatio: string;
  onUpdate: (updates: Partial<ComparisonScene>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRefreshAsset: (slotIdx: number) => void;
  onSelectAsset: (slotIdx: number, assetIdx: number) => void;
};

function AssetThumb({
  slot,
  label,
  slotIdx,
  onRefresh,
  onSelect,
  onPositionChange,
}: {
  slot: ComparisonScene["assets"][number] | undefined;
  label: string;
  slotIdx: number;
  onRefresh: () => void;
  onSelect: (assetIdx: number) => void;
  onPositionChange: (pos: string) => void;
}) {
  const displayUrl = slot?.url ?? slot?.options?.[slot?.selectedIndex ?? 0];
  const hasOptions = slot?.options && slot.options.length > 1;

  return (
    <div className="flex flex-col gap-1 flex-1">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider text-center">{label}</span>
      <div className="relative w-full aspect-[3/4] bg-black/50 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center">
        <DraggableImage
          src={displayUrl ?? ""}
          alt={label}
          objectPosition={slot?.objectPosition}
          onPositionChange={onPositionChange}
          onRefresh={onRefresh}
          className="w-full h-full"
        />
      </div>
      {hasOptions && (
        <div className="flex gap-1 justify-center">
          {slot!.options!.map((url, assetIdx) => (
            <button
              key={assetIdx}
              type="button"
              onClick={() => onSelect(assetIdx)}
              className={`w-10 h-10 rounded overflow-hidden border-2 transition-all cursor-pointer ${
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
  );
}

export function ComparisonSceneCard({
  scene,
  index,
  totalScenes,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onRefreshAsset,
  onSelectAsset,
}: SceneCardProps) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
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
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Scene {index + 1}</span>
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

      {/* Two image thumbnails side by side */}
      <div className="flex gap-3">
        <AssetThumb
          slot={scene.assets[0]}
          label="Left"
          slotIdx={0}
          onRefresh={() => onRefreshAsset(0)}
          onSelect={(assetIdx) => onSelectAsset(0, assetIdx)}
          onPositionChange={(pos) => {
            const assets = [...scene.assets];
            assets[0] = { ...assets[0], objectPosition: pos };
            onUpdate({ assets } as Partial<ComparisonScene>);
          }}
        />
        <AssetThumb
          slot={scene.assets[1]}
          label="Right"
          slotIdx={1}
          onRefresh={() => onRefreshAsset(1)}
          onSelect={(assetIdx) => onSelectAsset(1, assetIdx)}
          onPositionChange={(pos) => {
            const assets = [...scene.assets];
            assets[1] = { ...assets[1], objectPosition: pos };
            onUpdate({ assets } as Partial<ComparisonScene>);
          }}
        />
      </div>

      {/* Label inputs */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Left Label</label>
          <input
            type="text"
            value={scene.leftLabel}
            onChange={(e) => onUpdate({ leftLabel: e.target.value })}
            className="w-full px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded text-sm text-zinc-300 focus:outline-none focus:border-violet-500/50"
            placeholder="Left label"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Right Label</label>
          <input
            type="text"
            value={scene.rightLabel}
            onChange={(e) => onUpdate({ rightLabel: e.target.value })}
            className="w-full px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded text-sm text-zinc-300 focus:outline-none focus:border-violet-500/50"
            placeholder="Right label"
          />
        </div>
      </div>

      {/* Keyword inputs */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Left Keyword</label>
          <input
            type="text"
            value={scene.searchKeywords[0] ?? ""}
            onChange={(e) => {
              const kws = [...scene.searchKeywords];
              kws[0] = e.target.value;
              onUpdate({ searchKeywords: kws });
            }}
            className="w-full px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded text-sm text-zinc-300 focus:outline-none focus:border-violet-500/50"
            placeholder="Search keyword"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Right Keyword</label>
          <input
            type="text"
            value={scene.searchKeywords[1] ?? ""}
            onChange={(e) => {
              const kws = [...scene.searchKeywords];
              kws[1] = e.target.value;
              onUpdate({ searchKeywords: kws });
            }}
            className="w-full px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded text-sm text-zinc-300 focus:outline-none focus:border-violet-500/50"
            placeholder="Search keyword"
          />
        </div>
      </div>

      {/* Script text */}
      <textarea
        value={scene.scriptText}
        onChange={(e) => onUpdate({ scriptText: e.target.value })}
        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-violet-500/50 min-h-[60px] resize-y"
        placeholder="Script text"
      />
    </div>
  );
}
