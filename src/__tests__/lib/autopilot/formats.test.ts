import { describe, it, expect } from "vitest";
import { verifyPair, pairLabels, pairEras, fallbackNarration, isCurrentCouple } from "@/lib/autopilot/formats";
import { buildPersonFacts, parseWikidataYear, factsToPromptLine } from "@/lib/facts/wikidata";
import type { PersonFacts } from "@/lib/facts/wikidata";
import { sanitizeTags, stripDeliveryMarkup } from "@/lib/tts/soniox";

function person(p: Partial<PersonFacts> & { qid: string; name: string }): PersonFacts {
  return {
    description: "",
    birthYear: null,
    deathYear: null,
    isDeceased: false,
    occupations: [],
    sex: null,
    spouses: [],
    partners: [],
    children: [],
    imageFile: null,
    imageUrl: null,
    wikipediaTitle: null,
    sourceUrl: `https://www.wikidata.org/wiki/${p.qid}`,
    ...p,
  };
}

const tom = person({ qid: "Q2263", name: "Tom Hanks", sex: "male", birthYear: 1956, spouses: [{ qid: "Q234144", name: "Rita Wilson", startYear: 1988, endYear: null }], children: [{ qid: "Q366322", name: "Colin Hanks", startYear: null, endYear: null }] });
const rita = person({ qid: "Q234144", name: "Rita Wilson", sex: "female", birthYear: 1956 });
const colin = person({ qid: "Q366322", name: "Colin Hanks", sex: "male", birthYear: 1977 });
const kurt = person({ qid: "Q295964", name: "Kurt Russell", sex: "male", birthYear: 1951 });
const goldie = person({ qid: "Q190998", name: "Goldie Hawn", sex: "female", birthYear: 1945, partners: [{ qid: "Q295964", name: "Kurt Russell", startYear: 1983, endYear: null }] });

describe("pair verification", () => {
  it("confirms a marriage from either side", () => {
    expect(verifyPair("couples", tom, rita)?.relationKind).toBe("spouse");
    expect(verifyPair("couples", rita, tom)?.relationKind).toBe("spouse");
  });

  it("confirms an unmarried partnership recorded only on one side", () => {
    expect(verifyPair("couples", kurt, goldie)?.relationKind).toBe("partner");
  });

  it("rejects an invented couple", () => {
    expect(verifyPair("couples", kurt, rita)).toBeNull();
  });

  it("confirms parent and child only in the right direction", () => {
    expect(verifyPair("parent-child", tom, colin)?.relationKind).toBe("child");
    expect(verifyPair("parent-child", colin, tom)).toBeNull();
  });
});

describe("labels and eras", () => {
  it("uses gendered labels from data", () => {
    expect(pairLabels(verifyPair("couples", tom, rita)!)).toEqual({ leftLabel: "HUSBAND", rightLabel: "WIFE" });
    expect(pairLabels(verifyPair("couples", kurt, goldie)!)).toEqual({ leftLabel: "PARTNER", rightLabel: "PARTNER" });
    expect(pairLabels(verifyPair("parent-child", tom, colin)!)).toEqual({ leftLabel: "FATHER", rightLabel: "SON" });
  });

  it("marks ended marriages as EX-", () => {
    const a = person({ qid: "Q1", name: "A", sex: "male", spouses: [{ qid: "Q2", name: "B", startYear: 1990, endYear: 2000 }] });
    const b = person({ qid: "Q2", name: "B", sex: "female" });
    const pair = verifyPair("couples", a, b)!;
    expect(isCurrentCouple(pair)).toBe(false);
    expect(pairLabels(pair)).toEqual({ leftLabel: "EX-HUSBAND", rightLabel: "EX-WIFE" });
  });

  it("shows the parent at the child's current age", () => {
    const eras = pairEras(verifyPair("parent-child", tom, colin)!, 2026);
    expect(eras.left).toEqual({ era: "then", year: 1956 + (2026 - 1977) });
    expect(eras.right.era).toBe("now");
  });

  it("then-now shows the same person around age 30", () => {
    const eras = pairEras(verifyPair("then-now", tom, tom)!, 2026);
    expect(eras.left.year).toBe(1986);
    expect(pairLabels(verifyPair("then-now", tom, tom)!, 2026)).toEqual({ leftLabel: "1986", rightLabel: "2026" });
  });
});

describe("fallback narration uses only verified data", () => {
  it("counts years of marriage", () => {
    expect(fallbackNarration(verifyPair("couples", tom, rita)!, 2026)).toBe(
      "Tom Hanks and Rita Wilson married in 1988, and they have been husband and wife for 38 years."
    );
  });
});

describe("wikidata parsing", () => {
  it("parses years with sign", () => {
    expect(parseWikidataYear({ time: "+1956-07-09T00:00:00Z" })).toBe(1956);
    expect(parseWikidataYear({ time: "-0044-03-15T00:00:00Z" })).toBe(-44);
    expect(parseWikidataYear(null)).toBeNull();
  });

  it("builds facts from claims, ignoring deprecated statements", () => {
    const entity = {
      id: "Q2263",
      labels: { en: { value: "Tom Hanks" } },
      descriptions: { en: { value: "American actor" } },
      claims: {
        P569: [{ mainsnak: { snaktype: "value", datavalue: { type: "time", value: { time: "+1956-07-09T00:00:00Z" } } } }],
        P21: [{ mainsnak: { snaktype: "value", datavalue: { type: "wikibase-entityid", value: { id: "Q6581097" } } } }],
        P26: [
          {
            mainsnak: { snaktype: "value", datavalue: { type: "wikibase-entityid", value: { id: "Q234144" } } },
            qualifiers: { P580: [{ snaktype: "value", datavalue: { type: "time", value: { time: "+1988-04-30T00:00:00Z" } } }] },
          },
          { rank: "deprecated", mainsnak: { snaktype: "value", datavalue: { type: "wikibase-entityid", value: { id: "Q999" } } } },
        ],
        P18: [{ mainsnak: { snaktype: "value", datavalue: { type: "string", value: "Tom Hanks TIFF 2019.jpg" } } }],
      },
    };
    const facts = buildPersonFacts(entity, { Q234144: { id: "Q234144", labels: { en: { value: "Rita Wilson" } } } });
    expect(facts.birthYear).toBe(1956);
    expect(facts.sex).toBe("male");
    expect(facts.isDeceased).toBe(false);
    expect(facts.spouses).toEqual([{ qid: "Q234144", name: "Rita Wilson", startYear: 1988, endYear: null }]);
    expect(facts.imageUrl).toContain("Tom_Hanks_TIFF_2019.jpg");
    expect(factsToPromptLine(facts)).toContain("spouses: Rita Wilson (from 1988)");
  });
});

describe("soniox markup", () => {
  it("keeps allowed tags and drops unknown ones", () => {
    expect(sanitizeTags("[warm] Hello [dog barks] there [Softly] friend")).toBe("[warm] Hello there [softly] friend");
  });
  it("strips tags and emphasis for subtitles", () => {
    expect(stripDeliveryMarkup("[warm] They are *still* together...")).toBe("They are still together...");
  });
});
