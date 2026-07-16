# HTTP API protocol

The agent-facing surface is intentionally small: one endpoint to publish, one to read feedback, and one to check a token. Everything else (viewing, commenting, link management) happens on the web side through share links and the dashboard.

- Base URL: `https://preapp.app` (self-hosted servers substitute their own origin).
- Auth: `Authorization: Bearer pa_live_xxxxxxxx` (an **agent token**).
- Errors are JSON: `{"error": "unauthorized"}`, `{"error": "forbidden"}`, `{"error": "not_found"}`, etc.

## Token model

| Token | Where it lives | Can | Cannot |
| --- | --- | --- | --- |
| Agent token (`pa_live_...`) | Your machine / CI secret | Publish artifacts, read feedback, `GET /api/me` | — |
| Review token | Embedded in the feedback link | Open the feedback page, read and submit feedback on that content | Publish, read the feedback API |
| View token | Embedded in the view link | Browse the content | Comment, publish, read the feedback API |

Agent tokens are generated and revoked in the PreApp dashboard. Review/view tokens are minted by the server at publish time and returned inside `feedbackLink` / `viewLink` — treat those links as secrets (see [security.md](security.md)).

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

## `POST /api/contents/publish`

Publish an artifact as a new content item, or as a new version of an existing one.

```http
POST /api/contents/publish
Authorization: Bearer pa_live_xxxxxxxx
Idempotency-Key: 5f0f2a44-9c1b-4e0e-9a5e-1c2d3e4f5a6b
Content-Type: multipart/form-data
```

### Multipart fields

| Field | Required | Description |
| --- | --- | --- |
| `artifact` | yes | The HTML file or zip file. |
| `content` | no | Existing content id or slug. Empty/omitted creates a new content item with a random slug. |
| `title` | for new content items | Content title. |
| `description` | no | Human-readable content description. |
| `entry` | no | Entry file path inside the artifact. Defaults to `index.html` for zips, the file name for single HTML. |
| `changeNote` | no | Version note. |
| `feedbackAnchors` | no | JSON array of review anchors (below). |
| `feedbackMode` | no | `off` or `detailed` (default `detailed`). |
| `reviewProfile` | no | `standard` \| `prototype`. Marks an HTML artifact as an interactive product prototype (element-level feedback + owner review board). New HTML versions inherit the previous version's profile; Markdown is always `standard` (explicit `prototype` → `422 invalid_review_profile`). |
| `revisionBriefId` | no | `rbr_…` — apply a **ready** revision brief atomically with this publish (see *Revision brief* below). The brief must belong to this content and its source version must be the direct previous version. |
| `revisionBriefEditSequence` | with `revisionBriefId` | The `editSequence` read alongside the brief. Stale value → `409 revision_changed` (re-read and reconcile). |

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

`feedbackAnchors` is an optional JSON array giving reviewers named sections to attach feedback to (PreApp does not parse or infer content structure itself):

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
  "contentId": "cnt_01JZ8Q7M2B9T3EXAMPLE",
  "contentSlug": "q3-strategy",
  "versionId": "ver_01JZ8Q8A1K6P4EXAMPLE",
  "versionNumber": 1,
  "artifactHash": "sha256:9d5f...",
  "entry": "index.html",
  "viewLink": "https://preapp.app/s/q3-strategy?token=view_xxx",
  "feedbackLink": "https://preapp.app/s/q3-strategy/feedback?token=review_xxx",
  "versionLink": "https://preapp.app/s/q3-strategy/v/1?token=view_xxx",
  "feedbackCommand": "preapp feedback get https://preapp.app/s/q3-strategy --format markdown",
  "reviewProfile": "standard",
  "ownerReviewLink": null,
  "createdAt": "2026-07-03T04:00:00Z",
  "warnings": ["external resource: https://cdn.example.com/font.css"]
}
```

`reviewProfile` is always present; for `prototype` versions `ownerReviewLink` points at the owner's review board (`…/dashboard/c/{slug}/review?version={n}`, owner sign-in required), otherwise `null`. When the publish carried `revisionBriefId`, the response also includes `"revisionBrief": {"id", "state": "applied", "editSequenceBefore", "editSequenceAfter"}`.

`warnings` is present only when non-empty (e.g. stripped junk entries, external resources — allowed but flagged). `feedbackCommand` is a ready-to-run CLI command assuming the CLI is configured.

### curl example

```sh
curl -X POST https://preapp.app/api/contents/publish \
  -H "Authorization: Bearer pa_live_xxxxxxxx" \
  -H "Idempotency-Key: $(uuidgen)" \
  -F "artifact=@content.zip;type=application/zip" \
  -F "content=q3-strategy" \
  -F "title=Q3 Strategy Review" \
  -F "changeNote=Tightened pricing section"
```

### Idempotency semantics

- Every successful publish creates a **new version** — there is no content-based dedupe.
- Retrying with the **same `Idempotency-Key` and the same request** returns the original response; no duplicate version is created. Send the same key for all retries of one logical publish (the CLI does this automatically).
- The **same key with different content** returns `409`.
- Keys are retained for 24 hours.
- `artifactHash` is for traceability only — it is **not** used for dedupe.

### Version semantics

- The stable `viewLink` / `feedbackLink` always show the **latest** version.
- `versionLink` is a permalink pinned to that specific version.
- Feedback binds to a specific version, never merely to "latest".

### Publish errors

| Code | Meaning |
| --- | --- |
| `400` | Invalid request fields (e.g. missing `title` for a new content). |
| `401` | Missing or invalid agent token. |
| `403` | Token cannot publish to this content (not the owner). |
| `409` | `Idempotency-Key` reused with a different artifact/request. |
| `413` | Artifact too large: over 50 MB upload / 500 files / 200 MB unpacked. |
| `415` | Unsupported file type. |
| `422` | Content rules violated: missing entry file, path traversal, symlink entry, hidden file, executable, server script, unpacked size over limit, reserved `__preapp/` prefix, or invalid anchor JSON. |
| `503` | Artifact storage temporarily unavailable. Retry with the **same** `Idempotency-Key`. |

Prototype / revision-brief errors (validation failures roll back the whole publish — no version is created, `latest` and the brief are untouched):

| Code | `error` | Meaning |
| --- | --- | --- |
| `422` | `invalid_review_profile` | Markdown with an explicit `reviewProfile=prototype`. |
| `422` | `revision_content_mismatch` | The brief belongs to a different content item. |
| `422` | `revision_source_mismatch` | The brief's source version is not the direct previous version. |
| `409` | `revision_already_applied` | The brief was already used by another version. |
| `409` | `revision_not_ready` | The brief is still a draft — mark it ready first. |
| `409` | `revision_changed` | `revisionBriefEditSequence` is stale (response carries `currentEditSequence`). Re-read the brief, reconcile, retry. |

## `GET /api/contents/{contentOrVersion}/feedback`

Read the structured feedback for one version. `{contentOrVersion}` accepts a content item id or slug (combine with `?version=N`, default latest), or a `ver_`-prefixed version id (pins that exact version).

```http
GET /api/contents/q3-strategy/feedback?format=json
Authorization: Bearer pa_live_xxxxxxxx
```

| Query param | Values |
| --- | --- |
| `format` | `json` (default) or `markdown` (`text/markdown` — the Agent Feedback Brief) |
| `version` | Version number; omit (or `latest`) for the latest version. Ignored when the path is a `ver_` id. |

Both formats render the same source data; the full shape, field-by-field, is documented in [feedback-payload.md](feedback-payload.md). Feedback remains readable with the agent token even after a content item is taken offline.

### Feedback errors

| Code | Meaning |
| --- | --- |
| `401` | Missing/invalid agent token (review and view tokens cannot call this API). |
| `403` | Valid agent token, but the content belongs to another account. |
| `404` | Unknown content item, unknown version number, or malformed version segment. |

## `GET/PUT /api/contents/{contentOrVersion}/revision-brief`

The revision brief is the owner-curated change list for one prototype **source version** (at most one per version). Auth: the owner's **agent token** or the owner's signed-in session — view/review tokens get `401`, non-owners `403`. The web review board and the agent edit the same brief; every write is guarded by `editSequence` compare-and-swap.

```http
GET /api/contents/q3-prototype/revision-brief?version=1&format=markdown
PUT /api/contents/q3-prototype/revision-brief?version=1
```

- `GET` — `format=json` returns `{revisionBrief: {id, content, sourceVersion{id, number, reviewProfile}, state (draft|ready|applied), editSequence, items[{id, instruction, sortOrder, feedbackIds, sourceFeedback[]}], appliedVersion, createdVia, lastEditedVia, …}, safetyNote}`. `format=markdown` renders the agent brief with owner-curated **Changes** separated from untrusted **Source Feedback** (each reviewer original quoted exactly once). `404` = no brief curated for that version yet. Agent-token reads are logged as `payload_type=revision` pull events.
- `PUT` — creates or **fully replaces** the brief: `{baseEditSequence, state (draft|ready), items:[{instruction, feedbackIds?}]}`. First create requires `baseEditSequence: 0`; updates must send the current value (mismatch → `409 revision_conflict` with `currentEditSequence` — never overwritten silently). `applied` briefs are immutable. Limits: ≤100 items, `instruction` 1–1000 chars (whitespace-normalized), ≤20 feedback ids per item (must belong to the source version → `422 feedback_version_mismatch`), body ≤256 KB. An empty item list cannot be marked `ready`.
- Applying a brief happens through `POST /api/contents/publish` with `revisionBriefId` + `revisionBriefEditSequence` (see Publish above): the new version records the brief, the brief becomes `applied`, all in one transaction.
