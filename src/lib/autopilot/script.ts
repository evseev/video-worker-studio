import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { createGeminiClient, getTextModel, generateTextOrThrow } from "@/lib/ai/gemini";
import { getPersonFacts, factsToPromptLine, type PersonFacts } from "@/lib/facts/wikidata";
import { SONIOX_TAGS, type SonioxTag } from "@/lib/tts/soniox";
import {
  FORMATS,
  currentYear,
  fallbackNarration,
  pairFactsForPrompt,
  verifyPair,
  type FormatSlug,
  type VerifiedPair,
} from "./formats";

function model(systemInstruction: string, schema: ResponseSchema, temperature = 0.8) {
  const genAI = createGeminiClient(process.env.GEMINI_API_KEY);
  return getTextModel({
    genAI,
    systemInstruction,
    generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature },
  });
}

async function generateJson<T>(system: string, schema: ResponseSchema, user: string, parser: z.ZodType<T>, temperature?: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await generateTextOrThrow(model(system, schema, temperature), user);
      return parser.parse(JSON.parse(text));
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini JSON generation failed");
}

const AUDIENCE =
  "The channel is 'Emma's Angle': warm, nostalgic videos about Hollywood stars of the 1970s–2000s for viewers aged 55+, mostly watching on TV in the US.";

// ---------------------------------------------------------------- pairs

const PairsSchema = z.object({
  pairs: z.array(z.object({ left: z.string().min(2), right: z.string().min(2) })),
});

const pairsResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    pairs: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          left: { type: SchemaType.STRING, description: "Full name of the left person" },
          right: { type: SchemaType.STRING, description: "Full name of the right person" },
        },
        required: ["left", "right"],
      },
    },
  },
  required: ["pairs"],
};

function pairsInstruction(format: FormatSlug): string {
  switch (format) {
    case "couples":
    case "mega":
      return "Each pair: LEFT = the famous actor or actress, RIGHT = their real-life spouse or long-term partner (married or together, publicly documented). Prefer long-lasting couples who are still together; include a few surprising ones.";
    case "parent-child":
      return "Each pair: LEFT = a famous parent (actor, actress, musician), RIGHT = one of their real biological or adopted children who is publicly known as an adult. Prefer children who strongly resemble the parent.";
    case "then-now":
      return "Each pair: LEFT and RIGHT are the SAME living star (repeat the same full name twice). Prefer stars who were famous in the 1980s–2000s.";
  }
}

export async function proposePairs(params: {
  topic: string;
  format: FormatSlug;
  count: number;
  exclude: string[];
}): Promise<Array<{ left: string; right: string }>> {
  const system = `${AUDIENCE}
You pick subjects for one video. ${pairsInstruction(params.format)}
Rules: only real, well-documented people; use the most common English spelling of full names; no duplicates; no person from the exclusion list; order from most famous to least.`;
  const user = `Video topic: ${params.topic}
Return exactly ${params.count} pairs.
Exclusion list (already used, do not repeat): ${params.exclude.slice(0, 300).join("; ") || "(none)"}`;
  const res = await generateJson(system, pairsResponseSchema, user, PairsSchema, 0.7);
  return res.pairs;
}

/**
 * Propose pairs and keep only those whose relation Wikidata confirms.
 * Runs up to `rounds` proposal rounds until `count` verified pairs exist.
 */
export async function buildVerifiedPairs(params: {
  topic: string;
  format: FormatSlug;
  count: number;
  exclude?: string[];
  rounds?: number;
  onLog?: (msg: string) => void;
}): Promise<{ pairs: VerifiedPair[]; rejected: Array<{ left: string; right: string; reason: string }> }> {
  const log = params.onLog ?? (() => {});
  const verified: VerifiedPair[] = [];
  const rejected: Array<{ left: string; right: string; reason: string }> = [];
  const used = new Set<string>((params.exclude ?? []).map((s) => s.toLowerCase()));
  const usedQids = new Set<string>();
  const rounds = params.rounds ?? 3;

  for (let round = 0; round < rounds && verified.length < params.count; round++) {
    const need = params.count - verified.length;
    const proposals = await proposePairs({
      topic: params.topic,
      format: params.format,
      count: Math.ceil(need * 1.5) + 2,
      exclude: Array.from(used),
    });
    log(`round ${round + 1}: ${proposals.length} proposals for ${need} needed`);
    for (const prop of proposals) {
      if (verified.length >= params.count) break;
      const key = `${prop.left}|${prop.right}`.toLowerCase();
      if (used.has(key) || used.has(prop.left.toLowerCase())) continue;
      used.add(key);
      used.add(prop.left.toLowerCase());
      const left = await getPersonFacts(prop.left);
      const right = params.format === "then-now" ? left : await getPersonFacts(prop.right);
      if (!left || !right) {
        rejected.push({ ...prop, reason: "not found in Wikidata" });
        continue;
      }
      if (usedQids.has(left.qid) && params.format !== "then-now") {
        rejected.push({ ...prop, reason: "person already in this video" });
        continue;
      }
      const pair = verifyPair(params.format, left, right);
      if (!pair) {
        rejected.push({ ...prop, reason: "relation not confirmed by Wikidata" });
        continue;
      }
      if (params.format === "then-now" && left.isDeceased) {
        rejected.push({ ...prop, reason: "deceased (no 'now' photo)" });
        continue;
      }
      if (params.format === "parent-child" && right.isDeceased) {
        rejected.push({ ...prop, reason: "child deceased" });
        continue;
      }
      usedQids.add(left.qid);
      usedQids.add(right.qid);
      verified.push(pair);
      log(`verified ${verified.length}/${params.count}: ${left.name} / ${right.name} (${pair.relationKind})`);
    }
  }
  return { pairs: verified, rejected };
}

// ---------------------------------------------------------------- narration

/** Fact line with the current age precomputed so the model never does date math. */
export function factsLineWithAge(f: PersonFacts, now = currentYear()): string {
  const base = factsToPromptLine(f);
  if (f.birthYear && !f.isDeceased) return `${base} | age now: about ${now - f.birthYear}`;
  return base;
}

const NarrationSchema = z.object({
  lines: z.array(
    z.object({
      index: z.number().int(),
      scriptText: z.string().min(10),
      tone: z.enum(SONIOX_TAGS).nullable().optional(),
    })
  ),
});

const narrationResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    lines: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          index: { type: SchemaType.INTEGER },
          scriptText: { type: SchemaType.STRING },
          tone: { type: SchemaType.STRING, enum: [...SONIOX_TAGS], format: "enum" },
        },
        required: ["index", "scriptText", "tone"],
      },
    },
  },
  required: ["lines"],
};

const NARRATION_RULES = `${AUDIENCE}
You write the spoken narration for each pair. The narrator is Emma: warm, kind, a little wistful, never gossipy or mocking.
HARD RULES:
- Use ONLY the facts given for that pair (names, years, ages, spouses, partners, children). Never invent dates, films, awards, numbers, illnesses, scandals or quotes.
- Never say or imply that someone died, is ill or is struggling unless the facts say "died".
- 18 to 32 words, one or two sentences, plain spoken American English, easy to follow on first listen.
- Write years and numbers as digits ("1988", "35 years", "four children" is fine for small counts). Never spell years out as words.
- Name at most two children in a line; otherwise give the count ("four children").
- Every line must carry at least one concrete detail from the facts: a year, how long they have been together, an age, or a child's name. Avoid empty filler words such as "wonderful", "lovely", "journey", "amazing".
- Vary sentence openings across lines; never start two consecutive lines the same way; no "Next up", no "Let's", no rhetorical question in every line.
- You may use *one* word wrapped in asterisks for emphasis, and "..." for a gentle pause. No emojis, no hashtags.
- tone must be one of: ${SONIOX_TAGS.join(", ")} (mostly warm; happy for joyful facts; softly for tender moments).`;

const CheckSchema = z.object({
  results: z.array(z.object({ index: z.number().int(), supported: z.boolean(), problems: z.array(z.string()) })),
});
const checkResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    results: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          index: { type: SchemaType.INTEGER },
          supported: { type: SchemaType.BOOLEAN },
          problems: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["index", "supported", "problems"],
      },
    },
  },
  required: ["results"],
};

const CHECK_RULES = `You are a strict fact checker. For each line, decide whether EVERY factual claim (names, relationships, years, ages, durations, counts, life status) is directly supported by the facts block for that index. Opinions and warm adjectives are fine. Durations like "35 years" are supported if they follow from the given years and the current year ${currentYear()} (allow ±1 year). Any claim about films, awards, careers, health, death or events not in the facts is NOT supported.`;

export interface NarrationLineOut {
  scriptText: string;
  tone: SonioxTag | null;
  source: "llm" | "llm-rewrite" | "fallback";
  problems: string[];
}

async function checkLines(items: Array<{ index: number; facts: string; line: string }>) {
  if (items.length === 0) return new Map<number, string[]>();
  const user = items.map((i) => `#${i.index}\nFACTS:\n${i.facts}\nLINE: ${i.line}`).join("\n\n");
  const res = await generateJson(CHECK_RULES, checkResponseSchema, user, CheckSchema, 0);
  const problems = new Map<number, string[]>();
  for (const r of res.results) if (!r.supported) problems.set(r.index, r.problems.length ? r.problems : ["unsupported claim"]);
  return problems;
}

/** Narration for every pair, fact-checked; unsupported lines are rewritten once, then fall back to a template. */
export async function writeNarration(params: {
  topic: string;
  format: FormatSlug;
  pairs: VerifiedPair[];
  batchSize?: number;
  onLog?: (msg: string) => void;
}): Promise<NarrationLineOut[]> {
  const log = params.onLog ?? (() => {});
  const batch = params.batchSize ?? 10;
  const out: NarrationLineOut[] = new Array(params.pairs.length);
  const factsFor = (i: number) => pairFactsForPrompt(params.pairs[i], (f) => factsLineWithAge(f));

  for (let start = 0; start < params.pairs.length; start += batch) {
    const idx = params.pairs.slice(start, start + batch).map((_, k) => start + k);
    const prevOpenings = out
      .slice(Math.max(0, start - 3), start)
      .filter(Boolean)
      .map((l) => l.scriptText.split(" ").slice(0, 3).join(" "));
    const user = `Video topic: ${params.topic} (format: ${FORMATS[params.format].description})
Previous lines started with: ${prevOpenings.join(" | ") || "(none)"}
Write one line per index below.

${idx.map((i) => `#${i}\n${factsFor(i)}`).join("\n\n")}`;
    const res = await generateJson(NARRATION_RULES, narrationResponseSchema, user, NarrationSchema, 0.9);
    const byIndex = new Map(res.lines.map((l) => [l.index, l]));

    const drafts = idx.map((i) => ({ index: i, facts: factsFor(i), line: byIndex.get(i)?.scriptText ?? "" }));
    const problems = await checkLines(drafts.filter((d) => d.line));
    for (const d of drafts) {
      const l = byIndex.get(d.index);
      if (l && d.line && !problems.has(d.index)) {
        out[d.index] = { scriptText: l.scriptText, tone: (l.tone as SonioxTag) ?? "warm", source: "llm", problems: [] };
      }
    }

    // Rewrite failed or missing lines once with the checker's feedback.
    const retry = drafts.filter((d) => !out[d.index]);
    if (retry.length) {
      log(`rewriting ${retry.length} line(s) that failed the fact check`);
      const user2 = `Rewrite these lines so every claim is supported by the facts. Keep them warm and 18-32 words.
${retry.map((d) => `#${d.index}\n${d.facts}\nPREVIOUS: ${d.line || "(missing)"}\nPROBLEMS: ${(problems.get(d.index) ?? ["missing"]).join("; ")}`).join("\n\n")}`;
      const res2 = await generateJson(NARRATION_RULES, narrationResponseSchema, user2, NarrationSchema, 0.4);
      const byIndex2 = new Map(res2.lines.map((l) => [l.index, l]));
      const recheck = await checkLines(
        retry.map((d) => ({ ...d, line: byIndex2.get(d.index)?.scriptText ?? "" })).filter((d) => d.line)
      );
      for (const d of retry) {
        const l = byIndex2.get(d.index);
        if (l && !recheck.has(d.index)) {
          out[d.index] = { scriptText: l.scriptText, tone: (l.tone as SonioxTag) ?? "warm", source: "llm-rewrite", problems: [] };
        } else {
          out[d.index] = {
            scriptText: fallbackNarration(params.pairs[d.index]),
            tone: "warm",
            source: "fallback",
            problems: recheck.get(d.index) ?? problems.get(d.index) ?? ["missing"],
          };
        }
      }
    }
    log(`narration ${Math.min(start + batch, params.pairs.length)}/${params.pairs.length}`);
  }
  return out;
}

// ---------------------------------------------------------------- packaging

const PackagingSchema = z.object({
  titles: z.array(z.string().min(10).max(100)).min(3),
  hook: z.string().min(10),
  outro: z.string().min(10),
  description: z.string().min(100),
  tags: z.array(z.string()).min(10),
  thumbnailText: z.string().max(40),
});

const packagingResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    titles: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    hook: { type: SchemaType.STRING },
    outro: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    thumbnailText: { type: SchemaType.STRING },
  },
  required: ["titles", "hook", "outro", "description", "tags", "thumbnailText"],
};

export type Packaging = z.infer<typeof PackagingSchema>;

export async function writePackaging(params: {
  topic: string;
  format: FormatSlug;
  pairs: VerifiedPair[];
  seriesName?: string;
  publishSlot?: string;
}): Promise<Packaging> {
  const n = params.pairs.length;
  const names = params.pairs.slice(0, 12).map((p) => (p.relationKind === "self" ? p.left.name : `${p.left.name} & ${p.right.name}`));
  const system = `${AUDIENCE}
You write YouTube packaging that is accurate (no clickbait about deaths, illness or fake relationships).
- titles: 5 options, each under 70 characters, following the proven pattern "[number] [adjective] [cohort] and Their [relation] | Then & Now ${currentYear()}" or close variants. The number must be ${n} or a rounded-down form like "${Math.floor(n / 10) * 10}+".
- hook: the first narrated line, 20-35 words, warm, names one or two of the most famous people from the list, promises what the viewer will see, and invites them to stay to the end. No "smash that like button".
- outro: 25-40 words, thanks the viewer, asks which pair surprised them in the comments, and gives a reason to subscribe: a new story every weekday${params.publishSlot ? ` at ${params.publishSlot}` : ""}.
- description: 150-250 words, first two lines carry the main keywords, then a short paragraph, then the list of featured names, then 8-12 hashtags. Do NOT include chapters or credits (added separately).
- tags: 20-30 tags.
- thumbnailText: 2-4 words in capitals for the thumbnail banner, honest to the content.`;
  const user = `Topic: ${params.topic}
Format: ${FORMATS[params.format].description}
Series: ${params.seriesName ?? "(none)"}
Number of pairs: ${n}
Featured (in order): ${names.join("; ")}`;
  return generateJson(system, packagingResponseSchema, user, PackagingSchema, 0.8);
}
