import type { ResolvedImageMotion, ResolvedTextAnimation } from "@/lib/effects";

export function getImageTransform(
  motion: ResolvedImageMotion,
  progress: number,
): React.CSSProperties {
  switch (motion) {
    case "zoom-in": {
      const scale = 1 + 0.1 * progress;
      return { transform: `scale(${scale})`, transformOrigin: "center center" };
    }
    case "zoom-out": {
      const scale = 1.1 - 0.1 * progress;
      return { transform: `scale(${scale})`, transformOrigin: "center center" };
    }
    case "pan-left": {
      const x = -5 * progress;
      return { transform: `translateX(${x}%)`, transformOrigin: "center center" };
    }
    case "pan-right": {
      const x = 5 * progress;
      return { transform: `translateX(${x}%)`, transformOrigin: "center center" };
    }
    case "pan-up": {
      const y = -5 * progress;
      return { transform: `translateY(${y}%)`, transformOrigin: "center center" };
    }
    case "pan-down": {
      const y = 5 * progress;
      return { transform: `translateY(${y}%)`, transformOrigin: "center center" };
    }
    case "pan-horizontal": {
      const x = 3 * Math.sin(progress * 2 * Math.PI);
      return { transform: `translateX(${Math.round(x * 100) / 100}%)`, transformOrigin: "center center" };
    }
    case "pan-vertical": {
      const y = 3 * Math.sin(progress * 2 * Math.PI);
      return { transform: `translateY(${Math.round(y * 100) / 100}%)`, transformOrigin: "center center" };
    }
    case "none":
      return { transform: "none" };
  }
}

export function getTextStyle(
  animation: ResolvedTextAnimation,
  frame: number,
  startFrame: number,
  fps: number,
): React.CSSProperties {
  const elapsed = Math.max(0, frame - startFrame);
  const duration = fps * 0.5; // 0.5 seconds

  switch (animation) {
    case "slide-up": {
      const t = Math.min(elapsed / duration, 1);
      return {
        opacity: t,
        transform: `translateY(${30 * (1 - t)}px)`,
      };
    }
    case "slide-left": {
      const t = Math.min(elapsed / duration, 1);
      return {
        opacity: t,
        transform: `translateX(${30 * (1 - t)}px)`,
      };
    }
    case "typewriter": {
      const revealDuration = fps * 1.0; // 1 second for full reveal
      const t = Math.min(elapsed / revealDuration, 1);
      const hidePercent = Math.round((1 - t) * 100);
      return {
        opacity: 1,
        clipPath: `inset(0 ${hidePercent}% 0 0)`,
      };
    }
    case "pop": {
      const popDuration = fps * 0.4; // 0.4 seconds
      const t = Math.min(elapsed / popDuration, 1);
      // Overshoot: 0 → 1.1 → 1.0
      const scale = t < 0.7 ? (t / 0.7) * 1.1 : 1.1 - 0.1 * ((t - 0.7) / 0.3);
      return {
        opacity: Math.min(t / 0.3, 1),
        transform: `scale(${Math.round(scale * 1000) / 1000})`,
      };
    }
    case "fade-in": {
      const t = Math.min(elapsed / duration, 1);
      return { opacity: t };
    }
  }
}
