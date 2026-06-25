# PRISM HIV Qualitative Dashboard — Retool Setup Spec

## Overview

A two-panel Retool app that lets analysts explore how each PRISM segment responds to HIV public health messages. The left panel auto-generates avatar reaction quotes per segment; the right panel is a live chat that puts the analyst "in conversation" with a persona.

---

## 1. Backend Setup

### Run locally (dev)

```bash
cd qualitative_dashboard
cp .env.example .env        # fill in your Azure OpenAI credentials
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

### Deploy (production)

Deploy to any Python host (Azure App Service, Railway, Render, etc.). Set the four `AZURE_OPENAI_*` environment variables. Expose over HTTPS — Retool requires HTTPS for REST resources.

---

## 2. Retool — REST API Resource

1. In Retool, go to **Resources → Create new → REST API**
2. Name it `PRISM_Backend`
3. Base URL: `https://<your-deployed-backend>/` (or `http://localhost:8000` for dev via Retool's self-hosted tunnel)
4. No auth needed (add Bearer token if you add auth later)

---

## 3. App Layout

Create a new Retool app. Use a **two-column layout**:

```
┌─────────────────────────────────────────────────────────┐
│  PRISM HIV — Qualitative Message Feedback               │
├─────────────────────────────────────────────────────────┤
│  Message: [Dropdown ▾]   Token: [Dropdown ▾]            │
│  Segments: [Multiselect ▾]          [Generate Reactions]│
├──────────────────────┬──────────────────────────────────┤
│  AVATAR REACTIONS    │  PERSONA CHAT                    │
│                      │                                  │
│  [Quote Cards]       │  Segment: [Dropdown ▾]           │
│                      │  ─────────────────────────────── │
│                      │  [Chat history]                  │
│                      │                                  │
│                      │  [Text input]  [Send]            │
└──────────────────────┴──────────────────────────────────┘
```

---

## 4. Queries

### `q_messages` — Load message list on app open
- Resource: `PRISM_Backend`
- Method: GET
- Path: `/messages`
- Run: on app load

### `q_segments` — Load segment list on app open
- Resource: `PRISM_Backend`
- Method: GET
- Path: `/segments`
- Run: on app load

### `q_reactions` — Generate avatar quotes
- Resource: `PRISM_Backend`
- Method: POST
- Path: `/reactions`
- Body (JSON):
```json
{
  "msg_id": "{{ msgDropdown.value }}",
  "segment_codes": {{ segMultiselect.value }},
  "token_index": {{ tokenDropdown.value || 0 }}
}
```
- Run: manually (triggered by "Generate Reactions" button)

### `q_chat` — Send a chat message
- Resource: `PRISM_Backend`
- Method: POST
- Path: `/chat`
- Body (JSON):
```json
{
  "msg_id": "{{ msgDropdown.value }}",
  "segment_code": "{{ chatSegDropdown.value }}",
  "token_index": {{ tokenDropdown.value || 0 }},
  "history": {{ chatHistory.value }},
  "user_message": "{{ chatInput.value }}"
}
```
- Run: manually (triggered by Send button)

---

## 5. Components

### Header row

| Component | Type | Config |
|-----------|------|--------|
| `msgDropdown` | Select | Options from `{{ q_messages.data.map(m => ({label: m.theme_label, value: m.msg_id})) }}` |
| `tokenDropdown` | Select | Options `[{label:"Base",value:0},{label:"Proof 1",value:1},{label:"Proof 2",value:2}]` |
| `segMultiselect` | Multiselect | Options from `{{ q_segments.data.map(s => ({label: s.label, value: s.code})) }}` — default: select all |
| Generate button | Button | onClick: `q_reactions.trigger()` |

### Avatar Reactions panel (left column)

Use a **Listview** component bound to `{{ q_reactions.data }}`:

Inside each Listview row, place:
- **Text** (large): `{{ currentSourceRow.emoji }} {{ currentSourceRow.segment_label }}`
- **Text** (body, italic): `"{{ currentSourceRow.quote }}"`
- **Text** (small, muted): `{{ currentSourceRow.persona_text.slice(0, 120) }}...`

Style tip: give each card a light background and rounded corners via the container padding settings.

### Persona Chat panel (right column)

| Component | Type | Config |
|-----------|------|--------|
| `chatSegDropdown` | Select | Same options as `segMultiselect` but single-select |
| `chatHistory` | JS State variable | Default: `[]` |
| `chatDisplay` | Listview | Bound to `{{ chatHistory.value }}` — show role + content |
| `chatInput` | Text Input | Placeholder: "Ask the persona a question..." |
| Send button | Button | onClick: see JS transformer below |

**Send button JS (onClick):**
```javascript
// 1. Trigger the chat query
await q_chat.trigger();

// 2. Append exchange to history
const updated = [
  ...chatHistory.value,
  { role: "user", content: chatInput.value },
  { role: "assistant", content: q_chat.data.reply }
];
chatHistory.setValue(updated);

// 3. Clear input
chatInput.setValue("");
```

**Chat display Listview row:**
```
[If role === "user"] → right-aligned, bold label "You"
[If role === "assistant"] → left-aligned, label = segment label, italic text
```
Use a conditional container or two text components toggled by `{{ currentSourceRow.role === 'user' }}`.

---

## 6. State — Reset chat when segment or message changes

Add a Retool **Event Handler** on `chatSegDropdown` and `msgDropdown` onChange:
- Action: Set state → `chatHistory` → `[]`
- Action: Clear value → `chatInput`

---

## 7. Optional polish

- **Message preview text**: add a Text component below the dropdowns showing `{{ q_messages.data.find(m => m.msg_id === msgDropdown.value)?.base_text }}` in a muted style — helps analysts remember what message they're testing.
- **Loading spinners**: Retool shows these automatically when a query is running — no extra config needed.
- **Export**: add a Download button with `utils.downloadFile(JSON.stringify(q_reactions.data, null, 2), "reactions.json", "application/json")` to export quote cards.

---

## 8. Environment summary

| Setting | Value |
|---------|-------|
| Model | GPT-4.5 via Azure OpenAI |
| API version | `2025-02-01-preview` |
| Backend | FastAPI / Python |
| Retool resource type | REST API |
| Auth | API key in `.env` (server-side only — never exposed to Retool) |
