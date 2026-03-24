import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SceneCard } from "@/components/wizard/scene-card";
import type { SceneData } from "@/components/wizard/scene-card";

function makeScene(overrides: Partial<SceneData> = {}): SceneData {
  return {
    scriptText: "Test script",
    searchKeyword: "sunset beach",
    ...overrides,
  };
}

const defaultProps = {
  index: 0,
  total: 3,
  onScriptChange: vi.fn(),
  onKeywordChange: vi.fn(),
};

describe("SceneCard", () => {
  it("renders asset picker thumbnails when assetOptions has multiple entries", () => {
    const onSelectAsset = vi.fn();
    render(
      <SceneCard
        {...defaultProps}
        scene={makeScene({
          assetOptions: ["/a.jpg", "/b.jpg", "/c.jpg"],
          selectedAssetIndex: 0,
        })}
        onSelectAsset={onSelectAsset}
      />
    );

    const thumbnails = screen.getAllByRole("button", { name: /Option \d/ });
    expect(thumbnails).toHaveLength(3);
  });

  it("does not render asset picker when assetOptions has 1 entry", () => {
    render(
      <SceneCard
        {...defaultProps}
        scene={makeScene({
          assetOptions: ["/a.jpg"],
          selectedAssetIndex: 0,
        })}
        onSelectAsset={vi.fn()}
      />
    );

    const thumbnails = screen.queryAllByRole("button", { name: /Option \d/ });
    expect(thumbnails).toHaveLength(0);
  });

  it("does not render asset picker when onSelectAsset is not provided", () => {
    render(
      <SceneCard
        {...defaultProps}
        scene={makeScene({
          assetOptions: ["/a.jpg", "/b.jpg", "/c.jpg"],
          selectedAssetIndex: 0,
        })}
      />
    );

    const thumbnails = screen.queryAllByRole("button", { name: /Option \d/ });
    expect(thumbnails).toHaveLength(0);
  });

  it("calls onSelectAsset with correct index when thumbnail clicked", () => {
    const onSelectAsset = vi.fn();
    render(
      <SceneCard
        {...defaultProps}
        scene={makeScene({
          assetOptions: ["/a.jpg", "/b.jpg", "/c.jpg"],
          selectedAssetIndex: 0,
        })}
        onSelectAsset={onSelectAsset}
      />
    );

    const option2 = screen.getByRole("button", { name: "Option 2" });
    fireEvent.click(option2);

    expect(onSelectAsset).toHaveBeenCalledWith(1);
  });

  it("displays assetUrl as main image when set", () => {
    render(
      <SceneCard
        {...defaultProps}
        scene={makeScene({ assetUrl: "/main.jpg" })}
      />
    );

    const img = screen.getByAltText("sunset beach");
    expect(img).toHaveAttribute("src", "/main.jpg");
  });

  it("falls back to assetOptions[selectedAssetIndex] when no assetUrl", () => {
    render(
      <SceneCard
        {...defaultProps}
        scene={makeScene({
          assetOptions: ["/a.jpg", "/b.jpg", "/c.jpg"],
          selectedAssetIndex: 1,
        })}
      />
    );

    const img = screen.getByAltText("sunset beach");
    expect(img).toHaveAttribute("src", "/b.jpg");
  });

  it("shows 'No image' when no asset data", () => {
    render(
      <SceneCard
        {...defaultProps}
        scene={makeScene()}
      />
    );

    expect(screen.getByText("No image")).toBeInTheDocument();
  });

  it("highlights the selected thumbnail with violet border", () => {
    render(
      <SceneCard
        {...defaultProps}
        scene={makeScene({
          assetOptions: ["/a.jpg", "/b.jpg", "/c.jpg"],
          selectedAssetIndex: 1,
        })}
        onSelectAsset={vi.fn()}
      />
    );

    const option2 = screen.getByRole("button", { name: "Option 2" });
    expect(option2.className).toContain("border-violet-500");

    const option1 = screen.getByRole("button", { name: "Option 1" });
    expect(option1.className).not.toContain("border-violet-500");
  });
});
