"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DraggableImage } from "@/components/DraggableImage";
import type { ReviewModel, ReviewPair, ReviewPhoto } from "@/lib/autopilot/review-model";
import type { ReviewEdits } from "@/lib/autopilot/review";

type PairEdit = ReviewEdits["pairs"][number];

const BADGE: Record<ReviewPhoto["confidence"], string> = {
  high: "bg-emerald-500/20 text-emerald-300",
  medium: "bg-amber-500/20 text-amber-300",
  low: "bg-red-500/20 text-red-300",
};

function Badge({ photo }: { photo: ReviewPhoto | null }) {
  if (!photo) return <span className="rounded px-1.5 py-0.5 text-[10px] uppercase bg-red-500/20 text-red-300">no photo</span>;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${BADGE[photo.confidence]}`}>
      {photo.confidence} · {photo.identityScore.toFixed(2)}
    </span>
  );
}

function Side(props: {
  label: string;
  name: string;
  source: string;
  photo: ReviewPhoto | null;
  alternatives: ReviewPhoto[];
  position?: string;
  onPosition: (pos: string) => void;
  onAlternative: (index: number) => void;
}) {
  const { photo } = props;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-zinc-300">
          {props.label} · <a className="underline decoration-zinc-600 hover:text-white" href={props.source} target="_blank" rel="noreferrer">{props.name}</a>
        </span>
        <Badge photo={photo} />
      </div>
      <DraggableImage
        src={photo?.url ?? ""}
        alt={props.name}
        objectPosition={props.position ?? photo?.objectPosition}
        onPositionChange={props.onPosition}
        className="aspect-[958/1080] w-full overflow-hidden rounded-lg bg-zinc-900"
      />
      {photo && photo.flags.length > 0 && <p className="text-[11px] text-amber-300/80">{photo.flags.join(" · ")}</p>}
      {props.alternatives.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {props.alternatives.map((alt, i) => (
            <button
              key={alt.url}
              type="button"
              onClick={() => props.onAlternative(i)}
              className="relative h-16 w-14 overflow-hidden rounded border border-white/10 hover:border-violet-400"
              title={`Use this photo (${alt.confidence}, ${alt.identityScore.toFixed(2)})`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- owner-only API file, not optimisable */}
              <img src={alt.url} alt="" className="h-full w-full object-cover" />
              <span className={`absolute bottom-0 left-0 right-0 text-center text-[9px] uppercase ${BADGE[alt.confidence]}`}>{alt.confidence}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PairCard({ pair, edit, onEdit }: { pair: ReviewPair; edit: PairEdit | undefined; onEdit: (e: Partial<PairEdit>) => void }) {
  const removed = edit?.remove === true;
  return (
    <section
      className={`rounded-2xl border p-4 ${pair.needsAttention ? "border-amber-500/40 bg-amber-500/[0.03]" : "border-white/[0.06] bg-white/[0.02]"} ${removed ? "opacity-40" : ""}`}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">
          #{pair.index + 1} {pair.caption}
          <span className="ml-2 font-normal text-zinc-500">{pair.leftLabel} / {pair.rightLabel} · {pair.relation}</span>
        </h3>
        <button
          type="button"
          onClick={() => onEdit({ remove: !removed })}
          className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5"
        >
          {removed ? "Keep pair" : "Remove pair"}
        </button>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Side
          label={pair.leftLabel}
          name={pair.leftName}
          source={pair.leftSource}
          photo={pair.left}
          alternatives={pair.leftAlternatives}
          position={edit?.leftObjectPosition}
          onPosition={(p) => onEdit({ leftObjectPosition: p })}
          onAlternative={(i) => onEdit({ leftAlternative: i, leftObjectPosition: undefined })}
        />
        <Side
          label={pair.rightLabel}
          name={pair.rightName}
          source={pair.rightSource}
          photo={pair.right}
          alternatives={pair.rightAlternatives}
          position={edit?.rightObjectPosition}
          onPosition={(p) => onEdit({ rightObjectPosition: p })}
          onAlternative={(i) => onEdit({ rightAlternative: i, rightObjectPosition: undefined })}
        />
      </div>
      <label className="mt-3 block">
        <span className="text-xs text-zinc-400">
          Narration <span className="text-zinc-600">({pair.narrationSource})</span>
        </span>
        <textarea
          className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 p-2 text-sm text-zinc-100"
          rows={2}
          defaultValue={pair.scriptText}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== pair.scriptText) onEdit({ scriptText: v });
          }}
        />
      </label>
      {pair.problems.length > 0 && <p className="mt-1 text-[11px] text-amber-300/80">Fact check: {pair.problems.join("; ")}</p>}
    </section>
  );
}

export function ReviewClient({ projectId }: { projectId: string }) {
  const [model, setModel] = useState<ReviewModel | null>(null);
  const [edits, setEdits] = useState<Record<number, PairEdit>>({});
  const [titleIndex, setTitleIndex] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState<"save" | "approve" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/autopilot/${projectId}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({ error: "Failed to load" }));
        if (cancelled) return;
        if (res.ok) setModel(body as ReviewModel);
        else setMessage(body.error ?? "Failed to load");
      })
      .catch(() => !cancelled && setMessage("Failed to load"));
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  const ordered = useMemo(
    () => (model ? [...model.pairs].sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention) || a.index - b.index) : []),
    [model]
  );

  const payload = (): ReviewEdits => ({
    pairs: Object.values(edits),
    ...(titleIndex !== undefined ? { titleIndex } : {}),
  });

  const save = async () => {
    setBusy("save");
    const res = await fetch(`/api/autopilot/${projectId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) return setMessage(body.error ?? "Save failed");
    setEdits({});
    setTitleIndex(undefined);
    setModel(body.review);
    setMessage(body.rerun?.includes("voice") ? "Saved. Narration changes will be re-voiced at render." : "Saved.");
  };

  const approve = async () => {
    setBusy("approve");
    const res = await fetch(`/api/autopilot/${projectId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ edits: payload() }) });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) return setMessage(body.error ?? "Approve failed");
    setMessage("Approved. Rendering, dubbing and bundling run in the background; this page shows the downloads when done.");
    setEdits({});
    reload();
  };

  if (!model) return <main className="mx-auto max-w-5xl p-6 text-zinc-400">{message ?? "Loading…"}</main>;
  const attention = model.pairs.filter((p) => p.needsAttention).length;
  const pending = model.reviewStatus === "pending_review";

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 text-zinc-100">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-wider text-violet-300">Autopilot review</p>
        <h1 className="mt-1 text-xl font-semibold">{model.titles[titleIndex ?? 0] ?? model.topic}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {model.pairs.length} pairs · {model.durationSec ? `${(model.durationSec / 60).toFixed(1)} min` : "length pending"} ·{" "}
          {attention > 0 ? <span className="text-amber-300">{attention} need a look (shown first)</span> : "all photos verified"} ·{" "}
          {model.rejected.length} proposed pairs rejected by fact checks
        </p>
      </header>

      {model.videoUrl && (
        <video src={model.videoUrl} controls className="mb-5 aspect-video w-full rounded-2xl border border-white/[0.06] bg-black" />
      )}
      {model.bundle.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {model.bundle.map((f) => (
            <a key={f.name} href={f.url} className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/5">
              {f.name}
            </a>
          ))}
        </div>
      )}

      <section className="mb-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h2 className="mb-2 text-sm font-semibold">Title</h2>
        <div className="flex flex-col gap-1">
          {model.titles.map((t, i) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input type="radio" name="title" checked={(titleIndex ?? 0) === i} onChange={() => setTitleIndex(i)} disabled={!pending} />
              {t}
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-400"><b className="text-zinc-300">Hook:</b> {model.hook}</p>
        <p className="mt-1 text-xs text-zinc-400"><b className="text-zinc-300">Outro:</b> {model.outro}</p>
      </section>

      <div className="flex flex-col gap-4">
        {ordered.map((pair) => (
          <PairCard
            key={pair.index}
            pair={pair}
            edit={edits[pair.index]}
            onEdit={(e) => setEdits((prev) => ({ ...prev, [pair.index]: { ...prev[pair.index], ...e, index: pair.index } }))}
          />
        ))}
      </div>

      {pending && (
        <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 bg-zinc-950/95 py-3 backdrop-blur">
          <button type="button" onClick={save} disabled={busy !== null} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50">
            {busy === "save" ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={approve} disabled={busy !== null} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
            {busy === "approve" ? "Approving…" : "Approve & render"}
          </button>
          {message && <span className="text-xs text-zinc-400">{message}</span>}
        </div>
      )}
      {!pending && message && <p className="mt-4 text-sm text-zinc-400">{message}</p>}
    </main>
  );
}
