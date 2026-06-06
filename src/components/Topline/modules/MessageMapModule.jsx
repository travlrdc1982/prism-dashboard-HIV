// Message Map module (05) — message-test results from the messagemap
// pipeline. Two views in this first iteration:
//
//   1. Topline banner table: per-segment SoP% (with bootstrap CI) for each
//      of the 17 messages.
//   2. Simple SoP plot: rank-ordered bar chart of message SoP within a
//      selected basket (Total / Priority D / Priority All / GOP / DEM).
//
// The 4D cell drill-down (message × segment × arm × token with outcome
// toggle for PERSUASION / BASE) lands in a follow-up commit. Until then
// the outcome-toggle UI is intentionally absent — it would imply the
// drill-down works.
//
// Data shapes consumed:
//   dashboard.message_topline      — 17 entries, each with by_segment{}
//   dashboard.sop_simple           — 5 basket entries
//   dashboard.baskets              — basket metadata
//   dashboard.messages             — message metadata (theme, n_proofs)

import { useMemo, useState } from "react";
import { BannerTableHead } from "../components/Cell";

const DEFAULT_BASKET = "priority_d";

// Per-cell color shading for SoP%. Higher SoP = stronger green. The
// neutral mid-point for a 17-message MaxDiff is ~5.88% (uniform). Cells
// well above that read as winners; well below, as rejected. Symmetric
// around the uniform.
const UNIFORM_SOP_PCT = 100 / 17;
function sopShade(pct) {
  if (pct == null) return { background: "transparent", color: "#94a3b8" };
  const dev = pct - UNIFORM_SOP_PCT;
  if (dev >= 3)   return { background: "#065f46", color: "#6ee7b7" };  // strong winner
  if (dev >= 1.5) return { background: "#064e3b", color: "#a7f3d0" };
  if (dev >= 0.5) return { background: "#1a3a2a", color: "#a7f3d0" };
  if (dev <= -3)  return { background: "#5b1d1d", color: "#fecaca" };  // strong reject
  if (dev <= -1.5)return { background: "#3a1717", color: "#fecaca" };
  if (dev <= -0.5)return { background: "#2a1717", color: "#fecaca" };
  return { background: "#1e293b", color: "#cbd5e1" };
}

// Find a message's theme label and proof count from the messages metadata
function msgMeta(messages, msgId) {
  return messages.find((m) => m.id === msgId) || {};
}


function MessageBannerArea({ topline, segments, messages, study, basket, sopSimple }) {
  // Per-message TOTAL row comes from the basket's SoP (not from
  // message_topline, which has only per-segment data). When basket=total,
  // this is the full-sample SoP; when basket=priority_d, it's the D-side
  // persuadables aggregate; etc.
  const basketEntry = sopSimple[basket] || sopSimple.total;
  const totalSopByMsg = new Map(
    (basketEntry?.messages || []).map((m) => [m.message, m.sop_pct]),
  );
  const totalNByMsg = new Map(
    (basketEntry?.messages || []).map((m) => [m.message, m.n]),
  );

  const headerN = basketEntry?.messages?.[0]?.n ?? "—";

  // Order messages by basket SoP (best first) so the table reads top to bottom
  // as a clean ranking.
  const ranked = [...topline].sort((a, b) => {
    const sa = totalSopByMsg.get(a.message) ?? 0;
    const sb = totalSopByMsg.get(b.message) ?? 0;
    return sb - sa;
  });

  return (
    <div className="item-data">
      <div className="metric-header">
        <div className="metric-label">% SHARE OF PREFERENCE — 17-MESSAGE MAXDIFF</div>
        <div className="metric-scale-note">
          % of preference share each message would receive in a head-to-head
          comparison across the 17 tested. TOTAL column reflects the active
          basket ({basketEntry?.name || basket}). Per-segment columns are
          stable across baskets (MNL-derived SoP per segment).
        </div>
      </div>
      <table className="banner-table">
        <BannerTableHead
          segments={segments}
          totalN={headerN}
          partyA={study?.party_band_a_label}
          partyB={study?.party_band_b_label}
          showTotalLabel={(basketEntry?.name || "Total")}
        />
        <tbody>
          {ranked.map((row) => {
            const msgId = row.message;
            const meta = msgMeta(messages, msgId);
            const themeLabel = meta.theme_label || `Message ${msgId}`;
            const nProofs = meta.n_proofs ?? 1;
            const totalSop = totalSopByMsg.get(msgId);
            return (
              <tr key={msgId}>
                <td className="rlbl">
                  <span className="inf-item-code-inline">M{String(msgId).padStart(2, "0")}</span>{" "}
                  {themeLabel}
                  {nProofs > 1 && (
                    <span className="mm-token-count">
                      &nbsp;· {nProofs} {nProofs === 1 ? "token" : "tokens"}
                    </span>
                  )}
                </td>
                <td className="cell mm-cell total-cell"
                    style={sopShade(totalSop)}>
                  {totalSop != null ? `${totalSop.toFixed(1)}%` : "—"}
                </td>
                {segments.map((s) => {
                  const cell = row.by_segment?.[s.code];
                  if (!cell) {
                    return <td key={s.code} className="cell mm-cell empty" data-empty="1" />;
                  }
                  return (
                    <td key={s.code} className="cell mm-cell"
                        style={sopShade(cell.sop_pct)}
                        title={`SoP ${cell.sop_pct?.toFixed(2)}% (CI [${cell.sop_ci_low?.toFixed(2)}, ${cell.sop_ci_high?.toFixed(2)}])  ·  Utility ${cell.utility?.toFixed(0)}/100  ·  n=${cell.n}`}
                    >
                      <div className="cell-val mm-val">{cell.sop_pct?.toFixed(1)}%</div>
                      <div className="cell-sub mm-ci">
                        [{cell.sop_ci_low?.toFixed(1)}, {cell.sop_ci_high?.toFixed(1)}]
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function SimpleSopChart({ basketEntry }) {
  if (!basketEntry?.messages?.length) {
    return (
      <div className="mm-sop-empty">
        No SoP data for this basket.
      </div>
    );
  }
  const ranked = [...basketEntry.messages].sort((a, b) => b.sop_pct - a.sop_pct);
  const max = Math.max(...ranked.map((m) => m.sop_pct));
  return (
    <div className="mm-sop-chart">
      <div className="mm-sop-title">
        Share of Preference within <strong>{basketEntry.name}</strong>
        <span className="mm-sop-n"> (n = {ranked[0]?.n ?? "—"})</span>
      </div>
      <div className="mm-sop-rows">
        {ranked.map((m) => {
          const widthPct = (m.sop_pct / max) * 100;
          const above = m.sop_pct >= UNIFORM_SOP_PCT;
          return (
            <div key={m.message} className="mm-sop-row">
              <div className="mm-sop-rank">{m.rank}</div>
              <div className="mm-sop-msg-id">M{String(m.message).padStart(2, "0")}</div>
              <div className="mm-sop-bar-track">
                <div
                  className={"mm-sop-bar-fill" + (above ? " above" : " below")}
                  style={{ width: widthPct + "%" }}
                />
                <div className="mm-sop-bar-uniform"
                     style={{ left: (UNIFORM_SOP_PCT / max) * 100 + "%" }}
                     title={`Uniform = ${UNIFORM_SOP_PCT.toFixed(2)}% (17 messages, 1/17 each)`}
                />
              </div>
              <div className="mm-sop-pct">{m.sop_pct.toFixed(2)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export default function MessageMapModule({ data, module }) {
  const { message_topline: topline, sop_simple: sopSimple,
          baskets, messages, segments, study } = data;
  const [basket, setBasket] = useState(DEFAULT_BASKET);

  const basketEntry = sopSimple[basket];

  if (!topline?.length || !sopSimple) {
    return (
      <div className="module-placeholder"
           style={{ padding: "20px 24px", fontSize: 13, color: "#94a3b8",
                    fontStyle: "italic", background: "#f8fafc",
                    borderTop: "1px solid #e2e8f0" }}>
        Message map data not present in this build. Run
        <code> python scripts/refresh.py</code> to regenerate.
      </div>
    );
  }

  // Survey-pane mock copy + codebook intentionally summarized; deeper
  // methodology surfaces in the popover (future commit) and in
  // docs/METHODOLOGY for the messagemap pipeline.
  const stem = "Of these messages about U.S. HIV policy, which is the MOST persuasive — and which is the LEAST?";

  return (
    <div className="item-block mm-block">
      {/* Survey-pane: the MaxDiff card the respondent saw */}
      <div className="survey-pane mm-survey-pane">
        <div className="sp-header">
          <div className="sp-logo">PRISM</div>
          <div>STYLE.MAXDIFF</div>
        </div>
        <div className="sp-progress"><div /></div>
        <div className="sp-progress-text">MESSAGE TESTING</div>
        <div className="sp-card">
          <div className="sp-stem">{stem}</div>
          <div className="mm-survey-detail">
            14 tasks × 4 of 17 messages per task (BIBD design, 272 versions).
            Persona-tuning arm: 50% saw CORE messaging, 50% saw a
            segment-specific variant.
          </div>
          <div className="mm-survey-mock">
            <div className="mm-survey-mock-row">
              <div className="mm-pill best">MOST</div>
              <div className="mm-pill worst">LEAST</div>
              <div className="mm-mock-stim">Stimulus 1</div>
            </div>
            <div className="mm-survey-mock-row">
              <div className="mm-pill best" />
              <div className="mm-pill worst" />
              <div className="mm-mock-stim">Stimulus 2</div>
            </div>
            <div className="mm-survey-mock-row">
              <div className="mm-pill best" />
              <div className="mm-pill worst" />
              <div className="mm-mock-stim">Stimulus 3</div>
            </div>
            <div className="mm-survey-mock-row">
              <div className="mm-pill best" />
              <div className="mm-pill worst" />
              <div className="mm-mock-stim">Stimulus 4</div>
            </div>
          </div>
        </div>
      </div>

      {/* Codebook */}
      <div className="codebook-pane">
        <div className="cb-title">Codebook</div>
        <div className="cb-row"><span className="cb-key">Block</span><span className="cb-val">MaxDiff (best-worst scaling), 17 stimuli</span></div>
        <div className="cb-row"><span className="cb-key">Design</span><span className="cb-val">BIBD 272 versions × 14 tasks × 4 items/task</span></div>
        <div className="cb-row"><span className="cb-key">SoP</span><span className="cb-val">Softmax of mean B-W (normalized per respondent exposure)</span></div>
        <div className="cb-row"><span className="cb-key">Utility</span><span className="cb-val">0–100 rescale of mean B-W within segment</span></div>
        <div className="cb-row"><span className="cb-key">CI</span><span className="cb-val">300-iter respondent bootstrap (95% percentile)</span></div>
        <div className="cb-row"><span className="cb-key">Arms</span><span className="cb-val">50/50 CORE vs PERSONA-tuned variant</span></div>
        <div className="cb-row"><span className="cb-key">Tokens</span><span className="cb-val">Proof-point variants (0 = base, 1+ = added proof)</span></div>
        <div className="cb-note" style={{ marginTop: 8 }}>
          Cell-level drill-down (PERSUASION vs BASE outcomes, segment × arm
          × token) lands in a follow-up build.
        </div>
      </div>

      {/* Basket selector + topline table */}
      <div className="item-data">
        <div className="mm-basket-bar">
          <span className="mm-basket-label">BASKET</span>
          {(baskets || []).map((b) => (
            <button
              key={b.id}
              type="button"
              className={"mm-basket-btn" + (b.id === basket ? " active" : "")}
              onClick={() => setBasket(b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <MessageBannerArea
        topline={topline}
        segments={segments}
        messages={messages}
        study={study}
        basket={basket}
        sopSimple={sopSimple}
      />

      {/* Simple SoP rank chart */}
      <div className="item-data">
        <SimpleSopChart basketEntry={basketEntry} />
      </div>
    </div>
  );
}
