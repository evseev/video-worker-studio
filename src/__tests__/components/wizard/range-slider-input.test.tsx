import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RangeSliderInput } from "@/components/wizard/range-slider-input";

describe("RangeSliderInput", () => {
  it("updates through slider", () => {
    const onChange = vi.fn();
    render(
      <RangeSliderInput
        label="Number of Scenes"
        min={3}
        max={120}
        value={6}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Number of Scenes"), { target: { value: "12" } });
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it("clamps number input on blur", () => {
    const onChange = vi.fn();
    render(
      <RangeSliderInput
        label="Duration per Scene"
        min={3}
        max={15}
        value={5}
        onChange={onChange}
      />
    );

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(15);
  });
});
