# HTTP API protocol

The agent-facing surface is intentionally small: one endpoint to publish, one to read feedback, and one to check a token. Everything else (viewing, commenting, link management) happens on the web side through share links and the dashboard.

- Base URL: `https://preapp.app` (self-hosted servers substitute their own origin).
- Auth: `Authorization: Bearer pa_live_xxxxxxxx` (an **agent token**).
- Errors are JSON: `{"error": "unauthorized"}`, `{"error": "forbidden"}`, `{"error": "not_found"}`, etc.

## Token model

| Token | Where it lives | Can | Cannot |
| --- | --- | --- | --- |
| Agent token (`pa_live_...`) | Your machine / CI secret | Publish artifacts, read feedback, `GET /api/me` | — |
| Review token | Embedded in the review link | Open the review page, read and submit comments on that deck | Publish, read the feedback API |
| View token | Embedded in the view link | Browse the deck | Comment, publish, read the feedback API |

Agent tokens are generated and revoked in the PreApp dashboard. Review/view tokens are minted by the server at publish time and returned inside `reviewLink` / `viewLink` — treat those links as secrets (see [security.md](security.md)).

## `GET /api/me`

Token probe. Used by `preapp login` to validate a token before persisting it; useful for health checks in CI.

```http
GET /api/me
Authorization: Bearer pa_live_xxxxxxxx
```

`200`:

```json
{ "userId": "user_01JZ8...", "tokenName": "laptop agent token" }
```

`401` `{"error": "unauthorized"}` — missing, invalid, or revoked token.

## `POST /api/decks/publish`

Publish an artifact as a new deck, or as a new version of an existing deck.

```http
POST /api/decks/publish
Authorization: Bearer pa_live_xxxxxxxx
Idempotency-Key: 5f0f2a44-9c1b-4e0e-9a5e-1c2d3e4f5a6b
Content-Type: multipart/form-data
```

### Multipart fields

| Field | Required | Description |
| --- | --- | --- |
| `artifact` | yes | The HTML file or zip file. |
| `deck` | no | Existing deck id or slug. Empty/omitted creates a new deck with a random slug. |
| `title` | for new decks | Deck title. |
| `description` | no | Human-readable deck description. |
| `entry` | no | Entry file path inside the artifact. Defaults to `index.html` for zips, the file name for single HTML. |
| `changeNote` | no | Version note. |
| `reviewAnchors` | no | JSON array of review anchors (below). |
| `feedbackMode` | no | `off` or `detailed` (default `detailed`). |

### Accepted artifact shapes

- **Single HTML file** (`text/html`).
- **Zip** (`application/zip`) containing the entry file plus static assets with relative paths.
- **Directory** — not sent as-is; the CLI packs directories into a zip before upload (see [cli.md](cli.md#directory-packing)).

Only static assets are hosted. Uploads containing path traversal, symlink entries, hidden files, executables, or server-side scripts are rejected (`422`); known junk entries (`__MACOSX/`, `.DS_Store`, `Thumbs.db`) are stripped and reported in `warnings` instead of rejected. The path prefix `__preapp/` is reserved — artifacts must not contain it. The server never executes uploaded code.

### Limits

| Limit | Value |
| --- | --- |
| Upload size | 50 MB |
| Files per artifact | 500 |
| Unpacked size | 200 MB |

### Review anchors

`reviewAnchors` is an optional JSON array giving reviewers named sections to attach comments to (PreApp does not parse or infer deck structure itself):

```json
[
  {"label": "Opening", "sortOrder": 1},
  {"label": "Market Opportunity", "sortOrder": 2},
  {"label": "Pricing", "sortOrder": 3}
]
```

Inheritance across versions: **omit the field** and the new version copies the previous version's anchors; send an explicit **`[]`** to clear them; send a **non-empty array** to replace them. Maximum 50 anchors per version.

### Response `201`

```json
{
  "deckId": "deck_01JZ8Q7M2B9T3EXAMPLE",
  "deckSlug": "q3-strategy",
  "versionId": "ver_01JZ8Q8A1K6P4EXAMPLE",
  "versionNumber": 1,
  "artifactHash": "sha256:9d5f...",
  "entry": "index.html",
  "viewLink": "https://preapp.app/d/q3-strategy?token=view_xxx",
  "reviewLink": "https://preapp.app/d/q3-strategy/feedback?token=review_xxx",
  "versionLink": "https://preapp.app/d/q3-strategy/v/1?token=view_xxx",
  "feedbackCommand": "preapp feedback get https://preapp.app/d/q3-strategy/v/1 --format markdown",
  "createdAt": "2026-07-03T04:00:00Z",
  "warnings": ["external resource: https://cdn.example.com/font.css"]
}
```

`warnings` is present only when non-empty (e.g. stripped junk entries, external resources — allowed but flagged). `feedbackCommand` is a ready-to-run CLI command assuming the CLI is configured.

### curl example

```sh
curl -X POST https://preapp.app/api/decks/publish \
  -H "Authorization: Bearer pa_live_xxxxxxxx" \
  -H "Idempotency-Key: $(uuidgen)" \
  -F "artifact=@deck.zip;type=application/zip" \
  -F "deck=q3-strategy" \
  -F "title=Q3 Strategy Deck" \
  -F "changeNote=Tightened pricing section"
```

### Idempotency semantics

- Every successful publish creates a **new version** — there is no content-based dedupe.
- Retrying with the **same `Idempotency-Key` and the same request** returns the original response; no duplicate version is created. Send the same key for all retries of one logical publish (the CLI does this automatically).
- The **same key with different content** returns `409`.
- Keys are retained for 24 hours.
- `artifactHash` is for traceability only — it is **not** used for dedupe.

### Version semantics

- The stable `viewLink` / `reviewLink` always show the **latest** version.
- `versionLink` is a permalink pinned to that specific version.
- Comments and feedback bind to a specific version, never merely to "latest".

### Publish errors

| Code | Meaning |
| --- | --- |
| `400` | Invalid request fields (e.g. missing `title` for a new deck). |
| `401` | Missing or invalid agent token. |
| `403` | Token cannot publish to this deck (not the owner). |
| `409` | `Idempotency-Key` reused with a different artifact/request. |
| `413` | Artifact too large: over 50 MB upload / 500 files / 200 MB unpacked. |
| `415` | Unsupported file type. |
| `422` | Content rules violated: missing entry file, path traversal, symlink entry, hidden file, executable, server script, unpacked size over limit, reserved `__preapp/` prefix, or invalid anchor JSON. |
| `503` | Artifact storage temporarily unavailable. Retry with the **same** `Idempotency-Key`. |

## `GET /api/decks/{deck}/versions/{version}/feedback`

Read the structured feedback for one version. `{deck}` accepts a deck id or slug; `{version}` is a version number or the literal `latest`.

```http
GET /api/decks/q3-strategy/versions/latest/feedback?format=json
Authorization: Bearer pa_live_xxxxxxxx
```

| Query param | Values |
| --- | --- |
| `format` | `json` (default) or `markdown` (`text/markdown` — the Agent Fix Brief) |

Both formats render the same source data; the full shape, field-by-field, is documented in [feedback-payload.md](feedback-payload.md). Feedback remains readable with the agent token even after a deck is taken offline.

### Feedback errors

| Code | Meaning |
| --- | --- |
| `401` | Missing/invalid agent token (review and view tokens cannot call this API). |
| `403` | Valid agent token, but the deck belongs to another account. |
| `404` | Unknown deck, unknown version number, or malformed version segment. |
