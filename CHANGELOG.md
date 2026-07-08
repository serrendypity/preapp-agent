# Changelog

## 0.1.0 — 2026-07-08

First public release of the PreApp agent integration layer.

- `preapp publish` — publish a single HTML file, a directory (auto-packed with junk/hidden/executable filtering), or a zip; returns view/review/version links as JSON or text. Same `--deck` republish creates v2/v3… while links stay stable.
- `preapp feedback get` — pull reviewer comments as a Markdown **Agent Fix Brief** or JSON payload, with precise target locators (text quote/prefix/suffix + occurrence, image ref, anchors). Output ends with the two-stage gate: relay to the human before editing.
- `preapp login <token>` — one-time credential setup; validates against `GET /api/me` before writing `~/.preapp/config.json` (0600).
- `preapp skill install --harness <claude-code|codex|openclaw|hermes>` — installs the `preapp-publish` skill; Claude Code confirmed, Codex via skill + AGENTS snippet, OpenClaw/Hermes experimental.
- Skills, protocol docs (`docs/`), publishable examples (`examples/`), and an auditable mirror of the hosted `install.sh`.
