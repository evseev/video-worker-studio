export type SceneData = {
  scriptText: string;
  searchKeyword: string;
  assetUrl?: string;
  assetOptions?: string[];
  selectedAssetIndex?: number;
};

export function SceneCard({
  scene,
  index,
  total,
  onScriptChange,
  onKeywordChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onRefreshAsset,
  onSelectAsset,
  refreshingAsset,
}: {
  scene: SceneData;
  index: number;
  total: number;
  onScriptChange: (value: string) => void;
  onKeywordChange: (value: string) => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRefreshAsset?: () => void;
  onSelectAsset?: (assetIndex: number) => void;
  refreshingAsset?: boolean;
}) {
  const hasOptions = scene.assetOptions && scene.assetOptions.length > 1;
  const displayUrl = scene.assetUrl || scene.assetOptions?.[scene.selectedAssetIndex ?? 0];

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6" /></svg>
        </button>

        <div className="w-20 h-24 bg-black/50 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center relative">
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl} alt={scene.searchKeyword} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] text-zinc-600">No image</span>
          )}
          {onRefreshAsset && (
            <button
              type="button"
              onClick={onRefreshAsset}
              disabled={refreshingAsset}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              aria-label="Refresh asset"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className={refreshingAsset ? "animate-spin" : ""}>
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Move scene down"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="mb-2 flex justify-between items-center">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Scene {index + 1}</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={scene.searchKeyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              className="px-2 py-1 bg-white/[0.06] border border-white/10 rounded text-xs text-zinc-300 w-40 focus:outline-none focus:border-violet-500/50"
              placeholder="Search keyword"
            />
            {onDelete && total > 1 && (
              <button
                type="button"
                onClick={onDelete}
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

        <textarea
          value={scene.scriptText}
          onChange={(e) => onScriptChange(e.target.value)}
          className="w-full flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-violet-500/50 min-h-[60px] resize-y"
          placeholder="Script text"
        />

        {/* Asset options picker */}
        {hasOptions && onSelectAsset && (
          <div className="flex gap-2 mt-2">
            {scene.assetOptions!.map((url, assetIdx) => (
              <button
                key={assetIdx}
                type="button"
                onClick={() => onSelectAsset(assetIdx)}
                className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  (scene.selectedAssetIndex ?? 0) === assetIdx
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
