import dashboard from "../../data/topline/dashboard.json";
import styles from "./Topline.module.css";

// Phase C — Topline migration. This file scaffolds the /topline route and
// loads dashboard.json as the immutable input. Each of the 8 modules will be
// ported in subsequent commits as separate components under ./modules/.

export default function Topline() {
  const { study, modules } = dashboard;

  return (
    <div className={styles.toplineRoot}>
      <div className={styles.scaffoldBanner}>
        <strong>Topline migration scaffold.</strong> Modules in progress — see
        <code> AUDIT.md</code> / <code>BUILDME.md</code> Phase C for the port
        plan.
      </div>

      <header className={styles.titleHeader}>
        <h1>{study.title}</h1>
        <p>{study.subtitle}</p>
        <div className={styles.titleMeta}>
          <span>{study.field_dates}</span>
          <span>·</span>
          <span>{study.version}</span>
          <span>·</span>
          <span>Analyst: {study.analyst}</span>
        </div>
      </header>

      <section className={styles.moduleList}>
        <h2>Modules</h2>
        <ol>
          {modules.map((m) => (
            <li key={m.id} className={m.active ? "" : styles.disabled}>
              <span className={styles.tileNum}>{m.tile_num}</span>{" "}
              <strong>{m.tile_title}</strong>
              {!m.active && <em> · deferred</em>}
              <div className={styles.tileDesc}>{m.tile_desc}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
