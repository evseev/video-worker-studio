import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type SlideshowSceneProps = {
  scriptText: string;
  assetUrl: string | null;
  assetObjectPosition?: string;
};

const FALLBACK_GRADIENT =
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

export const SlideshowScene: React.FC<SlideshowSceneProps> = ({
  scriptText,
  assetUrl,
  assetObjectPosition,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1, 1.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const captionDuration = Math.min(fps * 0.5, durationInFrames);

  const captionOpacity = interpolate(frame, [0, captionDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const captionY = interpolate(frame, [0, captionDuration], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {/* Background — Ken Burns zoom */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {assetUrl ? (
          <Img
            src={assetUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: assetObjectPosition ?? "50% 50%" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: FALLBACK_GRADIENT,
            }}
          />
        )}
      </AbsoluteFill>

      {/* Dark gradient overlay (transparent → black at 80%) */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 40%, transparent 60%)",
        }}
      />

      {/* Caption — bottom center with fade-in animation */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "0 60px 60px 60px",
        }}
      >
        <div
          style={{
            opacity: captionOpacity,
            transform: `translateY(${captionY}px)`,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: "white",
              lineHeight: 1.4,
              textShadow: "0 2px 12px rgba(0,0,0,0.8)",
              fontFamily:
                "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
              margin: 0,
            }}
          >
            {scriptText}
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
