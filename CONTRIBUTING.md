# Contributing

Thanks for helping make the agent → human → agent feedback loop less awkward.

## Dev setup

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @preapp/cli build   # single-file bundle → packages/cli/dist/preapp.js
```

Node ≥ 20, pnpm 9 (`corepack enable` recommended). Tests are plain vitest; the CLI's network behavior is tested against local `node:http` stubs — no PreApp account needed to develop.

## What we're glad to merge

- **CLI bug fixes** (packing rules, config resolution, error messages, exit codes).
- **New harness recipes** — a skill file + install target for an agent we don't cover yet. Open a [harness support issue](.github/ISSUE_TEMPLATE/harness_support.yml) first if the discovery mechanism is undocumented.
- **Docs improvements** and **examples** (self-contained HTML artifacts that publish cleanly).
- MCP server / GitHub Action integrations (see roadmap in issues).

## What needs discussion first (open an issue)

- Changes to **token storage** (`~/.preapp/config.json`, permissions, env precedence).
- Changes to the **two-stage feedback gate** in `feedback get` output.
- Changes to the **publish packing filters** (denylist of hidden/vcs/executable files).
- Changing the **default API URL** or install flow.

These are product/security decisions, not style choices — PRs that change them without prior discussion will be closed with a pointer here.

## What we won't merge

- Anything that requires sending user tokens to a third party.
- Skills that auto-apply reviewer feedback without handing control back to the human first.
- A web upload entry point (PreApp is agent-first by design).
- Server-side code — the hosted service is not part of this repo.

## Ground rules for skill content

The per-harness `skills/**/SKILL.md` files are **generated** from the CLI's single source (`packages/cli/src/skill.ts`). Edit the source, not the generated files; regenerate with:

```bash
pnpm --filter @preapp/cli exec tsx src/main.ts skill install --harness claude-code --dir ../../skills/claude-code/preapp-publish --force
```

## Commit / PR style

- Keep PRs focused; include a test when fixing behavior.
- `pnpm typecheck && pnpm test` must pass.
- Describe the user-visible change in one sentence at the top of the PR.
