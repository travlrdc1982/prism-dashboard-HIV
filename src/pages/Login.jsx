import { useState } from "react";
import { supabase } from "../supabaseClient";
import { STUDY_META } from "../data/study";
import { getTheme, TYPOGRAPHY, SPACING, BORDER_RADIUS } from "../data/designTokens";
import { Button, Card } from "../components/ui";

const isDark = true;
const theme = getTheme(isDark);
const C = theme.colors;

export default function Login({ onAuth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin"); // "signin" | "setpw" | "forgot"
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSignIn(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else onAuth();
    setLoading(false);
  }

  async function handleSetPassword(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    // Update the invited user's password via signUp (works for pre-invited users)
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      // Try to sign in immediately
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        setMessage("Password set. You can now sign in.");
        setMode("signin");
      } else {
        onAuth();
      }
    }
    setLoading(false);
  }

  async function handleForgot(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) setError(error.message);
    else setMessage("If your email is registered, you'll receive a reset link.");
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.bg.primary,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: TYPOGRAPHY.fontFamily.default
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <Card padding="lg" isDark={isDark} style={{ width: 360 }}>
        <div style={{ textAlign: "center", marginBottom: SPACING[6] }}>
          <img src="/prismlogo.png" alt="PRISM" style={{ height: 36, marginBottom: SPACING[3] }} />
          <div style={{
            fontSize: 9, fontWeight: 600, color: C.text.secondary,
            letterSpacing: 2, textTransform: "uppercase"
          }}>AUDIENCE INTELLIGENCE PLATFORM</div>
          <div style={{
            fontSize: 8, color: C.text.muted, marginTop: SPACING[1],
            letterSpacing: 1, textTransform: "uppercase"
          }}>{STUDY_META.name} STUDY</div>
        </div>

        {/* ── SIGN IN ── */}
        {mode === "signin" && (
          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: SPACING[3] }}>
              <label style={{ fontSize: 10, color: C.text.secondary, fontWeight: 600, display: "block", marginBottom: SPACING[1] }}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: "100%", padding: SPACING[2], borderRadius: BORDER_RADIUS.base, border: `1px solid ${C.border.default}`, background: C.bg.tertiary, color: C.text.primary, fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily.default, outline: "none", boxSizing: "border-box" }}
                placeholder="you@company.com" />
            </div>
            <div style={{ marginBottom: SPACING[4] }}>
              <label style={{ fontSize: 10, color: C.text.secondary, fontWeight: 600, display: "block", marginBottom: SPACING[1] }}>PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                style={{ width: "100%", padding: SPACING[2], borderRadius: BORDER_RADIUS.base, border: `1px solid ${C.border.default}`, background: C.bg.tertiary, color: C.text.primary, fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily.default, outline: "none", boxSizing: "border-box" }}
                placeholder="Enter password" />
            </div>
            {error && <div style={{ fontSize: 11, color: C.error, marginBottom: SPACING[3], padding: SPACING[2], background: C.error + '15', borderRadius: BORDER_RADIUS.base }}>{error}</div>}
            {message && <div style={{ fontSize: 11, color: C.success, marginBottom: SPACING[3], padding: SPACING[2], background: C.success + '15', borderRadius: BORDER_RADIUS.base }}>{message}</div>}
            <Button type="submit" disabled={loading} variant="primary" isDark={isDark} style={{ width: "100%", opacity: loading ? 0.6 : 1 }}>
              {loading ? "..." : "SIGN IN"}
            </Button>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: SPACING[3] }}>
              <button type="button" onClick={() => { setMode("setpw"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: C.interactive.focus, fontSize: 10, cursor: "pointer", fontFamily: TYPOGRAPHY.fontFamily.default }}>
                First time? Set password
              </button>
              <button type="button" onClick={() => { setMode("forgot"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: C.text.muted, fontSize: 10, cursor: "pointer", fontFamily: TYPOGRAPHY.fontFamily.default }}>
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {/* ── SET PASSWORD (first time) ── */}
        {mode === "setpw" && (
          <form onSubmit={handleSetPassword}>
            <div style={{ fontSize: 11, color: C.text.secondary, marginBottom: SPACING[3], lineHeight: 1.5 }}>
              Enter the email your administrator invited you with, and choose a password.
            </div>
            <div style={{ marginBottom: SPACING[3] }}>
              <label style={{ fontSize: 10, color: C.text.secondary, fontWeight: 600, display: "block", marginBottom: SPACING[1] }}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: "100%", padding: SPACING[2], borderRadius: BORDER_RADIUS.base, border: `1px solid ${C.border.default}`, background: C.bg.tertiary, color: C.text.primary, fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily.default, outline: "none", boxSizing: "border-box" }}
                placeholder="you@company.com" />
            </div>
            <div style={{ marginBottom: SPACING[4] }}>
              <label style={{ fontSize: 10, color: C.text.secondary, fontWeight: 600, display: "block", marginBottom: SPACING[1] }}>CHOOSE PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                style={{ width: "100%", padding: SPACING[2], borderRadius: BORDER_RADIUS.base, border: `1px solid ${C.border.default}`, background: C.bg.tertiary, color: C.text.primary, fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily.default, outline: "none", boxSizing: "border-box" }}
                placeholder="Create a password (6+ chars)" />
            </div>
            {error && <div style={{ fontSize: 11, color: C.error, marginBottom: SPACING[3], padding: SPACING[2], background: C.error + '15', borderRadius: BORDER_RADIUS.base }}>{error}</div>}
            {message && <div style={{ fontSize: 11, color: C.success, marginBottom: SPACING[3], padding: SPACING[2], background: C.success + '15', borderRadius: BORDER_RADIUS.base }}>{message}</div>}
            <Button type="submit" disabled={loading} variant="primary" isDark={isDark} style={{ width: "100%", opacity: loading ? 0.6 : 1 }}>
              {loading ? "..." : "SET PASSWORD"}
            </Button>
            <div style={{ textAlign: "center", marginTop: SPACING[3] }}>
              <button type="button" onClick={() => { setMode("signin"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: C.text.muted, fontSize: 10, cursor: "pointer", fontFamily: TYPOGRAPHY.fontFamily.default }}>
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {mode === "forgot" && (
          <form onSubmit={handleForgot}>
            <div style={{ fontSize: 11, color: C.text.secondary, marginBottom: SPACING[3], lineHeight: 1.5 }}>
              Enter your email and we'll send a password reset link.
            </div>
            <div style={{ marginBottom: SPACING[4] }}>
              <label style={{ fontSize: 10, color: C.text.secondary, fontWeight: 600, display: "block", marginBottom: SPACING[1] }}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: "100%", padding: SPACING[2], borderRadius: BORDER_RADIUS.base, border: `1px solid ${C.border.default}`,
                  background: C.bg.tertiary, color: C.text.primary, fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily.default, outline: "none", boxSizing: "border-box" }}
                placeholder="you@company.com" />
            </div>
            {error && <div style={{ fontSize: 11, color: C.error, marginBottom: SPACING[3], padding: SPACING[2], background: C.error + '15', borderRadius: BORDER_RADIUS.base }}>{error}</div>}
            {message && <div style={{ fontSize: 11, color: C.success, marginBottom: SPACING[3], padding: SPACING[2], background: C.success + '15', borderRadius: BORDER_RADIUS.base }}>{message}</div>}
            <Button type="submit" disabled={loading} variant="primary" isDark={isDark} style={{ width: "100%", opacity: loading ? 0.6 : 1 }}>
              {loading ? "..." : "SEND RESET LINK"}
            </Button>
            <div style={{ textAlign: "center", marginTop: SPACING[3] }}>
              <button type="button" onClick={() => { setMode("signin"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: C.text.muted, fontSize: 10, cursor: "pointer", fontFamily: TYPOGRAPHY.fontFamily.default }}>
                Back to sign in
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
