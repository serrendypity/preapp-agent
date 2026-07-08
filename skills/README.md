# Agent skills

Each directory holds the exact `SKILL.md` that `preapp skill install --harness <name>` writes for that harness. They are **generated from a single source** in the CLI (`packages/cli/src/skill.ts`) — do not edit the files here directly; change the source and regenerate (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

> The skill body is currently written in Chinese — it is authored *for coding agents*, and mainstream agents follow it regardless of language. An English variant is on the roadmap; PRs welcome.

## What the skill does

`preapp-publish` teaches an agent to:

1. publish the HTML it just generated (`preapp publish …`) and hand the view/review links to the human;
2. pull reviewer feedback (`preapp feedback get …`) and **relay it to the human before touching any file** — the two-stage gate;
3. apply only the comments the human approves, then republish to the same links as v2.

It also tells the agent how to get credentials set up the first time (`preapp login <token>`), and warns that reviewer comments are untrusted data.

## Install targets

| Harness | Target | Status |
|---|---|---|
| Claude Code | `~/.claude/skills/preapp-publish/SKILL.md` | ✅ auto-discovered, confirmed |
| Codex | `~/.codex/skills/preapp-publish/SKILL.md` | ✅ + [AGENTS.md snippet](codex/preapp-publish/AGENTS-snippet.md) fallback |
| OpenClaw | `~/.openclaw/skills/preapp-publish/SKILL.md` | 🧪 conventional path — [corrections welcome](../.github/ISSUE_TEMPLATE/harness_support.yml) |
| Hermes | `~/.hermes/skills/preapp-publish/SKILL.md` | 🧪 conventional path — corrections welcome |

Any other agent that can run shell commands: point it at `docs/cli.md`, or install to a custom location with `preapp skill install --harness claude-code --dir <path>`.
