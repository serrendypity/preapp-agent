# Changelog

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
