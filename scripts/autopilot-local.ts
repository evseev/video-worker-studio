/**
 * Local autopilot runner — produces a complete, upload-ready bundle without touching the database.
 *
 *   npm run autopilot:local -- --topic "Hollywood actors of the 90s and their real-life wives" \
 *     --format couples --pairs 50 [--music lifting-dreams] [--locales pt-BR,es] [--until voice] [--force images]
 *
 * Output: out/autopilot/<slug>/{state.json, review.html, work/, bundle/}
 * Re-running the same command resumes from the last finished stage.
 */
import { runPipeline, STAGES, type StageName } from "@/lib/autopilot/pipeline";
import { FORMAT_SLUGS, type FormatSlug } from "@/lib/autopilot/formats";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const topic = arg("topic");
  if (!topic) {
    console.error('Usage: npm run autopilot:local -- --topic "..." [--format couples|parent-child|then-now|mega] [--pairs 50]');
    process.exit(1);
  }
  const format = (arg("format") ?? "couples") as FormatSlug;
  if (!FORMAT_SLUGS.includes(format)) throw new Error(`Unknown format ${format}`);
  const until = arg("until") as StageName | undefined;
  if (until && !STAGES.includes(until)) throw new Error(`Unknown stage ${until}`);
  const force = (arg("force") ?? "").split(",").filter(Boolean) as StageName[];
  const locales = arg("locales") !== undefined ? arg("locales")!.split(",").filter(Boolean) : undefined;

  const started = Date.now();
  const state = await runPipeline({
    topic,
    format,
    pairs: Number(arg("pairs") ?? 50),
    outRoot: arg("out") ?? "out/autopilot",
    musicId: arg("music"),
    locales,
    quality: (arg("quality") as "720p" | "1080p") ?? "1080p",
    until,
    force,
    exclude: (arg("exclude") ?? "").split(";").filter(Boolean),
    publishSlot: arg("slot") ?? "5 PM Eastern",
    log: (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`),
  });
  console.log(`\nDone in ${((Date.now() - started) / 60000).toFixed(1)} min → ${arg("out") ?? "out/autopilot"}/${state.slug}/review.html`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
