export interface CaptionStyle {
  id: string;
  name: string;
  description: string;
  /** CSS-like properties for Remotion rendering */
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string | null;
  position: "bottom" | "top" | "center-lower";
  textAlign: "center" | "left";
}

export const CAPTION_STYLES: CaptionStyle[] = [
  {
    id: "minimal",
    name: "Minimal White",
    description: "Clean white subtitles on dark overlay",
    fontSize: 32,
    fontWeight: 500,
    color: "#ffffff",
    backgroundColor: null,
    position: "bottom",
    textAlign: "center",
  },
  {
    id: "bold",
    name: "Bold Viral",
    description: "Large bold text with yellow accents",
    fontSize: 42,
    fontWeight: 800,
    color: "#facc15",
    backgroundColor: "rgba(0,0,0,0.7)",
    position: "center-lower",
    textAlign: "center",
  },
  {
    id: "strip",
    name: "Bottom Strip",
    description: "Text bar at the bottom of the screen",
    fontSize: 28,
    fontWeight: 600,
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.85)",
    position: "bottom",
    textAlign: "left",
  },
  {
    id: "split",
    name: "Split Labels",
    description: "For side-by-side and comparison videos",
    fontSize: 26,
    fontWeight: 600,
    color: "#ffffff",
    backgroundColor: "rgba(124,58,237,0.8)",
    position: "bottom",
    textAlign: "center",
  },
];

export function getCaptionStyle(id: string): CaptionStyle {
  return CAPTION_STYLES.find((s) => s.id === id) ?? CAPTION_STYLES[0];
}
