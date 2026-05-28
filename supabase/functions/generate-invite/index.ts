// Supabase Edge Function: generate-invite
//
// Generates a one-time invite link for a client to set their own password,
// WITHOUT relying on Supabase's email delivery. The analyst copies the
// returned URL and distributes it through their own channel (signed email,
// Slack, secure portal, etc.).
//
// Auth: caller must be signed in to this Supabase project AND their email
// must be in ADMIN_EMAILS below. Keep this list in sync with the client-side
// allowlist in src/data/admins.js.
//
// Link expiry is controlled by the project's auth config
// (Authentication → Email Templates → "Invite expiry" — bump to 604800
// seconds = 7 days).

import { createClient } from "jsr:@supabase/supabase-js@2";

const ADMIN_EMAILS = [
  "bdumont@reservoircg.com",
  "jholdsworth@reservoircg.com",
  "vudani@reservoircg.com",
  "bryangeorgedumont@gmail.com",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const ADMIN_SET = new Set(ADMIN_EMAILS.map(s => s.trim().toLowerCase()));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller identity using their JWT.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user?.email) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: jsonHeaders });
    }

    if (!ADMIN_SET.has(user.email.toLowerCase())) {
      return new Response(JSON.stringify({ error: "Not authorized: " + user.email }), { status: 403, headers: jsonHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const email = (body?.email ?? "").trim().toLowerCase();
    const redirectTo = body?.redirectTo ?? "https://hiv.rcghealthprism.app";
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), { status: 400, headers: jsonHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Use 'invite' for new users, 'magiclink' for users that already exist
    // and just need a new link.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });

    if (error) {
      // If already exists, fall back to a magiclink so we can still generate
      // an access URL for them.
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exist")) {
        const { data: mlData, error: mlErr } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo },
        });
        if (mlErr) {
          return new Response(JSON.stringify({ error: mlErr.message }), { status: 400, headers: jsonHeaders });
        }
        return new Response(JSON.stringify({
          link: mlData?.properties?.action_link,
          kind: "magiclink",
          email,
        }), { headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({
      link: data?.properties?.action_link,
      kind: "invite",
      email,
    }), { headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: jsonHeaders });
  }
});
