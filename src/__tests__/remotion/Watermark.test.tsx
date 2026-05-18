import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { Watermark } from "@/remotion/Watermark";

const remotionMocks = vi.hoisted(() => ({
  continueRender: vi.fn(),
  delayRender: vi.fn(() => "handle"),
}));

vi.mock("remotion", () => ({
  continueRender: remotionMocks.continueRender,
  delayRender: remotionMocks.delayRender,
  AbsoluteFill: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="fill">{children}</div>
  ),
  Img: () => <div data-testid="wm-img" role="presentation" />,
}));

describe("Watermark fail-soft", () => {
  const OriginalImage = global.Image;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.Image = OriginalImage;
  });

  it("continues render without crashing when logo preload errors", async () => {
    class BadImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        queueMicrotask(() => {
          this.onerror?.();
        });
      }
    }
    global.Image = BadImage as unknown as typeof Image;

    render(<Watermark logoUrl="https://example.com/missing.png" position="br" opacity={0.5} />);

    await waitFor(() => {
      expect(remotionMocks.continueRender).toHaveBeenCalled();
    });
  });

  it("continues immediately when position is none", async () => {
    render(<Watermark logoUrl="https://example.com/x.png" position="none" opacity={0.5} />);
    expect(remotionMocks.continueRender).toHaveBeenCalled();
  });
});
