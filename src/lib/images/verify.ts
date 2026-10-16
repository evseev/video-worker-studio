import { spawn } from "child_process";
import * as path from "path";
import { z } from "zod";
import type { FaceAnalysis } from "./types";

const FaceAnalysisSchema = z.object({
  path: z.string(),
  ok: z.boolean(),
  error: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  faceCount: z.number().optional(),
  faceBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().optional(),
  faceScore: z.number().nullable().optional(),
  faceAreaRatio: z.number().optional(),
  blur: z.number().optional(),
  dhash: z.string().optional(),
  refSimilarity: z.number().nullable().optional(),
  consensusSimilarity: z.number().nullable().optional(),
});

const ResponseSchema = z.object({
  references: z.array(z.object({ path: z.string(), ok: z.boolean(), faceCount: z.number() })),
  candidates: z.array(FaceAnalysisSchema),
});

export type FaceMatchResponse = z.infer<typeof ResponseSchema>;

/**
 * Resolve the face-match command. FACE_MATCH_BIN may be
 * "/path/python /path/face_match.py" (space separated); defaults to the repo venv.
 */
export function resolveFaceMatchCommand(cwd = process.cwd()): { cmd: string; args: string[] } {
  const configured = process.env.FACE_MATCH_BIN?.trim();
  if (configured) {
    const [cmd, ...args] = configured.split(/\s+/);
    return { cmd, args };
  }
  const dir = path.join(cwd, "scripts", "face-match");
  return { cmd: path.join(dir, ".venv", "bin", "python"), args: [path.join(dir, "face_match.py")] };
}

/** Run face analysis for candidates against reference photos of the same person. */
export async function analyzeFaces(
  references: string[],
  candidates: string[],
  opts: { timeoutMs?: number } = {}
): Promise<FaceMatchResponse> {
  if (candidates.length === 0) return { references: [], candidates: [] };
  const { cmd, args } = resolveFaceMatchCommand();
  const payload = JSON.stringify({ references, candidates });
  return await new Promise<FaceMatchResponse>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("face-match timed out"));
    }, opts.timeoutMs ?? 180_000);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`face-match exited ${code}: ${stderr.slice(0, 500)}`));
        return;
      }
      try {
        resolve(ResponseSchema.parse(JSON.parse(stdout)));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    child.stdin.end(payload);
  });
}

export function toFaceAnalysis(c: z.infer<typeof FaceAnalysisSchema>): FaceAnalysis {
  return { ...c, faceBox: c.faceBox ?? null };
}
