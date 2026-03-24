import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type ComparisonSceneProps = {
  scriptText: string;
  leftAssetUrl: string | null;
  rightAssetUrl: string | null;
  leftLabel: string;
  rightLabel: string;
};

const LEFT_GRADIENT = "linear-gradient(135deg, #f5576c 0%, #f093fb 100%)";
const RIGHT_GRADIENT = "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)";

export const ComparisonScene: React.FC<ComparisonSceneProps> = ({
  scriptText,
  leftAssetUrl,
  rightAssetUrl,
  leftLabel,
  rightLabel,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Images slide in from sides over 15 frames
  const slideProgress = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const leftX = interpolate(slideProgress, [0, 1], [-50, 0]);
  const rightX = interpolate(slideProgress, [0, 1], [50, 0]);
  const imageOpacity = interpolate(slideProgress, [0, 1], [0, 1]);

  // Caption fades in after 10 frames
  const captionOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Keep scale stable (no Ken Burns for comparison layout)
  void durationInFrames;

  const imageContainerStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    overflow: "hidden",
  };

  const imageWrapperStyle: React.CSSProperties = {
    flex: 1,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  };

  const gradientOverlayStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "30%",
    background:
      "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
    pointerEvents: "none",
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        flexDirection: "column",
        padding: 12,
        gap: 0,
      }}
    >
      {/* Images row */}
      <div
        style={{
          display: "flex",
          flex: 1,
          gap: 6,
          maxHeight: "55%",
        }}
      >
        {/* Left side */}
        <div
          style={{
            ...imageContainerStyle,
            opacity: imageOpacity,
            transform: `translateX(${leftX}px)`,
          }}
        >
          {/* Left label */}
          <div
            style={{
              textAlign: "center",
              fontSize: 14,
              fontWeight: 700,
              color: "#f5576c",
              fontFamily:
                "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              flexShrink: 0,
            }}
          >
            {leftLabel}
          </div>

          {/* Left image */}
          <div style={imageWrapperStyle}>
            {leftAssetUrl ? (
              <Img
                src={leftAssetUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{ width: "100%", height: "100%", background: LEFT_GRADIENT }}
              />
            )}
            <div style={gradientOverlayStyle} />
          </div>
        </div>

        {/* VS badge in center */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: 32,
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#0a0a0f",
              fontFamily:
                "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
              flexShrink: 0,
            }}
          >
            VS
          </div>
        </div>

        {/* Right side */}
        <div
          style={{
            ...imageContainerStyle,
            opacity: imageOpacity,
            transform: `translateX(${rightX}px)`,
          }}
        >
          {/* Right label */}
          <div
            style={{
              textAlign: "center",
              fontSize: 14,
              fontWeight: 700,
              color: "#4facfe",
              fontFamily:
                "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              flexShrink: 0,
            }}
          >
            {rightLabel}
          </div>

          {/* Right image */}
          <div style={imageWrapperStyle}>
            {rightAssetUrl ? (
              <Img
                src={rightAssetUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: RIGHT_GRADIENT,
                }}
              />
            )}
            <div style={gradientOverlayStyle} />
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Caption bar */}
      <div
        style={{
          opacity: captionOpacity,
          backgroundColor: "rgba(0,0,0,0.75)",
          padding: "12px 16px",
          borderRadius: 8,
          marginTop: 8,
        }}
      >
        <p
          style={{
            fontSize: 14,
            color: "white",
            textAlign: "center",
            margin: 0,
            lineHeight: 1.4,
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          {scriptText}
        </p>
      </div>
    </AbsoluteFill>
  );
};
