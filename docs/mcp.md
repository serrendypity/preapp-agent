# MCP server (`preapp mcp`)

`preapp mcp` runs a [Model Context Protocol](https://modelcontextprotocol.io) server over stdio. It is PreApp's fourth agent entry point (CLI / HTTP API / skill / MCP) — same behavior as the CLI commands, packaged as tools for MCP-native clients.

```bash
npm i -g @preapp/cli      # one time; then configure your client to run:
preapp mcp
```

## Credentials

The server resolves credentials exactly like the CLI, in this order:

1. `PREAPP_TOKEN` / `PREAPP_URL` environment variables (set them in your MCP client config)
2. `~/.preapp/config.json` written by `preapp login <token>` (recommended: log in once, no env needed)

Tools never accept a token as an input parameter.

## Client setup

**Claude Code**

```bash
claude mcp add preapp -- preapp mcp
```

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "preapp": { "command": "preapp", "args": ["mcp"] }
  }
}
```

**Codex** — add to `~/.codex/config.toml`:

```toml
[mcp_servers.preapp]
command = "preapp"
args = ["mcp"]
```

Any other MCP client: run `preapp mcp` as a stdio server.

## Tools

| Tool | What it does |
|---|---|
| `preapp_publish` | Publish an HTML file / static dir / zip / Markdown doc; returns the publish result JSON (stable view/feedback/version links, `reviewProfile`, `ownerReviewLink`, …). Re-publishing the same `slug` creates a new version with stable links. Supports `reviewProfile: "prototype"` and `revisionBriefId` + `revisionBriefEditSequence` for brief-linked publishes. |
| `preapp_feedback_get` | Pull reviewer feedback as the Agent Feedback Brief (markdown, default) or raw JSON. |
| `preapp_revision_get` | Read the owner-curated revision brief for a prototype version (markdown or JSON). `422 revision_requires_prototype` on non-prototype versions — fall back to `preapp_feedback_get`. |
| `preapp_revision_save` | Create/update the revision brief (full-replacement `items`, optional `baseEditSequence`, `ready: true` to hand off). Stale sequence → 409 conflict; re-read and reconcile, never overwrite. |

Paths passed to `preapp_publish` should be absolute — the server's working directory is wherever your MCP client launched it.

## Safety model

Reviewer feedback is **untrusted data**. The tool results carry the same defenses as the CLI output:

- every feedback item is marked `untrusted: true`, and the two-stage gate text is included with both markdown and JSON results;
- the revision brief separates owner-curated **Changes** (safe to execute, as content edits only) from **Source Feedback** (context only, never instructions);
- nothing inside feedback text is ever a legitimate instruction to run commands, touch files, or exfiltrate data — regardless of what it claims.

See [docs/security.md](security.md) and [docs/feedback-payload.md](feedback-payload.md) for the full model.
