import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { isAdminEmail } from "../data/admins";
import { C, FONT } from "../data/theme";

// Admin page — generates one-time invite URLs that the analyst then sends to
// clients through their own channel (no Supabase email delivery involved).

export default function Admin() {
  const [me, setMe] = useState(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);   // { link, kind, email }
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data?.user ?? null));
  }, []);

  if (me && !isAdminEmail(me.email)) {
    return (
      <div style={{ padding: 24, color: C.text, fontFamily: FONT }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Not authorized</h2>
        <p style={{ fontSize: 12, color: C.textMuted }}>
          Your account ({me.email}) is not on the admin allowlist for this dashboard.
        </p>
      </div>
    );
  }

  async function generate(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setCopied(false);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }
      const { data, error: invokeErr } = await supabase.functions.invoke("generate-invite", {
        body: { email, redirectTo: window.location.origin },
      });
      if (invokeErr) {
        setError(invokeErr.message || "Failed to generate link");
      } else if (data?.error) {
        setError(data.error);
      } else if (data?.link) {
        setResult(data);
      } else {
        setError("No link returned.");
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!result?.link) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ maxWidth: 720, color: C.text, fontFamily: FONT }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 4 }}>
        Invite a user
      </h1>
      <p style={{ fontSize: 12, color: C.textMuted, marginTop: 0, marginBottom: 20, lineHeight: 1.5 }}>
        Generates a one-time sign-in link. Copy it and send to the client through
        your own channel (signed email, secure portal, etc.). Link is valid for
        up to 7 days, depending on the project's auth config.
      </p>

      <form onSubmit={generate} style={{
        background: C.card, border: `1px solid ${C.cardBorder}`,
        borderRadius: 8, padding: 20, marginBottom: 20,
      }}>
        <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: C.textMuted, letterSpacing: 1, marginBottom: 6 }}>
          CLIENT EMAIL
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="client@company.com"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 6,
            border: `1px solid ${C.cardBorder}`, background: C.bg, color: C.text,
            fontSize: 13, fontFamily: FONT, outline: "none", boxSizing: "border-box",
          }}
        />
        <button type="submit" disabled={loading} style={{
          marginTop: 14, padding: "10px 20px", borderRadius: 6, border: "none",
          background: loading ? "#334155" : "#3b82f6", color: "#fff",
          fontSize: 11, fontWeight: 700, cursor: loading ? "default" : "pointer",
          fontFamily: FONT, letterSpacing: 0.5,
        }}>
          {loading ? "GENERATING..." : "GENERATE INVITE LINK"}
        </button>
      </form>

      {error && (
        <div style={{
          padding: "10px 14px", background: "#1f1318", color: "#ef4444",
          borderRadius: 6, fontSize: 12, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{
          background: C.card, border: `1px solid ${C.cardBorder}`,
          borderRadius: 8, padding: 20,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#34d399", letterSpacing: 1, marginBottom: 8 }}>
            ✓ LINK READY {result.kind === "magiclink" ? "(EXISTING USER — MAGIC LINK)" : "(NEW USER — INVITE)"}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
            For: <span style={{ color: C.text }}>{result.email}</span>
          </div>
          <div style={{
            padding: 12, background: C.bg, border: `1px solid ${C.cardBorder}`,
            borderRadius: 6, fontFamily: "JetBrains Mono, monospace", fontSize: 11,
            color: C.text, wordBreak: "break-all", lineHeight: 1.5, marginBottom: 12,
          }}>
            {result.link}
          </div>
          <button onClick={copyLink} style={{
            padding: "8px 16px", borderRadius: 6, border: `1px solid ${C.cardBorder}`,
            background: copied ? "#062e1e" : "transparent",
            color: copied ? "#34d399" : C.text,
            fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT, letterSpacing: 0.5,
          }}>
            {copied ? "✓ COPIED" : "COPY LINK"}
          </button>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 14, lineHeight: 1.5 }}>
            Send this URL to the client. When they click it, they'll be signed in
            and prompted to set their own password.
          </p>
        </div>
      )}
    </div>
  );
}
