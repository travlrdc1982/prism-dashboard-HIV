// Flatten dashboard.json into long-format rows for the Data Inspector.
// Ported verbatim from dashboard_template.html flattenForInspector()
// (lines 1863-1990). Pulls from items, pre/post, demographics, influencer,
// and the stigma_extras knowledge + composites blocks.

export function flattenForInspector(DATA) {
  const rows = [];

  // Items (Critics-style top-3 / bot-3 / mean)
  (DATA.items || []).forEach((it) => {
    const res = DATA.item_results?.[it.id];
    if (!res) return;
    Object.entries(res).forEach(([cut, s]) => {
      rows.push({
        source: "items", item: it.id, code: it.code, wave: "", cut,
        n: s.n, n_wgt: s.n_wgt,
        mean: s.mean, top3: s.top3, bot3: s.bot3, net: s.net,
        pct: "", val: "", metric: "top3",
        sig: s.sig_top3 || 0, z: s.z_top3 || 0,
      });
    });
  });

  // Pre/Post (PRE + POST waves)
  (DATA.pre_post || []).forEach((pp) => {
    const r = DATA.pp_results?.[pp.id];
    if (!r) return;
    ["pre", "post"].forEach((wave) => {
      Object.entries(r[wave] || {}).forEach(([cut, s]) => {
        rows.push({
          source: "pre_post", item: pp.id, code: pp.code, wave: wave.toUpperCase(), cut,
          n: s.n, n_wgt: s.n_wgt,
          mean: s.mean, top3: s.top3, bot3: s.bot3, net: s.net,
          pct: "", val: "", metric: "top3",
          sig: s.sig_top3 || 0, z: s.z_top3 || 0,
        });
      });
    });
  });

  // Demographics
  (DATA.demographics || []).forEach((q) => {
    if (q.style === "binary_set" && q.items) {
      q.items.forEach((it) => {
        Object.entries(it.cuts || {}).forEach(([cut, cell]) => {
          rows.push({
            source: "demos", item: it.var, code: it.code, wave: "", cut,
            n: cell.n || "", n_wgt: "",
            mean: "", top3: "", bot3: "", net: "",
            pct: cell.val !== undefined ? cell.val : "",
            val: "", metric: "pct_yes",
            sig: cell.sig || 0, z: cell.z || 0,
          });
        });
      });
    } else if (q.freq) {
      (q.options || []).forEach(([optVal, optLabel]) => {
        Object.entries(q.freq).forEach(([cut, freqDict]) => {
          const cell = freqDict[optVal] || freqDict[String(optVal)];
          if (!cell) return;
          rows.push({
            source: "demos", item: q.var, code: `${q.id}=${optLabel}`, wave: "", cut,
            n: cell.n, n_wgt: cell.n_wgt,
            mean: "", top3: "", bot3: "", net: "",
            pct: cell.pct, val: "", metric: "pct",
            sig: cell.sig || 0, z: cell.z || 0,
          });
        });
      });
    }
  });

  // Influencer360 (5 blocks)
  (DATA.influencer || []).forEach((blk) => {
    if (blk.kind === "categorical" && blk.freq) {
      (blk.options || []).forEach(([optVal, optLabel]) => {
        Object.entries(blk.freq).forEach(([cut, freqDict]) => {
          const cell = freqDict[optVal] || freqDict[String(optVal)];
          if (!cell) return;
          rows.push({
            source: "influencer", item: blk.var, code: `${blk.id}=${optLabel}`, wave: "", cut,
            n: cell.n, n_wgt: cell.n_wgt,
            mean: "", top3: "", bot3: "", net: "",
            pct: cell.pct, val: "", metric: "pct",
            sig: cell.sig || 0, z: cell.z || 0,
          });
        });
      });
    } else if (blk.items) {
      blk.items.forEach((it) => {
        Object.entries(it.cuts || {}).forEach(([cut, cell]) => {
          rows.push({
            source: "influencer", item: it.var, code: it.code, wave: "", cut,
            n: cell.n || "", n_wgt: "",
            mean: cell.metric === "mean" ? cell.val : "",
            top3: "", bot3: "", net: "",
            pct: cell.metric !== "mean" ? cell.val : "",
            val: cell.val !== undefined ? cell.val : "",
            metric: cell.metric || "",
            sig: cell.sig || 0,
            z: cell.z !== undefined ? cell.z : (cell.t !== undefined ? cell.t : 0),
          });
        });
      });
    }
  });

  // HIV Stigma extras
  if (DATA.stigma_extras) {
    if (DATA.stigma_extras.knowledge?.items) {
      DATA.stigma_extras.knowledge.items.forEach((it) => {
        Object.entries(it.cuts || {}).forEach(([cut, cell]) => {
          rows.push({
            source: "knowledge", item: it.var, code: it.code, wave: "", cut,
            n: cell.n || "", n_wgt: "",
            mean: "", top3: "", bot3: "", net: "",
            pct: cell.val !== undefined ? cell.val : "",
            val: "", metric: "pct_aware",
            sig: cell.sig || 0, z: cell.z || 0,
          });
        });
      });
    }
    if (DATA.stigma_extras.composites?.items) {
      DATA.stigma_extras.composites.items.forEach((it) => {
        Object.entries(it.cuts || {}).forEach(([cut, cell]) => {
          rows.push({
            source: "composites", item: it.code, code: it.code, wave: "", cut,
            n: cell.n || "", n_wgt: "",
            mean: cell.val, top3: "", bot3: "", net: "",
            pct: "", val: cell.val,
            metric: "mean",
            sig: cell.sig || 0,
            z: cell.t !== undefined ? cell.t : 0,
          });
        });
      });
    }
  }

  return rows;
}
