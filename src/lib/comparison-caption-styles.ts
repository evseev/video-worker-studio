/** Inline style bag — compatible with React/Remotion `style` prop. */
export type InlineStyle = Record<string, string | number | undefined>;

export type CaptionStyleId = "minimal" | "bold" | "strip" | "split" | "glowing";

export type ComparisonOverlayMode = "labels" | "caption" | "both";

const CAPTION_IDS: CaptionStyleId[] = ["minimal", "bold", "strip", "split", "glowing"];
const OVERLAY_IDS: ComparisonOverlayMode[] = ["labels", "caption", "both"];

export const CAPTION_STYLE_OPTIONS: { id: CaptionStyleId; label: string }[] = [
  { id: "minimal", label: "Minimal" },
  { id: "bold", label: "Bold viral" },
  { id: "strip", label: "Bottom strip" },
  { id: "split", label: "Split labels" },
  { id: "glowing", label: "Glowing" },
];

/** Multi-layer purple glow — same string for DOM and Remotion. */
export const GLOWING_TEXT_SHADOW =
  "0px 0px 4px rgba(185, 45, 255, 0.9), 0px 0px 10px rgba(185, 45, 255, 0.7), -20px 0px 8px rgba(185, 45, 255, 0.6), 20px 0px 8px rgba(185, 45, 255, 0.6), -50px 0px 4px rgba(185, 45, 255, 0.4), 50px 0px 4px rgba(185, 45, 255, 0.4), -90px 0px 2px rgba(185, 45, 255, 0.15), 90px 0px 2px rgba(185, 45, 255, 0.15)";

const GLOWING_FONT =
  "'Arial Black', Impact, 'Montserrat', system-ui, sans-serif";

/** Glowing style: large type + extra room below the caption line (see getComparisonCaptionStyles "glowing"). */
const GLOWING_FONT_SIZE_PX = 78; // 3× former 26px caption/label size
const GLOWING_BAR_PADDING_BOTTOM_PX = 28; // 2× former 14px bottom padding

const SYSTEM_FONT = "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

export function parseCaptionStyle(raw: string | null | undefined): CaptionStyleId {
  if (raw && CAPTION_IDS.includes(raw as CaptionStyleId)) {
    return raw as CaptionStyleId;
  }
  return "minimal";
}

export function parseComparisonOverlayMode(
  raw: string | null | undefined
): ComparisonOverlayMode {
  if (raw && OVERLAY_IDS.includes(raw as ComparisonOverlayMode)) {
    return raw as ComparisonOverlayMode;
  }
  return "both";
}

export function showComparisonLabels(mode: ComparisonOverlayMode): boolean {
  return mode === "labels" || mode === "both";
}

export function showComparisonCaption(mode: ComparisonOverlayMode): boolean {
  return mode === "caption" || mode === "both";
}

type LabelSide = "left" | "right";

const LEFT_COLOR = "#f5576c";
const RIGHT_COLOR = "#4facfe";

export function getComparisonLabelStyle(
  styleId: CaptionStyleId,
  side: LabelSide
): InlineStyle {
  const base: InlineStyle = {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    textAlign: "center",
    textTransform: "uppercase",
    margin: 0,
  };

  const color = side === "left" ? LEFT_COLOR : RIGHT_COLOR;

  switch (styleId) {
    case "minimal":
      return {
        ...base,
        fontSize: 32,
        fontWeight: 800,
        color,
        fontFamily: SYSTEM_FONT,
        letterSpacing: "0.08em",
        textShadow: "0 2px 8px rgba(0,0,0,0.6)",
      };
    case "bold":
      return {
        ...base,
        fontSize: 36,
        fontWeight: 900,
        color: "#fff",
        fontFamily: SYSTEM_FONT,
        letterSpacing: "0.06em",
        textShadow: `2px 2px 0 #000, -1px -1px 0 #000, ${color} 0 0 12px`,
      };
    case "strip":
      return {
        ...base,
        fontSize: 30,
        fontWeight: 800,
        color: "#fff",
        fontFamily: SYSTEM_FONT,
        letterSpacing: "0.1em",
        backgroundColor: "rgba(0,0,0,0.55)",
        padding: "8px 4px",
        bottom: 48,
        textShadow: "none",
      };
    case "split":
      return {
        ...base,
        fontSize: 34,
        fontWeight: 900,
        color,
        fontFamily: SYSTEM_FONT,
        letterSpacing: "0.12em",
        textShadow: "0 0 2px rgba(0,0,0,0.9)",
      };
    case "glowing":
      return {
        ...base,
        fontSize: GLOWING_FONT_SIZE_PX,
        fontWeight: 600,
        color: "#FFFFFF",
        fontFamily: GLOWING_FONT,
        letterSpacing: 0,
        lineHeight: 1,
        textShadow: GLOWING_TEXT_SHADOW,
      };
    default:
      return { ...base, fontSize: 32, fontWeight: 800, color, fontFamily: SYSTEM_FONT };
  }
}

export type ComparisonCaptionBarStyles = {
  bar: InlineStyle;
  text: InlineStyle;
};

export function getComparisonCaptionStyles(
  styleId: CaptionStyleId
): ComparisonCaptionBarStyles {
  switch (styleId) {
    case "minimal":
      return {
        bar: {
          padding: "16px 24px",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
        },
        text: {
          fontSize: 28,
          color: "white",
          textAlign: "center",
          margin: 0,
          lineHeight: 1.3,
          fontWeight: 600,
          fontFamily: SYSTEM_FONT,
          textShadow: "0 2px 6px rgba(0,0,0,0.5)",
        },
      };
    case "bold":
      return {
        bar: {
          padding: "18px 24px",
          background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(40,40,0,0.5) 55%, transparent 100%)",
        },
        text: {
          fontSize: 32,
          color: "#FFEB3B",
          textAlign: "center",
          margin: 0,
          lineHeight: 1.2,
          fontWeight: 900,
          fontFamily: SYSTEM_FONT,
          textShadow:
            "2px 2px 0 #000, -2px -2px 0 #000, 0 0 12px rgba(0,0,0,0.8)",
          textTransform: "uppercase",
        },
      };
    case "strip":
      return {
        bar: {
          padding: "14px 20px",
          background: "rgba(0,0,0,0.92)",
          borderTop: "2px solid rgba(255,255,255,0.15)",
        },
        text: {
          fontSize: 26,
          color: "#ffffff",
          textAlign: "center",
          margin: 0,
          lineHeight: 1.35,
          fontWeight: 700,
          fontFamily: SYSTEM_FONT,
          textShadow: "none",
        },
      };
    case "split":
      return {
        bar: {
          padding: "12px 28px",
          background:
            "linear-gradient(to top, rgba(10,10,20,0.92) 0%, rgba(0,0,0,0.35) 70%, transparent 100%)",
        },
        text: {
          fontSize: 24,
          color: "rgba(255,255,255,0.95)",
          textAlign: "center",
          margin: 0,
          lineHeight: 1.4,
          fontWeight: 600,
          fontFamily: SYSTEM_FONT,
          letterSpacing: "0.02em",
        },
      };
    case "glowing":
      return {
        bar: {
          padding: `14px 24px ${GLOWING_BAR_PADDING_BOTTOM_PX}px 24px`,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)",
        },
        text: {
          fontSize: GLOWING_FONT_SIZE_PX,
          color: "#FFFFFF",
          textAlign: "center",
          margin: 0,
          lineHeight: 1.12,
          fontWeight: 600,
          fontFamily: GLOWING_FONT,
          textTransform: "uppercase",
          letterSpacing: 0,
          textShadow: GLOWING_TEXT_SHADOW,
        },
      };
    default:
      return getComparisonCaptionStyles("minimal");
  }
}
