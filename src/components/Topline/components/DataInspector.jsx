// Data Inspector drawer — slides in from the right and exposes the
// flattened long-format rows behind the topline. Ported from
// dashboard_template.html (.inspector / renderInspector / toggleInspector,
// lines 471-485 and 1992-2030). Adds a CSV download for the filtered set.

import { useMemo, useState } from "react";
import { flattenForInspector } from "../utils/flatten";

function fmt(v, d = 1) {
  if (v === "" || v === undefined || v === null) return "";
  return typeof v === "number" ? v.toFixed(d) : v;
}
function sigGlyph(sig) {
  if (sig === 2) return "••";
  if (sig === 1) return "•";
  return "";
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadCsv(rows, studyId) {
  if (!rows.length) return;
  const header = ["source","item","code","wave","cut","n","n_wgt","metric","top3","bot3","mean","net","pct","val","stat","sig"];
  const lines = [header.join(",")];
  rows.forEach((r) => {
    lines.push([
      r.source, r.item, r.code, r.wave, r.cut, r.n, r.n_wgt, r.metric,
      r.top3, r.bot3, r.mean, r.net, r.pct, r.val, r.z, r.sig,
    ].map(csvEscape).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${studyId || "PRISM"}_data_long.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DataInspector({ open, onClose, data }) {
  const [filter, setFilter] = useState("");
  const allRows = useMemo(() => flattenForInspector(data), [data]);
  const filtered = useMemo(() => {
    if (!filter) return allRows;
    const f = filter.toLowerCase();
    return allRows.filter((r) =>
      [r.source, r.item, r.code, r.cut, r.wave, r.metric]
        .some((v) => (v || "").toString().toLowerCase().includes(f))
    );
  }, [allRows, filter]);

  const bySource = {};
  filtered.forEach((r) => { bySource[r.source] = (bySource[r.source] || 0) + 1; });

  return (
    <div className={"inspector" + (open ? " open" : "")}>
      <div className="hdr">
        <h3>Source Data (long format)</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => downloadCsv(filtered, data?.study?.id)}>CSV</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="body">
        <div className="filter">
          <input
            type="text"
            placeholder="Filter by item, code, cut, wave, source, or metric…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 10, color: "var(--ink-soft)", fontSize: 11 }}>
          <strong>{filtered.length} rows</strong>{filter ? ` (of ${allRows.length})` : ""} ·
          {" "}sources:{" "}
          {Object.entries(bySource).map(([s, n]) => (
            <span key={s} style={{ marginRight: 10 }}>
              <code>{s}</code>: {n}
            </span>
          ))}
        </div>
        <table>
          <thead>
            <tr>
              <th>source</th><th>item</th><th>code</th><th>wave</th><th>cut</th>
              <th>n</th><th>metric</th><th>top3</th><th>bot3</th><th>mean</th>
              <th>net</th><th>pct</th><th>val</th><th>stat</th><th>sig</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i}>
                <td><code>{r.source}</code></td>
                <td>{r.item}</td>
                <td>{r.code || ""}</td>
                <td>{r.wave || ""}</td>
                <td>{r.cut}</td>
                <td>{r.n}</td>
                <td>{r.metric || ""}</td>
                <td>{fmt(r.top3, 1)}</td>
                <td>{fmt(r.bot3, 1)}</td>
                <td>{fmt(r.mean, 3)}</td>
                <td>{fmt(r.net, 1)}</td>
                <td>{fmt(r.pct, 1)}</td>
                <td>{fmt(r.val, 3)}</td>
                <td>{(r.z || 0).toFixed(2)}</td>
                <td>{sigGlyph(r.sig)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
