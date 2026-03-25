import { slideshowConfig } from "./slideshow";
import { comparisonConfig } from "./comparison";
import { factCardConfig } from "./fact-card";
import type { TemplateDefinition, TemplateId } from "./types";

export const TEMPLATES: Record<TemplateId, TemplateDefinition> = {
  slideshow: slideshowConfig,
  comparison: comparisonConfig,
  "fact-card": factCardConfig,
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];
export const allTemplates = Object.values(TEMPLATES);

export function getTemplate(id: string): TemplateDefinition {
  const t = TEMPLATES[id as TemplateId];
  if (!t) throw new Error(`Unknown template: ${id}`);
  return t;
}

export * from "./types";
