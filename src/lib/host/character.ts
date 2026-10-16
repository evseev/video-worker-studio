/**
 * Phase 3 experiment: an animated, clearly stylized host "Emma" who opens and closes videos.
 * Policy guardrails (design doc, Phase 3):
 *  - Always stylized (illustrated / 3D-cartoon), never photorealistic → YouTube's
 *    "non-realistic content" exemption, no synthetic-media disclosure needed.
 *  - Never depicts, imitates or alters real celebrities.
 */

export type HostMode = "off" | "intro_outro" | "intro_bridges_outro" | "pip";

export const EMMA_CHARACTER = {
  name: "Emma",
  /** Prompt used to create the single reference image every clip is animated from. */
  referencePrompt:
    "Stylized 3D animated character in a warm Pixar-like style, a friendly woman in her early 50s with shoulder-length honey-blonde hair, " +
    "soft cardigan, gentle smile, sitting in a cozy living room with a vintage film projector and framed movie posters with no readable text, " +
    "warm evening light, medium shot, facing camera, clearly cartoon, not photorealistic",
  stylePrompt: "stylized 3D animation, soft warm lighting, smooth gentle motion, cartoon proportions, not photorealistic",
  voiceId: "Sloane",
} as const;

export type HostClipKind = "greeting" | "point-left" | "point-right" | "surprised" | "nod" | "laugh" | "goodbye" | "idle";

/** Reusable motion clips generated once per channel (≈ $10–15 total), then lip-synced per video. */
export const CLIP_LIBRARY: Array<{ kind: HostClipKind; prompt: string; seconds: 5 | 10 }> = [
  { kind: "greeting", prompt: "she looks into the camera, smiles warmly and waves hello, then rests her hands", seconds: 10 },
  { kind: "idle", prompt: "she listens attentively, small natural head movements and blinks, subtle breathing", seconds: 10 },
  { kind: "point-left", prompt: "she gestures gracefully to her left as if presenting something, then looks back at the camera", seconds: 5 },
  { kind: "point-right", prompt: "she gestures gracefully to her right as if presenting something, then looks back at the camera", seconds: 5 },
  { kind: "surprised", prompt: "she raises her eyebrows in pleasant surprise and smiles", seconds: 5 },
  { kind: "nod", prompt: "she nods slowly in agreement with a kind smile", seconds: 5 },
  { kind: "laugh", prompt: "she laughs softly, shoulders moving gently", seconds: 5 },
  { kind: "goodbye", prompt: "she smiles, waves goodbye warmly and leans back in her chair", seconds: 10 },
];

/** Deterministic A/B assignment: alternate arms within each format so formats stay balanced. */
export function assignExperimentArm(indexWithinFormat: number): "host" | "control" {
  return indexWithinFormat % 2 === 0 ? "host" : "control";
}

/**
 * Read-out after 14 days (design doc): adopt the host when 30-second retention improves by
 * ≥ 5 points or subscribers per 1K views by ≥ 30 %.
 */
export function experimentDecision(arms: {
  host: { retention30s: number; subsPer1k: number; videos: number };
  control: { retention30s: number; subsPer1k: number; videos: number };
}): { adopt: boolean; reason: string } {
  const { host, control } = arms;
  if (host.videos < 5 || control.videos < 5) return { adopt: false, reason: "need at least 5 videos per arm" };
  const retentionGain = (host.retention30s - control.retention30s) * 100;
  const subsGain = control.subsPer1k > 0 ? (host.subsPer1k - control.subsPer1k) / control.subsPer1k : 0;
  if (retentionGain >= 5) return { adopt: true, reason: `30-second retention +${retentionGain.toFixed(1)} points` };
  if (subsGain >= 0.3) return { adopt: true, reason: `subscribers per 1K views +${Math.round(subsGain * 100)}%` };
  return { adopt: false, reason: `retention ${retentionGain >= 0 ? "+" : ""}${retentionGain.toFixed(1)} pts, subs/1K ${subsGain >= 0 ? "+" : ""}${Math.round(subsGain * 100)}%` };
}
