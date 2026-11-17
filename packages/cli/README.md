# PreApp CLI

Publish Agent-made HTML or Markdown for review, then bring versioned human feedback back into the Agent.

## Install

```bash
npm install --global @preapp/cli
```

Create an Agent Token from the [PreApp onboarding page](https://preapp.app/login?intent=onboarding&utm_source=npm&utm_campaign=cli-readme), then configure the CLI once:

```bash
preapp login <agent-token> --base-url https://preapp.app
```

Keep the token out of issues, screenshots, shared commands, and source control.

## MCP server

Start the stdio MCP server with:

```bash
preapp mcp
```

The server exposes four tools:

- `preapp_publish`
- `preapp_feedback_get`
- `preapp_revision_get`
- `preapp_revision_save`

MCP clients can provide `PREAPP_TOKEN` as a secret environment variable and set `PREAPP_URL=https://preapp.app`. The server also reads the credentials written by `preapp login`; tool arguments never accept a token.

## CLI

```bash
preapp publish <file-or-dir>
preapp feedback get <share-url-or-slug>
preapp revision get <share-url-or-slug>
preapp revision save <share-url-or-slug> --file <revision.json|->
preapp skill install --harness <claude-code|codex|openclaw|hermes>
```

Full documentation and source: [serrendypity/preapp-agent](https://github.com/serrendypity/preapp-agent)
