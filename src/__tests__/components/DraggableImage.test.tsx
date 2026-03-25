import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DraggableImage } from "@/components/DraggableImage";

describe("DraggableImage", () => {
  it("renders image with objectFit cover", () => {
    render(
      <DraggableImage src="/test.jpg" alt="test" onPositionChange={vi.fn()} />
    );
    const img = screen.getByAltText("test");
    expect(img).toBeDefined();
    expect(img.style.objectFit).toBe("cover");
  });

  it("applies objectPosition when provided", () => {
    render(
      <DraggableImage
        src="/test.jpg"
        alt="test"
        objectPosition="30% 70%"
        onPositionChange={vi.fn()}
      />
    );
    const img = screen.getByAltText("test");
    expect(img.style.objectPosition).toBe("30% 70%");
  });

  it("defaults objectPosition to 50% 50%", () => {
    render(
      <DraggableImage src="/test.jpg" alt="test" onPositionChange={vi.fn()} />
    );
    const img = screen.getByAltText("test");
    expect(img.style.objectPosition).toBe("50% 50%");
  });

  it("shows reposition overlay on hover", async () => {
    render(
      <DraggableImage src="/test.jpg" alt="test" onPositionChange={vi.fn()} />
    );
    const container = screen.getByAltText("test").parentElement!;
    fireEvent.mouseEnter(container);
    expect(screen.getByText("Reposition")).toBeDefined();
  });

  it("hides reposition overlay when not hovered", () => {
    render(
      <DraggableImage src="/test.jpg" alt="test" onPositionChange={vi.fn()} />
    );
    expect(screen.queryByText("Reposition")).toBeNull();
  });

  it("renders refresh button on hover when onRefresh provided", () => {
    render(
      <DraggableImage
        src="/test.jpg"
        alt="test"
        onPositionChange={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    const container = screen.getByAltText("test").parentElement!;
    fireEvent.mouseEnter(container);
    expect(screen.getByLabelText("Refresh image")).toBeDefined();
  });

  it("does not render refresh button when onRefresh not provided", () => {
    render(
      <DraggableImage src="/test.jpg" alt="test" onPositionChange={vi.fn()} />
    );
    const container = screen.getByAltText("test").parentElement!;
    fireEvent.mouseEnter(container);
    expect(screen.queryByLabelText("Refresh image")).toBeNull();
  });

  it("does not render overlay when src is empty", () => {
    render(
      <DraggableImage src="" alt="test" onPositionChange={vi.fn()} />
    );
    const container = screen.getByText("No image").parentElement!;
    fireEvent.mouseEnter(container);
    expect(screen.queryByText("Reposition")).toBeNull();
  });
});
