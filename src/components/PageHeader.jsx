// Standardized 3-line page header used across PRISM dashboard routes.
// Pattern established on Persona Profile (SegmentProfile.jsx):
//
//   RESERVOIR HEALTH PRISM          ← brand strip (small caps)
//   PERSONA PROFILE                  ← page title (large)
//   PRISM AUDIENCE INTELLIGENCE      ← sub-brand strip (medium)
//
// Roll-out: Message Map, Audience ROI, future routes — to match.

export default function PageHeader({ title, accentColor = "#a78bfa" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: "'Nunito Sans',sans-serif",
        fontSize: 9, letterSpacing: 3, color: "#475569",
        marginBottom: 3,
      }}>RESERVOIR HEALTH PRISM</div>
      <h1 style={{
        fontFamily: "'Roboto',sans-serif",
        fontSize: 22, fontWeight: 800, color: "#f1f5f9", margin: 0,
        textTransform: "uppercase", letterSpacing: 0.5,
      }}>{title}</h1>
      <div style={{
        fontFamily: "'Roboto',sans-serif",
        fontSize: 13, fontWeight: 600, color: accentColor, marginTop: 2,
      }}>PRISM AUDIENCE INTELLIGENCE</div>
    </div>
  );
}
