// Items module — covers both Stigma (01) and Critics (04). Each item gets
// its own .item-block. Stigma is the umbrella: after the regular items,
// stigma_extras.knowledge (11 binary items with K5 trap) and
// stigma_extras.composites (8 means) render as additional blocks.
//
// Ported from dashboard_template.html renderSingleItem (1727-1737),
// renderStigmaKnowledgeBlock, renderStigmaCompositesBlock.

import ItemSurveyPane, {
  ItemCodebookPane,
  MetricHeader,
} from "../components/ItemSurveyPane";
import {
  DataCell,
  YesCell,
  MeanCell,
  BannerTableHead,
} from "../components/Cell";

const ALL = (segments) => ["TOTAL", ...segments.map((s) => s.code)];

// K5 = "epidemic effectively over" — false statement, foil item.
const K5_CODE = "HIV_K5";

// ─── Single Likert item ─────────────────────────────────────────────────
function SingleItem({ item, segments, study, itemResults }) {
  const res = itemResults[item.id];
  if (!res) {
    return (
      <div className="item-block">
        <ItemSurveyPane survey={item.survey} />
        <ItemCodebookPane cb={item.codebook} />
        <div className="item-data">
          <MetricHeader item={item} />
          <div className="cb-note">No results computed for {item.id}.</div>
        </div>
      </div>
    );
  }
  const totalT3 = res.TOTAL?.top3 ?? null;
  return (
    <div className="item-block">
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
            <tr>
              <td className="rlbl">
                % Top-3<span className="rlbl-sub">Agree</span>
              </td>
              <DataCell stats={res.TOTAL} isTotal cut="TOTAL" item={item.id} />
              {segments.map((s) => (
                <DataCell
                  key={s.code}
                  stats={res[s.code]}
                  totalTop3={totalT3}
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

// ─── Knowledge binary-set block (11 items, K5 has FALSE flag + pink row) ─
function KnowledgeBlock({ block, segments, study }) {
  if (!block?.items?.length) return null;
  const firstItem = block.items[0];
  const totalN = firstItem.cuts?.TOTAL?.n ?? "—";

  return (
    <div className="item-block">
      {/* Survey pane: checklist mock */}
      <div className="survey-pane">
        <div className="sp-header">
          <div className="sp-logo">PRISM</div>
          <div>STYLE.CHECKLIST</div>
        </div>
        <div className="sp-progress"><div /></div>
        <div className="sp-progress-text">{block.id?.toUpperCase()}</div>
        <div className="sp-card">
          <div className="sp-stem">
            For each item, indicate whether you have heard this before, or if it’s something you were not previously aware of.
          </div>
          {block.pane_subtitle && (
            <div className="sp-stem-secondary">{block.pane_subtitle}</div>
          )}
          <div className="inf-checklist">
            {block.items.map((it, i) => (
              <div
                key={i}
                className={
                  "inf-checklist-item" +
                  (it.is_false ? " sp-false-item" : "")
                }
              >
                <span className="inf-checkbox" />
                {it.is_false && (
                  <span className="sp-false-badge inline">FALSE</span>
                )}{" "}
                {it.wording}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Codebook */}
      <div className="codebook-pane">
        <div className="cb-title">Codebook</div>
        <div className="cb-row">
          <span className="cb-key">Block</span>
          <span className="cb-val">{block.block_label}</span>
        </div>
        <div className="cb-row">
          <span className="cb-key">Kind</span>
          <span className="cb-val">Binary awareness items (% Heard before)</span>
        </div>
        <div className="cb-row">
          <span className="cb-key">Filter</span>
          <span className="cb-val">
            Designed split sample · n={totalN} valid
          </span>
        </div>
        <div className="cb-row">
          <span className="cb-key">Note</span>
          <span className="cb-val">
            K5 is the false statement (foil) — % aware reflects exposure to
            misinformation. HKS composite excludes K5.
          </span>
        </div>
      </div>

      {/* Banner */}
      <div className="item-data">
        <div className="metric-header">
          <div className="metric-label">% AWARE — HIV KNOWLEDGE BATTERY</div>
          <div className="metric-scale-note">
            % responding "Heard before" per item. K5 is the foil (false
            statement); higher values indicate misinformation exposure.
          </div>
        </div>
        <table className="banner-table">
          <BannerTableHead
            segments={segments}
            totalN={totalN}
            partyA={study?.party_band_a_label}
            partyB={study?.party_band_b_label}
          />
          <tbody>
            {block.items.map((item) => {
              const isFalse = item.is_false || item.code === K5_CODE;
              return (
                <tr key={item.var} className={isFalse ? "row-false" : ""}>
                  <td className="rlbl">
                    <span className="inf-item-code-inline">{item.code}</span>
                    {isFalse && <span className="sp-false-badge inline">FALSE</span>}{" "}
                    {item.wording}
                  </td>
                  {ALL(segments).map((cut, idx) => (
                    <YesCell
                      key={cut}
                      cell={item.cuts?.[cut]}
                      isTotal={idx === 0}
                      cut={cut}
                      code={item.code}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Composites block (8 composites: MBS / SDS / EDS / SCS / CFS / PFS / SCF / HKS) ─
function CompositesBlock({ block, segments, study }) {
  if (!block?.items?.length) return null;
  const firstCut = block.items[0].cuts?.TOTAL;
  const totalN = firstCut?.n ?? "—";

  return (
    <div className="item-block">
      {/* Survey pane: composites overview */}
      <div className="survey-pane">
        <div className="sp-header">
          <div className="sp-logo">PRISM</div>
          <div>STYLE.COMPOSITES</div>
        </div>
        <div className="sp-progress"><div /></div>
        <div className="sp-progress-text">COMPOSITES</div>
        <div className="sp-card">
          <div className="sp-stem">
            Eight composite indices computed from the items above.
          </div>
          {block.pane_subtitle && (
            <div className="sp-stem-secondary">{block.pane_subtitle}</div>
          )}
          <div className="composites-list">
            {block.items.map((c) => (
              <div key={c.code} className="composite-row">
                <span className="composite-code">{c.code}</span>{" "}
                <span className="composite-wording">{c.wording}</span>
                {c.formula && (
                  <div className="composite-formula">{c.formula}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Codebook */}
      <div className="codebook-pane">
        <div className="cb-title">Codebook</div>
        <div className="cb-row">
          <span className="cb-key">Block</span>
          <span className="cb-val">{block.block_label}</span>
        </div>
        <div className="cb-row">
          <span className="cb-key">Kind</span>
          <span className="cb-val">
            Per-segment composite means (t-test vs rest)
          </span>
        </div>
        <div className="cb-row">
          <span className="cb-key">Filter</span>
          <span className="cb-val">
            Designed split sample · n={totalN} valid
          </span>
        </div>
        <div className="cb-row">
          <span className="cb-key">Method</span>
          <span className="cb-val">
            Cells show segment mean; sig dots = t-test vs all-other-segments
            (p&lt;.05 / p&lt;.01).
          </span>
        </div>
      </div>

      {/* Banner */}
      <div className="item-data">
        <div className="metric-header">
          <div className="metric-label">COMPOSITE MEANS — HIV STIGMA</div>
          <div className="metric-scale-note">
            Per-segment composite means. Sig markers = t-test vs the rest of
            the valid sample.
          </div>
        </div>
        <table className="banner-table">
          <BannerTableHead
            segments={segments}
            totalN={totalN}
            partyA={study?.party_band_a_label}
            partyB={study?.party_band_b_label}
          />
          <tbody>
            {block.items.map((c) => (
              <tr key={c.code}>
                <td className="rlbl">
                  <span className="inf-item-code-inline">{c.code}</span>{" "}
                  {c.wording}
                </td>
                {ALL(segments).map((cut, idx) => (
                  <MeanCell
                    key={cut}
                    cell={c.cuts?.[cut]}
                    isTotal={idx === 0}
                    cut={cut}
                    code={c.code}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Module entry ───────────────────────────────────────────────────────
export default function ItemsModule({
  items,
  segments,
  study,
  itemResults,
  section,
  stigmaExtras,
}) {
  const filtered = (items || []).filter((it) => it.section === section);
  return (
    <>
      {filtered.map((item) => (
        <SingleItem
          key={item.id}
          item={item}
          segments={segments}
          study={study}
          itemResults={itemResults}
        />
      ))}
      {section === "stigma" && stigmaExtras?.knowledge && (
        <KnowledgeBlock block={stigmaExtras.knowledge} segments={segments} study={study} />
      )}
      {section === "stigma" && stigmaExtras?.composites && (
        <CompositesBlock block={stigmaExtras.composites} segments={segments} study={study} />
      )}
    </>
  );
}
