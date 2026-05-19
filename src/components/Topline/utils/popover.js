// Cell popover — wires up click-to-popover behavior on .cell elements
// via event delegation, mirroring the source's showPopover() logic. Uses
// the data-* attributes already preserved on every cell (data-top3,
// data-bot3, data-mean, data-n, data-sig, data-z, data-dt3, data-dmean,
// etc.). Lives as a hook + a single fixed-position popover element so
// React doesn't have to re-render per-cell.

import { useEffect, useRef, useState } from "react";
import { fmtPct, fmtMean, fmtDelta } from "./format";

function buildPopoverHTML(cell) {
  const row = cell.dataset.row || "";
  if (row === "delta") {
    const dt3 = parseFloat(cell.dataset.dt3);
    const dm = parseFloat(cell.dataset.dmean);
    const cut = cell.dataset.cut || "";
    const npr = parseInt(cell.dataset.npaired) || 0;
    const gain = parseInt(cell.dataset.gain) || 0;
    const loss = parseInt(cell.dataset.loss) || 0;
    const mp = cell.dataset.mp !== "" && cell.dataset.mp !== undefined
      ? parseFloat(cell.dataset.mp) : null;
    const sigd = parseInt(cell.dataset.sigd) || 0;
    const sigText = ["not sig", "sig at p<.10", "sig at p<.05", "sig at p<.01"][sigd];
    const dtDisp = Math.abs(dt3) < 0.5
      ? "—"
      : (dt3 > 0 ? "+" : "") + (Math.round(dt3 * 10) / 10) + " pp";
    const noDiscord = "no discordant pairs";
    let html = `<div class="pop-head">${cut} · Δ (POST − PRE)</div>
      <div class="pop-row"><span class="lbl">Δ Top-3</span><span class="val">${dtDisp}</span></div>
      <div class="pop-row"><span class="lbl">Δ Mean</span><span class="val">${fmtDelta(dm, "")}</span></div>
      <div class="pop-row"><span class="lbl">n (paired)</span><span class="val">${npr}</span></div>
      <div class="pop-sig"><strong>Paired test (McNemar)</strong><br>
        ${gain} respondents gained top-3 · ${loss} lost top-3<br>
        ${mp !== null ? `p = ${mp.toFixed(3)} · ${sigText}` : noDiscord}</div>`;
    return html;
  }
  if (cell.dataset.opt !== undefined) {
    const opt = cell.dataset.opt;
    const cut = cell.dataset.cut;
    const sig = parseInt(cell.dataset.sig) || 0;
    const z = cell.dataset.z !== undefined ? parseFloat(cell.dataset.z) : null;
    const t = cell.dataset.t !== undefined ? parseFloat(cell.dataset.t) : null;
    const n = parseInt(cell.dataset.n);
    let sigText = "not sig vs. rest of sample";
    if (sig === 1) sigText = "sig at p<.05 vs. rest of sample";
    if (sig === 2) sigText = "sig at p<.01 vs. rest of sample";
    let displayValue = "—";
    if (cell.dataset.pct !== undefined) {
      displayValue = parseFloat(cell.dataset.pct).toFixed(1) + "%";
    } else if (cell.dataset.val !== undefined) {
      const v = parseFloat(cell.dataset.val);
      const isMean = cell.dataset.metric === "mean";
      displayValue = isMean ? v.toFixed(3) : v.toFixed(1) + "%";
    }
    let html = `<div class="pop-head">${cut} · ${opt}</div>
      <div class="pop-row"><span class="lbl">Value</span><span class="val">${displayValue}</span></div>
      <div class="pop-row"><span class="lbl">n</span><span class="val">${n}</span></div>`;
    if (cut !== "TOTAL" && (z !== null || t !== null) && !Number.isNaN(z ?? t)) {
      const statLine = t !== null && !Number.isNaN(t)
        ? `t = ${t.toFixed(2)} · ${sigText}`
        : `z = ${z.toFixed(2)} · ${sigText}`;
      html += `<div class="pop-sig">${statLine}</div>`;
    }
    return html;
  }
  // Standard top-3 / bot-3 / mean cell
  const t3 = parseFloat(cell.dataset.top3);
  const b3 = parseFloat(cell.dataset.bot3);
  const m = parseFloat(cell.dataset.mean);
  const n = parseInt(cell.dataset.n);
  const sig = parseInt(cell.dataset.sig) || 0;
  const z = parseFloat(cell.dataset.z) || 0;
  const head = cell.dataset.row ? cell.dataset.row.toUpperCase() : "";
  let sigText = "not sig vs. rest of sample";
  if (sig === 1) sigText = "sig at p<.05 vs. rest of sample";
  if (sig === 2) sigText = "sig at p<.01 vs. rest of sample";
  return `<div class="pop-head">${cell.dataset.cut}${head ? " · " + head : ""}</div>
    <div class="pop-row"><span class="lbl">Top-3 (5-7)</span><span class="val">${fmtPct(t3)}</span></div>
    <div class="pop-row"><span class="lbl">Bot-3 (1-3)</span><span class="val">${fmtPct(b3)}</span></div>
    <div class="pop-row"><span class="lbl">Mean</span><span class="val">${fmtMean(m)}</span></div>
    <div class="pop-row"><span class="lbl">n</span><span class="val">${n}</span></div>
    <div class="pop-sig">z = ${z.toFixed(2)} · ${sigText}</div>`;
}

export function useCellPopover(containerRef) {
  const popoverRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [html, setHtml] = useState("");
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function position(cellEl, pop) {
      const rect = cellEl.getBoundingClientRect();
      const popW = 240;
      const popH = pop?.offsetHeight || 120;
      let left = rect.left + rect.width / 2 - popW / 2;
      let top = rect.bottom + 8;
      if (top + popH > window.innerHeight) top = rect.top - popH - 8;
      left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));
      setPos({ left, top });
    }

    function onClick(e) {
      const cell = e.target.closest(".cell");
      if (!cell || cell.dataset.empty) {
        setVisible(false);
        return;
      }
      setHtml(buildPopoverHTML(cell));
      setVisible(true);
      // Position after the DOM updates
      requestAnimationFrame(() => position(cell, popoverRef.current));
    }
    function onKey(e) {
      if (e.key === "Escape") setVisible(false);
    }

    container.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      container.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [containerRef]);

  return { popoverRef, visible, html, pos, hide: () => setVisible(false) };
}
