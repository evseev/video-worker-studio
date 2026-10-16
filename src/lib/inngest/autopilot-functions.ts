import { inngest } from "./client";
import { runPipeline, loadState, type StageName } from "@/lib/autopilot/pipeline";
import { projectRunDir, summarizeState } from "@/lib/autopilot/review";
import {
  listEnabledChannels,
  claimNextIdea,
  createAutopilotProject,
  updateAutopilot,
  setPublishResult,
  scheduledSlots,
  AutopilotConfigSchema,
} from "@/lib/autopilot/db";
import { nextPublishSlot } from "@/lib/autopilot/schedule";
import { FORMAT_SLUGS, FORMATS, type FormatSlug } from "@/lib/autopilot/formats";
import { publishToYouTube, isYouTubeUploadConfigured } from "@/lib/youtube/upload";

/**
 * Autopilot (design: docs/superpowers/specs/2026-10-16-autopilot-pipeline-design.md)
 *
 *   cron / "autopilot/run"  → autopilotPlan     : claim backlog idea, create project
 *   "autopilot/produce"     → autopilotProduce  : script → photos → narration, then wait for review
 *   "autopilot/approved"    → autopilotRender   : render → thumbnails → dubs → bundle
 *   "autopilot/rendered"    → autopilotPublish  : pick slot; upload when YouTube upload is enabled
 *
 * Heavy artefacts live on disk under AUTOPILOT_OUT_DIR/projects/<id> (Phase 1 runs on the owner's Mac).
 * Each pipeline stage is its own Inngest step; the pipeline itself resumes from state.json, so a retried
 * step continues where it stopped.
 */

function asFormat(value: string | null | undefined, fallback: FormatSlug): FormatSlug {
  return value && (FORMAT_SLUGS as string[]).includes(value) ? (value as FormatSlug) : fallback;
}

export const autopilotPlan = inngest.createFunction(
  {
    id: "autopilot-plan",
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [{ cron: "TZ=America/New_York 0 6 * * 1-5" }, { event: "autopilot/run" }],
  },
  async ({ event, step }) => {
    const onlyChannel = (event?.data as { channelId?: string } | undefined)?.channelId ?? null;
    const channels = await step.run("list-channels", () => listEnabledChannels());
    const started: string[] = [];
    for (const ch of channels) {
      if (onlyChannel && ch.channel_id !== onlyChannel) continue;
      const cfg = AutopilotConfigSchema.parse(ch.autopilot_config ?? {});
      if (ch.pending_review >= cfg.maxPendingReview) continue;
      const idea = await step.run(`claim-idea-${ch.channel_id}`, () => claimNextIdea(ch.channel_id));
      if (!idea) continue;
      const format = asFormat(idea.format_slug, cfg.defaultFormat);
      const pairs = idea.pair_count ?? (format === "mega" ? FORMATS.mega.defaultPairs : cfg.defaultPairs);
      const projectId = await step.run(`create-project-${ch.channel_id}`, () =>
        createAutopilotProject({ channelId: ch.channel_id, ideaId: idea.id, topic: idea.idea_text, format, musicId: cfg.musicId })
      );
      await step.sendEvent(`produce-${projectId}`, {
        name: "autopilot/produce",
        data: {
          projectId,
          userId: ch.user_id,
          channelId: ch.channel_id,
          topic: idea.idea_text,
          format,
          pairs,
          musicId: cfg.musicId,
          locales: cfg.locales,
          seriesName: idea.series_key ?? cfg.seriesName ?? null,
        },
      });
      started.push(projectId);
    }
    return { started };
  }
);

type ProduceData = {
  projectId: string;
  userId: string;
  channelId: string;
  topic: string;
  format: FormatSlug;
  pairs: number;
  musicId: string;
  locales: string[];
  seriesName?: string | null;
};

function pipelineOpts(d: ProduceData, until: StageName, force: StageName[] = []) {
  return {
    topic: d.topic,
    format: d.format,
    pairs: d.pairs,
    outRoot: "",
    runDir: projectRunDir(d.projectId),
    musicId: d.musicId,
    locales: d.locales,
    seriesName: d.seriesName ?? undefined,
    publishSlot: "5 PM Eastern",
    until,
    force,
    log: (m: string) => console.log(`[autopilot ${d.projectId.slice(0, 8)}] ${m}`),
  };
}

export const autopilotProduce = inngest.createFunction(
  {
    id: "autopilot-produce",
    retries: 2,
    // Pinterest scraping and Soniox (3 concurrent requests) are shared resources.
    concurrency: [{ limit: 1 }, { limit: 1, key: "event.data.userId" }],
    triggers: [{ event: "autopilot/produce" }],
  },
  async ({ event, step }) => {
    const d = event.data as ProduceData;
    const runDir = projectRunDir(d.projectId);
    try {
      for (const stage of ["script", "images", "voice"] as const) {
        await step.run(`stage-${stage}`, async () => {
          const state = await runPipeline(pipelineOpts(d, stage));
          await updateAutopilot({ projectId: d.projectId, runDir, summary: summarizeState(state) });
          return { stage, done: Boolean(state.stages[stage]) };
        });
      }
    } catch (err) {
      await step.run("mark-failed", () => updateAutopilot({ projectId: d.projectId, status: "failed_ai" }));
      throw err;
    }
    await step.run("await-review", async () => {
      const state = loadState(runDir);
      await updateAutopilot({
        projectId: d.projectId,
        status: "awaiting_review",
        reviewStatus: "pending_review",
        runDir,
        summary: state ? summarizeState(state) : undefined,
      });
    });
    return { projectId: d.projectId, runDir };
  }
);

export const autopilotRender = inngest.createFunction(
  {
    id: "autopilot-render",
    retries: 2,
    concurrency: [{ limit: 1 }],
    triggers: [{ event: "autopilot/approved" }],
  },
  async ({ event, step }) => {
    const d = event.data as ProduceData;
    await step.run("mark-rendering", () => updateAutopilot({ projectId: d.projectId, status: "rendering", reviewStatus: "approved" }));
    try {
      // "voice" is a no-op unless review edits cleared it.
      for (const stage of ["voice", "render", "thumbnails", "localize", "bundle", "shorts"] as const) {
        await step.run(`stage-${stage}`, async () => {
          const state = await runPipeline(pipelineOpts(d, stage));
          await updateAutopilot({ projectId: d.projectId, summary: summarizeState(state) });
          return { stage };
        });
      }
    } catch (err) {
      await step.run("mark-failed", () => updateAutopilot({ projectId: d.projectId, status: "failed_render" }));
      throw err;
    }
    await step.run("mark-completed", async () => {
      const base = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
      await setPublishResult({
        projectId: d.projectId,
        videoUrl: `${base}/api/autopilot/${d.projectId}/file?path=bundle/video.mp4`,
        thumbnailUrl: `${base}/api/autopilot/${d.projectId}/file?path=bundle/thumbnail-labels.png`,
      });
      await updateAutopilot({ projectId: d.projectId, status: "completed" });
    });
    await step.sendEvent("rendered", { name: "autopilot/rendered", data: d });
    return { projectId: d.projectId };
  }
);

export const autopilotPublish = inngest.createFunction(
  {
    id: "autopilot-publish",
    retries: 3,
    concurrency: [{ limit: 1, key: "event.data.channelId" }],
    triggers: [{ event: "autopilot/rendered" }],
  },
  async ({ event, step }) => {
    const d = event.data as ProduceData;
    const channels = await step.run("load-config", () => listEnabledChannels());
    const cfg = AutopilotConfigSchema.parse(channels.find((c) => c.channel_id === d.channelId)?.autopilot_config ?? {});
    const slot = await step.run("pick-slot", async () => {
      const taken = await scheduledSlots(d.channelId);
      return nextPublishSlot(taken, cfg).toISOString();
    });

    const uploadable = await step.run("check-upload", () => isYouTubeUploadConfigured(d.channelId));
    if (!uploadable) {
      // Until the Google Cloud project passes the YouTube API audit, uploads stay manual:
      // the review page offers the bundle; the planned slot is recorded for the calendar.
      await step.run("record-planned-slot", () => setPublishResult({ projectId: d.projectId, publishAt: slot }));
      return { projectId: d.projectId, publishAt: slot, uploaded: false };
    }

    const videoId = await step.run("upload", () =>
      publishToYouTube({ channelId: d.channelId, runDir: projectRunDir(d.projectId), publishAt: slot })
    );
    await step.run("record-upload", () => setPublishResult({ projectId: d.projectId, youtubeVideoId: videoId, publishAt: slot }));
    return { projectId: d.projectId, publishAt: slot, uploaded: true, videoId };
  }
);

export const autopilotFunctions = [autopilotPlan, autopilotProduce, autopilotRender, autopilotPublish];
