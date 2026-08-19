import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY as string;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "uploads";
