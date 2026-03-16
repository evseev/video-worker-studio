import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type SceneProps = {
  scriptText: string;
  assetUrl: string | null;
  index: number;
  totalScenes: number;
  template?: string;
};

/**
 * A single scene in the video:
 * - Full-screen background image (with slow Ken Burns zoom)
 * - Gradient overlay for text readability
 * - TikTok-style caption text with fade-in animation
 */
export const Scene: React.FC<SceneProps> = ({
  scriptText,
  assetUrl,
  index,
  totalScenes,
  template = "Slideshow",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // Ken Burns: slow zoom from 100% to 110%
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Caption fade in from 0 to full opacity over 0.5s
  const captionOpacity = interpolate(
    frame,
    [0, Math.min(fps * 0.5, durationInFrames)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Caption slide up
  const captionY = interpolate(
    frame,
    [0, Math.min(fps * 0.5, durationInFrames)],
    [30, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Fallback gradient colors per scene index
  const gradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)",
    "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
  ];

  return (
    <AbsoluteFill>
      {/* Background */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {assetUrl ? (
          <Img
            src={assetUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: gradients[index % gradients.length],
            }}
          />
        )}
      </AbsoluteFill>

      {/* Dark gradient overlay for text readability (Skip for Fact Card to try different style) */}
      {template !== "Fact Card" && (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 40%, transparent 60%)",
          }}
        />
      )}

      {/* Caption */}
      <AbsoluteFill
        style={{
          justifyContent: template === "Compilation" ? "center" : "flex-end",
          alignItems: "center",
          padding: template === "Compilation" ? "0 60px" : template === "Fact Card" ? "0 40px 100px 40px" : "0 60px 200px 60px",
        }}
      >
        <div
          style={{
            opacity: captionOpacity,
            transform: `translateY(${captionY}px)`,
            textAlign: "center",
            ...(template === "Fact Card"
              ? {
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  padding: "40px 30px",
                  borderRadius: 24,
                  boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                  border: "2px solid rgba(0,0,0,0.1)",
                }
              : {}),
          }}
        >
          <p
            style={{
              fontSize: template === "Fact Card" ? 48 : 56,
              fontWeight: 800,
              color: template === "Fact Card" ? "#111" : "white",
              lineHeight: 1.3,
              textShadow: template === "Fact Card" ? "none" : "0 4px 20px rgba(0,0,0,0.6)",
              fontFamily:
                template === "Evolution" || template === "Comparison"
                  ? "system-ui, -apple-system, sans-serif"
                  : "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
              letterSpacing: template === "Fact Card" ? "0" : "-0.02em",
              margin: 0,
              textTransform: template === "Compilation" ? "uppercase" : "none",
            }}
          >
            {scriptText}
          </p>
        </div>
      </AbsoluteFill>

      {/* Scene counter */}
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 40,
          fontSize: 18,
          color: "rgba(255,255,255,0.5)",
          fontFamily: "monospace",
        }}
      >
        {index + 1}/{totalScenes}
      </div>
    </AbsoluteFill>
  );
};
