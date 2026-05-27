#!/usr/bin/env python3
"""
Derive the HIV-tab data files from the topline dashboard.json so both
views share a single source (the topline pipeline). Option (b).

Regenerates:
  src/data/hiv/seg_data.json   — per-segment composites + CON + ranks + z
  src/data/hiv/bench.json      — All (from TOTAL) + Republicans/Democrats
                                  (population-weighted party means)
  src/data/hiv/items.json      — scf / stigma / know / contact accordions
  src/data/hiv/zparams.json    — population mean+SD per composite (for z)

Leaves untouched:
  src/data/hiv/trust.json      — topline has no trust module (wave-2 disabled)
  src/data/hiv/manifest.json   — study metadata

Polarity note: the topline labels SDS/SCS as "comfort" (higher = less
stigma). The HIV tab frames them as "avoidance/distance" (higher = more
stigma). We reverse-code (8 - val) on a 1-7 scale so the HIV tab keeps
its avoidance framing while sourcing the underlying data from the topline.

Usage: python scripts/derive_hiv_seg_data.py
"""
import json
import math

DASH = "src/data/topline/dashboard.json"
SEG_NAME = {1:"TSP",2:"CEC",3:"TC",4:"HF",5:"PP",6:"WE",7:"PFF",8:"HHN",9:"MFL",10:"VS",
            11:"UCP",12:"FJP",13:"HCP",14:"HAD",15:"HCI",16:"GHI"}
GOP = {1,2,3,4,5,6,7,8,9,10}
DEM = {11,12,13,14,15,16}
COMPOSITES = ["MBS","SDS","EDS","SCS","CFS","PFS","SCF","HKS"]
# Composites that need reverse-coding (topline=comfort → HIV tab=avoidance)
REVERSE = {"SDS","SCS"}
SCALE_TOP = 8  # 1-7 scale → reverse = 8 - x


def pop_weighted_mean(values_by_seg, pops, seg_ids):
    num = sum(values_by_seg[s] * pops[s] for s in seg_ids if values_by_seg.get(s) is not None)
    den = sum(pops[s] for s in seg_ids if values_by_seg.get(s) is not None)
    return num / den if den else None


def pop_weighted_sd(values_by_seg, pops, seg_ids, mean):
    num = sum(pops[s] * (values_by_seg[s] - mean) ** 2 for s in seg_ids if values_by_seg.get(s) is not None)
    den = sum(pops[s] for s in seg_ids if values_by_seg.get(s) is not None)
    return math.sqrt(num / den) if den else 1.0


def main():
    dash = json.load(open(DASH))

    # Segment population shares (use pct_wgt fraction)
    pops = {}
    for s in dash["segments"]:
        pops[s["id"]] = (s.get("pct_wgt") or s.get("pct") or 0) / 100.0

    # ── Composite raw values per segment (reverse-code SDS/SCS) ──
    comp_cuts = {c["code"]: c["cuts"] for c in dash["stigma_extras"]["composites"]["items"]}
    raw = {code: {} for code in COMPOSITES}
    for code in COMPOSITES:
        cuts = comp_cuts.get(code, {})
        for sid, name in SEG_NAME.items():
            v = cuts.get(name, {}).get("val")
            if v is None:
                raw[code][sid] = None
            elif code in REVERSE:
                raw[code][sid] = round(SCALE_TOP - v, 4)
            else:
                raw[code][sid] = round(v, 4)

    # ── CON_HIV / CON_LGB from demographics contact (as fractions) ──
    con = {"CON_HIV": {}, "CON_LGB": {}}
    contact_q = next((q for q in dash["demographics"] if q.get("id") == "contact"), None)
    con_by_item = {it["code"]: it["cuts"] for it in (contact_q["items"] if contact_q else [])}
    for sid, name in SEG_NAME.items():
        for key, src in [("CON_HIV", "CON_HIV"), ("CON_LGB", "CON_LGB")]:
            cell = con_by_item.get(src, {}).get(name)
            con[key][sid] = round(cell["val"] / 100.0, 4) if cell and cell.get("val") is not None else None

    # ── Population mean + SD per composite (for z) ──
    zparams = {}
    all_ids = list(SEG_NAME.keys())
    for code in COMPOSITES:
        m = pop_weighted_mean(raw[code], pops, all_ids)
        sd = pop_weighted_sd(raw[code], pops, all_ids, m) if m is not None else 1.0
        zparams[code] = {"mean": round(m, 6), "sd": round(sd, 6)}

    # ── Ranks (descending: rank 1 = highest value) ──
    def ranks_for(values_by_seg):
        ordered = sorted(
            [sid for sid in all_ids if values_by_seg.get(sid) is not None],
            key=lambda sid: values_by_seg[sid], reverse=True,
        )
        return {sid: i + 1 for i, sid in enumerate(ordered)}

    rank = {code: ranks_for(raw[code]) for code in COMPOSITES}
    rank["CON_HIV"] = ranks_for(con["CON_HIV"])
    rank["CON_LGB"] = ranks_for(con["CON_LGB"])

    # ── Build seg_data.json ──
    seg_data = {}
    for sid, name in SEG_NAME.items():
        entry = {"name": name, "n": None, "pop": round(pops[sid], 6)}
        for code in COMPOSITES:
            v = raw[code][sid]
            if code == "HKS":
                entry["HKS"] = v
                entry["HKS_rank"] = rank["HKS"].get(sid)
            else:
                entry[f"{code}_raw"] = v
                zp = zparams[code]
                entry[f"{code}_z"] = round((v - zp["mean"]) / zp["sd"], 6) if v is not None and zp["sd"] else None
                entry[f"{code}_raw_rank"] = rank[code].get(sid)
        entry["CON_HIV"] = con["CON_HIV"][sid]
        entry["CON_LGB"] = con["CON_LGB"][sid]
        entry["CON_HIV_rank"] = rank["CON_HIV"].get(sid)
        entry["CON_LGB_rank"] = rank["CON_LGB"].get(sid)
        # n from any composite TOTAL-less cut (segment n)
        seg_n = comp_cuts.get("MBS", {}).get(name, {}).get("n")
        entry["n"] = seg_n
        seg_data[str(sid)] = entry

    # ── bench.json: All (TOTAL) + R/D (pop-weighted party means) ──
    def bench_block(seg_ids):
        block = {}
        for code in COMPOSITES:
            m = pop_weighted_mean(raw[code], pops, seg_ids)
            if code == "HKS":
                block["HKS"] = round(m, 4) if m is not None else None
            else:
                zp = zparams[code]
                block[code] = {
                    "raw": round(m, 4) if m is not None else None,
                    "z": round((m - zp["mean"]) / zp["sd"], 4) if m is not None and zp["sd"] else 0.0,
                }
        block["CON_HIV"] = round(pop_weighted_mean(con["CON_HIV"], pops, seg_ids), 4)
        block["CON_LGB"] = round(pop_weighted_mean(con["CON_LGB"], pops, seg_ids), 4)
        return block

    bench = {
        "All": bench_block(all_ids),
        "Republicans": bench_block(list(GOP)),
        "Democrats": bench_block(list(DEM)),
    }
    # All composite z should be ~0 by construction; force exact 0 + add n
    for code in COMPOSITES:
        if code != "HKS":
            bench["All"][code]["z"] = 0.0
    bench["All"]["n"] = dash["study"]["n_total"]
    bench["Republicans"]["n"] = sum(comp_cuts["MBS"].get(SEG_NAME[s], {}).get("n", 0) or 0 for s in GOP)
    bench["Democrats"]["n"] = sum(comp_cuts["MBS"].get(SEG_NAME[s], {}).get("n", 0) or 0 for s in DEM)

    # ── items.json: scf / stigma / know / contact ──
    item_results = dash["item_results"]
    item_by_id = {it["id"]: it for it in dash["items"]}

    def mean_cut(item_id, name):
        r = item_results.get(item_id, {}).get(name)
        return r.get("mean") if r else None

    def item_row(code, stem, item_id, reverse=False, binary=False):
        by_seg = {}
        for sid, name in SEG_NAME.items():
            v = mean_cut(item_id, name)
            if v is not None and reverse:
                v = round(SCALE_TOP - v, 4)
            by_seg[str(sid)] = round(v, 4) if v is not None else None
        total = mean_cut(item_id, "TOTAL")
        if total is not None and reverse:
            total = round(SCALE_TOP - total, 4)
        # Party means via pop-weighting the by_segment values
        bs_num = {int(k): val for k, val in by_seg.items()}
        rep = pop_weighted_mean(bs_num, pops, list(GOP))
        dem = pop_weighted_mean(bs_num, pops, list(DEM))
        return {
            "code": code, "stem": stem, "binary": binary,
            "by_segment": by_seg,
            "All": round(total, 4) if total is not None else None,
            "Republicans": round(rep, 4) if rep is not None else None,
            "Democrats": round(dem, 4) if dem is not None else None,
        }

    # Composite as an item row (raw[code] already reverse-coded)
    def composite_row(code, stem):
        by_seg = {str(sid): raw[code][sid] for sid in all_ids}
        return {
            "code": code, "stem": stem, "binary": False,
            "by_segment": by_seg,
            "All": bench["All"][code]["raw"] if code != "HKS" else bench["All"]["HKS"],
            "Republicans": bench["Republicans"][code]["raw"] if code != "HKS" else bench["Republicans"]["HKS"],
            "Democrats": bench["Democrats"][code]["raw"] if code != "HKS" else bench["Democrats"]["HKS"],
        }

    items = {}
    # SCF accordion: CFS items (Care), composite, PFS items (Purity), SCF composite
    items["scf"] = [
        item_row("MFQ_r1", "Whether someone suffered emotionally", "QMFQr1"),
        item_row("MFQ_r2", "Showed compassion for those worse off", "QMFQr2"),
        composite_row("CFS", "Care Foundation composite"),
        item_row("MFQ_r3", "Morally disgusting / violated decency", "QMFQr3"),
        item_row("MFQ_r4", "Against natural order", "QMFQr4"),
        composite_row("PFS", "Purity Foundation composite"),
        composite_row("SCF", "Sanctity − Care trade-off"),
    ]
    # Stigma accordion: SB items (blame), MBS, SD items (reverse → distance), SDS
    items["stigma"] = [
        item_row("SB1", "Sexual behavior choices led to it", "QHIVSTIGMAr1"),
        item_row("SB2", "More personal responsibility", "QHIVSTIGMAr2"),
        composite_row("MBS", "Blame composite"),
        item_row("SD1", "Comfortable working alongside (rev.)", "QHIVSTIGMAr3", reverse=True),
        item_row("SD2", "Comfortable close friendship (rev.)", "QHIVSTIGMAr4", reverse=True),
        composite_row("SDS", "Avoidance composite"),
    ]
    # Knowledge accordion: K1-K11 (exclude K5 foil), binary % aware
    know_items = dash["stigma_extras"]["knowledge"]["items"]
    know_rows = []
    for k in know_items:
        if k["code"] == "HIV_K5":
            continue  # foil, excluded from HKS
        by_seg = {}
        for sid, name in SEG_NAME.items():
            cell = k["cuts"].get(name)
            by_seg[str(sid)] = round(cell["val"] / 100.0, 4) if cell and cell.get("val") is not None else None
        total = k["cuts"].get("TOTAL", {}).get("val")
        bs_num = {int(kk): v for kk, v in by_seg.items()}
        rep = pop_weighted_mean(bs_num, pops, list(GOP))
        dem = pop_weighted_mean(bs_num, pops, list(DEM))
        know_rows.append({
            "code": k["code"].replace("HIV_", ""), "stem": k["wording"][:60], "binary": True,
            "by_segment": by_seg,
            "All": round(total / 100.0, 4) if total is not None else None,
            "Republicans": round(rep, 4) if rep is not None else None,
            "Democrats": round(dem, 4) if dem is not None else None,
        })
    items["know"] = know_rows
    # Contact accordion
    def contact_row(code, stem, src):
        cell_cuts = con_by_item.get(src, {})
        by_seg = {}
        for sid, name in SEG_NAME.items():
            cell = cell_cuts.get(name)
            by_seg[str(sid)] = round(cell["val"] / 100.0, 4) if cell and cell.get("val") is not None else None
        total = cell_cuts.get("TOTAL", {}).get("val")
        bs_num = {int(k): v for k, v in by_seg.items()}
        rep = pop_weighted_mean(bs_num, pops, list(GOP))
        dem = pop_weighted_mean(bs_num, pops, list(DEM))
        return {
            "code": code, "stem": stem, "binary": True,
            "by_segment": by_seg,
            "All": round(total / 100.0, 4) if total is not None else None,
            "Republicans": round(rep, 4) if rep is not None else None,
            "Democrats": round(dem, 4) if dem is not None else None,
        }
    items["contact"] = [
        contact_row("CON-HIV", "Personally knows person with HIV", "CON_HIV"),
        contact_row("CON-LGB", "Personally knows LGBTQ person", "CON_LGB"),
    ]

    # ── trust.json — only if dashboard.json carries a trust block ──
    # The topline pipeline (compute_core.py) now emits a `trust` array using
    # the same WGT weighting as everything else, but ONLY when the .sav has
    # the QTRUST* variables and the pipeline has been re-run. If present we
    # regenerate trust.json from it (single source); otherwise we leave the
    # existing persona-pipeline trust.json untouched and warn.
    dash_trust = dash.get("trust")
    if dash_trust:
        with open("src/data/hiv/trust.json", "w") as f:
            json.dump(dash_trust, f, indent=2)
        trust_status = f"REGENERATED from dashboard.json ({len(dash_trust)} messengers)"
    else:
        trust_status = ("UNCHANGED — dashboard.json has no `trust` block yet. "
                        "Re-run compute_core.py against the .sav (it now emits trust) "
                        "to make trust single-source.")

    # ── Write files ──
    with open("src/data/hiv/seg_data.json", "w") as f:
        json.dump(seg_data, f, indent=2)
    with open("src/data/hiv/bench.json", "w") as f:
        json.dump(bench, f, indent=2)
    with open("src/data/hiv/items.json", "w") as f:
        json.dump(items, f, indent=2)
    with open("src/data/hiv/zparams.json", "w") as f:
        json.dump(zparams, f, indent=2)

    print("Derived HIV-tab data from dashboard.json:")
    print(f"  seg_data.json: {len(seg_data)} segments")
    print(f"  bench.json: All/Republicans/Democrats")
    print(f"  items.json: scf={len(items['scf'])} stigma={len(items['stigma'])} know={len(items['know'])} contact={len(items['contact'])}")
    print(f"  zparams.json: {len(zparams)} composites")
    print(f"  trust.json: {trust_status}")
    # Spot check
    print(f"\nSpot check FJP (12): MBS={seg_data['12']['MBS_raw']} SDS={seg_data['12']['SDS_raw']} "
          f"SCF={seg_data['12']['SCF_raw']} HKS={seg_data['12']['HKS']} "
          f"CON_HIV={seg_data['12']['CON_HIV']}")


if __name__ == "__main__":
    main()
