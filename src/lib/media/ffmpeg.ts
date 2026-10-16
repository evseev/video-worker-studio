import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const FFMPEG_BIN = process.env.FFMPEG_BIN ?? "ffmpeg";
export const FFPROBE_BIN = process.env.FFPROBE_BIN ?? "ffprobe";

/** Media duration in seconds (audio or video). */
export async function probeDuration(file: string): Promise<number> {
  const { stdout } = await execFileAsync(FFPROBE_BIN, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const value = Number(stdout.trim());
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Could not read duration of ${file}`);
  return value;
}

export async function runFfmpeg(args: string[], timeoutMs = 10 * 60_000): Promise<void> {
  await execFileAsync(FFMPEG_BIN, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
}
