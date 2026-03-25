import { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { SlideshowScene } from "./templates/SlideshowScene";
import { ComparisonScene } from "./templates/ComparisonScene";
import { FactCardScene } from "./templates/FactCardScene";

export type VideoCompositionProps = {
  scenes: Array<{
    template: string;
    scriptText: string;
    assets: Array<{ url?: string | null; objectPosition?: string }>;
    // Comparison-specific
    leftLabel?: string;
    rightLabel?: string;
    // Fact-card-specific
    title?: string;
    subtitle?: string;
    facts?: { label: string; value: string }[];
  }>;
  sceneDurationFrames: number;
  transitionFrames: number;
  musicUrl?: string | null;
  voiceoverUrl?: string | null;
};

function BackgroundMusic({ src }: { src: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const fadeFrames = Math.min(fps * 2, durationInFrames / 4); // 2s fade or 25% of duration

  const volume = interpolate(
    frame,
    [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
    [0, 0.3, 0.3, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return <Audio src={src} volume={volume} />;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  scenes,
  sceneDurationFrames,
  transitionFrames,
  musicUrl,
  voiceoverUrl,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {musicUrl && <BackgroundMusic src={musicUrl} />}
      {voiceoverUrl && <Audio src={voiceoverUrl} volume={0.9} />}

      <TransitionSeries>
        {scenes.flatMap((scene, index) => {
          const elements = [
            <TransitionSeries.Sequence
              key={`scene-${index}`}
              durationInFrames={sceneDurationFrames}
            >
              {(() => {
                switch (scene.template) {
                  case "comparison":
                    return (
                      <ComparisonScene
                        scriptText={scene.scriptText}
                        leftAssetUrl={scene.assets[0]?.url ?? null}
                        rightAssetUrl={scene.assets[1]?.url ?? null}
                        leftObjectPosition={scene.assets[0]?.objectPosition}
                        rightObjectPosition={scene.assets[1]?.objectPosition}
                        leftLabel={scene.leftLabel ?? ""}
                        rightLabel={scene.rightLabel ?? ""}
                      />
                    );
                  case "fact-card":
                    return (
                      <FactCardScene
                        scriptText={scene.scriptText}
                        mainAssetUrl={scene.assets[0]?.url ?? null}
                        secondaryAssetUrl={scene.assets[1]?.url ?? null}
                        mainObjectPosition={scene.assets[0]?.objectPosition}
                        secondaryObjectPosition={scene.assets[1]?.objectPosition}
                        title={scene.title ?? ""}
                        subtitle={scene.subtitle ?? ""}
                        facts={scene.facts ?? []}
                      />
                    );
                  default:
                    return (
                      <SlideshowScene
                        scriptText={scene.scriptText}
                        assetUrl={scene.assets[0]?.url ?? null}
                        assetObjectPosition={scene.assets[0]?.objectPosition}
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
                presentation={fade()}
                timing={linearTiming({ durationInFrames: transitionFrames })}
              />
            );
          }

          return elements;
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
