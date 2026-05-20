import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreateModal } from "@/components/dashboard/create-modal";

describe("CreateModal", () => {
  it("renders toggle default on and passes copyLastSettings true on submit", () => {
    const onSubmit = vi.fn();
    render(
      <CreateModal
        topic="My topic"
        creating={false}
        channelName="Tech"
        onTopicChange={vi.fn()}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Creating on/i)).toBeTruthy();
    expect(screen.getByText(/Tech/)).toBeTruthy();
    const sw = screen.getByRole("switch");
    expect(sw).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: /Generate Video/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][1]).toEqual({ copyLastSettings: true });
  });

  it("prevents native form navigation on submit", () => {
    const onSubmit = vi.fn();
    render(
      <CreateModal
        topic="T"
        creating={false}
        channelName={null}
        onTopicChange={vi.fn()}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />
    );

    const form = screen.getByRole("button", { name: /Generate Video/i }).closest("form");
    expect(form).toBeTruthy();

    fireEvent.submit(form!);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].defaultPrevented).toBe(true);
  });

  it("passes copyLastSettings false when toggle turned off", () => {
    const onSubmit = vi.fn();
    render(
      <CreateModal
        topic="T"
        creating={false}
        channelName={null}
        onTopicChange={vi.fn()}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByRole("switch")).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: /Generate Video/i }));
    expect(onSubmit.mock.calls[0][1]).toEqual({ copyLastSettings: false });
  });
});
