"""
PRISM HIV Qualitative Dashboard — FastAPI Backend
Azure OpenAI (GPT-4.5) + PRISM message map data

Endpoints:
  GET  /messages          → list of messages with base text
  GET  /segments          → list of segments
  POST /reactions         → auto-generate avatar quotes for a message × segment
  POST /chat              → chat as a segment persona (stateless, pass history)
  GET  /message/{msg_id}  → full message detail with persona-tuned text
"""

import json
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AzureOpenAI
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Config — set via environment variables or a .env file
# ---------------------------------------------------------------------------
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "https://<your-resource>.openai.azure.com/")
AZURE_OPENAI_API_KEY  = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4-5")   # your GPT-4.5 deployment name
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2025-02-01-preview")

DATA_DIR = Path(__file__).parent / "data"

# ---------------------------------------------------------------------------
# Load PRISM data at startup
# ---------------------------------------------------------------------------
with open(DATA_DIR / "prism_variants.json") as f:
    VARIANTS = json.load(f)

with open(DATA_DIR / "dashboard.json") as f:
    DASHBOARD = json.load(f)

# Build quick-lookup dicts
MSG_BY_ID = {m["msg_id"]: m for m in VARIANTS["messages"]}
SEG_BY_CODE = {s["code"]: s for s in DASHBOARD["segments"]}

# Segment persona descriptions (used to ground the LLM persona)
SEGMENT_PERSONAS = {
    "TSP": "You are a Trust the Science Pragmatist: evidence-driven, respects expertise, wants data and institutional credibility. You trust federal health agencies and peer-reviewed science.",
    "CEC": "You are a Consumer Empowerment Champion: market-oriented, values personal agency and informed choice. You believe competition and transparency drive better health outcomes.",
    "TC":  "You are a Traditional Conservative: values tradition, personal responsibility, and sound public policy. You are skeptical of activist framing but responsive to proven science.",
    "WE":  "You are a Wellness Evangelist: holistic health focus, community-oriented, skeptical of pharma but responsive to prevention and whole-person health messaging.",
    "PP":  "You are a Price Populist: working-class economic lens, suspicious of elites and big institutions, responsive to messages about cost burdens on ordinary families.",
    "HF":  "You are a Health Futurist: tech-optimist, data-driven, excited about innovation and biotech. You want bold, future-forward solutions, not incremental policy.",
    "PFF": "You are a Paleo Freedom Fighter: individual liberty above all, deeply skeptical of government mandates, responsive only when framing centers personal choice.",
    "HHN": "You are a Holistic Health Naturalist: integrative medicine lens, community health focus, values natural approaches but can be reached through community-based framing.",
    "MFL": "You are a Medical Freedom Libertarian: anti-mandate, skeptical of pharmaceutical influence, values informed consent and medical autonomy.",
    "VS":  "You are a Vaccine Skeptic: deep distrust of vaccine programs, responsive only to peer and community framing, not institutional authority.",
    "UCP": "You are an Urban Community Progressive: social justice lens, highly responsive to racial equity and disparity data, community-centered.",
    "FJP": "You are a Faith and Justice Progressive: faith-based moral framing, values compassion and shared responsibility, community service.",
    "HCP": "You are a Healthcare Professional: clinical lens, values evidence-based practice, peer-reviewed research, and patient outcomes.",
    "HAD": "You are a Healthcare Administrator: operational and cost-efficiency lens, responsive to workforce and system-level impact data.",
    "HCI": "You are a Health Communicator/Influencer: narrative and reach focused, wants compelling, shareable framings.",
    "GHI": "You are a Global Health Idealist: values international benchmarking, human rights framing, global solidarity.",
}

# ---------------------------------------------------------------------------
# Azure OpenAI client
# ---------------------------------------------------------------------------
client = AzureOpenAI(
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
    api_key=AZURE_OPENAI_API_KEY,
    api_version=AZURE_OPENAI_API_VERSION,
)


def llm(messages: list[dict], max_tokens: int = 500) -> str:
    resp = client.chat.completions.create(
        model=AZURE_OPENAI_DEPLOYMENT,
        messages=messages,
        max_tokens=max_tokens,
        temperature=0.8,
    )
    return resp.choices[0].message.content.strip()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="PRISM HIV Qualitative Dashboard", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class ReactionsRequest(BaseModel):
    msg_id: str
    segment_codes: Optional[list[str]] = None   # defaults to all segments
    token_index: int = 0                         # which proof token (0 = base)


class ChatRequest(BaseModel):
    msg_id: str
    segment_code: str
    token_index: int = 0
    history: list[dict] = []   # [{role: "user"|"assistant", content: "..."}]
    user_message: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/messages")
def list_messages():
    """Return all messages with their base text."""
    out = []
    for m in VARIANTS["messages"]:
        base_token = next((t for t in m["tokens"] if t.get("is_base")), m["tokens"][0] if m["tokens"] else None)
        out.append({
            "msg_id": m["msg_id"],
            "theme_label": m["theme_label"],
            "n_tokens": m["n_tokens"],
            "base_text": base_token["text_core"] if base_token else "",
        })
    return out


@app.get("/segments")
def list_segments():
    """Return all segments."""
    return DASHBOARD["segments"]


@app.get("/message/{msg_id}")
def get_message(msg_id: str):
    """Full message detail: all tokens × all persona-tuned texts."""
    msg = MSG_BY_ID.get(msg_id)
    if not msg:
        raise HTTPException(404, f"Message {msg_id} not found")
    return msg


@app.post("/reactions")
def get_reactions(req: ReactionsRequest):
    """
    For a given message + token, generate short avatar-style quotes
    from each requested segment persona — as if they just read the message.

    Returns:
      [{segment_code, segment_label, persona_text, quote, emoji}]
    """
    msg = MSG_BY_ID.get(req.msg_id)
    if not msg:
        raise HTTPException(404, f"Message {req.msg_id} not found")

    tokens = msg["tokens"]
    if req.token_index >= len(tokens):
        raise HTTPException(400, "token_index out of range")
    token = tokens[req.token_index]

    target_codes = req.segment_codes or list(SEG_BY_CODE.keys())
    results = []

    for code in target_codes:
        seg = SEG_BY_CODE.get(code)
        if not seg:
            continue

        # Use persona-tuned text if available, else core text
        persona_text = token["text_by_persona"].get(code) or token["text_core"]
        persona_desc = SEGMENT_PERSONAS.get(code, f"You are a member of the {seg['label']} segment.")

        system = f"""{persona_desc}

You just read the following HIV public health message. Respond with:
1. A short, authentic first-person reaction quote (1–2 sentences, in your own voice). Be specific and honest — you can be persuaded, skeptical, or somewhere in between.
2. A single emoji that captures your gut reaction.

Respond in JSON: {{"quote": "...", "emoji": "..."}}
Do not explain. Just the JSON."""

        user = f'Message you just read:\n\n"{persona_text}"'

        try:
            raw = llm([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=200)
            # Strip markdown fences if present
            raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            parsed = json.loads(raw)
        except Exception:
            parsed = {"quote": raw, "emoji": "💬"}

        results.append({
            "segment_code": code,
            "segment_label": seg["label"],
            "persona_text": persona_text,
            "quote": parsed.get("quote", ""),
            "emoji": parsed.get("emoji", "💬"),
        })

    return results


@app.post("/chat")
def chat(req: ChatRequest):
    """
    Chat as a segment persona. The LLM stays in character as the segment
    throughout the conversation. Returns the assistant reply.

    Pass full history on each call (stateless server).
    """
    msg = MSG_BY_ID.get(req.msg_id)
    if not msg:
        raise HTTPException(404, f"Message {req.msg_id} not found")

    seg = SEG_BY_CODE.get(req.segment_code)
    if not seg:
        raise HTTPException(404, f"Segment {req.segment_code} not found")

    tokens = msg["tokens"]
    if req.token_index >= len(tokens):
        raise HTTPException(400, "token_index out of range")
    token = tokens[req.token_index]

    persona_text = token["text_by_persona"].get(req.segment_code) or token["text_core"]
    persona_desc = SEGMENT_PERSONAS.get(req.segment_code, f"You are a member of the {seg['label']} segment.")

    system = f"""{persona_desc}

You are participating in a message testing session. A researcher has shown you this HIV public health message:

"{persona_text}"

Stay fully in character as someone from the {seg['label']} segment. Answer the researcher's questions honestly from your persona's perspective — what resonates, what doesn't, what would make it stronger or weaker for you. Be specific, genuine, and conversational. Do not break character."""

    messages = [{"role": "system", "content": system}]
    for h in req.history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": req.user_message})

    reply = llm(messages, max_tokens=400)
    return {"reply": reply, "segment_code": req.segment_code, "segment_label": seg["label"]}
