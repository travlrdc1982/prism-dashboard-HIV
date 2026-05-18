import dashboard from "../../data/topline/dashboard.json";
import "./Topline.css";
import TopNav from "./components/TopNav";
import ModNav from "./components/ModNav";
import { ModuleSection } from "./components/ItemBlock";
import DemographicsModule from "./modules/DemographicsModule";

// Map of module id → renderer. Filled in incrementally; missing entries
// fall back to a placeholder block.
const MODULE_RENDERERS = {
  demographics: ({ data }) => (
    <DemographicsModule
      demographics={data.demographics}
      segments={data.segments}
      study={data.study}
    />
  ),
};

// Phase C scaffold — Stage 0. Renders the top nav, module chip nav, study
// header, and a placeholder for every module section. Each module body will
// be filled in by subsequent commits as individual components under ./modules/.
//
// The .topline-root wrapper scopes every CSS rule from Topline.css so it
// cannot leak into the dashboard chrome. The negative margin undoes Shell's
// 24/28px content padding so the topline owns its full canvas.

export default function Topline() {
  const { study, modules } = dashboard;

  return (
    <div className="topline-root" style={{ margin: "-24px -28px" }}>
      <TopNav study={study} />
      <ModNav modules={modules} />

      {/* Stage-0 scaffold banner — visible until all 8 modules are ported. */}
      <div
        style={{
          background: "#fef3c7",
          borderBottom: "1px solid #f59e0b",
          padding: "10px 24px",
          fontSize: 12,
          color: "#78350f",
        }}
      >
        <strong>Topline migration · Stage 0 scaffold.</strong> CSS, layout
        primitives, and module shells are in place. Each module body lands in
        a subsequent commit.
      </div>

      {/* Title section (placeholder until TitlePage.jsx lands) */}
      <div className="title-page">
        <header className="title-page-header">
          <h1 className="study-title">{study.title}</h1>
          <p className="study-subtitle">{study.subtitle}</p>
        </header>
        <div className="title-page-meta" style={{ display: "flex", gap: 24, fontSize: 12, color: "#475569" }}>
          <span>
            <strong>Field:</strong> {study.field_dates}
          </span>
          <span>
            <strong>Version:</strong> {study.version}
          </span>
          <span>
            <strong>Analyst:</strong> {study.analyst}
          </span>
        </div>
      </div>

      {/* Render each module section. Modules with a ported renderer in
          MODULE_RENDERERS get their full body; the rest show a placeholder. */}
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
                  padding: "16px 24px",
                  fontSize: 12,
                  color: "#94a3b8",
                  fontStyle: "italic",
                }}
              >
                {m.active
                  ? "Module body in progress — to be ported in subsequent commits."
                  : "Module deferred to a later wave."}
              </div>
            )}
          </ModuleSection>
        );
      })}
    </div>
  );
}
