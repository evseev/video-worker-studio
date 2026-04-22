import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getImageTransform, getTextStyle } from "@/remotion/animation-utils";
import { resolveCaption } from "@/remotion/caption-fallback";
import type { ResolvedImageMotion, ResolvedTextAnimation } from "@/lib/effects";

type SlideshowSceneProps = {
  scriptText: string;
  /**
   * Short on-screen caption. When omitted or empty, falls back to `scriptText`
   * so legacy scenes without a caption still render correctly.
   */
  captionText?: string;
  assetUrl: string | null;
  assetObjectPosition?: string;
  imageMotion?: ResolvedImageMotion;
  textAnimation?: ResolvedTextAnimation;
};

const FALLBACK_GRADIENT =
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

export const SlideshowScene: React.FC<SlideshowSceneProps> = ({
  scriptText,
  captionText,
  assetUrl,
  assetObjectPosition,
  imageMotion,
  textAnimation,
}) => {
  const displayCaption = resolveCaption(captionText, scriptText);
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const progress = frame / durationInFrames;
  const imageStyle = getImageTransform(imageMotion ?? "zoom-in", progress);
  const textStyle = getTextStyle(textAnimation ?? "slide-up", frame, 0, fps);

  return (
    <AbsoluteFill>
      {/* Background — configurable image motion */}
      <AbsoluteFill
        style={{ ...imageStyle }}
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
            ...textStyle,
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
            {displayCaption}
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
