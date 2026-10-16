import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedAutopilotProject } from "@/lib/autopilot/access";
import { applyReviewEdits, ReviewEditsSchema } from "@/lib/autopilot/review";
import { loadState, saveState } from "@/lib/autopilot/pipeline";
import { toReviewModel } from "@/lib/autopilot/review-model";
import { inngest } from "@/lib/inngest/client";

async function load(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const project = await getOwnedAutopilotProject(supabase, user.id, id);
  if (!project) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  const state = loadState(project.runDir);
  if (!state) return { error: NextResponse.json({ error: "Run state missing" }, { status: 409 }) } as const;
  return { user, project, state } as const;
}

/** Review model (relative file paths only) for the review page. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await load((await params).id);
  if ("error" in r) return r.error;
  return NextResponse.json(toReviewModel(r.project.id, r.project.runDir, r.state, r.project.review_status, r.project.status));
}

/** Save review edits (photo swaps, crop, narration, title). Allowed only while awaiting review. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await load((await params).id);
  if ("error" in r) return r.error;
  if (r.project.review_status !== "pending_review") {
    return NextResponse.json({ error: "This video is no longer waiting for review" }, { status: 409 });
  }
  const parsed = ReviewEditsSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid edits", issues: parsed.error.issues }, { status: 400 });
  const { state, rerun } = applyReviewEdits(r.state, parsed.data);
  saveState(r.project.runDir, state);
  return NextResponse.json({ ok: true, rerun, review: toReviewModel(r.project.id, r.project.runDir, state, r.project.review_status, r.project.status) });
}

/** Approve: optionally apply final edits, then queue render → dubs → bundle → publish. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await load((await params).id);
  if ("error" in r) return r.error;
  // Approve while awaiting review, or retry after a failed render.
  const retry = r.project.status === "failed_render";
  if (r.project.review_status !== "pending_review" && !retry) {
    return NextResponse.json({ error: "This video is no longer waiting for review" }, { status: 409 });
  }
  const body = await req.json().catch(() => ({}));
  let state = r.state;
  if (body && typeof body === "object" && "edits" in body) {
    const parsed = ReviewEditsSchema.safeParse((body as { edits: unknown }).edits);
    if (!parsed.success) return NextResponse.json({ error: "Invalid edits", issues: parsed.error.issues }, { status: 400 });
    state = applyReviewEdits(state, parsed.data).state;
    saveState(r.project.runDir, state);
  }
  await inngest.send({
    // Dedupes double-clicks within the same minute; a later retry gets a new id.
    id: `autopilot-approved-${r.project.id}-${Math.floor(Date.now() / 60_000)}`,
    name: "autopilot/approved",
    data: {
      projectId: r.project.id,
      userId: r.user.id,
      channelId: r.project.channel_id,
      topic: state.topic,
      format: state.format,
      pairs: state.pairsTarget,
      musicId: state.musicId,
      locales: state.locales,
    },
  });
  return NextResponse.json({ ok: true });
}
