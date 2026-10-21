# Backend request: `POST /diary/correct`

Diary correction currently runs through `POST /ai/chat` with the whole prompt built in the
browser (`frontend/src/services/diaryCorrection.js`). That should become a dedicated
endpoint.

## Why

- **The output format can be enforced.** Mistral supports `response_format: {"type": "json_object"}`,
  which `/ai/chat` has no field for. Today the model returns free text and the client
  guesses — a diary entry with a line break produced a literal newline inside a JSON string
  and blew up `JSON.parse`. Server-side, the format is guaranteed and Pydantic validates
  before the response is sent.
- **The prompt is product logic, not client logic.** The "never force ます" rule is the
  feature. In the browser it ships to every user, is editable from devtools, and can't be
  versioned or covered by backend tests.
- **`/ai/chat` returns `{reply, model}`.** Callers can't tell a correction from chatter.
  A typed response means the frontend stops parsing entirely.

## Contract

`POST /diary/correct` — auth required, same `Depends(get_current_user)` as the other diary routes.

### Request

```json
{
  "text": "今日は友達と映画を見た。\nとても面白いです。",
  "style_mode": "auto",
  "entry_date": "2026-08-10"
}
```

| Field | Type | Notes |
|---|---|---|
| `text` | str, 1–5000 | the entry to correct; required |
| `style_mode` | `"auto"` \| `"plain"` \| `"polite"` | defaults to `"auto"` |
| `entry_date` | date, optional | if given, the server pulls the writer's own recent entries for voice context instead of the client sending them |

`entry_date` is the improvement worth taking: the frontend currently ships the last 3
entries back to the server as prompt context. The server already has them in `diary_entry` —
query `where user_id = :uid and entry_date < :entry_date order by entry_date desc limit 3`.
Less payload, and the client can't spoof another user's context.

### Response `200`

```json
{
  "detected_register": "plain",
  "register_note": "You wrote in plain form (だ体), the natural register for a diary.",
  "corrected": "今日は友達と映画を見に行った。\nとても面白かった。",
  "notes": [
    {
      "original": "見た",
      "corrected": "見に行った",
      "kind": "word choice",
      "explanation": "For \"went to see\", Japanese uses 見に行く — 〜に行く attaches to the verb stem."
    }
  ],
  "encouragement": "Good use of とても to intensify the adjective."
}
```

Pydantic models for `app/models/diary.py`:

```python
class CorrectionNote(BaseModel):
    original: str = ""
    corrected: str = ""
    kind: Literal["particle", "conjugation", "word choice", "naturalness", "orthography", "grammar"] = "grammar"
    explanation: str = ""

class CorrectionRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    style_mode: Literal["auto", "plain", "polite"] = "auto"
    entry_date: date | None = None

class CorrectionResponse(BaseModel):
    detected_register: Literal["plain", "polite", "mixed", "unknown"] = "unknown"
    register_note: str = ""
    corrected: str
    notes: list[CorrectionNote] = []
    encouragement: str = ""
```

### Errors

| Status | When |
|---|---|
| `422` | empty/oversized `text` (FastAPI default) |
| `502` | Mistral unreachable, or its JSON fails `CorrectionResponse` validation after one retry |
| `504` | Mistral timeout — corrections are slower than chat, so allow ~60s |

Please do **not** fall back to returning the entry uncorrected with an empty `notes` array on
model failure. That renders as "your Japanese is perfect" and is worse than an error.

## Implementation notes

`app/services/ai.py` needs `response_format` plumbed into the payload — the existing
`stream_chat_reply` builds the dict, so a non-streaming sibling that adds
`"response_format": {"type": "json_object"}` and skips SSE parsing is the smaller change.
Correction is a single structured result; streaming buys nothing.

Suggested `max_tokens`: the reply restates the entry plus a note per error, so scale it
(`2000 + len(text) * 6`, capped ~8000) rather than fixing it. A flat 2000 truncates long
entries mid-object. `temperature: 0.2` — corrections should be reproducible.

Validate with `CorrectionResponse` and retry **once** on failure before returning `502`.

### The prompt to move server-side

Lift verbatim from `frontend/src/services/diaryCorrection.js` (`REGISTER_INSTRUCTIONS` +
`buildSystemPrompt` + `buildUserPrompt`). Two edits on the way in:

1. Drop the `## Output` section's JSON-escaping instructions — `response_format` makes them
   redundant.
2. Keep the JSON shape description. `json_object` mode guarantees *valid* JSON, not *your*
   JSON; the model still needs to be told the keys.

Everything above `## Output` is the actual feature and must survive intact — especially:

> Register (politeness level) is the WRITER'S CHOICE, not a mistake. Plain form (だ体 /
> である体) is the normal, idiomatic register for a diary. Never rewrite plain form into
> です・ます.

That rule is the whole point of the feature. If it gets softened, the diary stops being
useful to a writer who journals in plain form.

## Frontend side, once this lands

`diaryCorrection.js` shrinks to a single `apiClient.post('/diary/correct', …)` call.
`frontend/src/utils/parseCorrection.js` gets deleted — no repair layer, no `extractJson`,
no prompt building. A small zod check on the response stays as a boundary guard.

`detectRegister` in `frontend/src/utils/japaneseStyle.js` stays put: it drives the live
register badge as the user types, with no network call.

Nothing in `Diary.jsx` changes — it only calls `requestCorrection`.
