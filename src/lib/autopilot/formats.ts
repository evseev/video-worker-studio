import type { PersonFacts, Relation } from "@/lib/facts/wikidata";
import type { SlotEra } from "@/lib/images/types";

/**
 * Video formats the autopilot produces. Every format renders with the comparison
 * template (two portrait halves + labels + caption), which is legible on TV at 16:9.
 */
export type FormatSlug = "couples" | "parent-child" | "then-now" | "mega";

export const FORMAT_SLUGS: FormatSlug[] = ["couples", "parent-child", "then-now", "mega"];

export interface FormatConfig {
  slug: FormatSlug;
  /** The relation a pair must have in Wikidata to be kept. */
  relation: "partner" | "child" | "self";
  defaultPairs: number;
  description: string;
}

export const FORMATS: Record<FormatSlug, FormatConfig> = {
  couples: {
    slug: "couples",
    relation: "partner",
    defaultPairs: 50,
    description: "A famous actor or actress and their real-life spouse or long-term partner.",
  },
  "parent-child": {
    slug: "parent-child",
    relation: "child",
    defaultPairs: 50,
    description: "A famous parent shown at the same age their child is today, next to that child now.",
  },
  "then-now": {
    slug: "then-now",
    relation: "self",
    defaultPairs: 50,
    description: "The same star in their prime and today.",
  },
  mega: {
    slug: "mega",
    relation: "partner",
    defaultPairs: 120,
    description: "Long compilation of famous couples for TV viewers.",
  },
};

export function currentYear(): number {
  return new Date().getUTCFullYear();
}

function findRelation(list: Relation[], qid: string): Relation | undefined {
  return list.find((r) => r.qid === qid);
}

export interface VerifiedPair {
  left: PersonFacts;
  right: PersonFacts;
  /** For couples: the relation record (start/end years). */
  relation: Relation | null;
  relationKind: "spouse" | "partner" | "child" | "self";
}

/**
 * Confirm the relationship from structured data, checking both directions
 * (Wikidata is often only filled on one side).
 */
export function verifyPair(format: FormatSlug, left: PersonFacts, right: PersonFacts): VerifiedPair | null {
  const cfg = FORMATS[format];
  if (cfg.relation === "self") {
    return left.qid === right.qid ? { left, right, relation: null, relationKind: "self" } : null;
  }
  if (left.qid === right.qid) return null;
  if (cfg.relation === "partner") {
    const spouse = findRelation(left.spouses, right.qid) ?? findRelation(right.spouses, left.qid);
    if (spouse) return { left, right, relation: spouse, relationKind: "spouse" };
    const partner = findRelation(left.partners, right.qid) ?? findRelation(right.partners, left.qid);
    if (partner) return { left, right, relation: partner, relationKind: "partner" };
    return null;
  }
  // child: left is the parent
  const child = findRelation(left.children, right.qid);
  if (child) return { left, right, relation: child, relationKind: "child" };
  return null;
}

/** True when the couple is (as far as the data says) still together and both alive. */
export function isCurrentCouple(p: VerifiedPair): boolean {
  if (p.relationKind !== "spouse" && p.relationKind !== "partner") return false;
  if (p.relation?.endYear) return false;
  return !p.left.isDeceased && !p.right.isDeceased;
}

export function pairLabels(p: VerifiedPair, now = currentYear()): { leftLabel: string; rightLabel: string } {
  const role = (f: PersonFacts, male: string, female: string, neutral: string) =>
    f.sex === "male" ? male : f.sex === "female" ? female : neutral;
  switch (p.relationKind) {
    case "spouse": {
      const ended = Boolean(p.relation?.endYear);
      const prefix = ended ? "EX-" : "";
      return {
        leftLabel: prefix + role(p.left, "HUSBAND", "WIFE", "SPOUSE"),
        rightLabel: prefix + role(p.right, "HUSBAND", "WIFE", "SPOUSE"),
      };
    }
    case "partner":
      return p.relation?.endYear ? { leftLabel: "EX-PARTNER", rightLabel: "EX-PARTNER" } : { leftLabel: "PARTNER", rightLabel: "PARTNER" };
    case "child":
      return {
        leftLabel: role(p.left, "FATHER", "MOTHER", "PARENT"),
        rightLabel: role(p.right, "SON", "DAUGHTER", "CHILD"),
      };
    case "self": {
      const then = thenNowYears(p, now).thenYear;
      return { leftLabel: then ? String(then) : "THEN", rightLabel: String(now) };
    }
  }
}

/**
 * Which era each photo should show.
 *  - couples: both today (current photos), or at the start of the relationship if it ended.
 *  - parent-child: parent at the child's current age (the "lookalike" comparison), child today.
 *  - then-now: same person around age 30 vs today.
 */
export function pairEras(
  p: VerifiedPair,
  now = currentYear()
): { left: { era: SlotEra; year: number | null }; right: { era: SlotEra; year: number | null } } {
  switch (p.relationKind) {
    case "spouse":
    case "partner": {
      if (isCurrentCouple(p)) return { left: { era: "now", year: null }, right: { era: "now", year: null } };
      const y = p.relation?.startYear ?? null;
      return { left: { era: "then", year: y }, right: { era: "then", year: y } };
    }
    case "child": {
      const childAge = p.right.birthYear ? now - p.right.birthYear : null;
      const parentYear = p.left.birthYear && childAge ? p.left.birthYear + childAge : null;
      return {
        left: { era: "then", year: parentYear && parentYear < now - 5 ? parentYear : null },
        right: { era: p.right.isDeceased ? "then" : "now", year: null },
      };
    }
    case "self": {
      const { thenYear } = thenNowYears(p, now);
      return { left: { era: "then", year: thenYear }, right: { era: p.left.isDeceased ? "then" : "now", year: null } };
    }
  }
}

export function thenNowYears(p: VerifiedPair, now = currentYear()): { thenYear: number | null } {
  const b = p.left.birthYear;
  if (!b) return { thenYear: null };
  const y = Math.min(now - 15, Math.max(1970, b + 30));
  return { thenYear: y };
}

/** Caption shown under the pair. */
export function pairCaption(p: VerifiedPair): string {
  if (p.relationKind === "self") return p.left.name;
  return `${p.left.name} & ${p.right.name}`;
}

/** Facts the narration may use, as one line per person plus the relation. */
export function pairFactsForPrompt(p: VerifiedPair, factsLine: (f: PersonFacts) => string): string {
  const lines = [`LEFT: ${factsLine(p.left)}`];
  if (p.relationKind !== "self") lines.push(`RIGHT: ${factsLine(p.right)}`);
  if (p.relation) {
    const r = p.relation;
    const span = r.startYear ? `since ${r.startYear}${r.endYear ? `, ended ${r.endYear}` : ""}` : r.endYear ? `ended ${r.endYear}` : "years unknown";
    lines.push(`RELATION: ${p.relationKind} (${span})`);
  } else {
    lines.push(`RELATION: ${p.relationKind}`);
  }
  return lines.join("\n");
}

/**
 * Deterministic narration built only from verified data. Used when the LLM line
 * fails the fact check twice, so a video never ships an unsupported claim.
 */
export function fallbackNarration(p: VerifiedPair, now = currentYear()): string {
  const r = p.relation;
  switch (p.relationKind) {
    case "spouse":
      if (r?.startYear && !r.endYear) {
        return `${p.left.name} and ${p.right.name} married in ${r.startYear}, and they have been husband and wife for ${now - r.startYear} years.`.replace(
          "husband and wife",
          p.left.sex && p.right.sex && p.left.sex === p.right.sex ? "married" : "husband and wife"
        );
      }
      if (r?.startYear && r.endYear) return `${p.left.name} and ${p.right.name} were married from ${r.startYear} to ${r.endYear}.`;
      return `${p.left.name} and ${p.right.name} are one of Hollywood's married couples.`;
    case "partner":
      return r?.startYear
        ? `${p.left.name} and ${p.right.name} have been partners since ${r.startYear}.`
        : `${p.left.name} and ${p.right.name} are partners in real life.`;
    case "child": {
      const age = p.right.birthYear && !p.right.isDeceased ? now - p.right.birthYear : null;
      return age
        ? `${p.right.name} is the child of ${p.left.name}. Here is ${p.left.name} at about ${age}, the age ${p.right.name} is today.`
        : `${p.right.name} is the child of ${p.left.name}.`;
    }
    case "self":
      return p.left.birthYear
        ? `${p.left.name} was born in ${p.left.birthYear}. On the left, ${p.left.name} in their prime; on the right, ${p.left.name} today.`
        : `On the left, ${p.left.name} in their prime; on the right, ${p.left.name} today.`;
  }
}
