import type { TemplateDefinition } from "../types";

export const comparisonConfig: TemplateDefinition = {
  id: "comparison",
  name: "Side-by-Side",
  description: "Two images compared side by side with labels",
  useCases: "Then vs Now, Before/After, celebrity comparisons, product evolution",
  assetsPerScene: 2,
  defaultSceneCount: 6,
};
