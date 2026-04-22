import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getImageTransform, getTextStyle } from "@/remotion/animation-utils";
import { resolveCaption } from "@/remotion/caption-fallback";
import type { ResolvedImageMotion, ResolvedTextAnimation } from "@/lib/effects";
import {
  getComparisonCaptionStyles,
  getComparisonLabelStyle,
  showComparisonCaption,
  showComparisonLabels,
  type CaptionStyleId,
  type ComparisonOverlayMode,
} from "@/lib/comparison-caption-styles";

type ComparisonSceneProps = {
  scriptText: string;
  /** On-screen caption. Falls back to scriptText when empty. */
  captionText?: string;
  leftAssetUrl: string | null;
  rightAssetUrl: string | null;
  leftObjectPosition?: string;
  rightObjectPosition?: string;
  leftLabel: string;
  rightLabel: string;
  imageMotion?: ResolvedImageMotion;
  textAnimation?: ResolvedTextAnimation;
  captionStyleId: CaptionStyleId;
  comparisonOverlayMode: ComparisonOverlayMode;
};

const LEFT_GRADIENT = "linear-gradient(135deg, #f5576c 0%, #f093fb 100%)";
const RIGHT_GRADIENT = "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)";

export const ComparisonScene: React.FC<ComparisonSceneProps> = ({
  scriptText,
  captionText,
  leftAssetUrl,
  rightAssetUrl,
  leftObjectPosition,
  rightObjectPosition,
  leftLabel,
  rightLabel,
  imageMotion,
  textAnimation,
  captionStyleId,
  comparisonOverlayMode,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const progress = frame / durationInFrames;
  const imageStyle = getImageTransform(imageMotion ?? "zoom-in", progress);
  const textStyle = getTextStyle(textAnimation ?? "slide-up", frame, 10, fps);

  const showLabels = showComparisonLabels(comparisonOverlayMode);
  const showCaption = showComparisonCaption(comparisonOverlayMode);
  const labelLeft = getComparisonLabelStyle(captionStyleId, "left");
  const labelRight = getComparisonLabelStyle(captionStyleId, "right");
  const cap = getComparisonCaptionStyles(captionStyleId);
  const displayCaption = resolveCaption(captionText, scriptText);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          gap: 4,
        }}
      >
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
          {showLabels && (
            <div style={labelLeft}>
              {leftLabel}
            </div>
          )}
        </div>

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
          {showLabels && (
            <div style={labelRight}>
              {rightLabel}
            </div>
          )}
        </div>
      </div>

      {showCaption && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            ...cap.bar,
            ...textStyle,
          }}
        >
          <p style={cap.text}>
            {displayCaption}
          </p>
        </div>
      )}
    </AbsoluteFill>
  );
};
