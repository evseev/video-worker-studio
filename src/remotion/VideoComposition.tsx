import { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Scene } from "./Scene";

export type VideoCompositionProps = {
  scenes: Array<{
    scriptText: string;
    assetUrl: string | null;
  }>;
  sceneDurationFrames: number;
  transitionFrames: number;
  template?: string;
  captionStyle?: string;
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
  template,
  captionStyle,
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
              <Scene
                scriptText={scene.scriptText}
                assetUrl={scene.assetUrl}
                index={index}
                totalScenes={scenes.length}
                template={template}
                captionStyle={captionStyle}
              />
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
