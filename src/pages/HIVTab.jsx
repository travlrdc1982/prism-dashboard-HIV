// Phase B — HIV Persona Profile Tab.
// Faithful port of HIV_Persona_Profile_Tab/hiv_tab_v5.html. Markup and SVG
// rendering replicate the prototype; data is sourced from src/data/hiv/*
// and parameterized by the focal segment (the segment whose profile is
// being viewed).

import { useState, useMemo } from "react";
import "./HIVTab.css";
import segData from "../data/hiv/seg_data.json";
import items from "../data/hiv/items.json";
import bench from "../data/hiv/bench.json";
import trust from "../data/hiv/trust.json";
import manifest from "../data/hiv/manifest.json";

const SEG_NAME = {1:"TSP",2:"CEC",3:"TC",4:"HF",5:"PP",6:"WE",7:"PFF",8:"HHN",9:"MFL",10:"VS",11:"UCP",12:"FJP",13:"HCP",14:"HAD",15:"HCI",16:"GHI"};
const GOP_SEGS = new Set([1,2,3,4,5,6,7,8,9,10]);
const BENCH_GLYPH = { All: "US", Republicans: "R", Democrats: "D" };
const BENCH_FULL = { All: "All Americans", Republicans: "Republicans", Democrats: "Democrats" };

// ─── Bench glyph (SVG <g>) ──────────────────────────────────────────────
function BenchGlyph({ cx, cy, type, active = true, r = 9 }) {
  const dim = active ? 1.0 : 0.40;
  let fill = "#000", stroke = "none", textColor = "#fff", fontSize = r - 1;
  if (type === "R") { fill = "#DC4040"; stroke = "#fff"; }
  if (type === "D") { fill = "#4A82E0"; stroke = "#fff"; }
  if (type === "US") { fill = "#07090F"; stroke = "#E8EAED"; textColor = "#E8EAED"; fontSize = r - 2; }
  return (
    <g opacity={dim}>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth="1.5" />
      <text x={cx} y={cy + (fontSize/2 - 1)} textAnchor="middle"
        fontSize={fontSize} fontWeight="800" fill={textColor} fontFamily="Inter">
        {type}
      </text>
    </g>
  );
}

// ─── Compare bar ────────────────────────────────────────────────────────
function CompareBar({ current, onChange, focalCode }) {
  return (
    <div className="compare-bar">
      <span className="compare-label">Compare {focalCode} to:</span>
      <div className="compare-toggle">
        {["All", "Republicans", "Democrats"].map((b) => (
          <button
            key={b}
            className={"compare-btn" + (current === b ? " active" : "")}
            onClick={() => onChange(b)}
          >
            <span className={`bench-glyph ${BENCH_GLYPH[b]}`}>{BENCH_GLYPH[b]}</span>
            {b === "All" ? "All Americans" : b}
          </button>
        ))}
      </div>
      <span className="compare-note">
        Benchmarks, deltas, accordion item-level data, and the two scatter plots all reorient when you switch.
      </span>
    </div>
  );
}

// ─── Accordion (collapsible) ────────────────────────────────────────────
function Accordion({ target, items, benchKey, focalId, focalCode }) {
  const [open, setOpen] = useState(false);
  const benchGlyph = BENCH_GLYPH[benchKey];
  const fmtVal = (v, binary) => (binary ? `${Math.round(v * 100)}%` : Number(v).toFixed(2));
  const fmtDelta = (d, binary) => {
    const s = d >= 0 ? "+" : "";
    return binary ? `${s}${(d * 100).toFixed(0)}pp` : `${s}${d.toFixed(2)}`;
  };
  return (
    <div className={"accordion" + (open ? " open" : "")}>
      <button className="accordion-toggle" onClick={() => setOpen(!open)}>
        <span>Item-level data</span>
        <span className="chev">▾</span>
      </button>
      <div className="accordion-panel">
        <div className="acc-head">
          <span>Code</span>
          <span>Item</span>
          <span className="right">{focalCode}</span>
          <span className="right">{benchGlyph}</span>
          <span className="right">Δ</span>
        </div>
        <div>
          {items.map((it) => {
            const fjp = it.by_segment?.[String(focalId)] ?? null;
            const bv = it[benchKey] ?? null;
            const delta = fjp != null && bv != null ? fjp - bv : null;
            const dirClass = delta >= 0 ? "up" : "down";
            return (
              <div className="acc-row" key={it.code}>
                <span className="acc-code">{it.code}</span>
                <span className="acc-stem">{it.stem}</span>
                <span className="acc-seg">{fjp == null ? "—" : fmtVal(fjp, it.binary)}</span>
                <span className="acc-bench">{bv == null ? "—" : fmtVal(bv, it.binary)}</span>
                <span className={`acc-delta ${dirClass}`}>
                  {delta == null ? "—" : fmtDelta(delta, it.binary)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── TILE 1 — Compassion / Sanctity ─────────────────────────────────────
function SCFTile({ focalData, focalCode, benchKey }) {
  const W = 180, H = 280, cx = W / 2, yTop = 30, yBot = H - 30;
  const yMin = -2.0, yMax = 1.0;
  const yScale = (v) => yTop + (yMax - v) / (yMax - yMin) * (yBot - yTop);
  const scf = focalData.SCF_raw;
  const benchSCF = bench[benchKey].SCF.raw;
  const delta = scf - benchSCF;
  let lab = "Care-leaning";
  if (scf > 0.5) lab = "Sanctity-leaning";
  else if (scf > -0.5) lab = "Balanced";
  const yZero = yScale(0);
  const benchValues = {
    R: bench.Republicans.SCF.raw,
    D: bench.Democrats.SCF.raw,
    US: bench.All.SCF.raw,
  };
  const yFocal = yScale(scf);
  return (
    <div className="card scf-tile">
      <div className="card-eyebrow-row">
        <span className="card-eyebrow">Moral architecture</span>
        <span className="info-icon">i</span>
      </div>
      <div className="card-title">Compassion ↔ Sanctity</div>
      <div className="card-plain">
        Where this segment falls on the Care–Sanctity moral spectrum (SCF = Purity − Care).
      </div>
      <div className="card-body">
        <div className="scf-chart">
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <defs>
              {/* Gradient reversed so SANCTITY-red is at the top (matching the
                  swapped label) and COMPASSION-blue is at the bottom. */}
              <linearGradient id="scfgrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#DC4040" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#8B98A8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#6FA0E8" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <rect x={cx - 6} y={yTop} width="12" height={yBot - yTop} fill="url(#scfgrad)" rx="6" ry="6" />
            {/* Labels flipped per design: SANCTITY on top, COMPASSION on bottom.
                Gradient stops swapped in <defs> above so the colors still match
                the labels. yScale untouched — focal marker and bench glyphs
                still position by SCF value. */}
            <text x={cx} y={yTop - 12} textAnchor="middle" fontSize="10" fontWeight="700" fill="#DC4040" letterSpacing="1.2" fontFamily="Inter">
              SANCTITY
            </text>
            <text x={cx} y={yBot + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#6FA0E8" letterSpacing="1.2" fontFamily="Inter">
              COMPASSION
            </text>
            <line x1={cx - 22} x2={cx + 22} y1={yZero} y2={yZero} stroke="#4A5466" strokeWidth="1" strokeDasharray="2 2" />
            <text x={cx + 28} y={yZero + 3} fontSize="9" fill="#6A7488" fontFamily="Inter">0</text>
            {Object.entries(benchValues).map(([type, v]) => {
              const y = yScale(v);
              const active = BENCH_GLYPH[benchKey] === type;
              return (
                <g key={type}>
                  <BenchGlyph cx={cx + 38} cy={y} type={type} active={active} r={11} />
                  <text x={cx + 58} y={y + 3.5} fontSize="9" fill={active ? "#E8EAED" : "#6A7488"} fontFamily="Inter">
                    {v.toFixed(2)}
                  </text>
                </g>
              );
            })}
            <circle cx={cx - 32} cy={yFocal} r="14" fill="#2FE079" stroke="#fff" strokeWidth="2.5" />
            <text x={cx - 32} y={yFocal + 4.5} textAnchor="middle" fontSize="11" fontWeight="800" fill="#06241A" fontFamily="Inter">
              {focalCode}
            </text>
            <text x={cx - 32} y={yFocal + 30} textAnchor="middle" fontSize="9" fill="#6A7488" fontFamily="Inter">
              {scf.toFixed(2)}
            </text>
          </svg>
        </div>
        <div className="scf-label-readout">
          <span className="scf-num-readout">{(scf >= 0 ? "+" : "") + scf.toFixed(2)}</span>
          <span style={{ display: "inline-block", marginLeft: 8 }}>
            <strong>{lab}</strong>
            <span style={{ color: "var(--text-muted)" }}>
              {` · rank ${focalData.SCF_raw_rank} of 16 · ${delta > 0 ? "+" : ""}${delta.toFixed(2)} vs ${BENCH_GLYPH[benchKey]}`}
            </span>
          </span>
        </div>
      </div>
      <Accordion items={items.scf} benchKey={benchKey} focalId={focalData._id} focalCode={focalCode} />
    </div>
  );
}

// ─── TILE 2 — Stigma (Blame + Avoidance) ────────────────────────────────
function GlyphRow({ count, color, kind, benchPct, benchLabel }) {
  // kind: "arrow" (blame) or "crescent" (avoid). Render 5 glyphs.
  const totalWidth = 5 * 16 + 4 * 2;
  const leftPx = benchPct * totalWidth;
  return (
    <div className="stigma-glyphs">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < count;
        const isBlame = kind === "arrow";
        if (isBlame) {
          return (
            <span key={i} className={`g ${filled ? "filled" : "empty"} blame`}>
              <svg width="16" height="16" viewBox="0 0 64 64">
                <path
                  d="M 14 12 L 50 32 L 14 52 Z"
                  fill={filled ? color : "none"}
                  stroke={color}
                  strokeWidth={filled ? 3 : 4}
                  strokeLinejoin="miter"
                  opacity={filled ? 1 : 0.30}
                />
              </svg>
            </span>
          );
        }
        return (
          <span key={i} className={`g ${filled ? "filled" : "empty"} avoid`}>
            <svg width="16" height="16" viewBox="0 0 64 64">
              <path
                d="M 24 12 Q 44 32 24 52"
                stroke={color}
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
                opacity={filled ? 1 : 0.30}
              />
            </svg>
          </span>
        );
      })}
      <span className="bench-chev" style={{ left: leftPx + "px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color, fontWeight: 700 }}>
          <svg width="8" height="6" viewBox="0 0 8 6">
            <path d="M 4 0 L 8 6 L 0 6 Z" fill={color} />
          </svg>
          <span style={{ fontSize: 8.5, color, opacity: 0.85 }}>{benchLabel}</span>
        </span>
      </span>
    </div>
  );
}

function StigmaTile({ focalData, focalCode, benchKey }) {
  const blameRaw = focalData.MBS_raw;
  const avoidRaw = focalData.SDS_raw;
  const nFilled = (v) => Math.max(0, Math.min(5, Math.round(((v - 1) / 6) * 5)));
  const benchPct = (v) => Math.max(0, Math.min(1, (v - 1) / 6));
  const benchBlame = bench[benchKey].MBS.raw;
  const benchAvoid = bench[benchKey].SDS.raw;
  // Seesaw deviations
  const benchBlameZ = bench[benchKey].MBS.z;
  const benchAvoidZ = bench[benchKey].SDS.z;
  const blameDev = focalData.MBS_z - benchBlameZ;
  const avoidDev = focalData.SDS_z - benchAvoidZ;
  const absB = Math.abs(blameDev), absA = Math.abs(avoidDev);
  const tot = absB + absA || 1;
  const blameSide = absB / tot;
  const avoidSide = absA / tot;
  let dom = "balanced";
  if (Math.abs(blameSide - avoidSide) > 0.10) {
    dom = blameSide > avoidSide ? "BLAME-side deviation" : "AVOIDANCE-side deviation";
  }
  return (
    <div className="card">
      <div className="card-eyebrow-row">
        <span className="card-eyebrow">Stigma profile</span>
        <span className="info-icon">i</span>
      </div>
      <div className="card-title">Blame &amp; Avoidance</div>
      <div className="card-plain">
        Two parallel channels. Glyphs show absolute scale (0–5 of max).
        Marker on each row is the active benchmark.
      </div>
      <div className="card-body">
        <div className="stigma-row">
          <div className="stigma-label blame">
            BLAME<span className="sub">cognitive</span>
          </div>
          <GlyphRow
            count={nFilled(blameRaw)}
            color="#F0AC4A"
            kind="arrow"
            benchPct={benchPct(benchBlame)}
            benchLabel={`${BENCH_GLYPH[benchKey]} ${benchBlame.toFixed(1)}`}
          />
          <div className="stigma-val">
            <span className="v blame num">{blameRaw.toFixed(2)}</span>
          </div>
        </div>
        <div className="stigma-row">
          <div className="stigma-label avoid">
            AVOIDANCE<span className="sub">affective</span>
          </div>
          <GlyphRow
            count={nFilled(avoidRaw)}
            color="#4FB8D6"
            kind="crescent"
            benchPct={benchPct(benchAvoid)}
            benchLabel={`${BENCH_GLYPH[benchKey]} ${benchAvoid.toFixed(1)}`}
          />
          <div className="stigma-val">
            <span className="v avoid num">{avoidRaw.toFixed(2)}</span>
          </div>
        </div>
        <div className="seesaw">
          <div className="seesaw-eyebrow">
            <span>Dominant channel</span>
            <span>{dom}</span>
          </div>
          <div className="seesaw-bar">
            <div className="avoid-side" style={{ width: avoidSide * 100 + "%" }} />
            <div className="blame-side" style={{ width: blameSide * 100 + "%" }} />
            <div className="midline" style={{ left: "50%" }} />
          </div>
          <div className="seesaw-pct">
            <span className="avoid">AVOIDANCE-side <span>{Math.round(avoidSide * 100)}%</span></span>
            <span className="blame">BLAME-side <span>{Math.round(blameSide * 100)}%</span></span>
          </div>
        </div>
      </div>
      <Accordion items={items.stigma} benchKey={benchKey} focalId={focalData._id} focalCode={focalCode} />
    </div>
  );
}

// ─── TILE 3 — Knowledge ────────────────────────────────────────────────
function KnowledgeTile({ focalData, focalCode, benchKey }) {
  const hks = focalData.HKS;
  const benchHKS = bench[benchKey].HKS;
  const fillPct = (hks / 10) * 100;
  const benchPct = (benchHKS / 10) * 100;
  const benchFill = benchKey === "Republicans" ? "#DC4040" : benchKey === "Democrats" ? "#4A82E0" : "#07090F";
  const benchStroke = benchKey === "All" ? "#E8EAED" : "#fff";
  const benchTextFill = benchKey === "All" ? "#E8EAED" : "#fff";
  const benchFontSize = benchKey === "All" ? 7 : 8;
  return (
    <div className="card">
      <div className="card-eyebrow-row">
        <span className="card-eyebrow">Information</span>
        <span className="info-icon">i</span>
      </div>
      <div className="card-title">HIV knowledge</div>
      <div className="card-plain">
        Sum of correct answers across 10 factual questions (transmission, treatment, prevention, U.S. epidemiology).
      </div>
      <div className="card-body">
        <div className="knowledge-num-row">
          <span className="knowledge-num num">{hks.toFixed(1)}</span>
          <span className="knowledge-denom num">/ 10</span>
          <span className="knowledge-rank num">{focalData.HKS_rank} OF 16</span>
        </div>
        <div className="knowledge-bar-wrap">
          <div className="knowledge-bar-track" />
          <div className="knowledge-bar-fill" style={{ width: fillPct + "%" }} />
          <div className="knowledge-bar-bench" style={{ left: benchPct + "%" }}>
            <svg width="22" height="22" viewBox="-11 -11 22 22">
              <circle cx="0" cy="0" r="9" fill={benchFill} stroke={benchStroke} strokeWidth="1.5" />
              <text x="0" y="3" textAnchor="middle" fontSize={benchFontSize} fontWeight="800" fill={benchTextFill} fontFamily="Inter">
                {BENCH_GLYPH[benchKey]}
              </text>
            </svg>
          </div>
          <div className="knowledge-bar-labels">
            <span>0</span><span>5</span><span>10</span>
          </div>
        </div>
      </div>
      <Accordion items={items.know} benchKey={benchKey} focalId={focalData._id} focalCode={focalCode} />
    </div>
  );
}

// ─── TILE 4 — Contact ──────────────────────────────────────────────────
function ContactTile({ focalData, focalCode, benchKey }) {
  const g = BENCH_GLYPH[benchKey];
  return (
    <div className="card">
      <div className="card-eyebrow-row">
        <span className="card-eyebrow">Proximity</span>
        <span className="info-icon">i</span>
      </div>
      <div className="card-title">Personal contact</div>
      <div className="card-plain">
        Knowing affected people is the lever that bypasses the stigma architecture entirely.
      </div>
      <div className="card-body">
        <div className="contact-pair">
          <div className="contact-cell">
            <div className="contact-num">
              <span className="num">{Math.round(focalData.CON_LGB * 100)}</span>
              <span className="pct">%</span>
            </div>
            <div className="contact-label">know an LGBTQ person</div>
            <div className="contact-bench">
              <span className={`bench-glyph ${g}`}>{g}</span>
              <span>{Math.round(bench[benchKey].CON_LGB * 100)}%</span>
            </div>
            <div className="contact-rank-pill">{focalData.CON_LGB_rank} OF 16</div>
          </div>
          <div className="contact-cell">
            <div className="contact-num accent">
              <span className="num">{Math.round(focalData.CON_HIV * 100)}</span>
              <span className="pct">%</span>
            </div>
            <div className="contact-label">know someone with HIV</div>
            <div className="contact-bench">
              <span className={`bench-glyph ${g}`}>{g}</span>
              <span>{Math.round(bench[benchKey].CON_HIV * 100)}%</span>
            </div>
            <div className="contact-rank-pill">{focalData.CON_HIV_rank} OF 16</div>
          </div>
        </div>
      </div>
      <Accordion items={items.contact} benchKey={benchKey} focalId={focalData._id} focalCode={focalCode} />
    </div>
  );
}

// ─── Topology (stigma 2x2) ─────────────────────────────────────────────
function Topology({ focalId, focalCode, benchKey }) {
  const W = 640, H = 380, M = { t: 32, r: 38, b: 60, l: 78 };
  const benchMBSz = bench[benchKey].MBS.z;
  const benchSDSz = bench[benchKey].SDS.z;
  const range = 1.5;
  const xs = (z) => M.l + (z + range) / (2 * range) * (W - M.l - M.r);
  const ys = (z) => H - M.b - (z + range) / (2 * range) * (H - M.t - M.b);

  const focal = segData[String(focalId)];
  const fdx = focal.MBS_z - benchMBSz;
  const fdy = focal.SDS_z - benchSDSz;
  // Bubble radius scales with population. Linear (not sqrt) gives more
  // visible size differences across the 16 segments.
  const focalR = (p) => 8 + (p || 0) * 220;
  const otherR = (p) => 4 + (p || 0) * 200;
  const fr = focalR(focal.pop);
  const fjpQuad = (fdx < 0 && fdy < 0) ? "ACCEPTED"
                : (fdx < 0 && fdy >= 0) ? "DISTANCED"
                : (fdx >= 0 && fdy < 0) ? "JUDGED"
                : "OSTRACIZED";
  const quadStrat = {
    "ACCEPTED": "Lower blame, lower avoidance · deploy, don't persuade",
    "DISTANCED": "Lower blame, higher avoidance · exposure-based",
    "JUDGED": "Higher blame, lower avoidance · reframe-driven",
    "OSTRACIZED": "Higher blame, higher avoidance · full stigma reduction",
  };

  const benchSeg = {
    R: { dx: bench.Republicans.MBS.z - benchMBSz, dy: bench.Republicans.SDS.z - benchSDSz },
    D: { dx: bench.Democrats.MBS.z - benchMBSz, dy: bench.Democrats.SDS.z - benchSDSz },
    US: { dx: bench.All.MBS.z - benchMBSz, dy: bench.All.SDS.z - benchSDSz },
  };

  return (
    <div className="card panel">
      <div className="card-eyebrow-row">
        <span className="card-eyebrow">Stigma architecture</span>
        <span className="info-icon">i</span>
      </div>
      <div className="panel-title">The two-by-two of HIV stigma</div>
      <div className="panel-plain">
        Standardized deviation from the active benchmark on Blame (cognitive) and Avoidance (affective).
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <rect x={xs(0)} y={ys(range)} width={xs(range) - xs(0)} height={ys(0) - ys(range)} fill="rgba(231,72,72,0.10)" />
        <rect x={xs(-range)} y={ys(range)} width={xs(0) - xs(-range)} height={ys(0) - ys(range)} fill="rgba(79,184,214,0.08)" />
        <rect x={xs(0)} y={ys(0)} width={xs(range) - xs(0)} height={ys(-range) - ys(0)} fill="rgba(240,172,74,0.08)" />
        <rect x={xs(-range)} y={ys(0)} width={xs(0) - xs(-range)} height={ys(-range) - ys(0)} fill="rgba(47,224,121,0.10)" />
        <line x1={xs(0)} y1={M.t} x2={xs(0)} y2={H - M.b} stroke="#2A3550" strokeDasharray="3,3" />
        <line x1={M.l} y1={ys(0)} x2={W - M.r} y2={ys(0)} stroke="#2A3550" strokeDasharray="3,3" />
        {[
          ["DISTANCED", "#4FB8D6", "avoidance, not blame", xs(-range * 0.55), M.t + 18],
          ["OSTRACIZED", "#E74848", "both channels active", xs(range * 0.55), M.t + 18],
          ["ACCEPTED", "#2FE079", "deploy as champions", xs(-range * 0.55), H - M.b - 22],
          ["JUDGED", "#F0AC4A", "blame, not avoidance", xs(range * 0.55), H - M.b - 22],
        ].map(([txt, color, sub, x, y]) => (
          <g key={txt}>
            <text x={x} y={y} fill={color} fontSize="10" fontWeight="800" letterSpacing="0.14em" textAnchor="middle" fontFamily="Inter">
              {txt}
            </text>
            <text x={x} y={y + 13} fill={color} fontSize="9" fontWeight="500" textAnchor="middle" opacity="0.7" fontFamily="Inter">
              {sub}
            </text>
          </g>
        ))}
        <text x={W / 2} y={H - 16} fill="#A8B5C5" fontSize="11" letterSpacing="0.16em" textAnchor="middle" fontWeight="600" fontFamily="Inter">
          {`BLAME (z-deviation from ${BENCH_GLYPH[benchKey]}) →`}
        </text>
        <text x="18" y={H / 2} fill="#A8B5C5" fontSize="11" letterSpacing="0.16em" textAnchor="middle" fontWeight="600" transform={`rotate(-90 18 ${H / 2})`} fontFamily="Inter">
          {`AVOIDANCE (z-deviation from ${BENCH_GLYPH[benchKey]}) →`}
        </text>
        {Object.entries(segData).filter(([id]) => +id !== focalId).map(([id, s]) => {
          const seg = +id;
          const dx = s.MBS_z - benchMBSz;
          const dy = s.SDS_z - benchSDSz;
          if (Math.abs(dx) > range || Math.abs(dy) > range) return null;
          const r = otherR(s.pop);
          const isGop = GOP_SEGS.has(seg);
          return (
            <g key={id}>
              <circle cx={xs(dx)} cy={ys(dy)} r={r}
                fill={isGop ? "rgba(231,72,72,0.18)" : "rgba(74,130,224,0.18)"}
                stroke={isGop ? "rgba(231,72,72,0.40)" : "rgba(74,130,224,0.40)"}
                strokeWidth="1.2" />
              <text x={xs(dx)} y={ys(dy) + 3.5} textAnchor="middle" fontSize="9" fill="#6A7488" fontWeight="500" fontFamily="Inter">
                {SEG_NAME[seg]}
              </text>
            </g>
          );
        })}
        {/* Focal */}
        <circle cx={xs(fdx)} cy={ys(fdy)} r={fr + 6} fill="none" stroke="#5AC8DC" strokeWidth="1.8" strokeDasharray="3,3" opacity="0.85" />
        <circle cx={xs(fdx)} cy={ys(fdy)} r={fr} fill="#2FE079" stroke="#fff" strokeWidth="2.5" />
        <text x={xs(fdx)} y={ys(fdy) + 4.5} textAnchor="middle" fontSize="12" fill="#06241A" fontWeight="800" fontFamily="Inter">
          {focalCode}
        </text>
        {Object.entries(benchSeg).map(([type, p]) => {
          if (Math.abs(p.dx) > range || Math.abs(p.dy) > range) return null;
          const active = BENCH_GLYPH[benchKey] === type;
          return <BenchGlyph key={type} cx={xs(p.dx)} cy={ys(p.dy)} type={type} active={active} r={12} />;
        })}
      </svg>
      <div className="quad-tag">
        <span className="quad-tag-eyebrow">{focalCode} is in:</span>
        <span className="quad-tag-name">{fjpQuad}</span>
        <span className="quad-tag-strat">{quadStrat[fjpQuad]}</span>
      </div>
    </div>
  );
}

// ─── Trust list (top 8 by delta) ───────────────────────────────────────
function TrustList({ focalId, focalCode, benchKey }) {
  const rows = useMemo(() => {
    return trust
      .map((t) => ({
        ...t,
        fjp: t.by_segment?.[String(focalId)] ?? null,
        benchVal: t[benchKey] ?? null,
      }))
      .filter((t) => t.fjp != null && t.benchVal != null)
      .map((t) => ({ ...t, delta: t.fjp - t.benchVal }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 8);
  }, [focalId, benchKey]);
  return (
    <div className="card panel">
      <div className="card-eyebrow-row">
        <span className="card-eyebrow">Top over-index messengers</span>
        <span className="info-icon">i</span>
      </div>
      <div className="panel-title">
        Messengers {focalCode} trusts more than <span>{BENCH_FULL[benchKey]}</span>
      </div>
      <div className="panel-plain">
        From the 22 deployable messengers tested (personal physician excluded).
      </div>
      <div className="trust-grid">
        <div className="trust-head">
          <span>#</span><span>Messenger</span>
          <span className="right">{focalCode}</span>
          <span className="right">{BENCH_GLYPH[benchKey]}</span>
          <span className="right">Δ</span>
        </div>
        <div>
          {rows.map((t, i) => {
            const sign = t.delta >= 0 ? "+" : "";
            return (
              <div className={"trust-row" + (i < 3 ? " top-rank" : "")} key={t.code}>
                <span className="trust-rank">{i + 1}</span>
                <span className="trust-name">{t.label}</span>
                <span className="trust-num">{t.fjp.toFixed(2)}</span>
                <span className="trust-bench">{t.benchVal.toFixed(2)}</span>
                <span className="trust-delta">{sign}{t.delta.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Segment selector (mirrors the pill row at top of SegmentProfile) ──
// Stays on the HIV tab when a different segment is clicked (the
// SegmentProfile version resets profileTab to "demo"; this one doesn't).
function SegmentPills({ segments, currentIdx, onChange, tierAccent }) {
  if (!segments?.length || !onChange) return null;
  return (
    <div style={{ display: "flex", gap: 3, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 8, color: "#475569", fontFamily: "'Nunito',sans-serif", marginRight: 4 }}>SEGMENT:</span>
      {segments.map((s, i) => {
        const isSel = currentIdx === i;
        const accent = tierAccent?.[s.tier] || "#5b93c7";
        return (
          <button
            key={s.id}
            onClick={() => onChange(i)}
            style={{
              fontSize: 8, padding: "3px 8px", borderRadius: 3, cursor: "pointer",
              border: isSel ? `1px solid ${accent}` : "1px solid #1e293b",
              background: isSel ? (s.party === "GOP" ? "#2a1015" : "#0f1a2e") : "transparent",
              color: s.party === "GOP" ? "#fca5a5" : "#93c5fd",
              fontFamily: "'Nunito',sans-serif",
              fontWeight: isSel ? 700 : 400,
              transition: "all 0.15s",
            }}
          >
            {s.code}
          </button>
        );
      })}
    </div>
  );
}

// ─── Top-level HIV tab ────────────────────────────────────────────────
export default function HIVTab({ segmentId, segmentCode, segments, currentIdx, onChangeSegment, tierAccent }) {
  const [benchKey, setBenchKey] = useState("Democrats");
  const focalData = useMemo(() => {
    const d = segData[String(segmentId)];
    return d ? { ...d, _id: segmentId } : null;
  }, [segmentId]);

  if (!focalData) {
    return (
      <div className="hiv-tab-root" style={{ padding: 24, color: "#6A7488", fontSize: 12 }}>
        No HIV data for segment id={segmentId}.
      </div>
    );
  }

  const focalCode = segmentCode || SEG_NAME[segmentId] || `S${segmentId}`;

  return (
    <div className="hiv-tab-root">
      <SegmentPills
        segments={segments}
        currentIdx={currentIdx}
        onChange={onChangeSegment}
        tierAccent={tierAccent}
      />
      <CompareBar current={benchKey} onChange={setBenchKey} focalCode={focalCode} />

      <div className="section-break">
        <h3>Four Headline Measures</h3>
        <p>
          <span className="bench-glyph R" style={{ display: "inline-flex", width: 14, height: 14, fontSize: 7 }}>R</span>
          <span className="bench-glyph D" style={{ display: "inline-flex", width: 14, height: 14, fontSize: 7 }}>D</span>
          <span className="bench-glyph US" style={{ display: "inline-flex", width: 14, height: 14, fontSize: 6.5 }}>US</span>
          &nbsp;benchmark glyphs appear throughout. Active toggle's glyph is solid; the other two dim.
        </p>
      </div>

      <div className="row grid grid-4">
        <SCFTile focalData={focalData} focalCode={focalCode} benchKey={benchKey} />
        <StigmaTile focalData={focalData} focalCode={focalCode} benchKey={benchKey} />
        <KnowledgeTile focalData={focalData} focalCode={focalCode} benchKey={benchKey} />
        <ContactTile focalData={focalData} focalCode={focalCode} benchKey={benchKey} />
      </div>

      <div className="section-break" style={{ marginTop: 32 }}>
        <h3>Where They Sit Strategically</h3>
        <p>Stigma topology — coordinates are deviations from the active toggle benchmark.</p>
      </div>

      <div className="row grid grid-1-1">
        <Topology focalId={segmentId} focalCode={focalCode} benchKey={benchKey} />
        <TrustList focalId={segmentId} focalCode={focalCode} benchKey={benchKey} />
      </div>

      <div className="footer">
        {manifest.study} · Reservoir Communications Group / HAIG · Confidential · n={manifest.n_raw} (effective {Math.round(manifest.effective_n)})
      </div>
    </div>
  );
}
