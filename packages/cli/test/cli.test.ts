// CLI 纯单测（不依赖 @preapp/server；网络交互用 node:http stub）。
// 本文件随公开仓 preapp-agent 导出；起真服务端的 publish E2E 在 e2e.server.test.ts（仅主仓）。
import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { parseArgs } from "../src/args.js";
import { resolveConfig, ConfigError } from "../src/config.js";
import { packDirectory, UsageError } from "../src/pack.js";
import { run } from "../src/main.js";
import { makeIo, makeDeckDir, tmp } from "./helpers.js";

// ---------------------------------------------------------------------------

describe("参数解析", () => {
  it("--flag value / --flag=value / 布尔 / 位置参数", () => {
    const { positionals, flags } = parseArgs([
      "./dist",
      "--title",
      "Q3",
      "--slug=q3",
      "--format",
      "json",
      "--verbose",
    ]);
    expect(positionals).toEqual(["./dist"]);
    expect(flags.title).toBe("Q3");
    expect(flags.slug).toBe("q3");
    expect(flags.format).toBe("json");
    expect(flags.verbose).toBe(true);
  });
});

describe("配置链优先级（api-contract CLI 配置）", () => {
  function writeConfig(home: string, token: string, baseUrl: string): void {
    mkdirSync(join(home, ".preapp"));
    writeFileSync(join(home, ".preapp", "config.json"), JSON.stringify({ token, baseUrl }));
  }

  it("flag > env > 配置文件", () => {
    const home = tmp("preapp-home-");
    writeConfig(home, "file-tok", "http://file");

    const fromFile = resolveConfig({ env: {}, homeDir: home });
    expect(fromFile).toEqual({ token: "file-tok", baseUrl: "http://file" });

    const fromEnv = resolveConfig({
      env: { PREAPP_TOKEN: "env-tok", PREAPP_URL: "http://env/" },
      homeDir: home,
    });
    expect(fromEnv).toEqual({ token: "env-tok", baseUrl: "http://env" }); // 尾斜杠归一

    const fromFlag = resolveConfig({
      tokenFlag: "flag-tok",
      baseUrlFlag: "http://flag",
      env: { PREAPP_TOKEN: "env-tok", PREAPP_URL: "http://env" },
      homeDir: home,
    });
    expect(fromFlag.token).toBe("flag-tok");
    expect(fromFlag.baseUrl).toBe("http://flag");
  });

  it("全缺 → ConfigError", () => {
    expect(() => resolveConfig({ env: {}, homeDir: tmp("preapp-home-") })).toThrow(ConfigError);
  });
});

describe("目录打包（denylist 忽略规则）", () => {
  it("命中 index.html，跳过 hidden/vcs/junk/php", async () => {
    const dir = makeDeckDir();
    const res = await packDirectory(dir);
    expect(res.entryFile).toBe("index.html");
    expect(res.skipped).toContain(".env");
    expect(res.skipped).toContain("Thumbs.db");
    expect(res.skipped).toContain("app.php");
    expect(res.skipped.some((s) => s.startsWith(".git"))).toBe(true);
    expect(res.zip.length).toBeGreaterThan(0);
  });

  it("缺 entry 文件 → UsageError", async () => {
    const dir = tmp("preapp-empty-");
    writeFileSync(join(dir, "readme.md"), "# no entry");
    await expect(packDirectory(dir)).rejects.toBeInstanceOf(UsageError);
  });
});

describe("publish 用法/配置错误 → 退出码 2", () => {
  it("缺 index.html", async () => {
    const dir = tmp("preapp-noindex-");
    writeFileSync(join(dir, "readme.md"), "# x");
    const io = makeIo({
      argv: ["publish", dir, "--title", "T", "--slug", "d", "--token", "t", "--base-url", "http://x"],
    });
    expect(await run(io.argv, io)).toBe(2);
    expect(io.err.join("\n")).toContain("entry file not found");
  });

  it("缺 token 配置 → 提示 preapp login + 去哪生成", async () => {
    const io = makeIo({ argv: ["publish", "./whatever"] });
    expect(await run(io.argv, io)).toBe(2);
    const err = io.err.join("\n");
    expect(err).toContain("缺少 agent token");
    expect(err).toContain("preapp login");
  });

  it("路径不存在", async () => {
    const io = makeIo({
      argv: ["publish", "/no/such/path", "--token", "t", "--base-url", "http://x"],
    });
    expect(await run(io.argv, io)).toBe(2);
    expect(io.err.join("\n")).toContain("path not found");
  });
});

describe("feedback get（请求形状 + 鉴权头）", () => {
  let stub: Server;
  let baseUrl: string;
  let captured: { url: string; auth: string | undefined };

  beforeEach(async () => {
    captured = { url: "", auth: undefined };
    stub = createServer((req, res) => {
      captured = { url: req.url ?? "", auth: req.headers.authorization };
      res.writeHead(200, { "content-type": "text/markdown" });
      res.end("# Agent Fix Brief\n");
    });
    await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
    const addr = stub.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });
  afterEach(() => {
    stub.close();
  });

  it("version URL → 该版本号；默认 markdown；带 Bearer", async () => {
    const io = makeIo({
      argv: ["feedback", "get", `${baseUrl}/s/q3-strategy/v/2`, "--token", "pa_live_x", "--base-url", baseUrl],
    });
    expect(await run(io.argv, io)).toBe(0);
    expect(captured.url).toBe("/api/contents/q3-strategy/feedback?format=markdown&version=2");
    expect(captured.auth).toBe("Bearer pa_live_x");
    expect(io.out.join("\n")).toContain("Agent Fix Brief");
  });

  it("deck URL 省略版本 → latest 段；--format json", async () => {
    const io = makeIo({
      argv: ["feedback", "get", `${baseUrl}/s/q3-strategy`, "--format", "json", "--token", "t", "--base-url", baseUrl],
    });
    expect(await run(io.argv, io)).toBe(0);
    expect(captured.url).toBe("/api/contents/q3-strategy/feedback?format=json");
  });

  it("裸 slug + --version", async () => {
    const io = makeIo({
      argv: ["feedback", "get", "demo-deck", "--version", "3", "--token", "t", "--base-url", baseUrl],
    });
    expect(await run(io.argv, io)).toBe(0);
    expect(captured.url).toBe("/api/contents/demo-deck/feedback?format=markdown&version=3");
  });

  it("两段式关卡：markdown 输出末尾附关卡指令（交还控制权、不自动改）", async () => {
    const io = makeIo({
      argv: ["feedback", "get", "demo-deck", "--token", "t", "--base-url", baseUrl],
    });
    expect(await run(io.argv, io)).toBe(0);
    const out = io.out.join("\n");
    expect(out).toContain("Agent Fix Brief"); // 原始 brief 仍在
    expect(out).toContain("PREAPP 两段式关卡");
    expect(out).toContain("交还控制权");
    expect(out).toContain("在用户回复前，不要修改任何文件");
  });

  it("两段式关卡：json 输出走 stderr，stdout 保持纯 JSON", async () => {
    const io = makeIo({
      argv: ["feedback", "get", "demo-deck", "--format", "json", "--token", "t", "--base-url", baseUrl],
    });
    expect(await run(io.argv, io)).toBe(0);
    // stdout 不含关卡（保证可 JSON.parse）；关卡在 stderr
    expect(io.out.join("\n")).not.toContain("两段式关卡");
    expect(io.err.join("\n")).toContain("PREAPP 两段式关卡");
  });
});

describe("命令分发", () => {
  it("无参数打印帮助，退出 0", async () => {
    const io = makeIo();
    expect(await run([], io)).toBe(0);
    expect(io.out.join("\n")).toContain("usage:");
  });
  it("未知命令 → 退出 2", async () => {
    const io = makeIo();
    expect(await run(["frobnicate"], io)).toBe(2);
  });
  it("feedback 无 get → 退出 2", async () => {
    const io = makeIo();
    expect(await run(["feedback", "list"], io)).toBe(2);
  });
});

describe("skill install（各 harness）", () => {
  it("claude-code：写入 ~/.claude/skills，正文调 preapp 且不写死本地路径", async () => {
    const io = makeIo({ argv: ["skill", "install", "--harness", "claude-code"] });
    expect(await run(io.argv, io)).toBe(0);
    const p = join(io.homeDir, ".claude/skills/preapp-publish/SKILL.md");
    expect(existsSync(p)).toBe(true);
    const md = readFileSync(p, "utf8");
    expect(md).toContain("name: preapp-publish");
    expect(md).toContain("preapp publish");
    expect(md).not.toContain("/Users/"); // 路径无关：不含任何本机绝对路径
  });

  it("已存在不覆盖 → 2；--force → 0", async () => {
    const io1 = makeIo({ argv: ["skill", "install", "--harness", "claude-code"] });
    expect(await run(io1.argv, io1)).toBe(0);
    const io2 = makeIo({ argv: ["skill", "install", "--harness", "claude-code"], homeDir: io1.homeDir });
    expect(await run(io2.argv, io2)).toBe(2);
    const io3 = makeIo({
      argv: ["skill", "install", "--harness", "claude-code", "--force"],
      homeDir: io1.homeDir,
    });
    expect(await run(io3.argv, io3)).toBe(0);
  });

  it("未确认 harness（codex）也写入，且提示合并 AGENTS.md", async () => {
    const io = makeIo({ argv: ["skill", "install", "--harness", "codex"] });
    expect(await run(io.argv, io)).toBe(0);
    expect(existsSync(join(io.homeDir, ".codex/skills/preapp-publish/SKILL.md"))).toBe(true);
    expect(io.out.join("\n")).toContain("AGENTS.md");
  });

  it("未知/缺 harness、非 install 子命令 → 2", async () => {
    expect(await run(["skill", "install", "--harness", "bogus"], makeIo())).toBe(2);
    expect(await run(["skill", "install"], makeIo())).toBe(2);
    expect(await run(["skill", "frobnicate"], makeIo())).toBe(2);
  });
});

describe("login（装完后补写 token；写前校验 /api/me）", () => {
  let stub: Server;
  let baseUrl: string;
  let meStatus: number;
  let meBody: string;
  let captured: { url: string; auth: string | undefined };

  beforeEach(async () => {
    meStatus = 200;
    meBody = JSON.stringify({ userId: "u1", tokenName: "agent token" });
    captured = { url: "", auth: undefined };
    stub = createServer((req, res) => {
      captured = { url: req.url ?? "", auth: req.headers.authorization };
      res.writeHead(meStatus, { "content-type": "application/json" });
      res.end(meBody);
    });
    await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
    const addr = stub.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });
  afterEach(() => stub.close());

  it("有效 token + --base-url → 写 config(0600)、退出 0、命中 /api/me 带 Bearer", async () => {
    const io = makeIo({ argv: ["login", "pa_live_good", "--base-url", baseUrl] });
    expect(await run(io.argv, io)).toBe(0);
    expect(captured.url).toBe("/api/me");
    expect(captured.auth).toBe("Bearer pa_live_good");
    const cfgPath = join(io.homeDir, ".preapp", "config.json");
    expect(JSON.parse(readFileSync(cfgPath, "utf8"))).toEqual({ token: "pa_live_good", baseUrl });
    expect(statSync(cfgPath).mode & 0o777).toBe(0o600);
    expect(io.out.join("\n")).toContain("已保存凭证");
  });

  it("baseUrl 缺省时取既有 config.baseUrl（安装脚本已写入）", async () => {
    const io = makeIo({ argv: ["login", "pa_live_good"] });
    mkdirSync(join(io.homeDir, ".preapp"));
    writeFileSync(join(io.homeDir, ".preapp", "config.json"), JSON.stringify({ baseUrl }));
    expect(await run(io.argv, io)).toBe(0);
    expect(JSON.parse(readFileSync(join(io.homeDir, ".preapp", "config.json"), "utf8"))).toEqual({
      token: "pa_live_good",
      baseUrl,
    });
  });

  it("token 无效（401）→ 退出 1，且不写 config", async () => {
    meStatus = 401;
    meBody = JSON.stringify({ error: "unauthorized" });
    const io = makeIo({ argv: ["login", "pa_live_bad", "--base-url", baseUrl] });
    expect(await run(io.argv, io)).toBe(1);
    expect(existsSync(join(io.homeDir, ".preapp", "config.json"))).toBe(false);
    expect(io.err.join("\n")).toContain("401");
  });

  it("缺 token → 退出 2 + 用法", async () => {
    const io = makeIo({ argv: ["login"] });
    expect(await run(io.argv, io)).toBe(2);
    expect(io.err.join("\n")).toContain("usage: preapp login");
  });

  it("缺 baseUrl（无 config / flag / env）→ 退出 2", async () => {
    const io = makeIo({ argv: ["login", "pa_live_good"] });
    expect(await run(io.argv, io)).toBe(2);
    expect(io.err.join("\n")).toContain("缺少服务地址");
  });
});
