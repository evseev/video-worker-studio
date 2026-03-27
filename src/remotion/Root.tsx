import { Composition } from "remotion";
import { VideoComposition, type VideoCompositionProps } from "./VideoComposition";

const FPS = 30;
const SCENE_DURATION_SECONDS = 5;
const TRANSITION_FRAMES = 15;

const DEFAULT_SCENES = [
  {
    template: "slideshow",
    scriptText: "Welcome to Video Worker Studio",
    assets: [{ url: null }],
  },
];

const SCENE_DURATION_FRAMES = SCENE_DURATION_SECONDS * FPS;
const TOTAL_FRAMES =
  DEFAULT_SCENES.length * SCENE_DURATION_FRAMES -
  Math.max(0, DEFAULT_SCENES.length - 1) * TRANSITION_FRAMES;

export const RemotionRoot = () => {
  return (
    <Composition
      id="VideoWorker"
      component={VideoComposition}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={
        {
          scenes: DEFAULT_SCENES,
          sceneDurationFrames: SCENE_DURATION_FRAMES,
          transitionFrames: TRANSITION_FRAMES,
          sceneTransitions: ["fade"],
          imageMotions: ["zoom-in"],
          textAnimations: ["slide-up"],
        } satisfies VideoCompositionProps
      }
    />
  );
};
