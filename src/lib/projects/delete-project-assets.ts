import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const RENDERS_OBJECT_PREFIX = "videos/";

function setAwsCredentialAliases(): void {
  if (!process.env.AWS_ACCESS_KEY_ID && process.env.REMOTION_AWS_ACCESS_KEY_ID) {
    process.env.AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID;
  }
  if (!process.env.AWS_SECRET_ACCESS_KEY && process.env.REMOTION_AWS_SECRET_ACCESS_KEY) {
    process.env.AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
  }
  if (!process.env.AWS_SESSION_TOKEN && process.env.REMOTION_AWS_SESSION_TOKEN) {
    process.env.AWS_SESSION_TOKEN = process.env.REMOTION_AWS_SESSION_TOKEN;
  }
}

/**
 * Parse bucket + object key from common public S3 HTTPS URL shapes
 * (path-style, virtual-hosted regional, dualstack, legacy global).
 * Returns null if the URL is not a recognized S3 object URL.
 */
function parseS3PublicUrl(urlStr: string): { bucket: string; key: string } | null {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }

  let pathname = url.pathname.replace(/^\/+/, "");
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    /* keep percent-encoded path */
  }
  if (!pathname) {
    return null;
  }

  const host = url.hostname.toLowerCase();

  // Path-style: s3.<region>.amazonaws.com/<bucket>/<key> or s3.amazonaws.com/...
  if (host.startsWith("s3.") || host === "s3.amazonaws.com") {
    const slash = pathname.indexOf("/");
    if (slash <= 0) {
      return null;
    }
    const bucket = pathname.slice(0, slash);
    const key = pathname.slice(slash + 1);
    if (!bucket || !key) {
      return null;
    }
    return { bucket, key };
  }

  // Virtual-hosted dualstack: <bucket>.s3.dualstack.<region>.amazonaws.com/<key>
  const dualstack = /^([^.]+)\.s3\.dualstack\.([a-z0-9-]+)\.amazonaws\.com$/i.exec(
    host
  );
  if (dualstack) {
    return { bucket: dualstack[1], key: pathname };
  }

  // Virtual-hosted regional: <bucket>.s3.<region>.amazonaws.com/<key>
  const regional = /^([^.]+)\.s3\.([a-z0-9-]+)\.amazonaws\.com$/i.exec(host);
  if (regional) {
    return { bucket: regional[1], key: pathname };
  }

  // Legacy global: <bucket>.s3.amazonaws.com/<key>
  const legacy = /^([^.]+)\.s3\.amazonaws\.com$/i.exec(host);
  if (legacy) {
    return { bucket: legacy[1], key: pathname };
  }

  return null;
}

function isSupabaseRendersStorageUrl(urlStr: string): boolean {
  try {
    const p = new URL(urlStr).pathname;
    return (
      p.includes("/storage/v1/object/public/renders/") ||
      p.includes("/storage/v1/object/sign/renders/")
    );
  } catch {
    return false;
  }
}

function expectedRenderKey(projectId: string): string {
  return `${RENDERS_OBJECT_PREFIX}${projectId}.mp4`;
}

async function removeLocalProjectAssets(projectId: string, warnings: string[]): Promise<void> {
  // Keep TMP_ASSETS_PATH relative to the app root (e.g. public/tmp_assets). Absolute or
  // traversal-heavy values are an operator misconfiguration risk with path.join.
  const assetPath = process.env.TMP_ASSETS_PATH || "public/tmp_assets";
  const dir = path.join(process.cwd(), assetPath, "vws-assets", projectId);
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch (err) {
    warnings.push(
      `Local assets: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function removeLocalRenderTemp(projectId: string, warnings: string[]): Promise<void> {
  const file = path.join(os.tmpdir(), "vws-renders", `${projectId}.mp4`);
  try {
    await fs.promises.rm(file, { force: true });
  } catch (err) {
    warnings.push(
      `Local render temp: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function removeLocalRenderPublic(projectId: string, warnings: string[]): Promise<void> {
  const file = path.join(process.cwd(), "public", "local_renders", `${projectId}.mp4`);
  try {
    await fs.promises.rm(file, { force: true });
  } catch (err) {
    warnings.push(
      `Local render public: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function removeSupabaseRender(projectId: string, warnings: string[]): Promise<void> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    warnings.push("Supabase storage: SUPABASE_SERVICE_ROLE_KEY not set; skipped render file delete");
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    warnings.push("Supabase storage: NEXT_PUBLIC_SUPABASE_URL not set; skipped render file delete");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const objectPath = expectedRenderKey(projectId);

  const { error } = await supabase.storage.from("renders").remove([objectPath]);
  if (error) {
    warnings.push(`Supabase storage: ${error.message}`);
  }
}

async function removeLambdaS3Render(
  projectId: string,
  videoUrl: string | null,
  warnings: string[]
): Promise<void> {
  if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) {
    return;
  }

  const location = parseS3PublicUrl(videoUrl);
  if (!location) {
    if (
      /^https?:\/\//i.test(videoUrl) &&
      !isSupabaseRendersStorageUrl(videoUrl)
    ) {
      warnings.push(
        "Remote video: URL is not a recognized S3 or Supabase public shape; object may remain in storage (e.g. CloudFront or custom domain)."
      );
    }
    return;
  }

  const expectedKey = expectedRenderKey(projectId);
  if (location.key !== expectedKey) {
    if (/^https?:\/\//i.test(videoUrl) && !isSupabaseRendersStorageUrl(videoUrl)) {
      warnings.push(
        "Remote video: S3 object key does not match expected render path; skipped delete to avoid removing the wrong object."
      );
    }
    return;
  }

  const allowedBucket = process.env.REMOTION_OUTPUT_BUCKET?.trim();
  if (allowedBucket && location.bucket !== allowedBucket) {
    warnings.push(
      "S3: output URL bucket does not match REMOTION_OUTPUT_BUCKET; skipped object delete"
    );
    return;
  }

  setAwsCredentialAliases();
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    warnings.push("S3: AWS credentials not configured; skipped Lambda output delete");
    return;
  }

  const region =
    process.env.REMOTION_AWS_REGION ??
    process.env.AWS_REGION ??
    process.env.REMOTION_AWS_DEFAULT_REGION;
  if (!region) {
    warnings.push("S3: REMOTION_AWS_REGION or AWS_REGION not set; skipped Lambda output delete");
    return;
  }

  try {
    const client = new S3Client({ region });
    await client.send(
      new DeleteObjectCommand({
        Bucket: location.bucket,
        Key: location.key,
      })
    );
  } catch (err) {
    warnings.push(`S3: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Best-effort removal of all artifacts for a project (disk, Supabase renders bucket, Lambda S3 output).
 * Never throws; accumulates human-readable warnings for partial failures.
 */
export async function deleteProjectAssets(
  projectId: string,
  videoUrl: string | null
): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];

  await removeLocalProjectAssets(projectId, warnings);
  await removeLocalRenderTemp(projectId, warnings);
  await removeLocalRenderPublic(projectId, warnings);
  await removeSupabaseRender(projectId, warnings);
  await removeLambdaS3Render(projectId, videoUrl, warnings);

  return { warnings };
}
