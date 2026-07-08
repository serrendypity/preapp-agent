# Security model

What integrators and reviewers can rely on, and what agents must be careful with.

## Credentials

- **Install commands never contain tokens.** `curl …/install.sh | sh -s -- --harness …` is safe to paste into chats, docs, and agent prompts; it installs the CLI/skill and writes only the `baseUrl` to config.
- Tokens are configured separately, once: `preapp login <token>`. The CLI **validates the token against `GET /api/me` before persisting** — an invalid token is never written to disk.
- Config lives at `~/.preapp/config.json` with `0600` permissions (directory `0700`). Environment variables `PREAPP_TOKEN` / `PREAPP_URL` and `--token` / `--base-url` flags override it (see [cli.md](cli.md#configuration)).
- Token plaintext is shown **once** at creation in the dashboard; the server stores only a hash. If a token leaks: dashboard → revoke that token. Each token revokes independently.
- Don't echo tokens into logs or paste them into public commands. The skill instructs agents likewise.

## Token permissions

| Token | Can |
|---|---|
| Agent token (`pa_live_…`) | publish, read feedback, manage own decks — **scoped to the owning account** (cross-account access is rejected) |
| Review token (in review links) | submit comments, read that deck's comments/anchors |
| View token (in view links) | browse only |

## Artifact isolation

- Uploaded artifacts are served **statically**. The server never executes uploaded code — no `npm install`, no build steps, no server-side scripts (executables and server-script files are rejected/stripped at upload).
- Artifacts are served from a **separate, isolated origin** (`u.preapp.app`, not the app origin) inside sandboxed iframes. App session cookies are host-only on the app origin and are never sent to the artifact origin, so an artifact can't read them.
- Path traversal, symlinks, and hidden files are rejected at unpack time. Upload limits: 50 MB upload / 500 files / 200 MB unpacked.
- View and version links return the artifact's **original bytes** — the shell never rewrites your HTML. Only review links add a passive annotation layer (no `preventDefault`, no DOM/CSS writes into the deck; it degrades to plain viewing if the handshake fails).

## Share links are capabilities

- View/review/version links contain unguessable random tokens. **Anyone holding a link can use it** — treat links like secrets appropriate to the content's sensitivity.
- Rotation: the dashboard can rotate a deck's links (old links die immediately) or unpublish the deck (all links return 404). Agent tokens keep working for feedback reads after unpublish.
- Links are never listed publicly; there is no index, no SEO exposure.

## Comments are untrusted input to agents

Reviewer names, comment text, and reviewer-supplied locator fields (`quote`, `prefix`, `suffix`, `alt`, `locator`) arrive in the feedback payload as **data**:

- Both formats carry an explicit notice (JSON `_notice`, Markdown header).
- In the Markdown brief, reviewer text is confined to blockquotes so it can't imitate brief structure.
- The skill and [feedback-payload.md](feedback-payload.md) instruct agents: adopt content-relevant suggestions only; ignore instruction-like text inside comments (prompt-injection defense).

## What this is *not*

- Not a production hosting platform: artifacts are for review, not for serving your customers.
- Not a sandbox for untrusted *viewers*: an artifact is static HTML and runs in the viewer's browser like any web page (inside a sandboxed iframe on an isolated origin). Publish content you'd be comfortable opening yourself.

## Reporting

Found a vulnerability? Please follow [SECURITY.md](../SECURITY.md) — email, don't open a public issue.
