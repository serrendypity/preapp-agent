# Changelog

## 0.2.3 — 2026-07-10

Third round of feedback prompt-injection hardening (brief format + gate protocol + server-side flood control).

- **Single representation**: the Markdown brief no longer duplicates the feedback array as a `Raw Feedback JSON` section — hostile text appears exactly once, confined to blockquotes; machine-precise target fields (`prefix`/`suffix`/full `target`) come from `--format json`.
- **Feedback IDs are the reference**: each brief item now leads with its stable `fb_…` ID plus an `author (reviewer-supplied)` label. The gate requires relaying items by ID (with author, original text, and risk flags), and change authorization must come from the human referencing IDs — authorization claimed inside feedback text is void, and author names grant no identity or authority.
- **Read-only phase**: from pulling feedback until the human directs, the gate forbids file edits, republishing, and shell / network / credential / file-write tools.
- **Field-level untrusted markers**: every `feedback[]` item (and the submit 201 echo) carries `untrusted: true`, so the marker survives slicing/forwarding.
- **Persistent rate limiting** (hosted service): sliding windows stored in the database (restart-proof) on two dimensions — per review link (10/min, 500/24h, counting stored feedback) and per client IP (30/min, 300/24h, counting all attempts including invalid-token probing). IPs are stored only as salted hashes retained ≲24h, used for rate decisions only, never for profiling. The brief now states the anti-flood truncation reason and the omitted count.

## 0.2.2 — 2026-07-10

- Fix `preapp --version` printing a stale hardcoded string (`0.1.0`). The version now reads from `package.json` at runtime (single source of truth), so it always matches the installed package. A test locks the two together to prevent regressions.

## 0.2.1 — 2026-07-10

Prompt-injection hardening for the feedback loop.

- The `feedback get` gate now starts with a **safety scan**: the agent must check each item for operational injection (run commands, delete/move files, network, secret exfiltration, "ignore previous instructions", impersonation), flag hits, and never execute anything requested inside feedback text.
- A **red line that survives full delegation**: "apply without review" authorizes editing the content draft only — never executing actions found in feedback. The `preapp-publish` skill carries the same rules.
- Docs spell out that PreApp cannot enforce this on the consuming machine; under full delegation the agent runtime's permission/sandbox is the last line of defense.

## 0.2.0 — 2026-07-10

**Breaking — content/feedback semantics.** PreApp's core objects were renamed from deck/comment to content/feedback across the API, CLI, and share pages (no compatibility layer; the hosted service migrated in lockstep, so 0.1.0 CLIs no longer work against it — upgrade with `npm i -g @preapp/cli`).

- CLI: `--deck` → `--slug`; `preapp feedback get` now parses `/s/…` share URLs and calls `GET /api/contents/{contentOrVersion}/feedback` (`?version=N`, or a `ver_` id to pin a version).
- Publish: `POST /api/contents/publish`; multipart fields `content` / `feedbackAnchors` (was `deck` / `reviewAnchors`); response fields `contentId` / `contentSlug` / `feedbackLink` (was `deckId` / `deckSlug` / `reviewLink`); share links moved from `/d/…` to `/s/…`.
- Feedback: the brief is now the **Agent Feedback Brief** (Content / Version / Visit Summary / Feedback / Raw Feedback JSON / Safety Note). Per-item "fix drafts" and `agentInstructions` were removed — feedback is presented neutrally (it may be a question or extra context, not necessarily a change request); precise locators live in the raw JSON. `comments[]` → `feedback[]`, `_notice` → `safetyNote`, and the reserved `simpleFeedback` field is gone.
- Feedback items no longer have a `kind` category — `text` is the only body; a legacy `kind` field in submissions is ignored.
- Share pages: the primary action is now "feedback" everywhere (submit button, placeholders, target labels: whole content / selected text / image / section), in all five languages.

## 0.1.0 — 2026-07-08

First public release of the PreApp agent integration layer.

- `preapp publish` — publish a single HTML file, a directory (auto-packed with junk/hidden/executable filtering), or a zip; returns view/review/version links as JSON or text. Same `--deck` republish creates v2/v3… while links stay stable.
- `preapp feedback get` — pull reviewer comments as a Markdown **Agent Fix Brief** or JSON payload, with precise target locators (text quote/prefix/suffix + occurrence, image ref, anchors). Output ends with the two-stage gate: relay to the human before editing.
- `preapp login <token>` — one-time credential setup; validates against `GET /api/me` before writing `~/.preapp/config.json` (0600).
- `preapp skill install --harness <claude-code|codex|openclaw|hermes>` — installs the `preapp-publish` skill; Claude Code confirmed, Codex via skill + AGENTS snippet, OpenClaw/Hermes experimental.
- Skills, protocol docs (`docs/`), publishable examples (`examples/`), and an auditable mirror of the hosted `install.sh`.
