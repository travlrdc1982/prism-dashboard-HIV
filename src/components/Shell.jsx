import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { C, FONT } from "../data/theme";
import { STUDY_META } from "../data/study";
import { isAdminEmail } from "../data/admins";

const NAV_ITEMS = [
  { to: "/",          label: "AUDIENCE MAP" },
  { to: "/roi",       label: "AUDIENCE ROI" },
  { to: "/messages",  label: "MESSAGE MAP" },
  { to: "/profile",   label: "AUDIENCE PROFILES" },
  { to: "/topline",   label: "TOPLINE" },
];

export default function Shell() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setIsAdmin(isAdminEmail(data?.user?.email));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(isAdminEmail(session?.user?.email));
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: FONT, color: C.text }}>
      {/* ─── TOP BAR ─── */}
      <header style={{
        display: "flex", alignItems: "stretch", gap: 0,
        height: 52,
        borderBottom: `1px solid ${C.cardBorder}`,
        background: C.card,
        position: "sticky", top: 0, zIndex: 100,
        padding: "0 24px",
      }}>
        {/* Logo / Title */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          flexShrink: 0, paddingRight: 28,
          borderRight: `1px solid ${C.cardBorder}`,
        }}>
          <img src="/prismlogo.png" alt="PRISM logo" style={{ height: 24 }} />
          <span style={{
            fontSize: 8, fontWeight: 700, color: C.textDim,
            letterSpacing: 2.5, textTransform: "uppercase",
            fontFamily: "'JetBrains Mono', monospace",
            whiteSpace: "nowrap",
          }}>AUDIENCE INTELLIGENCE</span>
        </div>

        {/* Nav Links */}
        <nav style={{ display: "flex", gap: 0, flex: 1, paddingLeft: 8 }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center",
                padding: "0 14px",
                height: "100%",
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                fontFamily: "'JetBrains Mono', monospace",
                color: isActive ? C.white : C.steel,
                background: "transparent",
                textDecoration: "none",
                letterSpacing: 1,
                whiteSpace: "nowrap",
                position: "relative",
                borderBottom: isActive
                  ? `2px solid ${C.cyan}`
                  : "2px solid transparent",
                transition: "color 0.15s, border-color 0.15s",
              })}
              onMouseEnter={e => {
                if (!e.currentTarget.getAttribute("aria-current")) {
                  e.currentTarget.style.color = C.textMuted;
                }
              }}
              onMouseLeave={e => {
                if (!e.currentTarget.getAttribute("aria-current")) {
                  e.currentTarget.style.color = C.steel;
                }
              }}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Admin link + Study badge + Sign out */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, paddingLeft: 16, borderLeft: `1px solid ${C.cardBorder}` }}>
          {isAdmin && (
            <NavLink
              to="/admin"
              style={({ isActive }) => ({
                fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
                padding: "4px 10px", borderRadius: 4,
                border: `1px solid ${isActive ? "#3b82f6" : C.cardBorder}`,
                color: isActive ? "#60a5fa" : C.textDim,
                textDecoration: "none",
                fontFamily: "'JetBrains Mono', monospace",
                transition: "all 0.15s",
              })}
            >
              ADMIN
            </NavLink>
          )}
          <div style={{
            fontSize: 8, fontWeight: 600, color: C.textDim,
            letterSpacing: 1.5, textTransform: "uppercase",
            padding: "4px 10px", borderRadius: 4,
            border: `1px solid ${C.cardBorder}`,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {STUDY_META.name}
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              fontSize: 8, fontWeight: 500, color: C.textDim,
              background: "none", border: `1px solid ${C.cardBorder}`,
              borderRadius: 4, padding: "4px 10px",
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.steel; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.cardBorder; e.currentTarget.style.color = C.textDim; }}
          >SIGN OUT</button>
        </div>
      </header>

      {/* ─── CONTENT AREA ─── */}
      <main style={{ padding: "28px 32px", minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
