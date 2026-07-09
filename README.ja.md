# PreApp Agent

[English](README.md) | [简体中文](README.zh-CN.md) | **日本語** | [한국어](README.ko.md) | [Español](README.es.md)

AI が生成した HTML 成果物を公開し、人のフィードバックを集め、それを coding agent に戻す。

Agent は HTML の生成が得意になりました——デッキ、レポート、プロトタイプ。PreApp はそのラストマイルを担います:**共有し、レビューを受け、コメントを次の agent 実行に渡す。**

```text
agent publish → 共有リンク → 人がコメント → agent がフィードバック取得 → agent が v2 を publish
```

このリポジトリは [preapp.app](https://preapp.app) の agent 統合レイヤーです:`preapp` CLI、各 harness 向け agent skill(Claude Code / Codex / OpenClaw / Hermes)、プロトコルドキュメント、すぐ publish できるサンプル。ホスティングサービス本体はこのリポジトリには含まれません。

## 30 秒デモ

```bash
# 1. CLI + skill をインストール(このコマンドに token は含まれない——安全に転送可能)
curl -fsSL https://preapp.app/install.sh | sh -s -- --harness claude-code

# 2. 認証情報を一度だけ設定(https://preapp.app/dashboard → Install で token を生成)
preapp login <agent-token>

# 3. HTML ファイルまたはディレクトリを publish
preapp publish ./dist --title "Q3 Strategy Deck" --deck q3-strategy --format json
```

返ってきた `reviewLink` を共有すれば、誰でも登録なしでコメントできます(テキスト選択・画像クリックで注釈)。その後:

```bash
preapp feedback get q3-strategy --format markdown
```

Agent は **Agent Fix Brief**——正確なロケータ付きの番号付きコメント——を受け取り、修正して v2 を publish。**リンクは変わりません**。

同梱のサンプルで今すぐ試せます:

```bash
preapp publish examples/q3-strategy-deck --title "Q3 Strategy" --deck demo-q3
preapp publish examples/quarterly-report.html --title "Quarterly Report"
```

## なぜ PreApp か

Agent は HTML を生成できますが、それを人に届けるのは今も面倒です:

- ファイルは(多くの場合リモートの)workspace の中——`file://` では共有できない。
- 汎用ホスティング(Vercel / Netlify / Pages)はリポジトリ設定、ビルド、本番デプロイの意味論が伴う——レビュー用の成果物にはオーバーキル。
- フィードバックは Slack やメールのスクリーンショットで返ってきて、agent には届かない。

PreApp は欠けている輪だけを足します:

- **静的アセットも一緒に**——単一 HTML、ディレクトリ(自動パック)、zip をそのまま publish。
- **View / Review リンク**——クリーンな閲覧と軽量な注釈を分離、権限も別。
- **問題の場所にコメント**——テキスト選択や画像クリック;アンカーやデッキ全体へのコメントも。
- **バージョン + 安定リンク**——publish のたびに v1/v2/v3;共有リンクは常に最新版を指す。
- **agent 向けフィードバックペイロード**——Markdown brief または JSON、正確なロケータ付き。
- **アクセス記録**——共有が実際に開かれたかどうかが分かる。

これは本番デプロイのプラットフォーム*ではありません*。ビルドもサーバーコード実行もなし——ホスティングは意図的に地味に、価値はレビューループに。

## インストール

**推奨(agent にも人にも)**——1 行で CLI と harness 用 skill をインストール、token は決して含まれません:

```bash
curl -fsSL https://preapp.app/install.sh | sh -s -- --harness <claude-code|codex|openclaw|hermes>
```

**npm**:

```bash
npm i -g @preapp/cli
preapp skill install --harness claude-code
```

その後、認証情報を一度だけ設定([docs/install.md](docs/install.md) 参照):

```bash
preapp login <agent-token>   # ~/.preapp/config.json に書く前にサーバーで検証
```

## 対応 agent

| Agent | 方法 |
|---|---|
| Claude Code | `~/.claude/skills/preapp-publish/SKILL.md`(自動発見) |
| Codex | skill ディレクトリ + [AGENTS.md スニペット](skills/codex/preapp-publish/AGENTS-snippet.md) |
| OpenClaw | 慣例パス、`--dir` で上書き可 |
| Hermes | 慣例パス、`--dir` で上書き可 |
| Cursor / shell が使える agent | agent に `preapp` CLI を実行させる |

> PreApp は CLI と agent skill レシピを提供します。Claude Code を最初にサポート;Codex/OpenClaw/Hermes のレシピはコミュニティでの改善を歓迎——[PR はこちら](CONTRIBUTING.md)。

## コマンド

```text
preapp publish <file-or-dir> [--title ...] [--deck <id-or-slug>] [--entry index.html]
                             [--change-note ...] [--anchors anchors.json]
                             [--feedback-mode off|detailed] [--format json|text]
preapp feedback get <deck-url | version-url | deck-id-or-slug> [--version N] [--format markdown|json]
preapp login <token> [--base-url <url>]
preapp skill install --harness <claude-code|codex|openclaw|hermes> [--dir <path>] [--force]
```

完全なリファレンス:[docs/cli.md](docs/cli.md) · プロトコル:[docs/api-protocol.md](docs/api-protocol.md) · フィードバックペイロード:[docs/feedback-payload.md](docs/feedback-payload.md)

### 二段階フィードバックゲート

`preapp feedback get` の出力は意図的にゲート指示で終わります:agent は**コメントを人に伝えて、そこで止まる**——黙って自動修正してはいけません。人がどのコメントを反映するか指定してから、agent が編集して再 publish します。これは制限ではなくプロダクトの意思決定です;[docs/cli.md](docs/cli.md#two-stage-feedback-gate) 参照。

## セキュリティ

- インストールコマンドに token は決して含まれない;認証情報は `preapp login` で別途設定(保存前に検証、設定ファイルは `0600`)。
- アップロードされた成果物は隔離 origin から sandbox iframe 内で**静的に**配信——サーバーはアップロードされたコードを決して実行しない。
- 共有リンクは推測不能な capability URL;ダッシュボードからいつでもローテーション・非公開化可能。
- レビュアーのコメントは agent にとって**信頼できないデータ**(prompt injection 対策)——skill もドキュメントも、内容として扱い決して指示として扱わないよう定めています。

詳細:[docs/security.md](docs/security.md) · 脆弱性報告:[SECURITY.md](SECURITY.md)

## リポジトリ構成

```text
packages/cli/   preapp CLI(TypeScript、esbuild 単一ファイル bundle)
skills/         harness ごとの skill ファイル(CLI の単一ソースから生成)
docs/           インストール、CLI、skill、HTTP プロトコル、フィードバックペイロード、セキュリティモデル
examples/       すぐ publish できる HTML サンプル
scripts/        install.sh ミラー(監査用)+ スモークテスト
```

## 開発

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @preapp/cli build   # → packages/cli/dist/preapp.js
```

## ライセンス

[MIT](LICENSE)
