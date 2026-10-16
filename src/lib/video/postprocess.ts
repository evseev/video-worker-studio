import { runFfmpeg } from "@/lib/media/ffmpeg";

/**
 * Normalise container metadata of a rendered MP4 without re-encoding:
 *  - drop all global/stream metadata written by the renderer (encoder, handler names, tool tags),
 *  - set a clean title and creation time,
 *  - move the moov atom to the front (fast start) for quicker upload processing.
 * Note: YouTube re-encodes every upload and reviews content, not container tags; the real
 * protection against "inauthentic content" is narration, sourced facts and varied videos.
 */
export async function normalizeMp4Metadata(params: {
  input: string;
  output: string;
  title: string;
  creationTime?: Date;
  comment?: string;
}): Promise<void> {
  const created = (params.creationTime ?? new Date()).toISOString();
  await runFfmpeg([
    "-i",
    params.input,
    "-map",
    "0",
    "-c",
    "copy",
    "-map_metadata",
    "-1",
    "-map_chapters",
    "-1",
    "-fflags",
    "+bitexact",
    "-flags:v",
    "+bitexact",
    "-flags:a",
    "+bitexact",
    "-metadata",
    `title=${params.title}`,
    "-metadata",
    `creation_time=${created}`,
    ...(params.comment ? ["-metadata", `comment=${params.comment}`] : []),
    "-metadata:s:v:0",
    "handler_name=VideoHandler",
    "-metadata:s:a:0",
    "handler_name=SoundHandler",
    "-movflags",
    "+faststart",
    params.output,
  ]);
}
