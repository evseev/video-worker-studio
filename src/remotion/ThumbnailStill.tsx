import { AbsoluteFill, Img } from "remotion";

/**
 * 1280×720 YouTube thumbnail: two real photos side by side (face-cropped), a high-contrast
 * label banner on top (HUSBAND | WIFE, 1985 | 2026 …) and an optional bottom text band.
 * Honest by design: only real photos, no text over faces.
 */
export type ThumbnailVariant = "labels" | "banner" | "names";

export type ThumbnailProps = {
  leftUrl: string | null;
  rightUrl: string | null;
  leftObjectPosition?: string;
  rightObjectPosition?: string;
  leftLabel: string;
  rightLabel: string;
  leftName?: string;
  rightName?: string;
  /** 2–4 word headline for the "banner" variant. */
  headline?: string;
  variant: ThumbnailVariant;
  /** Brand accent (banner background). */
  accent?: string;
};

const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

function Photo({ url, position }: { url: string | null; position?: string }) {
  return url ? (
    <Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: position ?? "50% 35%" }} />
  ) : (
    <div style={{ width: "100%", height: "100%", background: "#333" }} />
  );
}

function LabelBar({ text, accent }: { text: string; accent: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 120,
        background: accent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderBottom: "6px solid #000",
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontSize: text.length > 10 ? 70 : 88,
          fontWeight: 900,
          color: "#fff",
          letterSpacing: "0.02em",
          textShadow: "4px 4px 0 #000",
          textTransform: "uppercase",
        }}
      >
        {text}
      </span>
    </div>
  );
}

export const ThumbnailStill: React.FC<ThumbnailProps> = (props) => {
  const accent = props.accent ?? "#7b2cbf";
  const showLabels = props.variant === "labels" || props.variant === "names";
  const topLeft = props.variant === "names" ? props.leftName ?? props.leftLabel : props.leftLabel;
  const topRight = props.variant === "names" ? props.rightName ?? props.rightLabel : props.rightLabel;
  const photoTop = showLabels ? 120 : 0;
  const photoBottom = props.variant === "banner" ? 150 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div style={{ position: "absolute", top: photoTop, bottom: photoBottom, left: 0, right: 0, display: "flex", gap: 8 }}>
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <Photo url={props.leftUrl} position={props.leftObjectPosition} />
        </div>
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <Photo url={props.rightUrl} position={props.rightObjectPosition} />
        </div>
      </div>

      {showLabels && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120, display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <LabelBar text={topLeft} accent={accent} />
          </div>
          <div style={{ flex: 1, position: "relative" }}>
            <LabelBar text={topRight} accent={accent} />
          </div>
        </div>
      )}

      {props.variant === "banner" && props.headline && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 150,
            background: "#ffd60a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderTop: "6px solid #000",
          }}
        >
          <span style={{ fontFamily: FONT, fontSize: props.headline.length > 18 ? 72 : 92, fontWeight: 900, color: "#111", textTransform: "uppercase" }}>
            {props.headline}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
