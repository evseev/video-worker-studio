import * as path from "path";
import type { PersonFacts } from "@/lib/facts/wikidata";
import { downloadImage } from "./download";
import { searchPinterest } from "./sources/pinterest";
import { searchCommons } from "./sources/commons";
import { searchGoogleImages, isGoogleImagesEnabled } from "./sources/google-images";
import { analyzeFaces, toFaceAnalysis } from "./verify";
import { rankCandidates } from "./rank";
import type { FaceAnalysis, ImageCandidate, RankedCandidate, SlotEra } from "./types";

export interface PersonSlotRequest {
  /** Opaque key the caller uses to map results back (e.g. "3:0" = scene 3, slot 0). */
  key: string;
  era: SlotEra;
  /** Era year for "then" slots (e.g. 1995). Derived from birth year when absent. */
  year?: number | null;
}

export interface PersonSourcingResult {
  person: string;
  facts: PersonFacts | null;
  referenceCount: number;
  slots: Record<string, RankedCandidate[]>;
  queries: string[];
}

/** Pick a representative "then" year: an explicit year, else age ~30, clamped to the 1970s–2000s. */
export function thenYear(facts: PersonFacts | null, requested?: number | null): number | null {
  if (requested && requested > 1900) return requested;
  if (facts?.birthYear) return Math.min(2005, Math.max(1970, facts.birthYear + 30));
  return null;
}

export function queriesForEra(name: string, era: SlotEra, year: number | null): string[] {
  if (era === "now") return [`${name} 2025`, `${name} recent photo`];
  if (era === "then") {
    if (year) {
      const decade = Math.floor(year / 10) * 10;
      return [`${name} ${decade}s`, `young ${name} ${year}`];
    }
    return [`young ${name}`, `${name} young photo`];
  }
  return [`${name} portrait`];
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "x";
}

/**
 * Gather, verify and rank photos for every slot that shows one person.
 * All of the person's candidates are verified together so that the "then" and "now"
 * pools reinforce each other's consensus score.
 */
export async function sourcePersonSlots(params: {
  person: string;
  facts: PersonFacts | null;
  slots: PersonSlotRequest[];
  workDir: string;
  perQuery?: number;
  excludeHashes?: string[];
}): Promise<PersonSourcingResult> {
  const { person, facts, slots, workDir } = params;
  const name = facts?.name ?? person;
  const perQuery = params.perQuery ?? 6;
  const personDir = path.join(workDir, slug(name));

  // 1) Reference photos: Wikidata P18 (+ up to two Commons photos that also serve as "now" candidates).
  const references: string[] = [];
  if (facts?.imageUrl) {
    const ref = await downloadImage(facts.imageUrl, path.join(personDir, "ref"));
    if (ref) references.push(ref);
  }
  const needsNow = slots.some((s) => s.era !== "then");
  const commons = needsNow ? await searchCommons(name, path.join(personDir, "commons"), 3) : [];

  // 2) Candidate searches per era (deduplicated queries).
  const eraPools = new Map<string, ImageCandidate[]>();
  const queries: string[] = [];
  const eraKey = (era: SlotEra, year: number | null) => `${era}:${year ?? ""}`;
  for (const s of slots) {
    const year = s.era === "then" ? thenYear(facts, s.year) : null;
    const k = eraKey(s.era, year);
    if (eraPools.has(k)) continue;
    const pool: ImageCandidate[] = [];
    for (const q of queriesForEra(name, s.era, year)) {
      queries.push(q);
      pool.push(...(await searchPinterest(q, path.join(personDir, slug(q)), perQuery)));
      if (isGoogleImagesEnabled()) {
        pool.push(...(await searchGoogleImages(q, path.join(personDir, `g-${slug(q)}`), perQuery)));
      }
    }
    if (s.era !== "then") pool.push(...commons);
    eraPools.set(k, pool);
  }

  // 3) Verify everything for this person in one pass.
  const all = new Map<string, ImageCandidate>();
  for (const pool of eraPools.values()) for (const c of pool) all.set(c.localPath, c);
  const analyses = new Map<string, FaceAnalysis>();
  if (all.size > 0) {
    const res = await analyzeFaces(references, Array.from(all.keys()));
    for (const a of res.candidates) analyses.set(a.path, toFaceAnalysis(a));
  }

  // 4) Rank per slot.
  const out: Record<string, RankedCandidate[]> = {};
  for (const s of slots) {
    const year = s.era === "then" ? thenYear(facts, s.year) : null;
    const pool = eraPools.get(eraKey(s.era, year)) ?? [];
    const withAnalysis = pool
      .map((c) => ({ ...c, analysis: analyses.get(c.localPath) ?? { path: c.localPath, ok: false, error: "not analysed" } }))
      .filter((c) => c.analysis);
    out[s.key] = rankCandidates(withAnalysis, { expectSingleFace: true, excludeHashes: params.excludeHashes });
  }
  return { person: name, facts, referenceCount: references.length, slots: out, queries };
}
