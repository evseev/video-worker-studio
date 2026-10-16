import { buildVerifiedPairs, writeNarration, writePackaging } from "@/lib/autopilot/script";
import { pairLabels, pairEras, pairCaption } from "@/lib/autopilot/formats";
(async () => {
  const topic = "Hollywood actors of the 1980s and 1990s and their real-life partners";
  const { pairs, rejected } = await buildVerifiedPairs({ topic, format: "couples", count: 6, onLog: (m) => console.log("  ", m) });
  console.log("rejected:", rejected);
  const lines = await writeNarration({ topic, format: "couples", pairs, onLog: (m) => console.log("  ", m) });
  pairs.forEach((p, i) => console.log(`#${i} ${pairCaption(p)} ${JSON.stringify(pairLabels(p))} ${JSON.stringify(pairEras(p))}\n    [${lines[i].tone}/${lines[i].source}] ${lines[i].scriptText} ${lines[i].problems.join(";")}`));
  const pk = await writePackaging({ topic, format: "couples", pairs, publishSlot: "5 PM Eastern" });
  console.log(JSON.stringify({ ...pk, description: pk.description.slice(0, 300) + "…" }, null, 1));
})();
