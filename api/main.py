import os
import json
import sqlite3
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "prism_dashboard.db")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data", "hiv")


def _load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path) as f:
        return json.load(f)

app = FastAPI(title="PRISM HIV Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def row_to_dict(row):
    return dict(row) if row else None


def rows_to_list(rows):
    return [dict(r) for r in rows]


# ── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok"}


# ── Studies ─────────────────────────────────────────────────────────────────

@app.get("/api/studies/{study_id}")
def get_study(study_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM studies WHERE id = ?", (study_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Study not found")
    return row_to_dict(row)


# ── Segments ─────────────────────────────────────────────────────────────────

@app.get("/api/studies/{study_id}/segments")
def get_segments(study_id: str):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM segments WHERE study_id = ? ORDER BY id",
        (study_id,)
    ).fetchall()
    conn.close()
    return rows_to_list(rows)


@app.get("/api/studies/{study_id}/segments/{segment_code}")
def get_segment_profile(study_id: str, segment_code: str):
    conn = get_db()

    segment = conn.execute(
        "SELECT * FROM segments WHERE study_id = ? AND code = ?",
        (study_id, segment_code.upper())
    ).fetchone()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    seg_id = segment["id"]

    items = conn.execute(
        """
        SELECT si.id, si.code, si.stem, si.construct,
               si.scale_min, si.scale_max,
               ir.mean, ir.sd, ir.n, ir.n_weighted
        FROM survey_items si
        LEFT JOIN item_responses ir
          ON si.id = ir.item_id AND ir.segment_id = ?
        WHERE si.study_id = ?
        ORDER BY si.construct, si.code
        """,
        (seg_id, study_id)
    ).fetchall()

    composites = conn.execute(
        """
        SELECT cs.id, cs.code, cs.label, cs.construct,
               cr.segment_id, cr.benchmark_group, cr.raw_value, cr.z_score
        FROM composite_scores cs
        LEFT JOIN composite_responses cr ON cs.id = cr.composite_id
        WHERE cs.study_id = ?
        ORDER BY cs.code, cr.benchmark_group
        """,
        (study_id,)
    ).fetchall()

    trust = conn.execute(
        """
        SELECT te.code, te.label, te.category,
               tr.trust_score, tr.benchmark_group
        FROM trust_entities te
        LEFT JOIN trust_ratings tr ON te.id = tr.entity_id
        WHERE te.study_id = ? AND tr.segment_id = ?
        ORDER BY te.code, tr.benchmark_group
        """,
        (study_id, seg_id)
    ).fetchall()

    messages = conn.execute(
        """
        SELECT m.id, m.code, m.short_name, m.theme, m.body_text,
               mp.score, mp.rank, mp.delta_vs_benchmark
        FROM messages m
        LEFT JOIN message_performance mp
          ON m.id = mp.message_id AND mp.segment_id = ?
        WHERE m.study_id = ?
        ORDER BY m.id
        """,
        (seg_id, study_id)
    ).fetchall()

    prepost = conn.execute(
        """
        SELECT pm.code, pm.question, pm.scale_type, pm.measurement_type,
               pr.timepoint, pr.pct_response, pr.delta
        FROM prepost_metrics pm
        LEFT JOIN prepost_responses pr
          ON pm.id = pr.metric_id AND pr.segment_id = ?
        WHERE pm.study_id = ?
        ORDER BY pm.order_in_test, pr.timepoint
        """,
        (seg_id, study_id)
    ).fetchall()

    conn.close()

    return {
        "segment": row_to_dict(segment),
        "survey_items": rows_to_list(items),
        "composite_scores": rows_to_list(composites),
        "trust_ratings": rows_to_list(trust),
        "messages": rows_to_list(messages),
        "prepost_metrics": rows_to_list(prepost),
    }


# ── Messages ─────────────────────────────────────────────────────────────────

@app.get("/api/studies/{study_id}/messages")
def get_messages(study_id: str):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM messages WHERE study_id = ? ORDER BY id",
        (study_id,)
    ).fetchall()
    conn.close()
    return rows_to_list(rows)


@app.get("/api/studies/{study_id}/messages/{message_code}")
def get_message(study_id: str, message_code: str):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM messages WHERE study_id = ? AND code = ?",
        (study_id, message_code.upper())
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Message not found")
    return row_to_dict(row)


# ── Survey Items ─────────────────────────────────────────────────────────────

@app.get("/api/studies/{study_id}/items")
def get_survey_items(study_id: str, construct: Optional[str] = None):
    conn = get_db()
    if construct:
        rows = conn.execute(
            "SELECT * FROM survey_items WHERE study_id = ? AND construct = ? ORDER BY code",
            (study_id, construct)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM survey_items WHERE study_id = ? ORDER BY construct, code",
            (study_id,)
        ).fetchall()
    conn.close()
    return rows_to_list(rows)


# ── Composite Scores ──────────────────────────────────────────────────────────

@app.get("/api/studies/{study_id}/composites")
def get_composites(study_id: str, benchmark_group: Optional[str] = None):
    conn = get_db()
    if benchmark_group:
        rows = conn.execute(
            """
            SELECT cs.*, cr.segment_id, cr.benchmark_group, cr.raw_value, cr.z_score
            FROM composite_scores cs
            JOIN composite_responses cr ON cs.id = cr.composite_id
            WHERE cs.study_id = ? AND cr.benchmark_group = ?
            ORDER BY cs.code, cr.segment_id
            """,
            (study_id, benchmark_group)
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT cs.*, cr.segment_id, cr.benchmark_group, cr.raw_value, cr.z_score
            FROM composite_scores cs
            JOIN composite_responses cr ON cs.id = cr.composite_id
            WHERE cs.study_id = ?
            ORDER BY cs.code, cr.benchmark_group, cr.segment_id
            """,
            (study_id,)
        ).fetchall()
    conn.close()
    return rows_to_list(rows)


# ── Trust Ratings ─────────────────────────────────────────────────────────────

@app.get("/api/studies/{study_id}/trust")
def get_trust(study_id: str, segment_code: Optional[str] = None):
    conn = get_db()
    if segment_code:
        seg = conn.execute(
            "SELECT id FROM segments WHERE study_id = ? AND code = ?",
            (study_id, segment_code.upper())
        ).fetchone()
        if not seg:
            conn.close()
            raise HTTPException(status_code=404, detail="Segment not found")
        rows = conn.execute(
            """
            SELECT te.code, te.label, te.category,
                   tr.trust_score, tr.benchmark_group
            FROM trust_entities te
            JOIN trust_ratings tr ON te.id = tr.entity_id
            WHERE te.study_id = ? AND tr.segment_id = ?
            ORDER BY te.code
            """,
            (study_id, seg["id"])
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT te.code, te.label, te.category,
                   s.code as segment_code,
                   tr.trust_score, tr.benchmark_group
            FROM trust_entities te
            JOIN trust_ratings tr ON te.id = tr.entity_id
            JOIN segments s ON tr.segment_id = s.id
            WHERE te.study_id = ?
            ORDER BY te.code, s.id
            """,
            (study_id,)
        ).fetchall()
    conn.close()
    return rows_to_list(rows)


# ── Message Performance (all segments) ───────────────────────────────────────

@app.get("/api/studies/{study_id}/performance")
def get_all_message_performance(study_id: str):
    conn = get_db()
    rows = conn.execute(
        """
        SELECT m.code as message_code, m.short_name,
               s.code as segment_code,
               mp.score, mp.rank, mp.delta_vs_benchmark
        FROM message_performance mp
        JOIN messages m ON mp.message_id = m.id
        JOIN segments s ON mp.segment_id = s.id
        WHERE m.study_id = ?
        ORDER BY s.id, mp.rank
        """,
        (study_id,)
    ).fetchall()
    conn.close()
    return rows_to_list(rows)


# ── Benchmark data (served from JSON source files) ───────────────────────────
# The database stores per-segment data. Benchmark group means (All / Republicans /
# Democrats) for composites, trust, and items are served from the original JSON
# source files until a future migration pass stores them in the DB.

@app.get("/api/studies/{study_id}/benchmarks")
def get_benchmarks(study_id: str):
    """Return composite benchmark stats (raw + z) for All, Republicans, Democrats."""
    bench = _load_json("bench.json")
    return bench


@app.get("/api/studies/{study_id}/items-full")
def get_items_full(study_id: str):
    """Return survey items with per-segment means and benchmark means."""
    items = _load_json("items.json")
    return items


@app.get("/api/studies/{study_id}/trust-full")
def get_trust_full(study_id: str):
    """Return trust entities with per-segment scores and benchmark means."""
    trust = _load_json("trust.json")
    return trust


@app.get("/api/studies/{study_id}/seg-data")
def get_seg_data(study_id: str):
    """Return per-segment composite scores and ranks (all 16 segments)."""
    seg_data = _load_json("seg_data.json")
    return seg_data


@app.get("/api/studies/{study_id}/manifest")
def get_manifest(study_id: str):
    """Return study manifest / metadata."""
    manifest = _load_json("manifest.json")
    return manifest


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
