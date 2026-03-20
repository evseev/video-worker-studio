"use client";

import { useRef, useState } from "react";

const MAX_SIZE_MB = 50;
const ALLOWED_TYPES = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav"];

export function VoiceoverUpload({
  voiceoverUrl,
  onUpload,
  onRemove,
}: {
  voiceoverUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(voiceoverUrl);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav)$/i)) {
      setError("Please upload an MP3 or WAV file.");
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      await onUpload(file);
      // Revoke previous blob URL to prevent memory leak
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onRemove();
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Voice-Over (Optional)</h3>

      {previewUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <audio src={previewUrl} controls className="flex-1 h-8" />
          <button
            type="button"
            onClick={handleRemove}
            className="p-2 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
            aria-label="Remove voice-over"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/30 bg-white/[0.02] p-6 text-center transition-all cursor-pointer disabled:opacity-50"
        >
          <div className="flex flex-col items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <div className="text-sm text-zinc-400">
              {uploading ? "Uploading..." : "Upload MP3 or WAV (max 50MB)"}
            </div>
          </div>
        </button>
      )}

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
