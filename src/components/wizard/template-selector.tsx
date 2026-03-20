const TEMPLATES = ["minimalist", "bold", "neon", "corporate"] as const;

export function TemplateSelector({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (template: string) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Visual Template</h3>
      <div className="grid grid-cols-2 gap-4">
        {TEMPLATES.map((template) => (
          <button
            key={template}
            onClick={() => onSelect(template)}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              selected === template
                ? "bg-violet-500/10 border-violet-500 text-white"
                : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20"
            }`}
          >
            <div className="font-medium capitalize mb-1">{template}</div>
            <div className="text-xs opacity-70">
              Visual style for text overlays and transitions.
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
