# PreApp Agent

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | **한국어** | [Español](README.es.md)

agent가 만든 결과물을 사람들과 공유하고, 피드백을 모아 다시 agent에게 전달하세요.

Agent는 이제 결과물을 잘 만듭니다 — 리포트, 문서, HTML 슬라이드, 웹 페이지. PreApp은 마지막 구간을 책임집니다: **공유하고, 피드백을 모으고, 다음 agent 실행에 넘기기.**

```text
agent publish → 공유 링크 → 사람이 피드백 → agent가 피드백 읽기 → agent가 v2 publish
```

이 저장소는 [preapp.app](https://preapp.app)의 agent 통합 레이어입니다: `preapp` CLI, harness별 agent skill(Claude Code / Codex / OpenClaw / Hermes), 프로토콜 문서, 바로 게시할 수 있는 예제. 호스팅 서비스 자체는 이 저장소에 없습니다.

## 30초 데모

```bash
# 1. CLI + skill 설치 (이 명령에는 token이 없습니다 — 안전하게 전달 가능)
curl -fsSL https://preapp.app/install.sh | sh -s -- --harness claude-code

# 2. 자격 증명 1회 설정 (https://preapp.app/dashboard → Install에서 token 생성)
preapp login <agent-token>

# 3. HTML 파일 또는 디렉터리 게시
preapp publish ./dist --title "Q3 Strategy Review" --slug q3-strategy --format json
```

반환된 `feedbackLink`를 공유하면 누구나 가입 없이 피드백을 남길 수 있습니다(텍스트 선택·이미지 클릭으로 정확한 위치 지정). 그다음:

```bash
preapp feedback get q3-strategy --format markdown
```

Agent는 **Agent Feedback Brief** — 정확한 위치 지정자가 붙은 피드백 목록 — 를 받아 수정하고 v2를 게시합니다. **링크는 그대로**입니다.

동봉된 예제로 바로 시도해 보세요:

```bash
preapp publish examples/q3-strategy-deck --title "Q3 Strategy" --slug demo-q3
preapp publish examples/quarterly-report.html --title "Quarterly Report"
```

## 왜 PreApp인가

Agent는 결과물을 만들 수 있지만, 그것을 사람 앞에 놓는 일은 여전히 번거롭습니다:

- 파일은 (대개 원격) workspace 안에 있습니다 — `file://`로는 공유할 수 없습니다.
- 범용 호스팅(Vercel / Netlify / Pages)은 저장소 설정, 빌드, 프로덕션 배포 의미론이 따라옵니다 — 리뷰용 산출물에는 과합니다.
- 피드백은 Slack/이메일 스크린샷으로 돌아오고, agent는 결코 보지 못합니다.

PreApp은 빠진 고리만 더합니다:

- **정적 자산 포함** — 단일 HTML, 디렉터리(자동 패킹), zip을 그대로 게시.
- **View / Feedback 이중 링크** — 깔끔한 열람과 가벼운 피드백을 분리, 권한도 별도.
- **문제 지점에 피드백** — 텍스트 선택 또는 이미지 클릭; 섹션·콘텐츠 전체 피드백도 지원.
- **버전 + 안정 링크** — 게시할 때마다 v1/v2/v3; 공유한 링크는 항상 최신을 가리킴.
- **agent용 피드백 페이로드** — Markdown brief 또는 JSON, 정확한 위치 지정자 포함.
- **방문 기록** — 공유가 실제로 열렸는지 확인.

이것은 프로덕션 배포 플랫폼이 *아닙니다*. 빌드도, 서버 코드 실행도 없습니다 — 호스팅은 일부러 단순하게, 가치는 리뷰 루프에.

## 설치

**권장 (agent와 사람 공용)** — 한 줄로 CLI와 harness용 skill 설치, token은 절대 포함되지 않습니다:

```bash
curl -fsSL https://preapp.app/install.sh | sh -s -- --harness <claude-code|codex|openclaw|hermes>
```

**npm**:

```bash
npm i -g @preapp/cli
preapp skill install --harness claude-code
```

그다음 자격 증명을 1회 설정합니다([docs/install.md](docs/install.md) 참고):

```bash
preapp login <agent-token>   # ~/.preapp/config.json에 쓰기 전에 서버로 검증
```

## 지원 agent

| Agent | 방식 |
|---|---|
| Claude Code | `~/.claude/skills/preapp-publish/SKILL.md` (자동 발견) |
| Codex | skill 디렉터리 + [AGENTS.md 스니펫](skills/codex/preapp-publish/AGENTS-snippet.md) |
| OpenClaw | 관례 경로, `--dir`로 재정의 가능 |
| Hermes | 관례 경로, `--dir`로 재정의 가능 |
| Cursor / shell 실행 가능한 agent | agent가 `preapp` CLI를 직접 실행 |

> PreApp은 CLI와 agent skill 레시피를 제공합니다. Claude Code를 가장 먼저 지원하며, Codex/OpenClaw/Hermes 레시피는 커뮤니티의 개선을 환영합니다 — [PR 환영](CONTRIBUTING.md).

## 명령어

```text
preapp publish <file-or-dir> [--title ...] [--slug <id-or-slug>] [--entry index.html]
                             [--change-note ...] [--anchors anchors.json]
                             [--feedback-mode off|detailed] [--format json|text]
preapp feedback get <share-url | version-url | content-id-or-slug> [--version N] [--format markdown|json]
preapp login <token> [--base-url <url>]
preapp skill install --harness <claude-code|codex|openclaw|hermes> [--dir <path>] [--force]
```

전체 레퍼런스: [docs/cli.md](docs/cli.md) · 프로토콜: [docs/api-protocol.md](docs/api-protocol.md) · 피드백 페이로드: [docs/feedback-payload.md](docs/feedback-payload.md)

### 2단계 피드백 게이트

`preapp feedback get`의 출력은 의도적으로 게이트 지시로 끝납니다: agent는 **피드백을 사람에게 전달하고 멈춰야 합니다** — 조용한 자동 수정 금지. 사람이 무엇을 반영할지 정한 뒤에야 agent가 수정하고 다시 게시합니다(피드백은 질문이나 보충일 수도 있어 반드시 고쳐야 하는 것은 아닙니다). 이는 제한이 아니라 제품 결정입니다; [docs/cli.md](docs/cli.md#the-two-stage-feedback-gate) 참고.

## 보안

- 설치 명령에는 token이 절대 포함되지 않습니다; 자격 증명은 `preapp login`으로 별도 설정(저장 전 검증, 설정 파일 `0600`).
- 업로드된 산출물은 격리 origin에서 sandbox iframe으로 **정적으로만** 제공됩니다 — 서버는 업로드된 코드를 절대 실행하지 않습니다.
- 공유 링크는 추측 불가능한 capability URL; 대시보드에서 언제든 회전·비공개 가능.
- 리뷰어 피드백은 agent에게 **신뢰할 수 없는 데이터**입니다(prompt injection 방어) — skill과 문서 모두 내용으로만 다루고 지시로 취급하지 않도록 정합니다.

자세히: [docs/security.md](docs/security.md) · 취약점 신고: [SECURITY.md](SECURITY.md)

## 저장소 구조

```text
packages/cli/   preapp CLI (TypeScript, esbuild 단일 파일 bundle)
skills/         harness별 skill 파일 (CLI 단일 소스에서 생성)
docs/           설치, CLI, skill, HTTP 프로토콜, 피드백 페이로드, 보안 모델
examples/       바로 게시 가능한 HTML 예제
scripts/        install.sh 미러(감사용) + 스모크 테스트
```

## 개발

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @preapp/cli build   # → packages/cli/dist/preapp.js
```

## 라이선스

[MIT](LICENSE)
