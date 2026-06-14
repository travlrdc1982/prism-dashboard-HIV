import { createClient } from "@supabase/supabase-js";

// Supabase project credentials — MUST be set in Vercel project settings
// (Environment Variables) for every deployment. For local dev create a
// .env.local at the repo root (gitignored). See .env.example.
//
// There is NO fallback. If you forget to set the env vars, the dashboard
// will refuse to boot — preventing silent cross-study data leaks where
// a new study's users get logged into the legacy auth project.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase env vars missing — set VITE_SUPABASE_URL and " +
    "VITE_SUPABASE_ANON_KEY in Vercel project settings (or .env.local " +
    "for local dev). The dashboard will not boot without them."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
