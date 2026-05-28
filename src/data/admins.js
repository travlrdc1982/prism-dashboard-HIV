// Client-side admin allowlist. Used ONLY to gate the /admin UI — the actual
// security check is server-side in the generate-invite edge function (which
// reads its own ADMIN_EMAILS env var).
//
// To add an admin: append their email to ADMIN_EMAILS below, AND set the
// matching ADMIN_EMAILS secret on the edge function:
//
//   supabase secrets set ADMIN_EMAILS="new@x.com,a@x.com,b@x.com"
//
// Or via the MCP tool. Keep the two lists in sync.

export const ADMIN_EMAILS = [
  "bdumont@reservoircg.com",
  "jholdsworth@reservoircg.com",
  "vudani@reservoircg.com",
  "bryangeorgedumont@gmail.com",
];

export function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
}
