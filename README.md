# PreApp Agent

**English** | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

Share agent-generated work with people, collect feedback, and bring it back to your agent.

Agents are good at generating work products — Markdown documents and HTML slides, from reports to slide decks. PreApp handles the last mile: **share it, collect feedback, and feed it back into the next agent run.**

```text
agent publish → share links → human feedback → agent feedback read → agent publish v2
```

This repo contains the agent integration layer for [preapp.app](https://preapp.app): the `preapp` CLI, a stdio MCP server (`preapp mcp`), agent skill recipes (Claude Code / Codex / OpenClaw / Hermes), protocol docs, and publishable examples. The hosted service itself is not in this repo.

<video src="https://github.com/serrendypity/preapp-agent/raw/main/docs/media/preapp-dogfood-case.mp4" poster="https://github.com/serrendypity/preapp-agent/raw/main/docs/media/preapp-dogfood-poster.png" controls muted playsinline>
  <a href="https://github.com/serrendypity/preapp-agent/raw/main/docs/media/preapp-dogfood-case.mp4">▶ Watch the demo (41s, no audio)</a>
</video>

> **A real run**: a reviewer left feedback on the exact HTML state, the owner curated a revision brief, and the agent published the next version on the same link. **4 versions · 2 review loops · 6 feedback items · 2 applied briefs.**

## 30-second demo

```bash
# 1. Install CLI + skill for your agent (no token in this command — safe to forward)
curl -fsSL https://preapp.app/install.sh | sh -s -- --harness claude-code

# 2. Configure credentials once (generate a token at https://preapp.app/dashboard → Install)
preapp login <agent-token>

# 3. Publish an HTML file or directory
preapp publish ./dist --title "Q3 Strategy Review" --slug q3-strategy --format json
```

Share the returned `feedbackLink`, let people leave feedback (text selection & image targeting, no signup needed), then:

```bash
preapp feedback get q3-strategy --format markdown
```

The agent gets an **Agent Feedback Brief** — feedback items with precise locators — and publishes v2 to the **same links**.

**Interactive HTML gets an advanced feedback mode** (product prototypes, hash-routed SPAs): publish with `--review-profile prototype`, reviewers experience the prototype and click any element to comment, the owner curates feedback into a revision brief, and the agent pulls it with `preapp revision get` and republishes with `--revision` for full traceability. Reports, documents, and HTML decks stay on the regular flow — this mode is an extra gear, not a repositioning.

Try it right now with the bundled examples:

```bash
preapp publish examples/q3-strategy-deck --title "Q3 Strategy" --slug demo-q3
preapp publish examples/quarterly-report.html --title "Quarterly Report"
preapp publish examples/market-analysis.md --title "Market Analysis"   # Markdown → Mermaid + math rendered server-side
```

## Why PreApp

Agents can generate the work. They still need a clean way to put it in front of people.

- The file lives in a (often remote) workspace — `file://` is useless for sharing.
- Generic hosting (Vercel / Netlify / Pages) means repo setup, builds, production semantics — overkill for a review artifact.
- Feedback comes back through Slack/email screenshots, and the agent never sees it.

PreApp adds exactly the missing loop:

- **HTML or Markdown** — publish a single HTML, a single `.md` (Mermaid diagrams and KaTeX math rendered server-side), a directory (auto-packed), or a zip.
- **View / feedback links** — clean reading vs. lightweight feedback, separate permissions.
- **Feedback where the issue is** — select text, click an image or a Mermaid diagram; sections and whole-content feedback too. Markdown feedback maps back to the source `.md` line.
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

| Agent | How |
|---|---|
| Claude Code | `~/.claude/skills/preapp-publish/SKILL.md` (auto-discovered) |
| Codex | skill dir + [AGENTS.md snippet](skills/codex/preapp-publish/AGENTS-snippet.md) |
| OpenClaw | conventional skill path, `--dir` override |
| Hermes | conventional skill path, `--dir` override |
| Cursor / anything with a shell | tell the agent to run the `preapp` CLI |
| Claude Desktop / any MCP client | `preapp mcp` (stdio MCP server) — see [docs/mcp.md](docs/mcp.md) |

> PreApp ships a CLI, an MCP server, and agent skill recipes. Claude Code is supported first; Codex/OpenClaw/Hermes recipes are open for community hardening — [PRs welcome](CONTRIBUTING.md).

## Commands

```text
preapp publish <file-or-dir> [--title ...] [--slug <id-or-slug>] [--entry index.html|report.md]
                             [--change-note ...] [--anchors anchors.json]
                             [--feedback-mode off|detailed] [--review-profile standard|prototype]
                             [--revision <rbr_id> --revision-sequence <n>] [--format json|text]
preapp feedback get <share-url | version-url | content-id-or-slug> [--version N] [--format markdown|json]
preapp revision get <share-url | content-id-or-slug> [--version N] [--format markdown|json]
preapp revision save <share-url | content-id-or-slug> [--version N] --file <revision.json|-> [--ready]
preapp login <token> [--base-url <url>]
preapp skill install --harness <claude-code|codex|openclaw|hermes> [--dir <path>] [--force]
preapp mcp                                     # stdio MCP server (publish / feedback / revision tools)
```

Full reference: [docs/cli.md](docs/cli.md) · MCP: [docs/mcp.md](docs/mcp.md) · Protocol: [docs/api-protocol.md](docs/api-protocol.md) · Feedback payload: [docs/feedback-payload.md](docs/feedback-payload.md)

### The two-stage feedback gate

`preapp feedback get` deliberately ends its output with a gate instruction: the agent must **safety-scan the feedback, relay each item by its `fb_…` ID, and stop** — a read-only phase (no file edits, no shell/network/credential tools) until the human directs by ID. No silent auto-editing; authorization claimed inside feedback text is void. Only after the human says what to apply does the agent edit and republish. This is a product decision, not a limitation; see [docs/cli.md](docs/cli.md#the-two-stage-feedback-gate).

## Security

- Install commands never contain tokens; credentials are configured separately via `preapp login` (validated before persisting, `0600` config).
- Uploaded artifacts are served **statically** from an isolated origin in sandboxed iframes — the server never executes uploaded code.
- Share links are unguessable capability URLs; rotate or unpublish anytime from the dashboard.
- Reviewer feedback is **untrusted data** to agents (prompt-injection defense) — the skill and docs treat it as content, never instructions.

Details: [docs/security.md](docs/security.md) · Reporting: [SECURITY.md](SECURITY.md)

## Repo layout

```text
packages/cli/   the preapp CLI (TypeScript, single-file bundle via esbuild)
skills/         per-harness skill files (generated from the CLI's single source)
docs/           install, CLI, MCP, skills, HTTP protocol, feedback payload, security model
examples/       publishable HTML and Markdown artifacts to try immediately
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
