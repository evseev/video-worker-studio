import type { Tables } from "@/lib/supabase/types";

type Project = Tables<"projects">;

export type DeleteState =
  | null
  | { phase: "confirm"; project: Project }
  | { phase: "success"; warnings: string[] };

export function DeleteModal({
  state,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  state: NonNullable<DeleteState>;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-lg mx-4 rounded-2xl border border-white/[0.06] bg-[#12121d] p-8 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          state.phase === "confirm" ? "delete-project-title" : "delete-project-done"
        }
      >
        {state.phase === "confirm" ? (
          <>
            <h2 id="delete-project-title" className="text-xl font-semibold text-white mb-2">
              Delete this project?
            </h2>
            <p className="text-base text-zinc-400 mb-2">
              <span className="text-zinc-200 font-medium">{state.project.topic}</span>{" "}
              will be removed from your library. Downloaded copies of the video are not affected.
            </p>
            <p className="text-base text-amber-200/80 mb-6">
              This permanently deletes the project, its scenes, local temp files, and stored video files when possible.
            </p>
            {error && <p className="text-base text-red-400 mb-4">{error}</p>}
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition-all hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {busy ? "Deleting…" : "Delete project"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="delete-project-done" className="text-xl font-semibold text-white mb-2">
              Project deleted
            </h2>
            <p className="text-base text-zinc-400 mb-4">
              The project has been removed from your account.
            </p>
            {state.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-6">
                <p className="text-xs font-medium text-amber-200/90 mb-2">
                  Some cleanup steps reported issues (the project row was still removed):
                </p>
                <ul className="text-xs text-amber-100/80 list-disc pl-4 space-y-1">
                  {state.warnings.map((w, i) => (
                    <li key={`${i}-${w}`}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-indigo-500 cursor-pointer"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
