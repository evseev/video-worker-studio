export function PhasePlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-zinc-400">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="mt-2 text-xs text-zinc-500">Available in Epic 25 Phase C/D.</p>
    </div>
  );
}
