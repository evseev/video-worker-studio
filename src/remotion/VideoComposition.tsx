import { AbsoluteFill, Audio, Sequence, interpolate, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming, type TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { SlideshowScene } from "./templates/SlideshowScene";
import { ComparisonScene } from "./templates/ComparisonScene";
import { FactCardScene } from "./templates/FactCardScene";
import { Watermark, type WatermarkPosition } from "./Watermark";
import type { ResolvedTransition, ResolvedImageMotion, ResolvedTextAnimation } from "@/lib/effects";
import type { CaptionStyleId, ComparisonOverlayMode } from "@/lib/comparison-caption-styles";

export type VideoCompositionProps = {
  scenes: Array<{
    template: string;
    scriptText: string;
    captionText?: string;
    assets: Array<{ url?: string | null; objectPosition?: string }>;
    // Comparison-specific
    leftLabel?: string;
    rightLabel?: string;
    // Fact-card-specific
    title?: string;
    subtitle?: string;
    facts?: { label: string; value: string }[];
    /** Per-scene narration clip (autopilot). Starts `narrationLeadInFrames` into the scene. */
    narrationUrl?: string | null;
  }>;
  sceneDurationFrames: number;
  /** Per-scene lengths (narration-driven). Falls back to `sceneDurationFrames` for every scene. */
  sceneDurationsFrames?: number[];
  narrationLeadInFrames?: number;
  /** Absolute [start, end) frames where narration is audible; music is ducked inside them. */
  narrationWindows?: Array<[number, number]>;
  musicVolume?: number;
  /** Music volume while narration plays (≈ -14 dB below musicVolume by default). */
  musicDuckedVolume?: number;
  /** Multiplier for label/caption text (1 = sizes tuned for a 1080px short side). */
  textScale?: number;
  /** Comparison scenes stack their photos in portrait frames (autopilot Shorts). */
  stackComparisonInPortrait?: boolean;
  transitionFrames: number;
  musicUrl?: string | null;
  voiceoverUrl?: string | null;
  sceneTransitions?: ResolvedTransition[];
  imageMotions?: ResolvedImageMotion[];
  textAnimations?: ResolvedTextAnimation[];
  captionStyle?: CaptionStyleId;
  comparisonOverlayMode?: ComparisonOverlayMode;
  /** Carried through the render manifest for Epic 25 (Phase D overlays the logo). */
  channelId?: string;
  watermark?: {
    logoUrl: string | null;
    position: WatermarkPosition;
    opacity: number;
  };
};

type WatermarkInput = NonNullable<VideoCompositionProps["watermark"]>;

function asPresentation<P extends Record<string, unknown>>(
  p: TransitionPresentation<P>
): TransitionPresentation<Record<string, unknown>> {
  return p as unknown as TransitionPresentation<Record<string, unknown>>;
}

function resolveTransitionPresentation(
  kind: ResolvedTransition,
  width: number,
  height: number
): TransitionPresentation<Record<string, unknown>> {
  switch (kind) {
    case "slide":
      return asPresentation(slide({ direction: "from-right" }));
    case "wipe":
      return asPresentation(wipe());
    case "flip":
      return asPresentation(flip());
    case "clock-wipe":
      return asPresentation(clockWipe({ width, height }));
    case "fade":
    default:
      return asPresentation(fade());
  }
}

function BackgroundMusic({
  src,
  volume = 0.3,
  duckedVolume,
  windows,
}: {
  src: string;
  volume?: number;
  duckedVolume?: number;
  windows?: Array<[number, number]>;
}) {
  const { durationInFrames, fps } = useVideoConfig();
  const fadeFrames = Math.min(fps * 2, durationInFrames / 4); // 2s fade or 25% of duration
  const ramp = Math.round(fps * 0.25);
  const ducked = duckedVolume ?? volume * 0.2;

  const volumeAt = (frame: number) => {
    const envelope = interpolate(
      frame,
      [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    let level = volume;
    if (windows && windows.length > 0) {
      // Smoothly duck under narration: distance (in frames) to the nearest window.
      let duck = 0;
      for (const [start, end] of windows) {
        if (frame >= start && frame < end) {
          duck = 1;
          break;
        }
        const d = frame < start ? start - frame : frame - end;
        if (d < ramp) duck = Math.max(duck, 1 - d / ramp);
      }
      level = volume + (ducked - volume) * duck;
    }
    return level * envelope;
  };

  return <Audio src={src} loop volume={volumeAt} />;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  scenes,
  sceneDurationFrames,
  sceneDurationsFrames,
  narrationLeadInFrames = 10,
  narrationWindows,
  musicVolume,
  musicDuckedVolume,
  textScale = 1,
  stackComparisonInPortrait = false,
  transitionFrames,
  musicUrl,
  voiceoverUrl,
  sceneTransitions = [],
  imageMotions = [],
  textAnimations = [],
  captionStyle = "minimal",
  comparisonOverlayMode = "both",
  watermark,
}) => {
  const { width, height } = useVideoConfig();

  const wm: WatermarkInput = watermark ?? {
    logoUrl: null,
    position: "none",
    opacity: 0.7,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {musicUrl && (
        <BackgroundMusic
          src={musicUrl}
          volume={musicVolume}
          duckedVolume={musicDuckedVolume}
          windows={narrationWindows}
        />
      )}
      {voiceoverUrl && <Audio src={voiceoverUrl} volume={0.9} />}

      <TransitionSeries>
        {scenes.flatMap((scene, index) => {
          const i = index;
          const elements = [
            <TransitionSeries.Sequence
              key={`scene-${index}`}
              durationInFrames={sceneDurationsFrames?.[index] ?? sceneDurationFrames}
            >
              {scene.narrationUrl ? (
                <Sequence from={narrationLeadInFrames} layout="none">
                  <Audio src={scene.narrationUrl} volume={1} />
                </Sequence>
              ) : null}
              {(() => {
                switch (scene.template) {
                  case "comparison":
                    return (
                      <ComparisonScene
                        scriptText={scene.scriptText}
                        captionText={scene.captionText}
                        leftAssetUrl={scene.assets[0]?.url ?? null}
                        rightAssetUrl={scene.assets[1]?.url ?? null}
                        leftObjectPosition={scene.assets[0]?.objectPosition}
                        rightObjectPosition={scene.assets[1]?.objectPosition}
                        leftLabel={scene.leftLabel ?? ""}
                        rightLabel={scene.rightLabel ?? ""}
                        imageMotion={imageMotions[i] ?? "zoom-in"}
                        textAnimation={textAnimations[i] ?? "slide-up"}
                        captionStyleId={captionStyle}
                        comparisonOverlayMode={comparisonOverlayMode}
                        textScale={textScale}
                        stackInPortrait={stackComparisonInPortrait}
                      />
                    );
                  case "fact-card":
                    return (
                      <FactCardScene
                        scriptText={scene.scriptText}
                        captionText={scene.captionText}
                        mainAssetUrl={scene.assets[0]?.url ?? null}
                        secondaryAssetUrl={scene.assets[1]?.url ?? null}
                        mainObjectPosition={scene.assets[0]?.objectPosition}
                        secondaryObjectPosition={scene.assets[1]?.objectPosition}
                        title={scene.title ?? ""}
                        subtitle={scene.subtitle ?? ""}
                        facts={scene.facts ?? []}
                        imageMotion={imageMotions[i] ?? "zoom-in"}
                        textAnimation={textAnimations[i] ?? "slide-up"}
                      />
                    );
                  default:
                    return (
                      <SlideshowScene
                        scriptText={scene.scriptText}
                        captionText={scene.captionText}
                        assetUrl={scene.assets[0]?.url ?? null}
                        assetObjectPosition={scene.assets[0]?.objectPosition}
                        imageMotion={imageMotions[i] ?? "zoom-in"}
                        textAnimation={textAnimations[i] ?? "slide-up"}
                      />
                    );
                }
              })()}
            </TransitionSeries.Sequence>,
          ];

          if (index < scenes.length - 1) {
            elements.push(
              <TransitionSeries.Transition
                key={`transition-${index}`}
                presentation={resolveTransitionPresentation(
                  sceneTransitions[i] ?? "fade",
                  width,
                  height
                )}
                timing={linearTiming({ durationInFrames: transitionFrames })}
              />
            );
          }

          return elements;
        })}
      </TransitionSeries>

      <Watermark
        key={`${wm.logoUrl ?? "none"}-${wm.position}-${wm.opacity}`}
        logoUrl={wm.logoUrl}
        position={wm.position}
        opacity={wm.opacity}
      />
    </AbsoluteFill>
  );
};
