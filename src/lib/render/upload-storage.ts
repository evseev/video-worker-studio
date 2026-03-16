import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

/**
 * Uploads a rendered video to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToStorage(
  filePath: string,
  projectId: string
): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fileBuffer = await fs.promises.readFile(filePath);
  const storagePath = `videos/${projectId}.mp4`;

  const { error: uploadError } = await supabase.storage
    .from("renders")
    .upload(storagePath, fileBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from("renders")
    .getPublicUrl(storagePath);

  return data.publicUrl;
}
