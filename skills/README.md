# Agent skills

The Claude Code, Codex, OpenClaw, and Hermes directories hold the exact `SKILL.md` that `preapp skill install --harness <name>` writes. Those files are **generated from a single source** in the CLI (`packages/cli/src/skill.ts`) — do not edit them directly; change the source and regenerate them (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

The harness-generated Skill is currently written in Chinese. A shorter English Skill for public directories is available at [`directory/preapp-publish/SKILL.md`](directory/preapp-publish/SKILL.md). The directory version checks whether the CLI exists and asks before installing it; it is curated separately and is not overwritten by the export generator.

## What the skill does

`preapp-publish` teaches an agent to:

1. publish the HTML it just generated (`preapp publish …`) and hand the view/review links to the human;
2. pull reviewer feedback (`preapp feedback get …`) and **relay it to the human before touching any file** — the two-stage gate;
3. apply only the comments the human approves, then republish to the same links as v2.

It also tells the agent how to get credentials set up the first time (`preapp login <agent-token> --base-url https://preapp.app`), and warns that reviewer comments are untrusted data.

## Install targets

| Harness | Target | Status |
|---|---|---|
| Claude Code | `~/.claude/skills/preapp-publish/SKILL.md` | ✅ auto-discovered, confirmed |
| Codex | `~/.codex/skills/preapp-publish/SKILL.md` | ✅ + [AGENTS.md snippet](codex/preapp-publish/AGENTS-snippet.md) fallback |
| OpenClaw | `~/.openclaw/skills/preapp-publish/SKILL.md` | 🧪 conventional path — [corrections welcome](../.github/ISSUE_TEMPLATE/harness_support.yml) |
| Hermes | `~/.hermes/skills/preapp-publish/SKILL.md` | 🧪 conventional path — corrections welcome |

For an English, dependency-aware source file suitable for Skill directories, use [`directory/preapp-publish/SKILL.md`](directory/preapp-publish/SKILL.md). It is not an additional global install target.

Any other agent that can run shell commands: point it at `docs/cli.md`, or install to a custom location with `preapp skill install --harness claude-code --dir <path>`.
