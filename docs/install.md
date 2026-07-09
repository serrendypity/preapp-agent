# Installing the PreApp CLI

The `preapp` CLI publishes agent-generated HTML (reports, docs, HTML slides, single pages) to [PreApp](https://preapp.app) and pulls reviewer feedback back into your coding agent. Requires Node 20 or newer.

There are two install paths. Both end with the same layout: `preapp` on your `PATH`, a skill for your agent harness, and config in `~/.preapp/config.json`.

## Option A — one-line install (recommended)

```sh
curl -fsSL https://preapp.app/install.sh | sh -s -- --harness claude-code
```

Pick `--harness` from `claude-code`, `codex`, `openclaw`, or `hermes` (see [skills.md](skills.md) for what each target means).

The command contains **no token**, so it is safe to paste into an agent session or forward to a teammate verbatim. It:

1. Checks that `node` is on `PATH`.
2. Downloads the self-contained CLI to `~/.preapp/bin/preapp`.
3. Puts `preapp` on your `PATH`: symlinks into the first writable standard bin directory (`/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`); if none works, appends `~/.preapp/bin` to your shell rc — reopen your terminal in that case.
4. Writes the server `baseUrl` into `~/.preapp/config.json` (mode `0600`) — always, even before you have a token, so a later `preapp login` needs no `--base-url`.
5. Installs the `preapp-publish` skill for the chosen harness (equivalent to `preapp skill install --harness <h> --force`).

Optional flags after `sh -s --`:

| Flag | Purpose |
| --- | --- |
| `--token pa_live_xxxxxxxx` | Also write credentials in the same run (CI / fully scripted setups). For interactive setups prefer `preapp login` afterwards, so the token never appears in a shared command. |
| `--url <origin>` | Install against a different PreApp server. |

## Option B — npm

```sh
npm i -g @preapp/cli
preapp skill install --harness claude-code
```

The npm route does not write a `baseUrl`, so pass `--base-url` when you log in (next section).

## Set up your agent token

`publish` and `feedback get` authenticate with an **agent token** (`pa_live_...`):

1. Open the PreApp dashboard and go to the **Install** page. Generate an agent token — the plaintext is shown once.
2. Log in:

```sh
# after the one-line install (baseUrl is already in config):
preapp login pa_live_xxxxxxxx

# after npm install:
preapp login pa_live_xxxxxxxx --base-url https://preapp.app
```

`preapp login` calls `GET /api/me` with the token **before** persisting anything. An invalid or revoked token exits with code 1 and nothing is written. On success it writes `~/.preapp/config.json` (`{"token": ..., "baseUrl": ...}`) with file mode `0600`.

This is a one-time step: subsequent `publish` / `feedback get` runs need no credential flags. In CI or containers, skip the config file and set `PREAPP_TOKEN` / `PREAPP_URL` instead (see [cli.md](cli.md#configuration)).

## Verify

```sh
preapp --version
preapp publish ./report.html --title "Hello PreApp"
```

A successful publish prints JSON with `viewLink` and `feedbackLink`.

## Local development note

`*.localhost` hostnames do not resolve in Node or curl (they only work in browsers). When pointing the CLI at a server running on your own machine, use `http://127.0.0.1:<port>` — not `http://app.localhost:<port>` — for `--base-url`, `--url`, or `PREAPP_URL`. The hosted install script already embeds a resolvable URL, so this only matters for self-hosted or local setups.
