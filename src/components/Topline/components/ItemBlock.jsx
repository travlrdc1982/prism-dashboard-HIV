// Three-pane brochure-rails container — the layout primitive shared by the
// Items, Pre-Post, Demographics, and Influencer modules. CSS class .item-block
// owns the grid (240px survey · 240px codebook · 1fr banner) — see Topline.css.

export default function ItemBlock({ extraClass = "", children }) {
  const className = extraClass ? `item-block ${extraClass}` : "item-block";
  return <div className={className}>{children}</div>;
}

// Section wrapper (heading + meta + intro + a stack of ItemBlocks).
export function ModuleSection({ id, title, meta, intro, children }) {
  return (
    <section id={id ? `mod-${id}` : undefined} className="module-section">
      {(title || meta || intro) && (
        <header className="section-header">
          {title && <h2 className="section-title">{title}</h2>}
          {meta && <div className="section-meta">{meta}</div>}
          {intro && (
            <div
              className="section-intro"
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          )}
        </header>
      )}
      {children}
    </section>
  );
}
