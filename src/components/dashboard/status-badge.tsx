const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  processing: "Generating…",
  rendering: "Rendering…",
  completed: "Completed",
  failed_ai: "AI Error",
  failed_render: "Render Error",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium status-${status}`}
    >
      {(status === "processing" || status === "rendering") && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-glow" />
      )}
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
