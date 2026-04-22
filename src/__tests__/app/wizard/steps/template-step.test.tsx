import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TemplateStep } from "@/app/wizard/[id]/steps/TemplateStep";
import { createWizardStore } from "@/lib/stores/wizard-store";
import type { Tables } from "@/lib/supabase/types";

type Project = Tables<"projects">;

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    user_id: "user-1",
    topic: "test topic",
    status: "draft",
    wizard_step: "template",
    video_url: null,
    selected_template: "slideshow",
    draft_scenes: null,
    comparison_overlay_mode: "both",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Project;
}

describe("TemplateStep", () => {
  it("renders total duration readout", () => {
    const store = createWizardStore(makeProject());
    render(<TemplateStep store={store} />);
    expect(screen.getByText(/Total duration:/)).toBeInTheDocument();
  });

  it("shows warning for long durations", () => {
    const store = createWizardStore(makeProject());
    store.getState().setSettings({ sceneCount: 120, sceneDuration: 15 });
    render(<TemplateStep store={store} />);
    expect(screen.getByText(/practical limit/i)).toBeInTheDocument();
  });

  it("updates scene count through slider", () => {
    const store = createWizardStore(makeProject());
    render(<TemplateStep store={store} />);
    const slider = screen.getByLabelText("Number of Scenes");
    fireEvent.change(slider, { target: { value: "80" } });
    expect(store.getState().settings.sceneCount).toBe(80);
  });
});
