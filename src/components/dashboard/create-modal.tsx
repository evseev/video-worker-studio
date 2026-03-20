"use client";

import { useState } from "react";

export interface CreateProjectData {
  topic: string;
  sceneCount: number;
  sceneDuration: number;
  aspectRatio: string;
  videoQuality: string;
}

export function CreateModal({
  creating,
  onSubmit,
  onClose,
}: {
  creating: boolean;
  onSubmit: (data: CreateProjectData) => void;
  onClose: () => void;
}) {
  const [topic, setTopic] = useState("");
  const [sceneCount, setSceneCount] = useState(5);
  const [sceneDuration, setSceneDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [videoQuality, setVideoQuality] = useState("1080p");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    onSubmit({ topic: topic.trim(), sceneCount, sceneDuration, aspectRatio, videoQuality });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/[0.06] bg-[#12121d] p-8 shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-2">Create a new video</h2>
        <p className="text-base text-zinc-400 mb-6">
          Describe your video idea and configure the basic settings.
        </p>
        <form onSubmit={handleSubmit}>
          {/* Topic */}
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Video idea</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. 5 tips for better sleep that most people ignore"
            required
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-zinc-500 transition-all focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none mb-5"
          />

          {/* Scene count + Duration row */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Number of scenes</label>
              <input
                type="number"
                min={2}
                max={100}
                value={sceneCount}
                onChange={(e) => setSceneCount(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-base text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Duration per scene (sec)</label>
              <input
                type="number"
                min={2}
                max={60}
                value={sceneDuration}
                onChange={(e) => setSceneDuration(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-base text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          </div>

          {/* Aspect ratio */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Aspect ratio</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "9:16", label: "9:16 Portrait", desc: "Shorts / TikTok / Reels" },
                { value: "16:9", label: "16:9 Landscape", desc: "YouTube / standard" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAspectRatio(opt.value)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    aspectRatio === opt.value
                      ? "bg-violet-500/10 border-violet-500 text-white"
                      : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20"
                  }`}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Video quality */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Video quality</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "720p", label: "HD 720p", desc: "Fast render" },
                { value: "1080p", label: "Full HD 1080p", desc: "Recommended" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVideoQuality(opt.value)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    videoQuality === opt.value
                      ? "bg-violet-500/10 border-violet-500 text-white"
                      : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:border-white/20"
                  }`}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
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
              {creating ? "Creating…" : "Create Video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
