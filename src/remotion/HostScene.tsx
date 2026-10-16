import { AbsoluteFill, OffthreadVideo } from "remotion";

/**
 * Phase 3 experiment: the animated host on screen. The lip-synced clip carries its own audio,
 * so host scenes have no separate narrationUrl. Remotion scenes in this repo use inline styles
 * (the Remotion bundle has no Tailwind), matching templates/*.tsx.
 */
export const HostScene: React.FC<{ videoUrl: string; caption?: string; textScale?: number }> = ({ videoUrl, caption, textScale = 1 }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <OffthreadVideo src={videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    {caption ? (
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: `${Math.round(64 * textScale)}px 32px ${Math.round(32 * textScale)}px`,
          background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: Math.round(44 * textScale), fontWeight: 900, color: "#fff", textTransform: "uppercase", fontFamily: "Arial Black, Arial, sans-serif" }}>
          {caption}
        </span>
      </div>
    ) : null}
  </AbsoluteFill>
);
