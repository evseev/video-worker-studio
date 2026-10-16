import * as path from "path";
import type { PipelineState, PickedImage } from "./pipeline";
import { pairCaption, pairLabels } from "./formats";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rel(dir: string, file: string): string {
  return path.relative(dir, file).split(path.sep).map(encodeURIComponent).join("/");
}

const BADGE: Record<string, string> = { high: "#1b7f3b", medium: "#b26a00", low: "#b3261e" };

function photo(dir: string, p: PickedImage | null, big = true): string {
  if (!p) return `<div class="ph missing">no photo</div>`;
  return `<figure class="${big ? "ph" : "alt"}">
  <img loading="lazy" src="${rel(dir, p.path)}" style="object-position:${esc(p.objectPosition)}" alt="">
  <figcaption><span class="badge" style="background:${BADGE[p.confidence]}">${esc(p.confidence)}</span>
  ${big ? `id ${p.identityScore.toFixed(2)} · ${p.width}×${p.height} · ${esc(p.source)}` : ""}
  ${big && p.flags.length ? `<div class="flags">${p.flags.map(esc).join(" · ")}</div>` : ""}</figcaption>
</figure>`;
}

/** Self-contained storyboard for offline review (open review.html next to work/ and bundle/). */
export function renderReviewHtml(state: PipelineState, dir: string): string {
  const pairs = state.pairs ?? [];
  const items = pairs.map((p, i) => {
    const img = state.images?.[String(i)];
    const n = state.narration?.[i];
    const vp = { left: p.left, right: p.right, relation: p.relation, relationKind: p.relationKind };
    const labels = pairLabels(vp);
    const worst = [img?.left.chosen?.confidence, img?.right.chosen?.confidence].includes("low")
      ? 0
      : [img?.left.chosen?.confidence, img?.right.chosen?.confidence].includes("medium")
        ? 1
        : 2;
    const flagged = worst < 2 || n?.source === "fallback";
    return { i, flagged, worst, html: `<section class="pair${flagged ? " flagged" : ""}" id="p${i}">
  <h3>#${i + 1} ${esc(pairCaption(vp))} <small>${esc(labels.leftLabel)} / ${esc(labels.rightLabel)} · ${esc(p.relationKind)}${p.relation?.startYear ? ` since ${p.relation.startYear}` : ""}${p.relation?.endYear ? ` until ${p.relation.endYear}` : ""}</small></h3>
  <div class="row">${photo(dir, img?.left.chosen ?? null)}${photo(dir, img?.right.chosen ?? null)}</div>
  <p class="line"><b>Narration</b> <span class="src">${esc(n?.source)}${n?.tone ? ` · ${esc(n.tone)}` : ""}</span><br>${esc(n?.scriptText)}${n?.problems?.length ? `<br><span class="flags">fact check: ${n.problems.map(esc).join("; ")}</span>` : ""}</p>
  <details><summary>Alternatives</summary>
    <div class="alts"><b>Left</b> ${(img?.left.alternatives ?? []).map((a) => photo(dir, a, false)).join("")}</div>
    <div class="alts"><b>Right</b> ${(img?.right.alternatives ?? []).map((a) => photo(dir, a, false)).join("")}</div>
    <p class="src">Sources: <a href="${esc(p.left.sourceUrl)}">${esc(p.left.name)}</a>${p.relationKind !== "self" ? `, <a href="${esc(p.right.sourceUrl)}">${esc(p.right.name)}</a>` : ""}</p>
  </details>
</section>` };
  });
  const ordered = [...items].sort((a, b) => a.worst - b.worst || a.i - b.i);
  const flaggedCount = items.filter((x) => x.flagged).length;
  const pk = state.packaging;
  const out = state.outputs ?? {};

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review – ${esc(pk?.titles?.[0] ?? state.topic)}</title>
<style>
:root{--bg:#fafafa;--fg:#1b1b1f;--card:#fff;--muted:#666;--line:#e3e3e8}
@media (prefers-color-scheme:dark){:root{--bg:#121214;--fg:#ececf1;--card:#1d1d21;--muted:#a0a0aa;--line:#2c2c33}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto}
.pair{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:14px 0}
.pair.flagged{border-left:5px solid #b26a00}
h3{margin:0 0 8px;font-size:17px} h3 small{color:var(--muted);font-weight:400}
.row{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.ph{margin:0}.ph img{width:100%;aspect-ratio:958/1080;object-fit:cover;border-radius:6px;display:block;max-height:420px}
.alt{display:inline-block;margin:4px;width:96px}.alt img{width:96px;height:108px;object-fit:cover;border-radius:4px}
.missing{display:flex;align-items:center;justify-content:center;aspect-ratio:958/1080;background:#3332;border-radius:6px}
figcaption{font-size:12px;color:var(--muted);margin-top:4px}
.badge{color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;text-transform:uppercase}
.flags{color:#b26a00;font-size:12px}.src{color:var(--muted);font-size:12px}
.line{margin:10px 0 4px}
video{width:100%;border-radius:8px;background:#000}
.thumbs img{width:32%;margin-right:1%;border-radius:6px}
a{color:#4b6bfb}
@media (max-width:600px){.row{grid-template-columns:1fr}}
</style></head><body><main>
<h1>${esc(pk?.titles?.[0] ?? state.topic)}</h1>
<p>${pairs.length} pairs · format <b>${esc(state.format)}</b> · ${flaggedCount} pair(s) need a look (shown first) · ${state.rejected?.length ?? 0} proposed pair(s) rejected by fact verification</p>
${out.video ? `<video controls preload="metadata" src="${rel(dir, out.video)}"></video>` : ""}
${out.thumbnails?.length ? `<div class="thumbs">${out.thumbnails.map((t) => `<img src="${rel(dir, t)}" alt="">`).join("")}</div>` : ""}
${pk ? `<details open><summary><b>Titles, hook and outro</b></summary><ol>${pk.titles.map((t) => `<li>${esc(t)}</li>`).join("")}</ol><p><b>Hook:</b> ${esc(pk.hook)}</p><p><b>Outro:</b> ${esc(pk.outro)}</p></details>` : ""}
${state.rejected?.length ? `<details><summary>Rejected pairs</summary><ul>${state.rejected.map((r) => `<li>${esc(r.left)} / ${esc(r.right)}: ${esc(r.reason)}</li>`).join("")}</ul></details>` : ""}
${ordered.map((x) => x.html).join("\n")}
</main></body></html>`;
}
