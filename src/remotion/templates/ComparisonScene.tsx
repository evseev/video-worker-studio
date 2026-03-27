import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getImageTransform, getTextStyle } from "@/remotion/animation-utils";
import type { ResolvedImageMotion, ResolvedTextAnimation } from "@/lib/effects";

type ComparisonSceneProps = {
  scriptText: string;
  leftAssetUrl: string | null;
  rightAssetUrl: string | null;
  leftObjectPosition?: string;
  rightObjectPosition?: string;
  leftLabel: string;
  rightLabel: string;
  imageMotion?: ResolvedImageMotion;
  textAnimation?: ResolvedTextAnimation;
};

const LEFT_GRADIENT = "linear-gradient(135deg, #f5576c 0%, #f093fb 100%)";
const RIGHT_GRADIENT = "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)";

export const ComparisonScene: React.FC<ComparisonSceneProps> = ({
  scriptText,
  leftAssetUrl,
  rightAssetUrl,
  leftObjectPosition,
  rightObjectPosition,
  leftLabel,
  rightLabel,
  imageMotion,
  textAnimation,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const progress = frame / durationInFrames;
  const imageStyle = getImageTransform(imageMotion ?? "zoom-in", progress);
  const textStyle = getTextStyle(textAnimation ?? "slide-up", frame, 10, fps);

  const font = "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Two images side by side — fill entire frame */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          gap: 4,
        }}
      >
        {/* Left image */}
        <div
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ width: "100%", height: "100%", ...imageStyle }}>
            {leftAssetUrl ? (
              <Img
                src={leftAssetUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: leftObjectPosition ?? "50% 50%" }}
              />
            ) : (
              <div
                style={{ width: "100%", height: "100%", background: LEFT_GRADIENT }}
              />
            )}
          </div>
          {/* Dark gradient overlay at bottom for label readability */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "40%",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
            }}
          />
          {/* Left label — large, overlaid at bottom of image */}
          <div
            style={{
              position: "absolute",
              bottom: 60,
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: 32,
              fontWeight: 800,
              color: "#f5576c",
              fontFamily: font,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            {leftLabel}
          </div>
        </div>

        {/* Right image */}
        <div
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ width: "100%", height: "100%", ...imageStyle }}>
            {rightAssetUrl ? (
              <Img
                src={rightAssetUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: rightObjectPosition ?? "50% 50%" }}
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
          </div>
          {/* Dark gradient overlay at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "40%",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
            }}
          />
          {/* Right label — large, overlaid at bottom of image */}
          <div
            style={{
              position: "absolute",
              bottom: 60,
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: 32,
              fontWeight: 800,
              color: "#4facfe",
              fontFamily: font,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            {rightLabel}
          </div>
        </div>
      </div>

      {/* Caption text — overlaid at very bottom of frame */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 24px",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
          ...textStyle,
        }}
      >
        <p
          style={{
            fontSize: 28,
            color: "white",
            textAlign: "center",
            margin: 0,
            lineHeight: 1.3,
            fontWeight: 600,
            fontFamily: font,
            textShadow: "0 2px 6px rgba(0,0,0,0.5)",
          }}
        >
          {scriptText}
        </p>
      </div>
    </AbsoluteFill>
  );
};
