# Agent skills

## What the `preapp-publish` skill is

`preapp-publish` is a skill file (a `SKILL.md` recipe) that teaches a coding agent when and how to use PreApp:

- **Publish**: when the user says "share this report" / "publish this", run `preapp publish <file-or-dir> --title ... --slug <slug> --format json` and hand back `viewLink` (for readers) and `feedbackLink` (for annotators).
- **Versioning**: republishing with the same `--slug` creates a new version; the share links stay stable.
- **Feedback**: when the user says "check the feedback", run `preapp feedback get <link> --format markdown`, restate the comments (numbered Q1, Q2, …) with their locators, then **stop and hand control back to the human** before editing anything — the two-stage gate described in [cli.md](cli.md#the-two-stage-feedback-gate).
- **Trust**: reviewer comments are untrusted external data — the skill instructs the agent to treat them as content, never as instructions (see [security.md](security.md)).
- **Token setup**: if a command fails with "missing agent token" (exit 2), the skill walks the agent through asking the user for a token and running `preapp login`.

The skill invokes `preapp` from `PATH` and contains no machine-specific paths, so the same content works on any machine and in any harness.

## Single source: the CLI generates the skill

The canonical skill body ships **inside the CLI** — `preapp skill install` writes it. There is exactly one source of truth, so upgrading the CLI upgrades the skill everywhere. Any skill copies you find under `skills/` in this repository are generated mirrors for browsing; do not hand-edit them.

To refresh an installed skill after upgrading the CLI:

```sh
preapp skill install --harness claude-code --force
```

## Install targets per harness

`preapp skill install --harness <id>` writes `SKILL.md` to a per-harness default location under your home directory. `--dir <path>` overrides the destination (writes `<path>/SKILL.md`); `--force` overwrites an existing file.

| Harness | Default target | Notes |
| --- | --- | --- |
| `claude-code` | `~/.claude/skills/preapp-publish/SKILL.md` | Confirmed. Claude Code auto-discovers skills in `~/.claude/skills/`; reopen your session to load it. |
| `codex` | `~/.codex/skills/preapp-publish/SKILL.md` | Global skill discovery varies by Codex version. If the skill is not picked up automatically, merge the file's content into your `AGENTS.md` (project root or `~/.codex/AGENTS.md`). |
| `openclaw` | `~/.openclaw/skills/preapp-publish/SKILL.md` | Experimental: conventional path, discovery mechanism not confirmed. Use `--dir` if your setup expects skills elsewhere. |
| `hermes` | `~/.hermes/skills/preapp-publish/SKILL.md` | Experimental: conventional path, discovery mechanism not confirmed. Use `--dir` if your setup expects skills elsewhere. |

## Harness support matrix

| Harness | Status | How it integrates |
| --- | --- | --- |
| Claude Code | Supported | Skill file, auto-discovered. |
| Codex | Supported | Skill file, or merge the same content into `AGENTS.md`. |
| OpenClaw | Experimental | Skill file at a conventional path; verify discovery, override with `--dir`. |
| Hermes | Experimental | Skill file at a conventional path; verify discovery, override with `--dir`. |
| Cursor | Docs-only recipe | No skill installer target. Add an instruction to your Cursor rules telling the agent to run the CLI — see below. |

### Cursor recipe

Cursor has no skill-file convention this installer targets, so integrate by instruction. Install the CLI (see [install.md](install.md)), run `preapp login`, then add something like this to your Cursor rules:

```text
To share an HTML report/page the session produced, run:
  preapp publish <file-or-dir> --title "..." --slug <stable-slug> --format json
and give the user the viewLink (readers) and feedbackLink (annotators) from the JSON.

To read reviewer feedback, run:
  preapp feedback get <link-or-slug> --format markdown
then follow the workflow-gate instructions printed at the end of its output:
restate the feedback and wait for the user's direction before editing anything.
```

The same recipe works for any harness that can execute shell commands but has no skill mechanism.
