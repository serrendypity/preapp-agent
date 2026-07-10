// preapp CLI 入口。子命令：publish、feedback、skill。开发经 tsx 运行；打包见 build.mjs（banner 注入 shebang + createRequire）。

import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";
import type { ExitCode, Io } from "./io.js";
import { runPublish } from "./publish.js";
import { runFeedback } from "./feedback.js";
import { runLogin } from "./login.js";
import { runSkillInstall } from "./skill.js";

const HELP = `preapp — 把 agent 生成的内容分享给人看,收集反馈,再带回 agent

usage:
  preapp publish <file-or-dir> [--title ...] [--slug <id-or-slug>] [--entry index.html|report.md]
                               [--description ...] [--change-note ...] [--anchors anchors.json]
                               [--feedback-mode off|detailed] [--format json|text]
  preapp feedback get <share-url | version-url | content-id-or-slug> [--version N] [--format markdown|json]
  preapp login <token> [--base-url <url>]        # 写入凭证到 ~/.preapp/config.json（装完后一次）
  preapp skill install --harness <claude-code|codex|openclaw|hermes> [--dir <path>] [--force]

config (优先级)：--token/--base-url  >  PREAPP_TOKEN/PREAPP_URL  >  ~/.preapp/config.json`;

export async function run(argv: string[], io: Omit<Io, "argv">): Promise<ExitCode> {
  const [cmd, ...rest] = argv;

  if (cmd === undefined || cmd === "--help" || cmd === "-h" || cmd === "help") {
    io.stdout(HELP);
    return 0;
  }
  if (cmd === "--version" || cmd === "-v") {
    // 版本号单一来源 = package.json，不硬编码（bump 版本后 --version 自动跟随）。
    // dev(tsx): src/main.ts → packages/cli/package.json；bundle: dist/preapp.js → 包根 package.json。
    const { createRequire } = await import("node:module");
    const { version } = createRequire(import.meta.url)("../package.json") as { version: string };
    io.stdout(`preapp ${version}`);
    return 0;
  }

  const base = { ...io };
  if (cmd === "publish") {
    return runPublish({ ...base, argv: rest });
  }
  if (cmd === "feedback") {
    if (rest[0] !== "get") {
      io.stderr("usage: preapp feedback get <target> [--version N] [--format markdown|json]");
      return 2;
    }
    return runFeedback({ ...base, argv: rest.slice(1) });
  }
  if (cmd === "login") {
    return runLogin({ ...base, argv: rest });
  }
  if (cmd === "skill") {
    if (rest[0] !== "install") {
      io.stderr(
        "usage: preapp skill install --harness <claude-code|codex|openclaw|hermes> [--dir <path>] [--force]",
      );
      return 2;
    }
    return runSkillInstall({ ...base, argv: rest.slice(1) });
  }

  io.stderr(`unknown command: ${cmd}\n\n${HELP}`);
  return 2;
}

// 直接运行（非测试导入）时挂到真实进程。realpathSync 解析 bin 软链，兼容 npm 全局安装。
const invokedDirectly = (() => {
  if (argv[1] === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(argv[1])).href;
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  run(argv.slice(2), {
    env: process.env,
    cwd: process.cwd(),
    homeDir: homedir(),
    stdout: (line) => process.stdout.write(line + "\n"),
    stderr: (line) => process.stderr.write(line + "\n"),
  })
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`unexpected error: ${String(err?.stack ?? err)}\n`);
      process.exit(1);
    });
}
