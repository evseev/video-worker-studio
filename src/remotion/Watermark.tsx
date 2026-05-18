import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { AbsoluteFill, Img, continueRender, delayRender } from "remotion";

export type WatermarkPosition = "tl" | "tr" | "bl" | "br" | "none";

export type WatermarkProps = {
  logoUrl?: string | null;
  position: WatermarkPosition;
  opacity: number;
};

function watermarkBoxStyle(position: WatermarkPosition, opacity: number): CSSProperties {
  const pad = "4%";
  const base: CSSProperties = {
    position: "absolute",
    width: "10%",
    minWidth: 52,
    maxWidth: 220,
    opacity: Math.min(1, Math.max(0, opacity)),
    pointerEvents: "none",
  };
  switch (position) {
    case "tl":
      return { ...base, left: pad, top: pad };
    case "tr":
      return { ...base, right: pad, top: pad };
    case "bl":
      return { ...base, left: pad, bottom: pad };
    case "br":
      return { ...base, right: pad, bottom: pad };
    default:
      return base;
  }
}

/**
 * Single composition-level logo overlay. Preloads remote URL so frame 0 is not blank;
 * fails open (no watermark) if the image cannot load.
 */
export const Watermark: React.FC<WatermarkProps> = ({ logoUrl, position, opacity }) => {
  const [handle] = useState(() => delayRender("watermark-logo-load"));
  const [show, setShow] = useState(false);
  const shouldPreload = Boolean(logoUrl && position !== "none");

  useEffect(() => {
    if (!shouldPreload) {
      continueRender(handle);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setShow(true);
        continueRender(handle);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        console.warn("[Watermark] Logo preload failed — rendering without watermark:", logoUrl);
        continueRender(handle);
      }
    };
    img.src = logoUrl as string;

    return () => {
      cancelled = true;
    };
  }, [shouldPreload, logoUrl, position, handle]);

  if (!shouldPreload || !show) {
    return null;
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 10 }}>
      <div style={watermarkBoxStyle(position, opacity)}>
        <Img
          src={logoUrl as string}
          style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.45))" }}
          alt=""
        />
      </div>
    </AbsoluteFill>
  );
};
