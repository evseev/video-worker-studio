import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CaptionStyleSelector } from "@/components/wizard/caption-style-selector";

describe("CaptionStyleSelector", () => {
  it("renders five preset cards and calls onChange with id", () => {
    const onChange = vi.fn();
    render(<CaptionStyleSelector value="minimal" onChange={onChange} />);

    expect(screen.getByRole("radiogroup", { name: /caption style/i })).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);

    fireEvent.click(radios[4]);
    expect(onChange).toHaveBeenCalledWith("glowing");
  });
});
