import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EffectSelector } from "@/components/wizard/effect-selector";

const options = [
  { id: "a" as const, label: "Alpha", description: "First option" },
  { id: "b" as const, label: "Beta", description: "Second option" },
  { id: "c" as const, label: "Gamma", description: "Third option" },
];

describe("EffectSelector", () => {
  it("renders all options", () => {
    const onChange = vi.fn();
    render(<EffectSelector options={options} value="a" onChange={onChange} />);
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
    expect(screen.getByText("Gamma")).toBeDefined();
  });

  it("renders descriptions", () => {
    const onChange = vi.fn();
    render(<EffectSelector options={options} value="a" onChange={onChange} />);
    expect(screen.getByText("First option")).toBeDefined();
  });

  it("highlights the selected option", () => {
    const onChange = vi.fn();
    const { container } = render(
      <EffectSelector options={options} value="b" onChange={onChange} />,
    );
    const buttons = container.querySelectorAll("button");
    // Second button (Beta) should have the selected ring class
    expect(buttons[1].className).toContain("ring-2");
  });

  it("calls onChange when clicking an option", () => {
    const onChange = vi.fn();
    render(<EffectSelector options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("does not call onChange when clicking the already-selected option", () => {
    const onChange = vi.fn();
    render(<EffectSelector options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByText("Alpha"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
