// `preapp login <token>`：把 agent token 写入 ~/.preapp/config.json（0600），供后续 publish/feedback 复用。
// 设计（decisions 2026-07-07）：一键安装命令不含 token（可安全转发）；token 由用户装完后用本命令补写。
// 写前先打 GET /api/me 验证：命中才落盘，避免把无效/已撤销凭证静默写入。

import { flagValue, parseArgs } from "./args.js";
import { readConfigFile, writeConfigFile } from "./config.js";
import { getJson } from "./http.js";
import type { ExitCode, Io } from "./io.js";

function trimUrl(u: string): string {
  return u.replace(/\/+$/, "");
}

function envStr(v: string | undefined): string | undefined {
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export async function runLogin(io: Io): Promise<ExitCode> {
  const { positionals, flags } = parseArgs(io.argv);
  const token = positionals[0] ?? flagValue(flags, "token") ?? envStr(io.env.PREAPP_TOKEN);

  // baseUrl 解析：--base-url/--url > env PREAPP_URL > 既有 config.baseUrl（一键安装已写入）。
  const file = readConfigFile(io.homeDir);
  const baseUrlRaw =
    flagValue(flags, "base-url") ??
    flagValue(flags, "url") ??
    envStr(io.env.PREAPP_URL) ??
    (typeof file.baseUrl === "string" ? envStr(file.baseUrl) : undefined);

  if (!token) {
    io.stderr(
      [
        "usage: preapp login <token> [--base-url <url>]",
        baseUrlRaw
          ? `到 ${trimUrl(baseUrlRaw)}/dashboard 的「安装」页生成一个 agent token，再运行 preapp login <粘贴 token>。`
          : "到你的 PreApp 控制台（如 https://preapp.app/dashboard）生成 agent token 后运行本命令。",
      ].join("\n"),
    );
    return 2;
  }
  if (!baseUrlRaw) {
    io.stderr(
      "缺少服务地址：用 --base-url <url> 指定，或先跑一键安装脚本（会把 baseUrl 写进 config）。",
    );
    return 2;
  }
  const baseUrl = trimUrl(baseUrlRaw);

  // 写前验证：/api/me 命中才落盘。
  let res;
  try {
    res = await getJson(`${baseUrl}/api/me`, token);
  } catch (err) {
    io.stderr(`无法连接 ${baseUrl}：${(err as Error).message}`);
    return 1;
  }
  if (res.status === 401) {
    io.stderr(`token 无效或已撤销（HTTP 401）。到 ${baseUrl}/dashboard 重新生成后再试。`);
    return 1;
  }
  if (res.status < 200 || res.status >= 300) {
    io.stderr(`校验 token 失败（HTTP ${res.status}）：${res.bodyText}`);
    return 1;
  }

  writeConfigFile(io.homeDir, { token, baseUrl });

  let who = "";
  try {
    const me = JSON.parse(res.bodyText) as { tokenName?: unknown };
    if (typeof me.tokenName === "string" && me.tokenName) who = `（token：${me.tokenName}）`;
  } catch {
    // /api/me 不是 JSON 也不致命——凭证已验证可用
  }
  io.stdout(`✓ 已保存凭证到 ~/.preapp/config.json${who}`);
  io.stdout(`  baseUrl：${baseUrl}`);
  io.stdout("现在可以：preapp publish <文件或目录> --slug <slug>");
  return 0;
}
