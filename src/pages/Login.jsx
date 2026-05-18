import { useState } from "react";
import { supabase } from "../supabaseClient";
import { STUDY_META } from "../data/study";

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
      minHeight: "100vh", background: "#080c16",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Nunito', sans-serif"
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <div style={{
        width: 360, background: "#0f1520", borderRadius: 12,
        border: "1px solid #1e293b", padding: "32px 28px"
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/prismlogo.png" alt="PRISM" style={{ height: 36, marginBottom: 12 }} />
          <div style={{
            fontSize: 9, fontWeight: 600, color: "#64748b",
            letterSpacing: 2, textTransform: "uppercase"
          }}>AUDIENCE INTELLIGENCE PLATFORM</div>
          <div style={{
            fontSize: 8, color: "#475569", marginTop: 4,
            letterSpacing: 1, textTransform: "uppercase"
          }}>{STUDY_META.name} STUDY</div>
        </div>

        {/* ── SIGN IN ── */}
        {mode === "signin" && (
          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#111827", color: "#e2e8f0", fontSize: 13, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box" }}
                placeholder="you@company.com" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#111827", color: "#e2e8f0", fontSize: 13, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box" }}
                placeholder="Enter password" />
            </div>
            {error && <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 12, padding: "6px 10px", background: "#1f1318", borderRadius: 4 }}>{error}</div>}
            {message && <div style={{ fontSize: 11, color: "#34d399", marginBottom: 12, padding: "6px 10px", background: "#062e1e", borderRadius: 4 }}>{message}</div>}
            <button type="submit" disabled={loading} style={{ width: "100%", padding: "10px 0", borderRadius: 6, border: "none", background: loading ? "#334155" : "#3b82f6", color: "#fff", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "'Nunito', sans-serif", letterSpacing: 0.5, transition: "background 0.15s" }}>
              {loading ? "..." : "SIGN IN"}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
              <button type="button" onClick={() => { setMode("setpw"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: "#60a5fa", fontSize: 10, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                First time? Set password
              </button>
              <button type="button" onClick={() => { setMode("forgot"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: "#64748b", fontSize: 10, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {/* ── SET PASSWORD (first time) ── */}
        {mode === "setpw" && (
          <form onSubmit={handleSetPassword}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14, lineHeight: 1.5 }}>
              Enter the email your administrator invited you with, and choose a password.
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#111827", color: "#e2e8f0", fontSize: 13, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box" }}
                placeholder="you@company.com" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>CHOOSE PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#111827", color: "#e2e8f0", fontSize: 13, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box" }}
                placeholder="Create a password (6+ chars)" />
            </div>
            {error && <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 12, padding: "6px 10px", background: "#1f1318", borderRadius: 4 }}>{error}</div>}
            {message && <div style={{ fontSize: 11, color: "#34d399", marginBottom: 12, padding: "6px 10px", background: "#062e1e", borderRadius: 4 }}>{message}</div>}
            <button type="submit" disabled={loading} style={{ width: "100%", padding: "10px 0", borderRadius: 6, border: "none", background: loading ? "#334155" : "#34d399", color: "#fff", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "'Nunito', sans-serif", letterSpacing: 0.5, transition: "background 0.15s" }}>
              {loading ? "..." : "SET PASSWORD"}
            </button>
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button type="button" onClick={() => { setMode("signin"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: "#64748b", fontSize: 10, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {mode === "forgot" && (
          <form onSubmit={handleForgot}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14, lineHeight: 1.5 }}>
              Enter your email and we'll send a password reset link.
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#111827", color: "#e2e8f0", fontSize: 13, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box" }}
                placeholder="you@company.com" />
            </div>
            {error && <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 12, padding: "6px 10px", background: "#1f1318", borderRadius: 4 }}>{error}</div>}
            {message && <div style={{ fontSize: 11, color: "#34d399", marginBottom: 12, padding: "6px 10px", background: "#062e1e", borderRadius: 4 }}>{message}</div>}
            <button type="submit" disabled={loading} style={{ width: "100%", padding: "10px 0", borderRadius: 6, border: "none", background: loading ? "#334155" : "#f59e0b", color: "#fff", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "'Nunito', sans-serif", letterSpacing: 0.5, transition: "background 0.15s" }}>
              {loading ? "..." : "SEND RESET LINK"}
            </button>
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button type="button" onClick={() => { setMode("signin"); setError(null); setMessage(null); }} style={{ background: "none", border: "none", color: "#64748b", fontSize: 10, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
