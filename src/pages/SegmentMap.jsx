import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SEG_BY_CODE } from "../data/generated/segments";
import { C } from "../data/theme";

// ─── BUBBLE LAYOUT: exact coords/sizes/z from the HTML; display names
// carry line breaks. party + pop come from the generated segment table
// (study/study.yaml registry — the canonical population shares). ───
const BUBBLE_LAYOUT = [
  { code:"UCP", name:"Universal Care\nProgressives",     left:115,  top:196,  w:900, z:4 },
  { code:"FJP", name:"Faith & Justice\nProgressives",    left:650,  top:639,  w:897, z:3 },
  { code:"GHI", name:"Global Health\nInstitutionalists", left:1320, top:1028, w:897, z:2 },
  { code:"VS",  name:"Vaccine\nSkeptics",                left:4470, top:772,  w:897, z:2 },
  { code:"TSP", name:"Trust the Science\nPragmatists",   left:2727, top:497,  w:560, z:3 },
  { code:"HCP", name:"Health Care\nProtectionists",      left:1389, top:454,  w:775, z:1 },
  { code:"HAD", name:"Health Abundance\nDemocrats",      left:1965, top:290,  w:850, z:4 },
  { code:"HCI", name:"Health Care\nIncrementalists",     left:1980, top:794,  w:800, z:3 },
  { code:"PFF", name:"Paleo Freedom\nFighters",          left:3955, top:29,   w:770, z:2 },
  { code:"PP",  name:"Price\nPopulists",                 left:3484, top:154,  w:660, z:2 },
  { code:"HF",  name:"Health\nFuturists",                left:3182, top:474,  w:660, z:2 },
  { code:"CEC", name:"Consumer Empowerment\nChampions",  left:2857, top:780,  w:800, z:1 },
  { code:"TC",  name:"Traditional\nConservatives",       left:3388, top:1146, w:800, z:4 },
  { code:"HHN", name:"Holistic Health\nNaturalists",     left:4379, top:400,  w:670, z:3 },
  { code:"MFL", name:"Medical Freedom\nLibertarians",    left:4094, top:1172, w:830, z:3 },
  { code:"WE",  name:"Wellness\nEvangelists",            left:3568, top:400,  w:1100,z:1 },
];
const BUBBLES = BUBBLE_LAYOUT.map(b => ({
  ...b,
  party: SEG_BY_CODE[b.code].party,
  pop: SEG_BY_CODE[b.code].pop,
}));

//Persona cards
const CARD_IMAGES = {
  CEC: "/prism-demo/CECCard.PNG",
  TC:  "/prism-demo/TCCard.PNG",
  WE:  "/prism-demo/WECard.png",
  TSP: "/prism-demo/TSPCard.PNG",
  HF:  "/prism-demo/HFCard.png",
  PP:  "/prism-demo/PPCard.png",
  PFF: "/prism-demo/PFFCard.png",
  HHN: "/prism-demo/HHNCard.png",
  MFL: "/prism-demo/MFLCard.PNG",
  VS: "/prism-demo/VSCard.PNG",
  UCP: "/prism-demo/UCPCard.png",
  FJP: "/prism-demo/FJPCard.png",
  HCP: "/prism-demo/HCPCard.png",
  HAD: "/prism-demo/HADCard.png",
  HCI: "/prism-demo/HCICard.png",
  GHI: "/prism-demo/GHICard.png",
};

// Stage dimensions from the HTML
const STAGE_W = 5325;
const STAGE_H = 1959;


// Colors
const DEM_FILL = "#2563eb";
const DEM_STROKE = "#3b82f6";
const DEM_TEXT = "#bfdbfe";
const GOP_FILL = "#dc2626";
const GOP_STROKE = "#ef4444";
const GOP_TEXT = "#fecaca";

function BubbleCircle({ b, isActive, isDim, onClick }) {
  const r = b.w / 2;
  const cx = b.left + r;
  const cy = b.top + r;
  const isDem = b.party === "DEM";

  const fill = isDem ? DEM_FILL : GOP_FILL;
  const stroke = isDem ? DEM_STROKE : GOP_STROKE;
  const textColor = isDem ? DEM_TEXT : GOP_TEXT;

  const lines = b.name.split("\n");

  return (
    <g
      onClick={onClick}
      style={{
        cursor: "pointer",
        opacity: isDim ? 0.15 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* Outer glow */}
      <circle
        cx={cx} cy={cy} r={r + 4}
        fill="none"
        stroke={stroke}
        strokeWidth={3}
        opacity={isActive ? 0.6 : 0.15}
      />
      {/* Main bubble */}
      <circle
        cx={cx} cy={cy} r={r}
        fill={fill}
        fillOpacity={isActive ? 0.28 : 0.18}
        stroke={stroke}
        strokeWidth={isActive ? 4 : 2}
        strokeOpacity={isActive ? 0.8 : 0.4}
      />
      {/* Inner gradient circle */}
      <circle
        cx={cx} cy={cy} r={r * 0.85}
        fill="none"
        stroke={stroke}
        strokeWidth={1}
        strokeOpacity={0.12}
      />
      {/* Full name lines */}
      {lines.map((line, i) => (
        <text
          key={i}
          x={cx} y={cy - r * 0.12 + i * r * 0.16}
          textAnchor="middle"
          dominantBaseline="central"
          fill={textColor}
          fontSize={r * 0.14}
          fontWeight={700}
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing={r * 0.01}
          opacity={isDim ? 0.3 : 0.9}
          textTransform="uppercase"
          style={{ textTransform: "uppercase" }}
        >
          {line.toUpperCase()}
        </text>
      ))}
      {/* Code abbreviation below */}
      <text
        x={cx} y={cy + r * 0.22}
        textAnchor="middle"
        dominantBaseline="central"
        fill={textColor}
        fontSize={r * 0.09}
        fontWeight={500}
        fontFamily="'JetBrains Mono', monospace"
        letterSpacing={r * 0.03}
        opacity={isDim ? 0.2 : 0.45}
      >
        {b.code}
      </text>
      {/* Population badge */}
      <circle
        cx={cx + r * 0.55} cy={cy - r * 0.55} r={r * 0.14}
        fill={C.card}
        stroke={stroke}
        strokeWidth={2}
        opacity={isDim ? 0.2 : 0.9}
      />
      <text
        x={cx + r * 0.55} y={cy - r * 0.55}
        textAnchor="middle"
        dominantBaseline="central"
        fill={C.text}
        fontSize={r * 0.1}
        fontWeight={700}
        fontFamily="'JetBrains Mono', monospace"
        opacity={isDim ? 0.2 : 0.9}
      >
        {b.pop}%
      </text>
    </g>
  );
}

export default function BubbleMap() {
  const [active, setActive] = useState(null);
  const navigate = useNavigate();
  const wrapperRef = useRef(null);

  // click outside to reset
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setActive(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Sort by z-index for render order (lower z = rendered first = behind)
  const sorted = [...BUBBLES].sort((a, b) => a.z - b.z);

  return (
    <div
        ref={wrapperRef}
        style={{
          width: "100%",
          maxWidth: 1400,
          margin: "0 auto",
          position: "relative",
        }}
      >
        <svg
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          width="100%"
          style={{ display: "block" }}
          onClick={(e) => {
            if (e.target.tagName === "svg" || e.target.tagName === "rect") setActive(null);
          }}
        >
          {/* Subtle grid */}
          <defs>
            <pattern id="grid" width="200" height="200" patternUnits="userSpaceOnUse">
              <path d="M 200 0 L 0 0 0 200" fill="none" stroke={C.cardBorder} strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={STAGE_W} height={STAGE_H} fill={C.bg} />
          <rect width={STAGE_W} height={STAGE_H} fill="url(#grid)" opacity="0.4" />

          {/* Divider line between DEM and GOP clusters */}
          <line
            x1={2650} y1={0} x2={2650} y2={STAGE_H}
            stroke={C.cardBorder} strokeWidth={3} strokeDasharray="20,15"
            opacity={0.4}
          />
          <text x={1300} y={60} fill="#3b82f6" fontSize={48} fontWeight={700}
            fontFamily="'JetBrains Mono',monospace" opacity={0.25}
            textAnchor="middle">DEMOCRATIC SEGMENTS</text>
          <text x={4000} y={60} fill="#ef4444" fontSize={48} fontWeight={700}
            fontFamily="'JetBrains Mono',monospace" opacity={0.25}
            textAnchor="middle">REPUBLICAN SEGMENTS</text>

          {/* Render bubbles in z-order */}
          {sorted.map((b) => (
            <BubbleCircle
              key={b.code}
              b={b}
              isActive={active === b.code}
              isDim={active !== null && active !== b.code}
              onClick={(e) => {
  e.stopPropagation();
  e.nativeEvent.stopImmediatePropagation();
  if (active === b.code) {
                  navigate('/profile?seg=' + b.code);
                } else {
                  setActive(b.code);
                }
              }}
            />
          ))}
        </svg>

      {active && CARD_IMAGES[active] && (() => {
        const isGOP = BUBBLES.find(b => b.code === active)?.party === "GOP";
        return (
          <div
            onClick={() => navigate('/profile?seg=' + active)}
            style={{
              position: "absolute",
              top: "50%",
              [isGOP ? "left" : "right"]: 40,
              transform: "translateY(-50%)",
              cursor: "pointer",
              zIndex: 200,
              opacity: 0.85,
              filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.7))",
              transition: "opacity 0.3s ease, left 0.3s ease, right 0.3s ease",
             }}
          >
          <img
            src={CARD_IMAGES[active]}
            alt={active}
            style={{
              width: 320,
              borderRadius: 16,
              opacity: 0.88,
          }}
        />
        <div style={{
          textAlign: "center", marginTop: 8,
          fontSize: 10, color: "#64748b",
          fontFamily: "'JetBrains Mono',monospace",
        }}>
          Click card to view full profile →
      </div>
    </div>
  );
})()}

      
        {/* Legend */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 24, marginTop: 12, padding: "8px 0"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: DEM_FILL, opacity: 0.5, border: `2px solid ${DEM_STROKE}` }} />
            <span style={{ fontSize: 10, color: "#64748b", fontFamily: "'JetBrains Mono',monospace" }}>Democratic</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: GOP_FILL, opacity: 0.5, border: `2px solid ${GOP_STROKE}` }} />
            <span style={{ fontSize: 10, color: "#64748b", fontFamily: "'JetBrains Mono',monospace" }}>Republican</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>Bubble size = population weight</span>
          </div>
        </div>
      </div>
  );
}
