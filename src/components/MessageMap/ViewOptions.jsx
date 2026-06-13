// ViewOptions — the Message Map's right-side control panel.
//
// Groups every "how do I look at the grid" control in one card:
//   FILTER (basket) · COLUMNS (all vs tier-1) · PERSONA VARIANT
//   (expand/collapse all) · MESSAGE SORT (survey vs total SoP) ·
//   PROOF POINT ROWS (expand/collapse all).
//
// Pure presentation — all state lives in the page; this just renders
// the controls and calls back. Segmented buttons show the active
// option highlighted.
import { C, FONT, MONO } from "../../data/theme";
import ControlSelect from "./ControlSelect";

function GroupLabel({ children }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 7.5, color: C.textDim,
      letterSpacing: 1.5, textTransform: "uppercase",
    }}>{children}</span>
  );
}

function Segmented({ options, value, onChange, disabled = false }) {
  return (
    <div style={{
      display: "inline-flex", borderRadius: 4, overflow: "hidden",
      border: `1px solid ${C.cardBorder}`,
      opacity: disabled ? 0.4 : 1,
    }}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button key={o.value}
            onClick={disabled ? undefined : () => onChange(o.value)}
            title={disabled ? "Not applicable for this measurement"
                            : (o.title || undefined)}
            disabled={disabled}
            style={{
              fontFamily: MONO, fontSize: 9, fontWeight: 700,
              letterSpacing: 0.8, textTransform: "uppercase",
              padding: "5px 9px",
              cursor: disabled ? "not-allowed" : "pointer",
              border: "none",
              borderLeft: i === 0 ? "none" : `1px solid ${C.cardBorder}`,
              background: active ? (o.accent || C.violet) : "transparent",
              color: active ? "#0f1520" : C.textMuted,
              transition: "background 0.12s, color 0.12s",
            }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function Group({ label, children, note, disabled = false }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      opacity: disabled ? 0.55 : 1,
    }}>
      <GroupLabel>{label}</GroupLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {children}
      </div>
      {note && (
        <span style={{
          fontFamily: FONT, fontSize: 8.5, color: C.textDim, fontStyle: "italic",
        }}>{note}</span>
      )}
    </div>
  );
}

export default function ViewOptions({
  basket, onBasket, baskets, filterInfo,
  columnMode, onColumnMode,
  personaAll, onPersonaAll,
  sortMode, onSortMode,
  onProofsExpand, onProofsCollapse, proofsAllOpen,
  // SoP / Utility don't have persona arms or proof tokens, so those
  // two control groups are greyed out (visible but non-interactive).
  personaDisabled = false,
  proofsDisabled = false,
}) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.cardBorder}`,
      borderRadius: 6, padding: "11px 14px 13px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 700,
        letterSpacing: 1.5, textTransform: "uppercase", color: C.text,
      }}>View Options</div>

      <div style={{
        display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start",
      }}>
        {/* FILTER (bucket selector) */}
        <ControlSelect
          label="Filter (Audience Bucket)"
          infoTitle="Filter (bucket)"
          value={basket}
          onChange={onBasket}
          options={baskets.map(b => ({ value: b.id, label: b.name }))}
          info={filterInfo}
        />

        {/* COLUMNS */}
        <Group label="Columns"
          note="Drag any segment circle to reorder columns.">
          <Segmented
            value={columnMode}
            onChange={onColumnMode}
            options={[
              { value: "all", label: "All Audiences",
                title: "All 16 segments in canonical order" },
              { value: "tier1", label: "Tier 1",
                title: "Tier-1 audiences first, by ROI; others stay but dim" },
            ]}
          />
        </Group>

        {/* PERSONA VARIANT */}
        <Group label="Persona Variant" disabled={personaDisabled}
          note={personaDisabled ? "Not applicable for this measurement." : undefined}>
          <Segmented
            value={personaAll ? "expand" : "collapse"}
            onChange={(v) => onPersonaAll(v === "expand")}
            disabled={personaDisabled}
            options={[
              { value: "collapse", label: "Collapse" },
              { value: "expand", label: "Expand All",
                title: "Slide every column's persona half open" },
            ]}
          />
        </Group>

        {/* MESSAGE SORT */}
        <Group label="Message Sort">
          <Segmented
            value={sortMode}
            onChange={onSortMode}
            options={[
              { value: "survey", label: "Survey Order" },
              { value: "sop", label: "Total SoP",
                title: "Sort messages by total Share of Preference (desc)" },
            ]}
          />
        </Group>

        {/* PROOF POINT ROWS */}
        <Group label="Proof Point Rows" disabled={proofsDisabled}
          note={proofsDisabled ? "Not applicable for this measurement." : undefined}>
          <Segmented
            value={proofsAllOpen ? "expand" : "collapse"}
            onChange={(v) => v === "expand" ? onProofsExpand() : onProofsCollapse()}
            disabled={proofsDisabled}
            options={[
              { value: "collapse", label: "Collapse All" },
              { value: "expand", label: "Expand All" },
            ]}
          />
        </Group>
      </div>
    </div>
  );
}
