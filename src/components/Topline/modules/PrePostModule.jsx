// Pre/Post module — 7 items, each rendered as a three-row banner table
// (PRE / POST / Δ). Ported from dashboard_template.html renderPrePostItem
// (1699-1725).

import ItemSurveyPane, {
  ItemCodebookPane,
  MetricHeader,
} from "../components/ItemSurveyPane";
import { DataCell, DeltaCell, BannerTableHead } from "../components/Cell";

function PrePostItem({ item, segments, study, ppResults }) {
  const res = ppResults[item.id];
  if (!res) {
    return (
      <div id={`prepost-item-${item.id}`} className="item-block prepost-anchor-target">
        <ItemSurveyPane survey={item.survey} />
        <ItemCodebookPane cb={item.codebook} />
        <div className="item-data">
          <MetricHeader item={item} />
          <div className="cb-note">No pre/post results computed for {item.id}.</div>
        </div>
      </div>
    );
  }

  const totalT3Pre = res.pre?.TOTAL?.top3 ?? null;
  const totalT3Post = res.post?.TOTAL?.top3 ?? null;

  // Enrich delta cells with signed freq differences (POST − PRE per band).
  const deltaWithDist = {};
  for (const cut of Object.keys(res.delta || {})) {
    const d = { ...res.delta[cut] };
    const pre = res.pre?.[cut];
    const post = res.post?.[cut];
    if (pre && post) {
      for (let k = 0; k < 7; k++) {
        d["df" + (k + 1)] = +(post.freq[k] - pre.freq[k]).toFixed(1);
      }
    }
    deltaWithDist[cut] = d;
  }

  return (
    <div id={`prepost-item-${item.id}`} className="item-block prepost-anchor-target">
      <ItemSurveyPane survey={item.survey} />
      <ItemCodebookPane cb={item.codebook} />
      <div className="item-data">
        <MetricHeader item={item} />
        <table className="banner-table">
          <BannerTableHead
            segments={segments}
            totalN={study?.n_total}
            partyA={study?.party_band_a_label}
            partyB={study?.party_band_b_label}
          />
          <tbody>
            <tr className="pre">
              <td className="rlbl">
                PRE<span className="rlbl-sub">before exposure</span>
              </td>
              <DataCell stats={res.pre?.TOTAL} isTotal cut="TOTAL" row="pre" item={item.id} />
              {segments.map((s) => (
                <DataCell
                  key={s.code}
                  stats={res.pre?.[s.code]}
                  totalTop3={totalT3Pre}
                  cut={s.code}
                  row="pre"
                  item={item.id}
                />
              ))}
            </tr>
            <tr className="post">
              <td className="rlbl">
                POST<span className="rlbl-sub">after exposure</span>
              </td>
              <DataCell stats={res.post?.TOTAL} isTotal cut="TOTAL" row="post" item={item.id} />
              {segments.map((s) => (
                <DataCell
                  key={s.code}
                  stats={res.post?.[s.code]}
                  totalTop3={totalT3Post}
                  cut={s.code}
                  row="post"
                  item={item.id}
                />
              ))}
            </tr>
            <tr className="delta">
              <td className="rlbl">
                Δ<span className="rlbl-sub">POST − PRE</span>
              </td>
              <DeltaCell delta={deltaWithDist.TOTAL} isTotal cut="TOTAL" item={item.id} />
              {segments.map((s) => (
                <DeltaCell
                  key={s.code}
                  delta={deltaWithDist[s.code]}
                  cut={s.code}
                  item={item.id}
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PrePostModule({ items, segments, study, ppResults }) {
  if (!items?.length) {
    return <div className="demos-empty">No pre/post items configured.</div>;
  }
  return (
    <>
      {items.map((it) => (
        <PrePostItem
          key={it.id}
          item={it}
          segments={segments}
          study={study}
          ppResults={ppResults}
        />
      ))}
    </>
  );
}
