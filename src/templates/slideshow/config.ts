import type { TemplateDefinition } from "../types";

export const slideshowConfig: TemplateDefinition = {
  id: "slideshow",
  name: "Slideshow",
  description: "Single image with caption overlay per scene",
  useCases: "Top 10 lists, historical facts, storytelling, motivational, educational shorts",
  assetsPerScene: 1,
  defaultSceneCount: 8,
};
