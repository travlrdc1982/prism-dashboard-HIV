import { NavLink, Outlet } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { getTheme, SPACING, TYPOGRAPHY, BORDER_RADIUS } from "../data/designTokens";
import { STUDY_META } from "../data/study";
import { Button } from "./ui";

const isDark = true;
const theme = getTheme(isDark);
const C = theme.colors;

const NAV_ITEMS = [
  { to: "/",          label: "AUDIENCE MAP" },
  { to: "/roi",       label: "AUDIENCE ROI" },
  { to: "/messages",  label: "MESSAGE MAP" },
  { to: "/profile",   label: "AUDIENCE PROFILES" },
  { to: "/topline",   label: "TOPLINE" },
];

export default function Shell() {
  return (
    <div style={{ background: C.bg.primary, minHeight: "100vh", fontFamily: TYPOGRAPHY.fontFamily.default, color: C.text.primary }}>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800&family=Nunito:wght@400;500;600;700;800&family=Roboto:wght@400;500;700;800&family=Roboto+Slab:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      {/* ─── TOP BAR ─── */}
      <header style={{
        display: "flex", alignItems: "center", gap: SPACING[6],
        padding: `${SPACING[2]} ${SPACING[7]}`,
        borderBottom: `1px solid ${C.border.default}`,
        background: C.bg.secondary,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        {/* Logo / Title */}
        <div style={{ display: "flex", alignItems: "center", gap: SPACING[2], flexShrink: 0 }}>
          <img src="/prismlogo.png" alt="PRISM logo" style={{ height: 28 }} />
          <span style={{
            fontSize: 9, fontWeight: 600, color: C.text.secondary,
            letterSpacing: 2, textTransform: "uppercase",
          }}>AUDIENCE INTELLIGENCE PLATFORM</span>
        </div>

        {/* Nav Links */}
        <nav style={{ display: "flex", gap: SPACING[1], flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              style={({ isActive }) => ({
                padding: `${SPACING[1]} ${SPACING[3]}`,
                borderRadius: BORDER_RADIUS.md,
                fontSize: 11,
                fontWeight: isActive ? 500 : 300,
                fontFamily: TYPOGRAPHY.fontFamily.default,
                color: isActive ? C.text.primary : C.text.secondary,
                background: isActive ? C.interactive.active : "transparent",
                textDecoration: "none",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Study badge + Sign out */}
        <div style={{ display:"flex", alignItems:"center", gap: SPACING[2], flexShrink:0 }}>
          <div style={{
            fontSize: 9, fontWeight: 600, color: C.text.secondary,
            letterSpacing: 1, textTransform: "uppercase",
            padding: `${SPACING[1]} ${SPACING[2]}`, borderRadius: BORDER_RADIUS.base,
            border: `1px solid ${C.border.default}`,
          }}>
            {STUDY_META.name} STUDY
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => supabase.auth.signOut()}
            isDark={isDark}
          >
            SIGN OUT
          </Button>
        </div>
      </header>

      {/* ─── CONTENT AREA ─── */}
      <main style={{ padding: `${SPACING[6]} ${SPACING[7]}` }}>
        <Outlet />
      </main>
    </div>
  );
}
