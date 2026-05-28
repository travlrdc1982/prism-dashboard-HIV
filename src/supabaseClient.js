import { createClient } from "@supabase/supabase-js";

// Supabase project credentials — set in Vercel project settings (Environment
// Variables) for production. For local dev create a .env.local at the repo
// root (gitignored). See .env.example.
//
// The fallback values below point at the legacy `prism-dashboard-al-auth`
// project — kept ONLY so local dev still boots if .env.local isn't set up.
// Production MUST set the env vars to the dedicated HIV project so client
// users are isolated from other studies that share the legacy project.

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://zviodrqsrawcxtqcorst.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2aW9kcnFzcmF3Y3h0cWNvcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY0NzcsImV4cCI6MjA5MTAwMjQ3N30.uozcjlP1svArOnK1vawDylA1uEa6Jp0tcdrCqsZgBUE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
