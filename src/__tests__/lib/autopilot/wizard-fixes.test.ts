import { describe, it, expect } from "vitest";
import { normalizeWizardStep } from "@/lib/stores/wizard-store";
import { mergeDraftScenes } from "@/lib/projects/draft";

describe("wizard step normalisation (blank wizard on reopen)", () => {
  it("maps legacy server step names to real steps", () => {
    expect(normalizeWizardStep("validation")).toBe("refine");
    expect(normalizeWizardStep("structure")).toBe("script");
    expect(normalizeWizardStep("assets")).toBe("preview");
  });
  it("keeps valid steps and defaults unknown ones", () => {
    expect(normalizeWizardStep("render")).toBe("render");
    expect(normalizeWizardStep("bogus")).toBe("template");
    expect(normalizeWizardStep(null)).toBe("template");
  });
});

describe("draft merge (settings lost after generate-structure)", () => {
  it("keeps settings and idea when replacing scenes", () => {
    const merged = mergeDraftScenes({ settings: { sceneCount: 70, sceneDuration: 9 }, videoTitle: "T", scenes: [] }, [{ a: 1 }]);
    expect(merged).toEqual({ settings: { sceneCount: 70, sceneDuration: 9 }, videoTitle: "T", scenes: [{ a: 1 }] });
  });
  it("upgrades a legacy bare array and parses string drafts", () => {
    expect(mergeDraftScenes([{ old: true }], [{ a: 1 }])).toEqual({ scenes: [{ a: 1 }] });
    expect(mergeDraftScenes('{"settings":{"sceneCount":9}}', [])).toEqual({ settings: { sceneCount: 9 }, scenes: [] });
    expect(mergeDraftScenes(null, [])).toEqual({ scenes: [] });
  });
});
