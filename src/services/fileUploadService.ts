import crypto from "crypto";
import path from "path";
import { supabase, SUPABASE_BUCKET } from "../config/supabaseClient.js";

interface UploadResult {
  url: string;
  storagePath: string;
}

export const uploadFileToSupabase = async (
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<UploadResult> => {
  const extension = path.extname(originalName);
  const storagePath = `${crypto.randomUUID()}${extension}`;

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(storagePath);

  return { url: data.publicUrl, storagePath };
};

export const deleteFileFromSupabase = async (
  storagePath: string,
): Promise<void> => {
  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error(
      `Failed to delete "${storagePath}" from Supabase storage: ${error.message}`,
    );
  }
};
