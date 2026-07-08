# CLI reference

`preapp` — publish HTML artifacts, hand out share links, read reviewer feedback. The CLI is agent-first: default output is machine-readable, errors go to stderr, and exit codes are stable.

```text
preapp publish <file-or-dir> [--title ...] [--deck <id-or-slug>] [--entry index.html]
                             [--change-note ...] [--anchors anchors.json]
                             [--feedback-mode off|detailed] [--format json|text]
preapp feedback get <deck-url | version-url | deck-id-or-slug> [--version N] [--format markdown|json]
preapp login <token> [--base-url <url>]
preapp skill install --harness <claude-code|codex|openclaw|hermes> [--dir <path>] [--force]
preapp --version
preapp --help
```

## Configuration

Credentials and the server address resolve in strict priority order:

1. Flags: `--token`, `--base-url`
2. Environment: `PREAPP_TOKEN`, `PREAPP_URL`
3. File: `~/.preapp/config.json` (written by `preapp login` and the install script)

Every command that talks to the server accepts `--token` / `--base-url` as one-off overrides. Trailing slashes on the base URL are trimmed. Recommended: the config file on workstations, environment variables in CI and containers.

## Exit codes

| Code | Meaning | Examples |
| --- | --- | --- |
| `0` | Success | |
| `1` | Server or network error | non-2xx HTTP response, unreachable host, token rejected during `login` |
| `2` | Usage or config error | unknown command, missing token/baseUrl, path not found, entry file missing, invalid `--format` value, config file is not valid JSON |

Exit code `2` means something is fixable locally (arguments or configuration); `1` means the request reached the network layer and failed.

## `preapp publish`

```sh
preapp publish ./dist \
  --title "Q3 Strategy Deck" \
  --deck q3-strategy \
  --entry index.html \
  --change-note "Tightened pricing section" \
  --anchors anchors.json \
  --format json
```

Publishes a single `.html`/`.htm` file, or a directory (packed into a zip client-side). Passing a single file with any other extension is a usage error — put assets in a directory instead. To upload a pre-built zip, call the [HTTP API](api-protocol.md) directly.

| Flag | Description |
| --- | --- |
| `--title <text>` | Deck title. Required when creating a new deck. |
| `--deck <id-or-slug>` | Publish a new version of an existing deck. Omit to create a new deck with a random slug. |
| `--entry <path>` | Entry file inside the artifact. Directory default: `index.html` (must exist after packing, or exit 2). Single-file default: the file itself. |
| `--description <text>` | Human-readable deck description. |
| `--change-note <text>` | Version note, shown alongside the version. |
| `--anchors <file.json>` | JSON array of review anchors, sent as `reviewAnchors` (see [api-protocol.md](api-protocol.md#review-anchors)). |
| `--feedback-mode <off\|detailed>` | Feedback mode for the review link. Default `detailed`. |
| `--format <json\|text>` | Output format. Default `json`. |
| `--token`, `--base-url` | One-off credential overrides. |

### Directory packing

Directories are zipped in memory with a client-side denylist. Skipped, never uploaded:

- `.git/` and `node_modules/`
- hidden files and directories (dotfiles — includes `.env`)
- known junk (`.DS_Store`, `Thumbs.db`)
- symlinks (never followed)
- executable and server-script extensions (`php`, `py`, `rb`, `pl`, `cgi`, `jsp`, `asp`, `sh`, `bat`, `ps1`, `exe`, `dll`, `so`, `jar`, and similar)

The server independently re-validates every upload with its own authoritative rules, so the denylist is a convenience, not the security boundary.

### Idempotency and retries

Each invocation generates a fresh UUID `Idempotency-Key`. On network failure or HTTP 503 the CLI automatically retries (up to 2 extra attempts, short backoff) **with the same key**, so one `publish` can never create duplicate versions. 4xx responses are not retried.

### Output

`--format json` (default) prints the full `201` response body to stdout — parse `viewLink`, `reviewLink`, `versionLink`, `feedbackCommand` from it. `--format text` prints a human summary:

```text
✓ published q3-strategy · PROOF v2
  view:    https://preapp.app/d/q3-strategy?token=view_xxx
  review:  https://preapp.app/d/q3-strategy/feedback?token=review_xxx
  version: https://preapp.app/d/q3-strategy/v/2?token=view_xxx
  feedback: preapp feedback get https://preapp.app/d/q3-strategy/v/2 --format markdown
  warnings: 1
    - external resource: https://cdn.example.com/font.css
```

Re-publishing with the same `--deck` creates a new version; the stable view/review links keep working and always show the latest version.

## `preapp feedback get`

```sh
preapp feedback get https://preapp.app/d/q3-strategy            # latest version
preapp feedback get https://preapp.app/d/q3-strategy/v/2        # that version
preapp feedback get q3-strategy --version 3 --format json       # bare slug or deck id
```

Fetches the structured feedback for one version. The target can be any deck link (view, review, or version permalink — the token query string is ignored) or a bare deck id/slug. An explicit `--version N` overrides the version found in a URL; with no version, `latest` is used.

| Flag | Description |
| --- | --- |
| `--version <N>` | Version number. Default: latest, or the version embedded in the URL. |
| `--format <markdown\|json>` | `markdown` (default) renders the Agent Fix Brief; `json` returns the structured payload. Any other value is a usage error. |
| `--token`, `--base-url` | One-off credential overrides. |

Maps to `GET /api/decks/{deck}/versions/{version|latest}/feedback?format=...` (see [api-protocol.md](api-protocol.md)). Payload details, including which fields are untrusted, are in [feedback-payload.md](feedback-payload.md).

### The two-stage feedback gate

This is intended behavior, not a quirk: every successful `feedback get` ends with a **workflow gate** — an instruction block addressed to the agent that just ran the command. It says, in short:

1. Restate the feedback to the human, item by item (numbered Q1, Q2, …), with each item's locator and original text.
2. Stop and hand control back to the human; ask which items to change and how.
3. Do not modify any files and do not republish until the human replies.

The only exception: the human already explicitly asked, in the same request, for feedback to be pulled *and* applied without review.

Stream placement is deliberate:

- `--format markdown` — the gate is appended to **stdout** after the brief (the brief is read by a model anyway).
- `--format json` — the gate goes to **stderr**, so stdout remains a single parseable JSON document.

If you script around the CLI, keep the gate visible to the agent rather than filtering it out; it is the last line of defense against an agent auto-applying unreviewed (and untrusted) feedback.

## `preapp login`

```sh
preapp login pa_live_xxxxxxxx [--base-url https://preapp.app]
```

Persists credentials for all later commands. The token comes from the positional argument, `--token`, or `PREAPP_TOKEN`. The base URL resolves from `--base-url` (alias `--url`), then `PREAPP_URL`, then an existing `baseUrl` in the config file (the install script writes one).

Before writing anything, `login` validates the token against `GET /api/me`:

- `401` — token invalid or revoked: exit 1, **nothing is written**.
- other failures / unreachable host: exit 1, nothing is written.
- success: writes `~/.preapp/config.json` (`{"token": ..., "baseUrl": ...}`, mode `0600`) and prints the token name.

Missing token or base URL is a usage error (exit 2) with a hint about where to generate a token.

## `preapp skill install`

```sh
preapp skill install --harness claude-code [--dir <path>] [--force]
```

Writes the `preapp-publish` skill file for an agent harness. Purely local — no network, no credentials needed.

| Flag | Description |
| --- | --- |
| `--harness <id>` | One of `claude-code`, `codex`, `openclaw`, `hermes`. Required. |
| `--dir <path>` | Override the destination directory (writes `<dir>/SKILL.md`). |
| `--force` | Overwrite an existing skill file. Without it, an existing file is a usage error (exit 2). |

Default destinations and per-harness caveats are documented in [skills.md](skills.md).

## `preapp --version`

Prints the CLI name and version to stdout, e.g. `preapp 0.1.0`. `preapp --help` (or no arguments) prints usage and exits 0.
