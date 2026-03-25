import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
} from "remotion";

type FactCardSceneProps = {
  scriptText: string;
  mainAssetUrl: string | null;
  secondaryAssetUrl: string | null;
  mainObjectPosition?: string;
  secondaryObjectPosition?: string;
  title: string;
  subtitle: string;
  facts: { label: string; value: string }[];
};

const MAIN_FALLBACK = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
const SECONDARY_FALLBACK = "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)";

const PILL_COLORS = ["#764ba2", "#667eea", "#f5576c", "#4facfe", "#43e97b"];

export const FactCardScene: React.FC<FactCardSceneProps> = ({
  scriptText,
  mainAssetUrl,
  secondaryAssetUrl,
  mainObjectPosition,
  secondaryObjectPosition,
  title,
  subtitle,
  facts,
}) => {
  const frame = useCurrentFrame();

  // Main image: fade in + scale from 0.95 to 1.0 over 15 frames
  const heroProgress = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const heroOpacity = heroProgress;
  const heroScale = interpolate(heroProgress, [0, 1], [0.95, 1.0]);

  // Card: slides up from +40px and fades in over 20 frames starting at frame 8
  const cardProgress = interpolate(frame, [8, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardOpacity = cardProgress;
  const cardY = interpolate(cardProgress, [0, 1], [40, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        flexDirection: "column",
        padding: 12,
        gap: 10,
      }}
    >
      {/* Hero image — ~35% height */}
      <div
        style={{
          height: "35%",
          borderRadius: 10,
          overflow: "hidden",
          flexShrink: 0,
          opacity: heroOpacity,
          transform: `scale(${heroScale})`,
          transformOrigin: "center center",
        }}
      >
        {mainAssetUrl ? (
          <Img
            src={mainAssetUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: mainObjectPosition ?? "50% 50%" }}
          />
        ) : (
          <div
            style={{ width: "100%", height: "100%", background: MAIN_FALLBACK }}
          />
        )}
      </div>

      {/* Card body */}
      <div
        style={{
          flex: 1,
          backgroundColor: "#1a1a2e",
          borderRadius: 12,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          opacity: cardOpacity,
          transform: `translateY(${cardY}px)`,
        }}
      >
        {/* Top row: thumbnail + title + subtitle */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* Secondary image thumbnail */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {secondaryAssetUrl ? (
              <Img
                src={secondaryAssetUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: secondaryObjectPosition ?? "50% 50%" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: SECONDARY_FALLBACK,
                }}
              />
            )}
          </div>

          {/* Title + subtitle */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "white",
                fontFamily:
                  "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#888",
                fontFamily:
                  "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                lineHeight: 1.3,
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {subtitle}
            </div>
          </div>
        </div>

        {/* Description (scriptText) */}
        <p
          style={{
            fontSize: 14,
            color: "#ccc",
            lineHeight: 1.5,
            margin: 0,
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {scriptText}
        </p>

        {/* Fact pills */}
        {facts.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {facts.map((fact, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: PILL_COLORS[i % PILL_COLORS.length],
                  borderRadius: 9999,
                  paddingTop: 4,
                  paddingBottom: 4,
                  paddingLeft: 10,
                  paddingRight: 10,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "white",
                  fontFamily:
                    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                {fact.label}: {fact.value}
              </div>
            ))}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
