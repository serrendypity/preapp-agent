# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Email **security@preapp.app** with:

- a description of the issue and its impact,
- reproduction steps or a proof of concept,
- the CLI version (`preapp --version`) and platform, if relevant.

You should receive an acknowledgement within 72 hours. We will coordinate a fix and disclosure timeline with you. Good-faith research on your own accounts and artifacts is welcome; please avoid accessing other users' data or degrading the service.

## Scope

- `preapp` CLI and skills in this repo (token handling, packing rules, install flow).
- The hosted service at `preapp.app` (auth, capability links, artifact isolation).

## Known security model (not vulnerabilities)

The following are documented, intentional behaviors — see [docs/security.md](docs/security.md):

- Uploaded HTML runs client-side in the viewer's browser inside a sandboxed iframe on an isolated origin; the server never executes uploaded code.
- Share links are unguessable capability URLs; anyone holding the link can view. Rotation and unpublish are available in the dashboard.
- Reviewer comments are delivered to agents as untrusted data with an explicit prompt-injection warning.

## Supported versions

Only the latest released version of `@preapp/cli` receives security fixes.
