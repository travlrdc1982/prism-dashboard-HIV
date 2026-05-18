import dashboard from "../../data/topline/dashboard.json";
import "./Topline.css";
import "./Topline.addendum.css";
import TopNav from "./components/TopNav";
import ModNav from "./components/ModNav";
import { ModuleSection } from "./components/ItemBlock";
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

export default function Topline() {
  const { study, modules, segments } = dashboard;

  return (
    <div className="topline-root" style={{ margin: "-24px -28px" }}>
      <TopNav study={study} />
      <ModNav modules={modules} />

      <TitlePage study={study} segments={segments} />

      {modules.map((m) => {
        const Renderer = MODULE_RENDERERS[m.id];
        return (
          <ModuleSection
            key={m.id}
            id={m.id}
            title={`${m.tile_num} · ${m.tile_title}`}
            meta={m.section_meta}
            intro={m.section_intro}
          >
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
    </div>
  );
}
