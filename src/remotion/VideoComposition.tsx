import { AbsoluteFill } from "remotion";
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
};

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  scenes,
  sceneDurationFrames,
  transitionFrames,
  template,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
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
              />
            </TransitionSeries.Sequence>,
          ];

          // Transition must be a direct sibling of Sequence, not nested inside
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
