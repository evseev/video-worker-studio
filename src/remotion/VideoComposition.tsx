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
};

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  scenes,
  sceneDurationFrames,
  transitionFrames,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>
        {scenes.map((scene, index) => (
          <TransitionSeries.Sequence
            key={index}
            durationInFrames={sceneDurationFrames}
          >
            <Scene
              scriptText={scene.scriptText}
              assetUrl={scene.assetUrl}
              index={index}
              totalScenes={scenes.length}
            />
            {index < scenes.length - 1 && (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({ durationInFrames: transitionFrames })}
              />
            )}
          </TransitionSeries.Sequence>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
