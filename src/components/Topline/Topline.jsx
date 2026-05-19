import { useState, useRef } from "react";
import dashboard from "../../data/topline/dashboard.json";
import "./Topline.css";
import "./Topline.addendum.css";
import TopNav from "./components/TopNav";
import ModNav from "./components/ModNav";
import { ModuleSection } from "./components/ItemBlock";
import TogglesBar from "./components/TogglesBar";
import Legend from "./components/Legend";
import DataInspector from "./components/DataInspector";
import { useCellPopover } from "./utils/popover";
import TitlePage from "./modules/TitlePage";
import DemographicsModule from "./modules/DemographicsModule";
import ItemsModule from "./modules/ItemsModule";
import PrePostModule from "./modules/PrePostModule";
import RoiModule from "./modules/RoiModule";
import InfluencerModule from "./modules/InfluencerModule";

// Map of module id → renderer. Disabled modules fall through to a
// "deferred" placeholder.
const MODULE_RENDERERS = {
  stigma: ({ data }) => (
    <ItemsModule
      items={data.items}
      segments={data.segments}
      study={data.study}
      itemResults={data.item_results}
      section="stigma"
      stigmaExtras={data.stigma_extras}
    />
  ),
  prepost: ({ data }) => (
    <PrePostModule
      items={data.pre_post}
      segments={data.segments}
      study={data.study}
      ppResults={data.pp_results}
    />
  ),
  roi: ({ data }) => <RoiModule roiSvg={data.roi_svg} roiData={data.roi_data} />,
  critics: ({ data }) => (
    <ItemsModule
      items={data.items}
      segments={data.segments}
      study={data.study}
      itemResults={data.item_results}
      section="critics"
    />
  ),
  demos: ({ data }) => (
    <DemographicsModule
      demographics={data.demographics}
      segments={data.segments}
      study={data.study}
    />
  ),
  influencer: ({ data }) => (
    <InfluencerModule
      influencer={data.influencer}
      segments={data.segments}
      study={data.study}
    />
  ),
};

// Modules that should display the cell-toggles bar (every ordinal/nominal
// data-bearing block — everything except the SVG-only ROI and the deferred
// 05/06 modules).
const TOGGLE_MODULES = new Set([
  "stigma",
  "prepost",
  "critics",
  "demos",
  "influencer",
]);

export default function Topline() {
  const { study, modules, segments } = dashboard;
  const [expanded, setExpanded] = useState(false);
  const [fullDist, setFullDist] = useState(false);
  // Collapse the survey + codebook side panes so the banner takes the full
  // width and the analyst can scroll the full 18-column table without
  // horizontal cropping. Persists across modules.
  const [bannerFull, setBannerFull] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const rootRef = useRef(null);
  const { popoverRef, visible: popVisible, html: popHtml, pos: popPos, hide: hidePopover } = useCellPopover(rootRef);

  // .topline-root gets `expanded` / `fullDist` / `banner-full` classes; the
  // CSS uses them to reveal cell details, the freq dist, or to collapse the
  // survey + codebook panes.
  const rootClass =
    "topline-root" +
    (expanded ? " expanded" : "") +
    (fullDist ? " fullDist" : "") +
    (bannerFull ? " banner-full" : "");

  return (
    <div ref={rootRef} className={rootClass} style={{ margin: "-24px -28px" }}>
      <TopNav study={study} onOpenInspector={() => setInspectorOpen(true)} />
      <ModNav modules={modules} />

      {/* Banner-full toggle + always-visible legend */}
      <div className="topline-controls">
        <button
          type="button"
          className="banner-full-btn"
          onClick={() => setBannerFull((v) => !v)}
          aria-pressed={bannerFull}
        >
          {bannerFull ? "▼ Show survey + codebook panes" : "▶ Collapse survey + codebook (show full banner)"}
        </button>
        <Legend />
      </div>

      <TitlePage study={study} segments={segments} />

      {modules.map((m) => {
        const Renderer = MODULE_RENDERERS[m.id];
        const showToggles = TOGGLE_MODULES.has(m.id) && m.active;
        return (
          <ModuleSection
            key={m.id}
            id={m.id}
            title={`${m.tile_num} · ${m.tile_title}`}
            meta={m.section_meta}
            intro={m.section_intro}
          >
            {showToggles && (
              <TogglesBar
                expanded={expanded}
                fullDist={fullDist}
                onToggleExpanded={setExpanded}
                onToggleFullDist={setFullDist}
                info="Click any cell for popover · z-test vs. rest of sample"
              />
            )}
            {Renderer && m.active ? (
              <Renderer data={dashboard} module={m} />
            ) : (
              <div
                className="module-placeholder"
                style={{
                  padding: "20px 24px",
                  fontSize: 13,
                  color: "#94a3b8",
                  fontStyle: "italic",
                  background: "#f8fafc",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                {m.active
                  ? "Module body coming soon."
                  : `${m.tile_title} is deferred — not part of this wave.`}
              </div>
            )}
          </ModuleSection>
        );
      })}

      <div
        id="versioning"
        style={{
          padding: "20px 24px",
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "'JetBrains Mono', monospace",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <strong>{study.id}</strong> · {study.version} · Rendered {study.rendered} ·
        Analyst: {study.analyst} · N={study.n_total}
      </div>

      <DataInspector
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        data={dashboard}
      />

      {/* Cell popover — driven by useCellPopover hook via event delegation */}
      {popVisible && (
        <div
          ref={popoverRef}
          className="topline-popover"
          style={{ left: popPos.left, top: popPos.top, position: "fixed" }}
          onClick={hidePopover}
          dangerouslySetInnerHTML={{ __html: popHtml }}
        />
      )}
    </div>
  );
}
