// Phase B — HIV Persona Profile Tab.
// Parameterized by the focal segment (the segment whose profile is being
// viewed). Reads from src/data/hiv/* and renders three sections:
//   1. Four headline tiles (SCF · Stigma · Knowledge · Personal Contact)
//      with item-level accordions
//   2. Strategic positioning scatter (16 segments)
//   3. Trust messengers (22 items)
// Plus a compare bar (All / Republicans / Democrats) that drives every
// benchmark glyph and delta on the tab.

import { useState, useMemo } from "react";
import segData from "../data/hiv/seg_data.json";
import items from "../data/hiv/items.json";
import bench from "../data/hiv/bench.json";
import trust from "../data/hiv/trust.json";
import manifest from "../data/hiv/manifest.json";

// ─── Helpers ────────────────────────────────────────────────────────────
const BENCHES = ["All", "Republicans", "Democrats"];
const BENCH_LABEL = { All: "US", Republicans: "R", Democrats: "D" };
const BENCH_COLOR = { All: "#94a3b8", Republicans: "#ef4444", Democrats: "#3b82f6" };

function fmt(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toFixed(digits);
}
function fmtPct(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Math.round(v * 100) + "%";
}
function fmtDelta(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const s = v > 0 ? "+" : "";
  return s + Number(v).toFixed(digits);
}
function rank(n) {
  if (!n) return "—";
  return `#${n} of 16`;
}

// ─── Compare bar (All / Republicans / Democrats) ────────────────────────
function CompareBar({ current, onChange }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
      background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8,
      marginBottom: 14,
    }}>
      <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: 1, marginRight: 6 }}>
        COMPARE VS:
      </span>
      {BENCHES.map((b) => {
        const active = current === b;
        const c = BENCH_COLOR[b];
        return (
          <button
            key={b}
            onClick={() => onChange(b)}
            style={{
              padding: "5px 12px", borderRadius: 4, fontSize: 11, fontWeight: 700,
              cursor: "pointer", border: `1px solid ${active ? c : "#334155"}`,
              background: active ? c + "33" : "transparent",
              color: active ? c : "#94a3b8", fontFamily: "'JetBrains Mono', monospace",
              transition: "all 0.15s",
            }}
          >
            {BENCH_LABEL[b]} · {b}
          </button>
        );
      })}
      <span style={{ marginLeft: "auto", fontSize: 9.5, color: "#475569", fontStyle: "italic" }}>
        Toggle drives benchmark glyphs and deltas on every tile below
      </span>
    </div>
  );
}

// ─── Generic tile wrapper ───────────────────────────────────────────────
function Tile({ title, subtitle, accent, children }) {
  return (
    <div style={{
      background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8,
      padding: 14, display: "flex", flexDirection: "column", gap: 10,
      minHeight: 320,
    }}>
      <div style={{ borderBottom: "1px solid #1e293b", paddingBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── BIG-VALUE row ──────────────────────────────────────────────────────
function ValueWithDelta({ value, deltaValue, valueLabel, deltaLabel, color }) {
  const isPos = deltaValue > 0;
  const deltaColor = deltaValue == null ? "#64748b" : isPos ? "#34d399" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "'Nunito',sans-serif", lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 8, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>
          {valueLabel}
        </div>
      </div>
      {deltaValue != null && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: deltaColor, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
            {fmtDelta(deltaValue)}
          </div>
          <div style={{ fontSize: 8, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>
            {deltaLabel}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Item-level accordion ───────────────────────────────────────────────
function ItemsAccordion({ items, segmentId, benchKey, formatValue = fmt }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: "auto" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "6px 10px", background: "#1e293b", border: "none",
          color: "#94a3b8", fontSize: 10, fontWeight: 700, textAlign: "left",
          cursor: "pointer", borderRadius: 4, letterSpacing: 0.5,
        }}
      >
        {open ? "▼" : "▶"} ITEMS ({items.length})
      </button>
      {open && (
        <table style={{ width: "100%", marginTop: 6, fontSize: 10, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e293b" }}>
              <th style={{ textAlign: "left", padding: "4px 6px", color: "#64748b", fontWeight: 600 }}>Item</th>
              <th style={{ textAlign: "right", padding: "4px 6px", color: "#cbd5e1", fontWeight: 700, width: 50 }}>Focal</th>
              <th style={{ textAlign: "right", padding: "4px 6px", color: "#94a3b8", fontWeight: 600, width: 50 }}>{benchKey.slice(0,3)}</th>
              <th style={{ textAlign: "right", padding: "4px 6px", color: "#94a3b8", fontWeight: 600, width: 50 }}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const focal = it.by_segment?.[String(segmentId)] ?? null;
              const benchVal = it[benchKey] ?? null;
              const delta = (focal != null && benchVal != null) ? focal - benchVal : null;
              return (
                <tr key={it.code} style={{ borderBottom: "1px solid #1a2030" }}>
                  <td style={{ padding: "4px 6px", color: "#cbd5e1" }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#64748b", marginRight: 4 }}>
                      {it.code}
                    </span>
                    {it.stem}
                  </td>
                  <td style={{ textAlign: "right", padding: "4px 6px", color: "#e2e8f0", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                    {focal == null ? "—" : formatValue(focal)}
                  </td>
                  <td style={{ textAlign: "right", padding: "4px 6px", color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace" }}>
                    {benchVal == null ? "—" : formatValue(benchVal)}
                  </td>
                  <td style={{ textAlign: "right", padding: "4px 6px", fontFamily: "'JetBrains Mono',monospace", color: delta > 0 ? "#34d399" : delta < 0 ? "#f87171" : "#64748b", fontWeight: 700 }}>
                    {delta == null ? "—" : fmtDelta(delta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Tile 1: SCF (Compassion ↔ Sanctity) ───────────────────────────────
function SCFTile({ data, benchKey }) {
  const focal = data?.SCF_raw;
  const benchVal = bench[benchKey]?.SCF?.raw;
  const delta = focal != null && benchVal != null ? focal - benchVal : null;
  return (
    <Tile title="Compassion ↔ Sanctity" subtitle="Moral foundation balance (SCF = PFS − CFS)" accent="#a78bfa">
      <ValueWithDelta
        value={fmt(focal)}
        deltaValue={delta}
        valueLabel="SCF index"
        deltaLabel={`vs ${benchKey}`}
        color="#a78bfa"
      />
      <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>
        Rank: <strong>{rank(data?.SCF_raw_rank)}</strong> · Higher = sanctity/purity emphasis;
        lower = care/compassion emphasis.
      </div>
      <ItemsAccordion items={items.scf} segmentId={data?._id} benchKey={benchKey} />
    </Tile>
  );
}

// ─── Tile 2: Stigma (Blame & Avoidance) ────────────────────────────────
function StigmaTile({ data, benchKey }) {
  const mbs = data?.MBS_raw, sds = data?.SDS_raw;
  const bMbs = bench[benchKey]?.MBS?.raw, bSds = bench[benchKey]?.SDS?.raw;
  return (
    <Tile title="HIV Stigma Profile" subtitle="Moral Blame (MBS) and Social Distance (SDS)" accent="#f87171">
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f87171", fontFamily: "'Nunito',sans-serif", lineHeight: 1 }}>
            {fmt(mbs)}
          </div>
          <div style={{ fontSize: 8, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>
            MBS · Blame (rank #{data?.MBS_raw_rank})
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>
            Δ vs {benchKey}: {fmtDelta(mbs - bMbs)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fbbf24", fontFamily: "'Nunito',sans-serif", lineHeight: 1 }}>
            {fmt(sds)}
          </div>
          <div style={{ fontSize: 8, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>
            SDS · Avoidance (rank #{data?.SDS_raw_rank})
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>
            Δ vs {benchKey}: {fmtDelta(sds - bSds)}
          </div>
        </div>
      </div>
      <ItemsAccordion items={items.stigma} segmentId={data?._id} benchKey={benchKey} />
    </Tile>
  );
}

// ─── Tile 3: Knowledge (HKS) ───────────────────────────────────────────
function KnowledgeTile({ data, benchKey }) {
  const hks = data?.HKS;
  const benchVal = bench[benchKey]?.HKS;
  const pct = hks != null ? (hks / 10) * 100 : 0;
  return (
    <Tile title="HIV Knowledge (HKS)" subtitle="Sum of awareness items 0-10 (K5 foil excluded)" accent="#34d399">
      <ValueWithDelta
        value={fmt(hks, 1) + " / 10"}
        deltaValue={hks != null && benchVal != null ? hks - benchVal : null}
        valueLabel={`rank #${data?.HKS_rank ?? "—"}`}
        deltaLabel={`vs ${benchKey}`}
        color="#34d399"
      />
      <div style={{ height: 10, background: "#1e293b", borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#34d399", transition: "width 0.4s" }} />
        {benchVal != null && (
          <div style={{
            position: "absolute", left: `${(benchVal / 10) * 100}%`, top: -3,
            width: 2, height: 16, background: BENCH_COLOR[benchKey],
          }} title={`${benchKey} benchmark: ${fmt(benchVal, 1)}`} />
        )}
      </div>
      <ItemsAccordion items={items.know} segmentId={data?._id} benchKey={benchKey} formatValue={(v) => fmtPct(v)} />
    </Tile>
  );
}

// ─── Tile 4: Personal Contact ─────────────────────────────────────────
function ContactTile({ data, benchKey }) {
  const conH = data?.CON_HIV, conL = data?.CON_LGB;
  const bH = bench[benchKey]?.CON_HIV, bL = bench[benchKey]?.CON_LGB;
  return (
    <Tile title="Personal Contact" subtitle="Knows someone with HIV / knows someone LGB" accent="#60a5fa">
      <div style={{ display: "flex", gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#60a5fa", fontFamily: "'Nunito',sans-serif", lineHeight: 1 }}>
            {fmtPct(conH)}
          </div>
          <div style={{ fontSize: 8, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>
            CON-HIV · rank #{data?.CON_HIV_rank ?? "—"}
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>
            Δ {benchKey}: {fmtDelta((conH - bH) * 100, 1)}pp
          </div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa", fontFamily: "'Nunito',sans-serif", lineHeight: 1 }}>
            {fmtPct(conL)}
          </div>
          <div style={{ fontSize: 8, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>
            CON-LGB · rank #{data?.CON_LGB_rank ?? "—"}
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>
            Δ {benchKey}: {fmtDelta((conL - bL) * 100, 1)}pp
          </div>
        </div>
      </div>
      <ItemsAccordion items={items.contact} segmentId={data?._id} benchKey={benchKey} formatValue={(v) => fmtPct(v)} />
    </Tile>
  );
}

// ─── Section 2: Strategic positioning scatter ──────────────────────────
function StrategicScatter({ focalId }) {
  // X = MBS_raw (stigma), Y = SCF_raw (sanctity-care). Size = pop.
  const segs = Object.entries(segData).map(([id, d]) => ({ id: +id, ...d }));
  const xs = segs.map((s) => s.MBS_raw);
  const ys = segs.map((s) => s.SCF_raw);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);

  const W = 560, H = 320, PAD = 36;
  const xScale = (x) => PAD + ((x - xMin) / (xMax - xMin)) * (W - 2 * PAD);
  const yScale = (y) => H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD);

  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: 14, marginTop: 14 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#a78bfa", letterSpacing: 1.5, marginBottom: 8 }}>
        STRATEGIC POSITIONING · 16 segments
      </div>
      <svg width={W} height={H} style={{ background: "#0b0e13", borderRadius: 4 }}>
        {/* Axes */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#334155" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#334155" />
        <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
          Stigma (MBS) →
        </text>
        <text x={10} y={H / 2} textAnchor="middle" fontSize="10" fill="#94a3b8" transform={`rotate(-90, 10, ${H / 2})`}>
          Sanctity emphasis (SCF) →
        </text>
        {/* Bubbles */}
        {segs.map((s) => {
          const cx = xScale(s.MBS_raw);
          const cy = yScale(s.SCF_raw);
          const r = Math.max(4, Math.sqrt(s.pop || 0) * 30);
          const isFocal = s.id === focalId;
          return (
            <g key={s.id}>
              <circle
                cx={cx} cy={cy} r={r}
                fill={isFocal ? "#a78bfa" : "#475569"}
                fillOpacity={isFocal ? 0.85 : 0.5}
                stroke={isFocal ? "#c4b5fd" : "#334155"}
                strokeWidth={isFocal ? 2 : 1}
              />
              <text
                x={cx} y={cy + 3} textAnchor="middle" fontSize="9"
                fontWeight={isFocal ? 800 : 500}
                fill={isFocal ? "#fff" : "#cbd5e1"}
              >
                {s.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Section 3: Trust Messengers ──────────────────────────────────────
function TrustMessengers({ focalId, benchKey }) {
  const sorted = useMemo(() => {
    return [...trust].sort((a, b) => {
      const bv = b.by_segment?.[String(focalId)] ?? -Infinity;
      const av = a.by_segment?.[String(focalId)] ?? -Infinity;
      return bv - av;
    });
  }, [focalId]);
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: 14, marginTop: 14 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#fbbf24", letterSpacing: 1.5, marginBottom: 8 }}>
        TRUST MESSENGERS · sorted by focal segment ({sorted.length} items)
      </div>
      <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #1e293b" }}>
            <th style={{ textAlign: "left", padding: "5px 8px", color: "#64748b", fontWeight: 600 }}>Messenger</th>
            <th style={{ textAlign: "right", padding: "5px 8px", color: "#cbd5e1", fontWeight: 700, width: 70 }}>Focal</th>
            <th style={{ textAlign: "right", padding: "5px 8px", color: "#94a3b8", fontWeight: 600, width: 70 }}>{benchKey}</th>
            <th style={{ textAlign: "right", padding: "5px 8px", color: "#94a3b8", fontWeight: 600, width: 60 }}>Δ</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const focal = t.by_segment?.[String(focalId)] ?? null;
            const benchVal = t[benchKey] ?? null;
            const delta = focal != null && benchVal != null ? focal - benchVal : null;
            return (
              <tr key={t.code} style={{ borderBottom: "1px solid #1a2030" }}>
                <td style={{ padding: "5px 8px", color: "#e2e8f0" }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#64748b", marginRight: 4 }}>
                    {t.code}
                  </span>
                  {t.label}
                </td>
                <td style={{ textAlign: "right", padding: "5px 8px", color: "#e2e8f0", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                  {fmt(focal)}
                </td>
                <td style={{ textAlign: "right", padding: "5px 8px", color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace" }}>
                  {fmt(benchVal)}
                </td>
                <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "'JetBrains Mono',monospace", color: delta > 0 ? "#34d399" : delta < 0 ? "#f87171" : "#64748b", fontWeight: 700 }}>
                  {fmtDelta(delta)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Manifest strip ────────────────────────────────────────────────────
function ManifestStrip() {
  return (
    <div style={{ padding: "6px 12px", background: "#0a0e16", border: "1px solid #1e293b", borderRadius: 6, marginBottom: 14, fontSize: 9.5, color: "#64748b", display: "flex", gap: 14, flexWrap: "wrap" }}>
      <span><strong style={{ color: "#94a3b8" }}>Study:</strong> {manifest.study}</span>
      <span><strong style={{ color: "#94a3b8" }}>n_raw:</strong> {manifest.n_raw}</span>
      <span><strong style={{ color: "#94a3b8" }}>effective n:</strong> {manifest.effective_n?.toFixed?.(1)}</span>
      <span><strong style={{ color: "#94a3b8" }}>Deff:</strong> {manifest.design_effect?.toFixed?.(2)}</span>
      <span><strong style={{ color: "#94a3b8" }}>weighted:</strong> IPF-raked</span>
    </div>
  );
}

// ─── Top-level HIV tab ────────────────────────────────────────────────
export default function HIVTab({ segmentId }) {
  const [benchKey, setBenchKey] = useState("Democrats");
  const focalData = useMemo(() => {
    const d = segData[String(segmentId)];
    return d ? { ...d, _id: segmentId } : null;
  }, [segmentId]);

  if (!focalData) {
    return (
      <div style={{ padding: 20, color: "#64748b", fontSize: 12 }}>
        No HIV data for this segment (id={segmentId}).
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.25s ease" }}>
      <ManifestStrip />
      <CompareBar current={benchKey} onChange={setBenchKey} />

      {/* Section 1: Four tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <SCFTile data={focalData} benchKey={benchKey} />
        <StigmaTile data={focalData} benchKey={benchKey} />
        <KnowledgeTile data={focalData} benchKey={benchKey} />
        <ContactTile data={focalData} benchKey={benchKey} />
      </div>

      {/* Section 2: Strategic scatter */}
      <StrategicScatter focalId={segmentId} />

      {/* Section 3: Trust messengers */}
      <TrustMessengers focalId={segmentId} benchKey={benchKey} />
    </div>
  );
}
