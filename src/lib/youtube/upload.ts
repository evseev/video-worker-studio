import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { autopilotDb } from "@/lib/autopilot/db";
import { loadState } from "@/lib/autopilot/pipeline";
import { runFfmpeg } from "@/lib/media/ffmpeg";
import { isYouTubeOAuthConfigured, refreshAccessToken } from "./oauth";

/**
 * YouTube Data API v3 publishing with plain fetch (no googleapis dependency).
 * Videos are uploaded as private with status.publishAt, so YouTube publishes them on schedule.
 * IMPORTANT: uploads from an unaudited Google Cloud project are locked private forever;
 * keep youtube_connections.upload_enabled = false until the API audit has passed.
 */

const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3";
const CHUNK = 16 * 1024 * 1024; // multiple of 256 KiB, as resumable uploads require

const ConnectionSchema = z
  .object({
    channel_id: z.string(),
    youtube_channel_id: z.string().nullable(),
    refresh_token: z.string(),
    access_token: z.string().nullable(),
    access_token_expires_at: z.string().nullable(),
    upload_enabled: z.boolean(),
    scopes: z.array(z.string()).nullable(),
  })
  .nullable();

async function getConnection(channelId: string) {
  const { data, error } = await autopilotDb().rpc("worker_get_youtube_connection", { p_channel_id: channelId });
  if (error) throw new Error(`worker_get_youtube_connection failed: ${error.message}`);
  return ConnectionSchema.parse(data);
}

export async function isYouTubeUploadConfigured(channelId: string): Promise<boolean> {
  if (!isYouTubeOAuthConfigured()) return false;
  try {
    const c = await getConnection(channelId);
    return Boolean(c?.upload_enabled && c.refresh_token);
  } catch {
    return false;
  }
}

async function accessToken(channelId: string): Promise<string> {
  const c = await getConnection(channelId);
  if (!c) throw new Error("YouTube is not connected for this channel");
  if (c.access_token && c.access_token_expires_at && Date.parse(c.access_token_expires_at) > Date.now() + 120_000) {
    return c.access_token;
  }
  const t = await refreshAccessToken(c.refresh_token);
  const { error } = await autopilotDb().rpc("worker_save_youtube_tokens", {
    p_channel_id: channelId,
    p_youtube_channel_id: c.youtube_channel_id,
    p_refresh_token: t.refresh_token ?? "",
    p_access_token: t.access_token,
    p_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    p_scopes: (t.scope ?? "").split(" ").filter(Boolean),
  });
  if (error) throw new Error(`worker_save_youtube_tokens failed: ${error.message}`);
  return t.access_token;
}

export interface VideoResource {
  snippet: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    defaultLanguage: string;
    defaultAudioLanguage: string;
  };
  status: {
    privacyStatus: "private";
    publishAt?: string;
    selfDeclaredMadeForKids: false;
    containsSyntheticMedia: boolean;
    embeddable: true;
  };
  localizations?: Record<string, { title: string; description: string }>;
}

/** Build the videos.insert body. Pure, exported for tests. */
export function buildVideoResource(params: {
  title: string;
  description: string;
  tags: string[];
  publishAt?: string | null;
  localizations?: Record<string, { title: string; description: string }>;
}): VideoResource {
  // YouTube limits: title ≤ 100 chars, description ≤ 5000 bytes, tags ≤ 500 chars in total.
  const tags: string[] = [];
  let total = 0;
  for (const t of params.tags.map((x) => x.replace(/[<>]/g, "").trim()).filter(Boolean)) {
    const cost = t.length + (t.includes(" ") ? 2 : 0) + 1;
    if (total + cost > 480) break;
    tags.push(t);
    total += cost;
  }
  const clip = (s: string, n: number) => (Buffer.byteLength(s) <= n ? s : Buffer.from(s).subarray(0, n).toString().replace(/�+$/, ""));
  const localizations = params.localizations
    ? Object.fromEntries(
        Object.entries(params.localizations)
          .filter(([, v]) => v.title && v.description)
          .map(([k, v]) => [k, { title: v.title.replace(/[<>]/g, "").slice(0, 100), description: clip(v.description.replace(/[<>]/g, ""), 4900) }])
      )
    : undefined;
  return {
    snippet: {
      title: params.title.replace(/[<>]/g, "").slice(0, 100),
      description: clip(params.description.replace(/[<>]/g, ""), 4900),
      tags,
      categoryId: "24", // Entertainment
      defaultLanguage: "en",
      defaultAudioLanguage: "en",
    },
    status: {
      privacyStatus: "private",
      ...(params.publishAt ? { publishAt: params.publishAt } : {}),
      selfDeclaredMadeForKids: false,
      // Real photos + synthetic narration voice of a fictional narrator: not "realistic altered content".
      containsSyntheticMedia: false,
      embeddable: true,
    },
    ...(localizations && Object.keys(localizations).length ? { localizations } : {}),
  };
}

async function resumableUpload(token: string, file: string, resource: VideoResource): Promise<string> {
  const size = fs.statSync(file).size;
  const parts = ["snippet", "status", ...(resource.localizations ? ["localizations"] : [])].join(",");
  const init = await fetch(`${UPLOAD}/videos?uploadType=resumable&part=${parts}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(size),
      "X-Upload-Content-Type": "video/mp4",
    },
    body: JSON.stringify(resource),
  });
  if (!init.ok) throw new Error(`videos.insert init ${init.status}: ${(await init.text()).slice(0, 300)}`);
  const location = init.headers.get("location");
  if (!location) throw new Error("videos.insert: no upload session URL");

  const fd = await fs.promises.open(file, "r");
  try {
    let offset = 0;
    while (offset < size) {
      const len = Math.min(CHUNK, size - offset);
      const buf = Buffer.alloc(len);
      await fd.read(buf, 0, len, offset);
      const res = await fetch(location, {
        method: "PUT",
        headers: { "Content-Length": String(len), "Content-Range": `bytes ${offset}-${offset + len - 1}/${size}` },
        body: buf,
      });
      if (res.status === 308) {
        const range = res.headers.get("range");
        offset = range ? Number(range.split("-")[1]) + 1 : offset + len;
        continue;
      }
      if (!res.ok) throw new Error(`upload chunk ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const body = (await res.json()) as { id?: string };
      if (!body.id) throw new Error("upload finished without a video id");
      return body.id;
    }
  } finally {
    await fd.close();
  }
  throw new Error("upload ended unexpectedly");
}

async function setThumbnail(token: string, videoId: string, png: string, workDir: string): Promise<void> {
  // thumbnails.set requires < 2 MB; convert to a high-quality JPEG.
  const jpg = path.join(workDir, "thumbnail-upload.jpg");
  await runFfmpeg(["-i", png, "-q:v", "3", jpg]);
  const res = await fetch(`${UPLOAD}/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
    body: await fs.promises.readFile(jpg),
  });
  if (!res.ok) throw new Error(`thumbnails.set ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function insertCaption(token: string, videoId: string, language: string, name: string, srt: string): Promise<void> {
  const boundary = `vws${Date.now().toString(36)}`;
  const meta = JSON.stringify({ snippet: { videoId, language, name, isDraft: false } });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    await fs.promises.readFile(srt),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await fetch(`${UPLOAD}/captions?uploadType=multipart&part=snippet`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`captions.insert ${language} ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/**
 * Upload the bundle of an approved autopilot run. Returns the YouTube video id.
 * Multi-language AUDIO tracks have no public API and stay a Studio step (bundle checklist).
 */
export async function publishToYouTube(params: { channelId: string; runDir: string; publishAt: string | null }): Promise<string> {
  const state = loadState(params.runDir);
  if (!state?.packaging || !state.outputs?.video) throw new Error("Run is not rendered yet");
  const bundle = path.join(params.runDir, "bundle");
  const metadata = fs.existsSync(path.join(bundle, "chapters.txt")) ? fs.readFileSync(path.join(bundle, "chapters.txt"), "utf8") : "";
  const description = [state.packaging.description.trim(), metadata ? `\nChapters:\n${metadata}` : ""].join("\n");
  const token = await accessToken(params.channelId);
  const resource = buildVideoResource({
    title: state.packaging.titles[0],
    description,
    tags: state.packaging.tags,
    publishAt: params.publishAt,
    localizations: Object.fromEntries(Object.entries(state.dubs ?? {}).map(([loc, d]) => [loc, { title: d.title, description: d.description }])),
  });
  const videoId = await resumableUpload(token, state.outputs.video, resource);
  const thumb = path.join(bundle, "thumbnail-labels.png");
  if (fs.existsSync(thumb)) await setThumbnail(token, videoId, thumb, path.join(params.runDir, "work"));
  for (const [lang, name] of [["en", "English"], ["pt-BR", "Português (Brasil)"], ["es", "Español"]] as const) {
    const srt = path.join(bundle, `captions.${lang}.srt`);
    if (fs.existsSync(srt)) await insertCaption(token, videoId, lang, name, srt);
  }
  return videoId;
}

export { API as YOUTUBE_API_BASE };
