import { Composition } from "remotion";
import { VideoComposition, type VideoCompositionProps } from "./VideoComposition";

const FPS = 30;
const SCENE_DURATION_SECONDS = 5;
const TRANSITION_FRAMES = 15;

export const RemotionRoot = () => {
  const defaultScenes = [
    {
      scriptText: "Welcome to Video Worker Studio",
      assetUrl: null,
    },
  ];

  const sceneDurationFrames = SCENE_DURATION_SECONDS * FPS;
  const totalFrames =
    defaultScenes.length * sceneDurationFrames -
    Math.max(0, defaultScenes.length - 1) * TRANSITION_FRAMES;

  return (
    <Composition
      id="VideoWorker"
      component={VideoComposition}
      durationInFrames={totalFrames}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={
        {
          scenes: defaultScenes,
          sceneDurationFrames,
          transitionFrames: TRANSITION_FRAMES,
        } satisfies VideoCompositionProps
      }
    />
  );
};
