import { z } from "zod";

/**
 * Wikidata resolver: turns a person name into structured, sourced facts used for
 * narration (marriage years, children, birth year) and a reference photo used for
 * face verification. No API key required. Wikimedia asks for a descriptive User-Agent.
 */

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const USER_AGENT =
  process.env.WIKIMEDIA_USER_AGENT ??
  "VideoWorkerStudio/0.5 (autopilot; contact via repository owner) node-fetch";

export interface Relation {
  qid: string;
  name: string;
  /** Year the relation started (marriage / partnership), when known. */
  startYear: number | null;
  /** Year the relation ended (divorce / death), when known. */
  endYear: number | null;
}

export interface PersonFacts {
  qid: string;
  name: string;
  description: string;
  birthYear: number | null;
  deathYear: number | null;
  /** True when Wikidata has a date of death. Narration must never claim death otherwise. */
  isDeceased: boolean;
  occupations: string[];
  spouses: Relation[];
  partners: Relation[];
  children: Relation[];
  /** Commons file name of the P18 image, when present. */
  imageFile: string | null;
  /** Direct (resized) URL for the P18 image. */
  imageUrl: string | null;
  wikipediaTitle: string | null;
  sourceUrl: string;
}

const SearchResponse = z.object({
  search: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .default([]),
});

const ClaimSnak = z.object({
  snaktype: z.string(),
  datavalue: z
    .object({
      value: z.unknown(),
      type: z.string(),
    })
    .optional(),
});

const Claim = z.object({
  mainsnak: ClaimSnak,
  rank: z.string().optional(),
  qualifiers: z.record(z.string(), z.array(ClaimSnak)).optional(),
});

const Entity = z.object({
  id: z.string(),
  labels: z.record(z.string(), z.object({ value: z.string() })).optional(),
  descriptions: z.record(z.string(), z.object({ value: z.string() })).optional(),
  claims: z.record(z.string(), z.array(Claim)).optional(),
  sitelinks: z.record(z.string(), z.object({ title: z.string() })).optional(),
});

const EntitiesResponse = z.object({
  entities: z.record(z.string(), Entity),
});

type EntityT = z.infer<typeof Entity>;
type ClaimT = z.infer<typeof Claim>;
type SnakT = z.infer<typeof ClaimSnak>;

/** Descriptions that signal a person in the entertainment niche. */
const PERSON_HINT =
  /\b(actor|actress|singer|musician|model|comedian|director|producer|filmmaker|television|tv|presenter|host|rapper|entertainer|dancer|athlete|player|wrestler|businessman|businesswoman|personality)\b/i;

/** Minimum spacing between Wikidata requests (Wikimedia rate-limits bursts with 429). */
const MIN_INTERVAL_MS = 400;
let nextSlot = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function wikidataGet(params: Record<string, string>, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const url = new URL(WIKIDATA_API);
  for (const [k, v] of Object.entries({ ...params, format: "json", origin: "*" })) {
    url.searchParams.set(k, v);
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      if (fetchImpl === fetch) await throttle();
      const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Wikidata HTTP ${res.status}`);
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, Math.min(backoff, 30_000)));
        continue;
      }
      if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Wikidata request failed");
}

/** Parse a Wikidata time value ("+1956-07-09T00:00:00Z") into a year. */
export function parseWikidataYear(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const time = (value as { time?: unknown }).time;
  if (typeof time !== "string") return null;
  const m = /^([+-])(\d{1,4})-/.exec(time);
  if (!m) return null;
  const year = Number(m[2]) * (m[1] === "-" ? -1 : 1);
  return Number.isFinite(year) && year !== 0 ? year : null;
}

function entityIdOf(snak: SnakT | undefined): string | null {
  const v = snak?.datavalue?.value;
  if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") {
    return (v as { id: string }).id;
  }
  return null;
}

function stringOf(snak: SnakT | undefined): string | null {
  const v = snak?.datavalue?.value;
  return typeof v === "string" ? v : null;
}

/** Prefer preferred-rank claims, drop deprecated ones. */
function usableClaims(entity: EntityT, prop: string): ClaimT[] {
  const all = entity.claims?.[prop] ?? [];
  const live = all.filter((c) => c.rank !== "deprecated");
  const preferred = live.filter((c) => c.rank === "preferred");
  return preferred.length > 0 && prop !== "P26" && prop !== "P40" && prop !== "P451" && prop !== "P106"
    ? preferred
    : live;
}

function qualifierYear(claim: ClaimT, prop: string): number | null {
  const q = claim.qualifiers?.[prop]?.[0];
  return q ? parseWikidataYear(q.datavalue?.value) : null;
}

export function commonsFileUrl(fileName: string, width = 1200): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName.replace(/ /g, "_"))}?width=${width}`;
}

function label(entity: EntityT | undefined, lang = "en"): string | null {
  return entity?.labels?.[lang]?.value ?? entity?.labels?.["mul"]?.value ?? null;
}

/**
 * Find the best Wikidata item for a person name. Prefers results whose description
 * looks like an entertainment person; falls back to the first result.
 */
export async function searchPerson(
  name: string,
  opts: { fetchImpl?: typeof fetch; hint?: RegExp } = {}
): Promise<{ qid: string; label: string; description: string } | null> {
  const raw = await wikidataGet(
    { action: "wbsearchentities", search: name, language: "en", type: "item", limit: "8" },
    opts.fetchImpl
  );
  const parsed = SearchResponse.parse(raw);
  if (parsed.search.length === 0) return null;
  const hint = opts.hint ?? PERSON_HINT;
  const best = parsed.search.find((s) => hint.test(s.description ?? "")) ?? parsed.search[0];
  return { qid: best.id, label: best.label ?? name, description: best.description ?? "" };
}

async function getEntities(ids: string[], props: string, fetchImpl?: typeof fetch): Promise<Record<string, EntityT>> {
  const out: Record<string, EntityT> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    if (chunk.length === 0) continue;
    const raw = await wikidataGet(
      { action: "wbgetentities", ids: chunk.join("|"), props, languages: "en|mul" },
      fetchImpl
    );
    Object.assign(out, EntitiesResponse.parse(raw).entities);
  }
  return out;
}

/** Pure parser, exported for tests: entity + label lookup → PersonFacts. */
export function buildPersonFacts(entity: EntityT, labels: Record<string, EntityT>): PersonFacts {
  const nameOf = (qid: string) => label(labels[qid]) ?? qid;
  const relations = (prop: string): Relation[] => {
    const seen = new Set<string>();
    const out: Relation[] = [];
    for (const c of usableClaims(entity, prop)) {
      const id = entityIdOf(c.mainsnak);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        qid: id,
        name: nameOf(id),
        startYear: qualifierYear(c, "P580"),
        endYear: qualifierYear(c, "P582"),
      });
    }
    return out;
  };

  const birthYear = parseWikidataYear(usableClaims(entity, "P569")[0]?.mainsnak.datavalue?.value);
  const deathClaim = usableClaims(entity, "P570")[0];
  const deathYear = parseWikidataYear(deathClaim?.mainsnak.datavalue?.value);
  const imageFile = stringOf(usableClaims(entity, "P18")[0]?.mainsnak);
  const occupations = usableClaims(entity, "P106")
    .map((c) => entityIdOf(c.mainsnak))
    .filter((id): id is string => Boolean(id))
    .map(nameOf);

  return {
    qid: entity.id,
    name: label(entity) ?? entity.id,
    description: entity.descriptions?.en?.value ?? "",
    birthYear,
    deathYear,
    isDeceased: Boolean(deathClaim),
    occupations: Array.from(new Set(occupations)),
    spouses: relations("P26"),
    partners: relations("P451"),
    children: relations("P40"),
    imageFile,
    imageUrl: imageFile ? commonsFileUrl(imageFile) : null,
    wikipediaTitle: entity.sitelinks?.enwiki?.title ?? null,
    sourceUrl: `https://www.wikidata.org/wiki/${entity.id}`,
  };
}

const factsCache = new Map<string, PersonFacts | null>();

/** Resolve a person name (or QID) to facts. Returns null when nothing matches. */
export async function getPersonFacts(
  nameOrQid: string,
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<PersonFacts | null> {
  const key = nameOrQid.trim().toLowerCase();
  if (factsCache.has(key)) return factsCache.get(key) ?? null;

  let qid = /^Q\d+$/.test(nameOrQid.trim()) ? nameOrQid.trim() : null;
  if (!qid) {
    const hit = await searchPerson(nameOrQid, opts);
    qid = hit?.qid ?? null;
  }
  if (!qid) {
    factsCache.set(key, null);
    return null;
  }

  const main = await getEntities([qid], "labels|descriptions|claims|sitelinks", opts.fetchImpl);
  const entity = main[qid];
  if (!entity) {
    factsCache.set(key, null);
    return null;
  }

  const refIds = new Set<string>();
  for (const prop of ["P26", "P451", "P40", "P106"]) {
    for (const c of entity.claims?.[prop] ?? []) {
      const id = entityIdOf(c.mainsnak);
      if (id) refIds.add(id);
    }
  }
  const labels = await getEntities(Array.from(refIds), "labels", opts.fetchImpl);
  const facts = buildPersonFacts(entity, labels);
  factsCache.set(key, facts);
  return facts;
}

/** Compact one-line summary handed to the script prompt as the only allowed facts. */
export function factsToPromptLine(f: PersonFacts): string {
  const parts: string[] = [`${f.name}`];
  if (f.birthYear) parts.push(`born ${f.birthYear}`);
  if (f.isDeceased) parts.push(`died ${f.deathYear ?? "(year unknown)"}`);
  else parts.push("living (no date of death on record)");
  if (f.occupations.length) parts.push(f.occupations.slice(0, 3).join("/"));
  const rel = (r: Relation) =>
    `${r.name}${r.startYear ? ` (from ${r.startYear}${r.endYear ? ` to ${r.endYear}` : ""})` : r.endYear ? ` (until ${r.endYear})` : ""}`;
  if (f.spouses.length) parts.push(`spouses: ${f.spouses.map(rel).join("; ")}`);
  if (f.partners.length) parts.push(`partners: ${f.partners.map(rel).join("; ")}`);
  if (f.children.length) parts.push(`children on record: ${f.children.map((c) => c.name).join(", ")}`);
  return parts.join(" | ");
}
