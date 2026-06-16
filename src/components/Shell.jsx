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
  { to: "/executive-summary", label: "EXECUTIVE SUMMARY" },
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
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800&family=Nunito:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,600;1,400&family=Roboto:wght@400;500;700;800&family=Roboto+Slab:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      {/* ─── TOP BAR ─── */}
      <header style={{
        display: "flex", alignItems: "center", gap: 24,
        padding: "10px 28px",
        borderBottom: `1px solid ${C.cardBorder}`,
        background: C.card,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        {/* Logo / Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <img src="/prismlogo.png" alt="PRISM logo" style={{ height: 28 }} />
          <span style={{
            fontSize: 9, fontWeight: 600, color: C.steel,
            letterSpacing: 2, textTransform: "uppercase",
          }}>AUDIENCE INTELLIGENCE PLATFORM</span>
        </div>

        {/* Nav Links */}
        <nav style={{ display: "flex", gap: 2, flex: 1, minWidth: 0, overflowX: "auto" }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              style={({ isActive }) => ({
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: isActive ? 500 : 300,
                fontFamily:"'Nunito',sans-serif",
                color: isActive ? C.white : C.textMuted,
                background: isActive ? `${C.steel}20` : "transparent",
                textDecoration: "none",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Admin link + Study badge + Sign out */}
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          {isAdmin && (
            <NavLink
              to="/admin"
              style={({ isActive }) => ({
                fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase",
                padding: "4px 10px", borderRadius: 4,
                border: `1px solid ${isActive ? "#3b82f6" : C.cardBorder}`,
                color: isActive ? "#60a5fa" : C.textDim,
                textDecoration: "none", fontFamily: "'Nunito',sans-serif",
              })}
            >
              ADMIN
            </NavLink>
          )}
          <div style={{
            fontSize: 9, fontWeight: 600, color: C.textDim,
            letterSpacing: 1, textTransform: "uppercase",
            padding: "4px 10px", borderRadius: 4,
            border: `1px solid ${C.cardBorder}`,
          }}>
            {STUDY_META.name} STUDY
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              fontSize: 9, fontWeight: 500, color: C.textDim,
              background: "none", border: `1px solid ${C.cardBorder}`,
              borderRadius: 4, padding: "4px 10px", cursor: "pointer",
              fontFamily: "'Nunito',sans-serif", transition: "all 0.15s",
            }}
          >SIGN OUT</button>
        </div>
      </header>

      {/* ─── CONTENT AREA ─── */}
      <main style={{ padding: "24px 28px" }}>
        <Outlet />
      </main>
    </div>
  );
}
