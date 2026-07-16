# PreApp Agent

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | **Español**

Comparte el trabajo generado por tu agente, recoge feedback y devuélvelo al agente.

Los agents ya son buenos generando entregables: documentos Markdown y diapositivas HTML, de informes a presentaciones. PreApp cubre la última milla: **compártelo, recoge feedback y devuélvelo a la siguiente ejecución del agent.**

```text
agent publish → enlaces compartidos → feedback humano → agent lee el feedback → agent publica v2
```

Este repositorio contiene la capa de integración de agents de [preapp.app](https://preapp.app): la CLI `preapp`, skills por harness (Claude Code / Codex / OpenClaw / Hermes), documentación del protocolo y ejemplos listos para publicar. El servicio alojado no está en este repositorio.

<video src="https://github.com/serrendypity/preapp-agent/raw/main/docs/media/preapp-dogfood-case.mp4" poster="https://github.com/serrendypity/preapp-agent/raw/main/docs/media/preapp-dogfood-poster.png" controls muted playsinline>
  <a href="https://github.com/serrendypity/preapp-agent/raw/main/docs/media/preapp-dogfood-case.mp4">▶ Ver demo (41 s, sin audio)</a>
</video>

> **Una ejecución real**: un revisor dejó feedback sobre el estado exacto del HTML, el responsable lo convirtió en una lista de cambios y el agente publicó la siguiente versión en el mismo enlace. **4 versiones · 2 ciclos de revisión · 6 comentarios · 2 briefs aplicados.**

## Demo en 30 segundos

```bash
# 1. Instala la CLI + skill para tu agent (sin token en el comando — seguro de reenviar)
curl -fsSL https://preapp.app/install.sh | sh -s -- --harness claude-code

# 2. Configura credenciales una vez (genera un token en https://preapp.app/dashboard → Install)
preapp login <agent-token>

# 3. Publica un archivo o directorio HTML
preapp publish ./dist --title "Q3 Strategy Review" --slug q3-strategy --format json
```

Comparte el `feedbackLink` devuelto, deja que la gente dé feedback (selección de texto y clic en imágenes para ubicar con precisión, sin registro), y luego:

```bash
preapp feedback get q3-strategy --format markdown
```

El agent recibe un **Agent Feedback Brief** — una lista de feedback con localizadores precisos — y publica la v2 en **los mismos enlaces**.

Pruébalo ahora mismo con los ejemplos incluidos:

```bash
preapp publish examples/q3-strategy-deck --title "Q3 Strategy" --slug demo-q3
preapp publish examples/quarterly-report.html --title "Quarterly Report"
```

## Por qué PreApp

Los agents pueden generar el trabajo, pero ponerlo frente a una persona sigue siendo incómodo:

- El archivo vive en un workspace (a menudo remoto) — `file://` no sirve para compartir.
- El hosting genérico (Vercel / Netlify / Pages) implica repos, builds y semántica de despliegue de producción — demasiado para un artefacto de revisión.
- El feedback vuelve por Slack/email en capturas, y el agent nunca lo ve.

PreApp añade exactamente el eslabón que falta:

- **Assets estáticos incluidos** — publica un HTML único, un directorio (auto-empaquetado) o un zip.
- **Enlaces View / Feedback** — lectura limpia vs. feedback ligero, con permisos separados.
- **Feedback donde está el problema** — selecciona texto o haz clic en una imagen; también secciones y feedback sobre todo el contenido.
- **Versiones con enlaces estables** — cada publish es v1/v2/v3; el enlace compartido siempre muestra la última.
- **Payload de feedback para agents** — brief en Markdown o JSON, con localizadores exactos.
- **Visitas** — sabrás si lo que compartiste realmente se abrió.

*No* es una plataforma de despliegue de producción. Sin builds, sin ejecución de código en el servidor — el hosting es deliberadamente aburrido; el valor está en el ciclo de revisión.

## Instalación

**Recomendada (agents y humanos)** — una línea instala la CLI y el skill de tu harness, nunca contiene un token:

```bash
curl -fsSL https://preapp.app/install.sh | sh -s -- --harness <claude-code|codex|openclaw|hermes>
```

**npm**:

```bash
npm i -g @preapp/cli
preapp skill install --harness claude-code
```

Luego configura credenciales una vez (ver [docs/install.md](docs/install.md)):

```bash
preapp login <agent-token>   # valida contra el servidor antes de escribir ~/.preapp/config.json
```

## Agents compatibles

| Agent | Cómo |
|---|---|
| Claude Code | `~/.claude/skills/preapp-publish/SKILL.md` (autodescubierto) |
| Codex | directorio de skills + [snippet AGENTS.md](skills/codex/preapp-publish/AGENTS-snippet.md) |
| OpenClaw | ruta convencional, redefinible con `--dir` |
| Hermes | ruta convencional, redefinible con `--dir` |
| Cursor / cualquier agent con shell | indica al agent que ejecute la CLI `preapp` |
| Claude Desktop / cualquier cliente MCP | `preapp mcp` (servidor MCP por stdio) — ver [docs/mcp.md](docs/mcp.md) |

> PreApp ofrece una CLI, un servidor MCP y recetas de skills para agents. Claude Code es el primero en soportarse; las recetas de Codex/OpenClaw/Hermes están abiertas a mejoras de la comunidad — [PRs bienvenidos](CONTRIBUTING.md).

## Comandos

```text
preapp publish <file-or-dir> [--title ...] [--slug <id-or-slug>] [--entry index.html|report.md]
                             [--change-note ...] [--anchors anchors.json]
                             [--feedback-mode off|detailed] [--review-profile standard|prototype]
                             [--revision <rbr_id> --revision-sequence <n>] [--format json|text]
preapp feedback get <share-url | version-url | content-id-or-slug> [--version N] [--format markdown|json]
preapp revision get <share-url | content-id-or-slug> [--version N] [--format markdown|json]
preapp revision save <share-url | content-id-or-slug> [--version N] --file <revision.json|-> [--ready]
preapp login <token> [--base-url <url>]
preapp skill install --harness <claude-code|codex|openclaw|hermes> [--dir <path>] [--force]
preapp mcp                                     # servidor MCP por stdio (herramientas de publish / feedback / revision)
```

Referencia completa: [docs/cli.md](docs/cli.md) · MCP: [docs/mcp.md](docs/mcp.md) · Protocolo: [docs/api-protocol.md](docs/api-protocol.md) · Payload de feedback: [docs/feedback-payload.md](docs/feedback-payload.md)

### La puerta de feedback en dos etapas

La salida de `preapp feedback get` termina deliberadamente con una instrucción de puerta: el agent debe **transmitir el feedback a su humano y detenerse** — nada de auto-edición silenciosa. Solo cuando el humano indica qué aplicar, el agent edita y vuelve a publicar (el feedback puede ser una pregunta o contexto extra; no todo exige cambios). Es una decisión de producto, no una limitación; ver [docs/cli.md](docs/cli.md#the-two-stage-feedback-gate).

## Seguridad

- Los comandos de instalación nunca contienen tokens; las credenciales se configuran aparte con `preapp login` (validación antes de persistir, config `0600`).
- Los artefactos subidos se sirven **estáticamente** desde un origin aislado en iframes con sandbox — el servidor nunca ejecuta código subido.
- Los enlaces compartidos son capability URLs no adivinables; rota o despublica en cualquier momento desde el dashboard.
- El feedback de los revisores son **datos no confiables** para los agents (defensa contra prompt injection) — el skill y la documentación lo tratan como contenido, nunca como instrucciones.

Detalles: [docs/security.md](docs/security.md) · Reportes: [SECURITY.md](SECURITY.md)

## Estructura del repositorio

```text
packages/cli/   la CLI preapp (TypeScript, bundle de archivo único vía esbuild)
skills/         archivos de skill por harness (generados desde la fuente única de la CLI)
docs/           instalación, CLI, skills, protocolo HTTP, payload de feedback, modelo de seguridad
examples/       artefactos HTML listos para publicar
scripts/        espejo de install.sh (auditable) + smoke test
```

## Desarrollo

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @preapp/cli build   # → packages/cli/dist/preapp.js
```

## Licencia

[MIT](LICENSE)
