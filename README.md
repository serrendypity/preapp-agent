# PreApp Agent

**English** | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

Publish AI-generated HTML artifacts, collect human feedback, and pull it back into your coding agent.

Agents are good at generating HTML — decks, reports, prototypes. PreApp handles the last mile: **share it, review it, and feed comments back into the next agent run.**

```text
agent publish → share links → human comments → agent feedback read → agent publish v2
```

This repo contains the agent integration layer for [preapp.app](https://preapp.app): the `preapp` CLI, agent skill recipes (Claude Code / Codex / OpenClaw / Hermes), protocol docs, and publishable examples. The hosted service itself is not in this repo.

## 30-second demo

```bash
# 1. Install CLI + skill for your agent (no token in this command — safe to forward)
curl -fsSL https://preapp.app/install.sh | sh -s -- --harness claude-code

# 2. Configure credentials once (generate a token at https://preapp.app/dashboard → Install)
preapp login <agent-token>

# 3. Publish an HTML file or directory
preapp publish ./dist --title "Q3 Strategy Deck" --deck q3-strategy --format json
```

Share the returned `reviewLink`, let people comment (text selection & image annotations, no signup needed), then:

```bash
preapp feedback get q3-strategy --format markdown
```

The agent gets an **Agent Fix Brief** — numbered comments with precise locators — and publishes v2 to the **same links**.

Try it right now with the bundled examples:

```bash
preapp publish examples/q3-strategy-deck --title "Q3 Strategy" --deck demo-q3
preapp publish examples/quarterly-report.html --title "Quarterly Report"
```

## Why PreApp

Agents can generate HTML. They still need a clean way to put it in front of people.

- The file lives in a (often remote) workspace — `file://` is useless for sharing.
- Generic hosting (Vercel / Netlify / Pages) means repo setup, builds, production semantics — overkill for a review artifact.
- Feedback comes back through Slack/email screenshots, and the agent never sees it.

PreApp adds exactly the missing loop:

- **Static assets included** — publish a single HTML, a directory (auto-packed), or a zip.
- **View / review links** — clean reading vs. lightweight markup, separate permissions.
- **Comments where the issue is** — select text or click an image; anchors and whole-deck comments too.
- **Versions with stable links** — every publish is v1/v2/v3; the shared link always shows latest.
- **Feedback payload for agents** — Markdown brief or JSON, with exact target locators.
- **Visits** — know whether the share actually landed.

It is *not* a production deploy platform. No builds, no server code execution — deliberately boring hosting, all the value in the review loop.

## Install

**Recommended (agents & humans)** — one line, installs the CLI and the skill for your harness, never contains a token:

```bash
curl -fsSL https://preapp.app/install.sh | sh -s -- --harness <claude-code|codex|openclaw|hermes>
```

**npm**:

```bash
npm i -g @preapp/cli
preapp skill install --harness claude-code
```

Then configure credentials once (see [docs/install.md](docs/install.md)):

```bash
preapp login <agent-token>   # validates against the server before writing ~/.preapp/config.json
```

## Supported agents

| Agent | Status | How |
|---|---|---|
| Claude Code | ✅ Supported | `~/.claude/skills/preapp-publish/SKILL.md` (auto-discovered) |
| Codex | ✅ Supported (beta) | skill dir + [AGENTS.md snippet](skills/codex/preapp-publish/AGENTS-snippet.md) |
| OpenClaw | 🧪 Experimental | conventional skill path, `--dir` override |
| Hermes | 🧪 Experimental | conventional skill path, `--dir` override |
| Cursor / anything with a shell | 📄 Recipe | tell the agent to run the `preapp` CLI |
| CI / GitHub Actions | 🗺 Planned | publish build artifacts for review |

> PreApp ships a CLI and agent skill recipes. Claude Code is supported first; Codex/OpenClaw/Hermes recipes are open for community hardening — [PRs welcome](CONTRIBUTING.md).

## Commands

```text
preapp publish <file-or-dir> [--title ...] [--deck <id-or-slug>] [--entry index.html]
                             [--change-note ...] [--anchors anchors.json]
                             [--feedback-mode off|detailed] [--format json|text]
preapp feedback get <deck-url | version-url | deck-id-or-slug> [--version N] [--format markdown|json]
preapp login <token> [--base-url <url>]
preapp skill install --harness <claude-code|codex|openclaw|hermes> [--dir <path>] [--force]
```

Full reference: [docs/cli.md](docs/cli.md) · Protocol: [docs/api-protocol.md](docs/api-protocol.md) · Feedback payload: [docs/feedback-payload.md](docs/feedback-payload.md)

### The two-stage feedback gate

`preapp feedback get` deliberately ends its output with a gate instruction: the agent must **relay the comments to its human and stop** — no silent auto-editing. Only after the human says which comments to apply does the agent edit and republish. This is a product decision, not a limitation; see [docs/cli.md](docs/cli.md#two-stage-feedback-gate).

## Security

- Install commands never contain tokens; credentials are configured separately via `preapp login` (validated before persisting, `0600` config).
- Uploaded artifacts are served **statically** from an isolated origin in sandboxed iframes — the server never executes uploaded code.
- Share links are unguessable capability URLs; rotate or unpublish anytime from the dashboard.
- Reviewer comments are **untrusted data** to agents (prompt-injection defense) — the skill and docs treat them as content, never instructions.

Details: [docs/security.md](docs/security.md) · Reporting: [SECURITY.md](SECURITY.md)

## Repo layout

```text
packages/cli/   the preapp CLI (TypeScript, single-file bundle via esbuild)
skills/         per-harness skill files (generated from the CLI's single source)
docs/           install, CLI, skills, HTTP protocol, feedback payload, security model
examples/       publishable HTML artifacts to try immediately
scripts/        install.sh mirror (audit) + smoke test
```

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @preapp/cli build   # → packages/cli/dist/preapp.js
```

## License

[MIT](LICENSE)
