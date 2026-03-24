import type { TemplateDefinition } from "../types";

export const factCardConfig: TemplateDefinition = {
  id: "fact-card",
  name: "Fact Card",
  description: "Identity card with main image, secondary image, and fact labels",
  useCases: "Celebrity + spouse, actor + role, person + net worth, famous couples",
  assetsPerScene: 2,
  defaultSceneCount: 5,
};
