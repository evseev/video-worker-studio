export function CreateModal({
  topic,
  creating,
  onTopicChange,
  onSubmit,
  onClose,
}: {
  topic: string;
  creating: boolean;
  onTopicChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/[0.06] bg-[#12121d] p-8 shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-2">Create a new video</h2>
        <p className="text-base text-zinc-400 mb-6">
          Describe what your video should be about. Our AI will handle the script, visuals, and rendering.
        </p>
        <form onSubmit={onSubmit}>
          <textarea
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder="e.g. 5 tips for better sleep that most people ignore"
            required
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-zinc-500 transition-all focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none mb-4"
          />
          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !topic.trim()}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {creating ? "Creating…" : "Generate Video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
