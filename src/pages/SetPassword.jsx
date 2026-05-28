import { useState } from "react";
import { supabase } from "../supabaseClient";
import { STUDY_META } from "../data/study";

// Shown after a user clicks an invite link and lands on the dashboard with
// an active session. They set their own password here, and the next time
// they visit they can sign in with email + password normally.

export default function SetPassword({ email, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      onDone();
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#080c16",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Nunito', sans-serif",
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <div style={{
        width: 380, background: "#0f1520", borderRadius: 12,
        border: "1px solid #1e293b", padding: "32px 28px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/prismlogo.png" alt="PRISM" style={{ height: 36, marginBottom: 12 }} />
          <div style={{
            fontSize: 9, fontWeight: 600, color: "#64748b",
            letterSpacing: 2, textTransform: "uppercase",
          }}>AUDIENCE INTELLIGENCE PLATFORM</div>
          <div style={{
            fontSize: 8, color: "#475569", marginTop: 4,
            letterSpacing: 1, textTransform: "uppercase",
          }}>{STUDY_META.name} STUDY</div>
        </div>

        <div style={{
          fontSize: 14, color: "#e2e8f0", fontWeight: 600,
          marginBottom: 6, textAlign: "center",
        }}>
          Welcome{email ? `, ${email}` : ""}
        </div>
        <div style={{
          fontSize: 11, color: "#94a3b8", marginBottom: 18, lineHeight: 1.5, textAlign: "center",
        }}>
          Choose a password. You'll use it to sign in from now on.
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>
              NEW PASSWORD
            </label>
            <input
              type="password" required minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="8+ characters"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 6,
                border: "1px solid #1e293b", background: "#111827", color: "#e2e8f0",
                fontSize: 13, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>
              CONFIRM PASSWORD
            </label>
            <input
              type="password" required minLength={8}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-type password"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 6,
                border: "1px solid #1e293b", background: "#111827", color: "#e2e8f0",
                fontSize: 13, fontFamily: "'Nunito', sans-serif", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          {error && (
            <div style={{
              fontSize: 11, color: "#ef4444", marginBottom: 12,
              padding: "6px 10px", background: "#1f1318", borderRadius: 4,
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "10px 0", borderRadius: 6, border: "none",
            background: loading ? "#334155" : "#34d399", color: "#fff",
            fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer",
            fontFamily: "'Nunito', sans-serif", letterSpacing: 0.5,
          }}>
            {loading ? "..." : "SET PASSWORD & CONTINUE"}
          </button>
        </form>
      </div>
    </div>
  );
}
