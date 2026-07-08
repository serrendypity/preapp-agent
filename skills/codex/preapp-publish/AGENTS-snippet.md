# Codex: AGENTS.md snippet

Codex's global skill discovery varies between versions. If the installed skill at `~/.codex/skills/preapp-publish/SKILL.md` is not picked up automatically, merge the skill into an `AGENTS.md` Codex *does* read — either your project root `AGENTS.md` or `~/.codex/AGENTS.md`.

## How

1. Install the CLI and skill (either path):

   ```bash
   curl -fsSL https://preapp.app/install.sh | sh -s -- --harness codex
   # or: npm i -g @preapp/cli && preapp skill install --harness codex
   ```

2. Append the skill body to your `AGENTS.md`:

   ```bash
   cat ~/.codex/skills/preapp-publish/SKILL.md >> AGENTS.md
   ```

   (Drop the YAML frontmatter block at the top if your AGENTS.md style doesn't use it.)

3. One-time credentials, if not done yet:

   ```bash
   preapp login <agent-token>
   ```

That's it — Codex can now run `preapp publish` / `preapp feedback get` per the skill's rules (including the two-stage feedback gate: relay comments to the human before editing).

If you've confirmed how a specific Codex version discovers skills, please [tell us](../../../.github/ISSUE_TEMPLATE/harness_support.yml) so we can harden this recipe.
