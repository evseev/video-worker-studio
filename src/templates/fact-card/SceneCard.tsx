import type { FactCardScene } from "@/templates/types";

type SceneCardProps = {
  scene: FactCardScene;
  index: number;
  totalScenes: number;
  aspectRatio: string;
  onUpdate: (updates: Partial<FactCardScene>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRefreshAsset: (slotIdx: number) => void;
  onSelectAsset: (slotIdx: number, assetIdx: number) => void;
};

function AssetSlotPicker({
  slot,
  size,
  label,
  onRefresh,
  onSelect,
}: {
  slot: FactCardScene["assets"][number] | undefined;
  size: "large" | "small";
  label: string;
  onRefresh: () => void;
  onSelect: (assetIdx: number) => void;
}) {
  const displayUrl = slot?.url ?? slot?.options?.[slot?.selectedIndex ?? 0];
  const hasOptions = slot?.options && slot.options.length > 1;
  const sizeClass = size === "large" ? "w-32 h-36" : "w-20 h-24";

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className={`${sizeClass} bg-black/50 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center relative group/slot`}>
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] text-zinc-600">No image</span>
        )}
        <button
          type="button"
          onClick={onRefresh}
          className="absolute inset-0 bg-black/60 opacity-0 group-hover/slot:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
          aria-label={`Refresh ${label}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>
      {hasOptions && (
        <div className="flex gap-1">
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

export function FactCardSceneCard({
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
  function updateFact(factIdx: number, field: "label" | "value", val: string) {
    const facts = scene.facts.map((f, i) => (i === factIdx ? { ...f, [field]: val } : f));
    onUpdate({ facts });
  }

  function removeFact(factIdx: number) {
    onUpdate({ facts: scene.facts.filter((_, i) => i !== factIdx) });
  }

  function addFact() {
    if (scene.facts.length >= 3) return;
    onUpdate({ facts: [...scene.facts, { label: "", value: "" }] });
  }

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

      {/* Images */}
      <div className="flex gap-4 items-start">
        <AssetSlotPicker
          slot={scene.assets[0]}
          size="large"
          label="Main Image"
          onRefresh={() => onRefreshAsset(0)}
          onSelect={(assetIdx) => onSelectAsset(0, assetIdx)}
        />
        <AssetSlotPicker
          slot={scene.assets[1]}
          size="small"
          label="Secondary"
          onRefresh={() => onRefreshAsset(1)}
          onSelect={(assetIdx) => onSelectAsset(1, assetIdx)}
        />
      </div>

      {/* Title + Subtitle */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Title</label>
          <input
            type="text"
            value={scene.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded text-sm text-zinc-300 focus:outline-none focus:border-violet-500/50"
            placeholder="Title"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Subtitle</label>
          <input
            type="text"
            value={scene.subtitle}
            onChange={(e) => onUpdate({ subtitle: e.target.value })}
            className="w-full px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded text-sm text-zinc-300 focus:outline-none focus:border-violet-500/50"
            placeholder="Subtitle"
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

      {/* Facts editor */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Facts</span>
          {scene.facts.length < 3 && (
            <button
              type="button"
              onClick={addFact}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
            >
              + Add fact
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {scene.facts.map((fact, factIdx) => (
            <div key={factIdx} className="flex gap-2 items-center">
              <input
                type="text"
                value={fact.label}
                onChange={(e) => updateFact(factIdx, "label", e.target.value)}
                className="flex-1 px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded text-sm text-zinc-300 focus:outline-none focus:border-violet-500/50"
                placeholder="Label"
              />
              <input
                type="text"
                value={fact.value}
                onChange={(e) => updateFact(factIdx, "value", e.target.value)}
                className="flex-1 px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded text-sm text-zinc-300 focus:outline-none focus:border-violet-500/50"
                placeholder="Value"
              />
              <button
                type="button"
                onClick={() => removeFact(factIdx)}
                className="p-1 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                aria-label="Remove fact"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" x2="6" y1="6" y2="18" />
                  <line x1="6" x2="18" y1="6" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          {scene.facts.length === 0 && (
            <p className="text-xs text-zinc-600">No facts yet. Click &quot;+ Add fact&quot; to add one.</p>
          )}
        </div>
      </div>

      {/* Keyword inputs */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Main Keyword</label>
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
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Secondary Keyword</label>
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
    </div>
  );
}
