"""
PRISM Simulation API — FastAPI
==============================
Simulates how PRISM segments respond to new HIV messages
using trained persuasion models. Callable from Azure Foundry
as a custom tool via HTTP.

Run locally:
    pip install fastapi uvicorn pandas numpy scikit-learn statsmodels
    uvicorn prism_simulation_api:app --reload --port 8000

Test:
    POST http://localhost:8000/simulate
"""

import os
import sys
import json
import math
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

# ── Pandas StringDtype compatibility patch ────────────────────────────────────
# Models were saved with an older pandas. Patch StringDtype before loading
# to handle positional argument mismatch across pandas versions.
try:
    import pandas as pd
    _orig_string_init = pd.StringDtype.__init__
    def _patched_string_init(self, *args, **kwargs):
        try:
            _orig_string_init(self, *args, **kwargs)
        except TypeError:
            try:
                _orig_string_init(self, args[0] if args else None)
            except TypeError:
                _orig_string_init(self)
    pd.StringDtype.__init__ = _patched_string_init
except Exception:
    pass

# ── Model directory ───────────────────────────────────────────────────────────
# Adjust this path if you move the PersuasionModels folder
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PersuasionModels")
sys.path.insert(0, MODEL_DIR)

from prism_pre_gen_predict import predict_pre_score, compute_issue_profile
from prism_delta_predict import predict_opinion_delta
from prism_seg_predict import predict_msg_rating, rank_messages

app = FastAPI(
    title="PRISM Simulation API",
    description="Simulates PRISM segment responses to new HIV messages without surveying real people.",
    version="1.0.0"
)

# ── Segment definitions ────────────────────────────────────────────────────────
SEGMENTS = {
    1:  {"code": "PP",  "name": "Price Populists",                    "coalition": "GOP"},
    2:  {"code": "MFL", "name": "Medical Freedom Libertarians",        "coalition": "GOP"},
    3:  {"code": "TC",  "name": "Traditional Conservatives",           "coalition": "GOP"},
    4:  {"code": "UCP", "name": "Upscale Conservative Professionals",  "coalition": "GOP"},
    5:  {"code": "WE",  "name": "Working-Class Evangelicals",          "coalition": "GOP"},
    6:  {"code": "PFF", "name": "Patriotic Faith and Family",          "coalition": "GOP"},
    7:  {"code": "GHI", "name": "Government and Healthcare Insiders",  "coalition": "GOP"},
    8:  {"code": "HAD", "name": "Heartland and Agriculture Dependents","coalition": "GOP"},
    9:  {"code": "HF",  "name": "Hometown Fiscalists",                 "coalition": "GOP"},
    10: {"code": "CEC", "name": "Cost-Conscious Entrepreneurs",        "coalition": "GOP"},
    11: {"code": "FJP", "name": "Faith and Justice Progressives",      "coalition": "DEM"},
    12: {"code": "VS",  "name": "Values and Science",                  "coalition": "DEM"},
    13: {"code": "HCP", "name": "Healthcare and Community Protectors", "coalition": "DEM"},
    14: {"code": "HCI", "name": "Health Cost Independents",            "coalition": "DEM"},
    15: {"code": "HHN", "name": "Health and Human Needs",              "coalition": "DEM"},
    16: {"code": "TSP", "name": "Transformative Social Progressives",  "coalition": "DEM"},
}

# Default vector profiles per segment (from Wave 1 HIV study)
SEGMENT_VECTORS = {
    1:  {"V_TRUST": -0.4, "V_SCIENCE": -0.2, "V_MARKETS":  0.8, "V_FREEDOM":  0.6},
    2:  {"V_TRUST": -0.8, "V_SCIENCE": -0.6, "V_MARKETS":  0.4, "V_FREEDOM":  1.2},
    3:  {"V_TRUST":  0.2, "V_SCIENCE": -0.1, "V_MARKETS":  0.5, "V_FREEDOM":  0.3},
    4:  {"V_TRUST":  0.6, "V_SCIENCE":  0.4, "V_MARKETS":  0.9, "V_FREEDOM":  0.1},
    5:  {"V_TRUST": -0.2, "V_SCIENCE": -0.3, "V_MARKETS":  0.2, "V_FREEDOM":  0.4},
    6:  {"V_TRUST":  0.3, "V_SCIENCE": -0.2, "V_MARKETS":  0.3, "V_FREEDOM":  0.2},
    7:  {"V_TRUST":  0.8, "V_SCIENCE":  0.6, "V_MARKETS":  0.1, "V_FREEDOM": -0.2},
    8:  {"V_TRUST":  0.1, "V_SCIENCE": -0.1, "V_MARKETS":  0.4, "V_FREEDOM":  0.3},
    9:  {"V_TRUST":  0.2, "V_SCIENCE":  0.1, "V_MARKETS":  0.6, "V_FREEDOM":  0.2},
    10: {"V_TRUST":  0.5, "V_SCIENCE":  0.3, "V_MARKETS":  0.7, "V_FREEDOM":  0.0},
    11: {"V_REFORM": 0.8, "V_EQUITY":  0.9, "V_LEADERSHIP":  0.4, "V_INDUSTRY": -0.3},
    12: {"V_REFORM": 0.5, "V_EQUITY":  0.6, "V_LEADERSHIP":  0.6, "V_INDUSTRY": -0.1},
    13: {"V_REFORM": 0.7, "V_EQUITY":  0.8, "V_LEADERSHIP":  0.5, "V_INDUSTRY": -0.2},
    14: {"V_REFORM": 0.3, "V_EQUITY":  0.4, "V_LEADERSHIP":  0.3, "V_INDUSTRY":  0.2},
    15: {"V_REFORM": 0.9, "V_EQUITY":  1.0, "V_LEADERSHIP":  0.3, "V_INDUSTRY": -0.4},
    16: {"V_REFORM": 1.1, "V_EQUITY":  1.2, "V_LEADERSHIP":  0.2, "V_INDUSTRY": -0.5},
}

# ── Request/Response models ───────────────────────────────────────────────────
class MessageVector(BaseModel):
    """
    Vector codes for the new message (-2 to +2 scale).
    Rate how strongly the message appeals to each dimension.
    0 = neutral, +2 = strongly appeals, -2 = strongly opposes.
    """
    TRUST:      float = 0.0   # Appeals to institutional trust
    SCIENCE:    float = 0.0   # Appeals to science/evidence
    MARKETS:    float = 0.0   # Appeals to market/economic framing
    FREEDOM:    float = 0.0   # Appeals to personal freedom/choice
    REFORM:     float = 0.0   # Appeals to systemic reform
    EQUITY:     float = 0.0   # Appeals to equity/fairness
    LEADERSHIP: float = 0.0   # Appeals to leadership/authority
    INDUSTRY:   float = 0.0   # Appeals to industry/private sector

class SimulateRequest(BaseModel):
    message_text: str                          # The new message to simulate
    message_id: str = "NEW_MSG"               # Optional label
    message_vectors: MessageVector             # Vector codes for the message
    segments: Optional[list[int]] = None      # Specific segments (1-16), None = all
    study: str = "HIV"                         # Study context

class SegmentResult(BaseModel):
    segment_id: int
    segment_code: str
    segment_name: str
    coalition: str
    predicted_rating: Optional[float]
    predicted_delta: Optional[float]
    utility_estimate: Optional[float]
    backfire_risk: bool
    confidence: str

class SimulateResponse(BaseModel):
    message_id: str
    message_text: str
    results: list[SegmentResult]
    top_segments: list[str]
    backfire_segments: list[str]
    note: str

# ── Utility calculation ───────────────────────────────────────────────────────
def compute_utility(ratings: list[float]) -> list[float]:
    """Normalize ratings to 0-100 utility scale."""
    valid = [r for r in ratings if r is not None]
    if not valid:
        return [None] * len(ratings)
    mn, mx = min(valid), max(valid)
    if mx == mn:
        return [50.0 if r is not None else None for r in ratings]
    return [
        round(100 * (r - mn) / (mx - mn), 1) if r is not None else None
        for r in ratings
    ]

# ── Simulation endpoint ───────────────────────────────────────────────────────
@app.post("/simulate", response_model=SimulateResponse)
def simulate_message(req: SimulateRequest):
    """
    Simulate how PRISM segments respond to a new message.
    Returns predicted ratings, opinion deltas, utility scores,
    and backfire flags for each segment.
    """
    target_segments = req.segments or list(range(1, 17))

    # Map study codes to available trained models.
    # HIV uses VAX2 as the closest proxy (infectious disease, medical trust dynamics).
    STUDY_MAP = {
        "HIV": "VAX2",
    }
    study = STUDY_MAP.get(req.study, req.study)

    msg = {
        "msg_id":    req.message_id,
        "TRUST":     req.message_vectors.TRUST,
        "SCIENCE":   req.message_vectors.SCIENCE,
        "MARKETS":   req.message_vectors.MARKETS,
        "FREEDOM":   req.message_vectors.FREEDOM,
        "REFORM":    req.message_vectors.REFORM,
        "EQUITY":    req.message_vectors.EQUITY,
        "LEADERSHIP":req.message_vectors.LEADERSHIP,
        "INDUSTRY":  req.message_vectors.INDUSTRY,
    }

    # Issue profile from message vectors
    issue_profile = compute_issue_profile([{
        k: v for k, v in msg.items() if k != "msg_id"
    }])

    raw_ratings = []
    raw_deltas = []

    for seg_id in target_segments:
        seg_info = SEGMENTS.get(seg_id)
        if not seg_info:
            raw_ratings.append(None)
            raw_deltas.append(None)
            continue

        avatar = {
            "segment": seg_id,
            "study": study,
            "outcome_item": "COMPOSITE",
            "outcome_scale": 7,
            **SEGMENT_VECTORS.get(seg_id, {})
        }

        # Predict baseline opinion
        pre_std, pre_raw = predict_pre_score(avatar, issue_profile=issue_profile)
        pre_score = pre_raw if pre_raw is not None else 4.0

        # Predict message rating
        rating = predict_msg_rating(avatar, msg)
        raw_ratings.append(rating)

        # Predict opinion delta
        avatar["pre_score"] = pre_score
        avatar["pre_scale"] = 7
        delta = predict_opinion_delta(avatar)
        raw_deltas.append(delta)

    # Compute utility scores
    utilities = compute_utility(raw_ratings)

    # Build results
    results = []
    for i, seg_id in enumerate(target_segments):
        seg_info = SEGMENTS.get(seg_id, {})
        rating = raw_ratings[i]
        delta = raw_deltas[i]
        utility = utilities[i]

        backfire = (delta is not None and delta < -0.15) or \
                   (rating is not None and rating < -0.15)

        if rating is None:
            confidence = "no model"
        elif abs(rating) < 0.3:
            confidence = "low"
        elif abs(rating) < 0.7:
            confidence = "medium"
        else:
            confidence = "high"

        results.append(SegmentResult(
            segment_id=seg_id,
            segment_code=seg_info.get("code", ""),
            segment_name=seg_info.get("name", ""),
            coalition=seg_info.get("coalition", ""),
            predicted_rating=round(rating, 4) if rating is not None else None,
            predicted_delta=round(delta, 4) if delta is not None else None,
            utility_estimate=utility,
            backfire_risk=backfire,
            confidence=confidence
        ))

    # Sort by utility descending
    results.sort(key=lambda x: (x.utility_estimate or -999), reverse=True)

    top_segments = [r.segment_code for r in results if r.utility_estimate and r.utility_estimate >= 60]
    backfire_segments = [r.segment_code for r in results if r.backfire_risk]

    return SimulateResponse(
        message_id=req.message_id,
        message_text=req.message_text,
        results=results,
        top_segments=top_segments,
        backfire_segments=backfire_segments,
        note=(
            "Scores are model-predicted estimates for an untested message. "
            "True utility requires real survey data. "
            "Use these scores for directional guidance only."
        )
    )

@app.get("/health")
def health():
    return {"status": "ok", "model_dir": MODEL_DIR}

@app.get("/segments")
def get_segments():
    return SEGMENTS

@app.get("/models")
def get_models():
    from prism_seg_predict import available_models as seg_models
    from prism_delta_predict import _models as delta_models
    from prism_pre_gen_predict import _models as pre_models
    return {
        "seg_models": seg_models(),
        "delta_model_keys": list(delta_models.keys()) if hasattr(delta_models, 'keys') else str(type(delta_models)),
        "pre_model_keys": list(pre_models.keys()) if hasattr(pre_models, 'keys') else str(type(pre_models)),
    }

# ── Dashboard / Wave 1 topline endpoints ──────────────────────────────────────
import functools

DASHBOARD_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard.json")

@functools.lru_cache(maxsize=1)
def _load_dashboard():
    with open(DASHBOARD_PATH, "r") as f:
        return json.load(f)

SEGMENT_NAMES = {
    "PP": "Price Populists", "MFL": "Medical Freedom Libertarians",
    "TC": "Traditional Conservatives", "UCP": "Upscale Conservative Professionals",
    "WE": "Working-Class Evangelicals", "PFF": "Patriotic Faith and Family",
    "GHI": "Government and Healthcare Insiders", "HAD": "Heartland and Agriculture Dependents",
    "HF": "Hometown Fiscalists", "CEC": "Cost-Conscious Entrepreneurs",
    "FJP": "Faith and Justice Progressives", "VS": "Values and Science",
    "HCP": "Healthcare and Community Protectors", "HCI": "Health Cost Independents",
    "HHN": "Health and Human Needs", "TSP": "Transformative Social Progressives",
}

@app.get("/topline")
def get_topline():
    """Return all 17 Wave 1 messages with segment scores."""
    d = _load_dashboard()
    results = []
    msg_map = {m["id"]: m["theme_label"] for m in d.get("messages", [])}
    for record in d.get("message_topline", []):
        msg_num = record["message"]
        segments_out = []
        for seg_code, metrics in record.get("by_segment", {}).items():
            bw = metrics.get("bw_mean", 0)
            segments_out.append({
                "segment_code": seg_code,
                "segment_name": SEGMENT_NAMES.get(seg_code, seg_code),
                "utility": metrics.get("utility"),
                "bw_mean": bw,
                "sop_pct": metrics.get("sop_pct"),
                "n": metrics.get("n"),
                "backfire_risk": bw < -0.15,
            })
        segments_out.sort(key=lambda x: (x["utility"] or 0), reverse=True)
        results.append({
            "message_id": f"MSG_{msg_num:02d}",
            "message_number": msg_num,
            "message_label": msg_map.get(msg_num, f"MSG_{msg_num:02d}"),
            "data_source": "dashboard.json, Wave 1, Gilead Sciences, April 2026, n=3102",
            "segments": segments_out,
        })
    return results

@app.get("/topline/{message_number}")
def get_topline_message(message_number: int):
    """Return Wave 1 scores for a single message (1-17) across all 16 segments."""
    d = _load_dashboard()
    msg_map = {m["id"]: m["theme_label"] for m in d.get("messages", [])}
    for record in d.get("message_topline", []):
        if record["message"] == message_number:
            segments_out = []
            for seg_code, metrics in record.get("by_segment", {}).items():
                bw = metrics.get("bw_mean", 0)
                segments_out.append({
                    "segment_code": seg_code,
                    "segment_name": SEGMENT_NAMES.get(seg_code, seg_code),
                    "utility": metrics.get("utility"),
                    "bw_mean": bw,
                    "sop_pct": metrics.get("sop_pct"),
                    "n": metrics.get("n"),
                    "backfire_risk": bw < -0.15,
                })
            segments_out.sort(key=lambda x: (x["utility"] or 0), reverse=True)
            return {
                "message_id": f"MSG_{message_number:02d}",
                "message_number": message_number,
                "message_label": msg_map.get(message_number, f"MSG_{message_number:02d}"),
                "data_source": "dashboard.json, Wave 1, Gilead Sciences, April 2026, n=3102",
                "segments": segments_out,
            }
    raise HTTPException(status_code=404, detail=f"Message {message_number} not found. Valid range: 1-17.")

# ── Message keyword registry (source of truth for routing) ───────────────────
# The agent calls /match with user text → gets message_number back → calls /topline/{n}
# This eliminates hardcoded routing from agent instructions.
MESSAGE_REGISTRY = {
    1: {
        "label": "THE ONGOING EPIDEMIC",
        "keywords": ["39,000", "39000", "new diagnoses", "100 per day", "100 every day",
                     "aids-related", "aids related", "ongoing epidemic", "deaths per week",
                     "100 americans die", "newly diagnosed with hiv every year"]
    },
    2: {
        "label": "PROGRESS PARADOX",
        "keywords": ["progress paradox", "advanced stage", "1 in 5", "one in five", "27%",
                     "lowest prevention", "states with lowest", "most advanced stage",
                     "2023", "prevention coverage"]
    },
    3: {
        "label": "THE PREVENTABLE DIAGNOSIS",
        "keywords": ["only 1 in 3", "prep", "hiv prevention medication",
                     "available since 2012", "since 2012", "receives it", "could benefit",
                     "preventable diagnosis", "1 in 3 americans"]
    },
    4: {
        "label": "COMPASSION",
        "keywords": ["pepfar", "human dignity", "25 million", "president bush",
                     "global hiv", "lives saved", "every human life", "compassion"]
    },
    5: {
        "label": "VIGILANCE",
        "keywords": ["treatment interruption", "resistance", "vigilance", "daily medication",
                     "once monthly", "twice yearly", "twice-yearly", "once a month",
                     "once monthly prevention", "twice yearly prevention", "reliable protection"]
    },
    6: {
        "label": "ECONOMIC RETURN",
        "keywords": ["$500,000", "500000", "economic cost", "lifetime healthcare costs",
                     "cuts to prevention", "avoidable", "modest annual reduction",
                     "billions", "infection prevented saves", "economic return"]
    },
    7: {
        "label": "SHARED COMMUNITIES",
        "keywords": ["opioid crisis", "mental illness", "not competing priorities",
                     "shared communities", "outreach workers", "same communities",
                     "same individuals", "shared populations", "clinics"]
    },
    8: {
        "label": "WORKFORCE COST",
        "keywords": ["workforce", "productivity losses", "earnings", "economic participation",
                     "employers", "insurers", "untreated hiv", "out of the workforce",
                     "workforce cost"]
    },
    9: {
        "label": "BARRIERS",
        "keywords": ["coverage restrictions", "cost barriers", "doctor prescribes",
                     "millions don't have it", "gaps in the healthcare system",
                     "healthcare system", "barriers", "even if their doctor"]
    },
    10: {
        "label": "THE FINISH LINE",
        "keywords": ["90%", "ninety percent", "2030", "national goal", "ending the epidemic",
                     "finish line", "existing tools", "reduce new hiv infections", "90 percent"]
    },
    11: {
        "label": "INNOVATION SPILLOVER",
        "keywords": ["innovation", "research pipeline", "continued investment", "new hiv treatments",
                     "pipeline", "science it drives", "spillover", "developing today"]
    },
    12: {
        "label": "TREATMENT AS PREVENTION",
        "keywords": ["treatment as prevention", "once a month", "twice a year", "twice yearly",
                     "consistent protection", "new treatments", "more achievable than ever",
                     "monthly or twice"]
    },
    13: {
        "label": "SOUTHERN EPIDEMIC",
        "keywords": ["american south", "sub-saharan africa", "sub saharan africa",
                     "8 of 9", "eight of the nine", "highest diagnosis rates", "southern states",
                     "south rivals", "southern epidemic", "hiv incidence in the south",
                     "hiv incidence in parts"]
    },
    14: {
        "label": "GETTING YOUNGER",
        "keywords": ["13 to 24", "13-24", "youth", "young people", "one in five new",
                     "1 in 5 new diagnoses", "least likely to know", "getting younger",
                     "epidemic is not aging", "aged 13"]
    },
    15: {
        "label": "RURAL HEALTH",
        "keywords": ["ryan white", "rural", "southern communities", "rural access",
                     "primary healthcare resource", "rural and southern", "rural health",
                     "ryan white hiv"]
    },
    16: {
        "label": "RACIAL DISPARITY",
        "keywords": ["black americans", "38%", "38 percent", "12% of the", "12 percent",
                     "hispanic", "latino", "34%", "34 percent", "racial disparities",
                     "racial disparity", "18% of prevention"]
    },
    17: {
        "label": "ALL OF US AFFECTED",
        "keywords": ["every state", "every kind of community", "geography",
                     "healthcare infrastructure", "prevention programs", "universal impact",
                     "all of us", "where the burden falls", "all of us affected"]
    },
}


class MatchRequest(BaseModel):
    query: str


@app.post("/match")
def match_message(req: MatchRequest):
    """
    Match user-provided message text, theme label, or message number to a Wave 1 message.
    Supports: full message text, theme label (e.g. 'rural health'), or message number (e.g. '15', 'msg 15', 'msg_15').
    Returns message_number (1-17) or null if no match.
    """
    import re
    query = req.query.lower().strip()

    # 1. Direct message number match: "15", "msg 15", "msg_15", "message 15"
    num_pattern = re.search(r'\b(?:msg[_\s]?|message\s?)?(\d{1,2})\b', query)
    if num_pattern:
        num = int(num_pattern.group(1))
        if 1 <= num <= 17 and num in MESSAGE_REGISTRY:
            msg = MESSAGE_REGISTRY[num]
            return {
                "message_number": num,
                "message_label": msg["label"],
                "confidence": "high",
                "keyword_hits": 1,
                "note": f"Matched MSG_{num:02d}: {msg['label']} by message number."
            }

    # 2. Theme label match (e.g. "rural health", "southern epidemic")
    for msg_num, msg_data in MESSAGE_REGISTRY.items():
        label_lower = msg_data["label"].lower()
        if label_lower in query:
            return {
                "message_number": msg_num,
                "message_label": msg_data["label"],
                "confidence": "high",
                "keyword_hits": 1,
                "note": f"Matched MSG_{msg_num:02d}: {msg_data['label']} by theme label."
            }

    # 3. Keyword match
    best_num = None
    best_score = 0
    best_label = None
    for msg_num, msg_data in MESSAGE_REGISTRY.items():
        score = sum(1 for kw in msg_data["keywords"] if kw.lower() in query)
        if score > best_score:
            best_score = score
            best_num = msg_num
            best_label = msg_data["label"]

    if best_score < 4:
        return {
            "message_number": None,
            "message_label": None,
            "confidence": "no_match",
            "note": "No Wave 1 message matched with sufficient confidence. Route to PATH B simulation."
        }

    return {
        "message_number": best_num,
        "message_label": best_label,
        "confidence": "high" if best_score >= 5 else "low",
        "keyword_hits": best_score,
        "note": f"Matched MSG_{best_num:02d}: {best_label}. Call /topline/{best_num} for segment scores."
    }


@app.get("/audience/{segment_code}")
def get_audience_profile(segment_code: str):
    """Return fixed Wave 1 audience profile for a segment: trust battery, demographics, influencer ratings."""
    d = _load_dashboard()
    seg_code = segment_code.upper()

    trust = []
    for item in d.get("trust", []):
        results_by_seg = item.get("results", {})
        if seg_code in results_by_seg:
            trust.append({
                "source": item.get("label", item.get("id", "")),
                "mean": results_by_seg[seg_code].get("mean"),
                "top2": results_by_seg[seg_code].get("top2"),
            })

    demographics = []
    for demo in d.get("demographics", []):
        results_by_seg = demo.get("results", {})
        if seg_code in results_by_seg:
            demographics.append({
                "label": demo.get("label", demo.get("id", "")),
                "value": results_by_seg[seg_code],
            })

    influencer = []
    for inf in d.get("influencer", []):
        results_by_seg = inf.get("results", {})
        if seg_code in results_by_seg:
            influencer.append({
                "messenger": inf.get("label", inf.get("id", "")),
                "mean": results_by_seg[seg_code].get("mean"),
                "top2": results_by_seg[seg_code].get("top2"),
            })

    roi = d.get("roi_data", {}).get(seg_code)

    return {
        "segment_code": seg_code,
        "segment_name": SEGMENT_NAMES.get(seg_code, seg_code),
        "data_source": "dashboard.json, Wave 1, Gilead Sciences, April 2026",
        "trust_battery": trust,
        "demographics": demographics,
        "influencer_ratings": influencer,
        "roi_data": roi,
    }
