// 凭证与服务端地址解析（api-contract CLI 配置节，严格优先级）：
// 1. --token / --base-url  2. env PREAPP_TOKEN / PREAPP_URL  3. ~/.preapp/config.json

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ResolvedConfig {
  token: string;
  baseUrl: string;
}

export interface ConfigInputs {
  tokenFlag?: string | undefined;
  baseUrlFlag?: string | undefined;
  env: NodeJS.ProcessEnv;
  homeDir: string;
}

/** 配置缺失时抛出，命令层转成退出码 2 + 使用说明。 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

interface ConfigFile {
  token?: unknown;
  baseUrl?: unknown;
}

/** ~/.preapp/config.json 的绝对路径。 */
export function configPath(homeDir: string): string {
  return join(homeDir, ".preapp", "config.json");
}

export function readConfigFile(homeDir: string): ConfigFile {
  const path = configPath(homeDir);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as ConfigFile) : {};
  } catch {
    throw new ConfigError(`~/.preapp/config.json is not valid JSON: ${path}`);
  }
}

/** 写入凭证（config 文件 0600、.preapp 目录 0700）。login 命令用；只落 token + baseUrl 两字段。 */
export function writeConfigFile(homeDir: string, cfg: { token: string; baseUrl: string }): void {
  const dir = join(homeDir, ".preapp");
  mkdirSync(dir, { recursive: true });
  try {
    chmodSync(dir, 0o700);
  } catch {
    // best-effort：目录权限收紧失败不致命
  }
  const path = configPath(homeDir);
  writeFileSync(path, JSON.stringify({ token: cfg.token, baseUrl: cfg.baseUrl }) + "\n", {
    mode: 0o600,
  });
  try {
    chmodSync(path, 0o600);
  } catch {
    // best-effort：已存在文件的权限收紧失败不致命
  }
}

function pick(...candidates: Array<unknown>): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() !== "") return c.trim();
  }
  return undefined;
}

export function resolveConfig(inputs: ConfigInputs): ResolvedConfig {
  const file = readConfigFile(inputs.homeDir);
  const token = pick(inputs.tokenFlag, inputs.env.PREAPP_TOKEN, file.token);
  const baseUrl = pick(inputs.baseUrlFlag, inputs.env.PREAPP_URL, file.baseUrl);

  if (!token) {
    const dash = baseUrl
      ? `${baseUrl.replace(/\/+$/, "")}/dashboard`
      : "你的 PreApp 控制台（如 https://preapp.app/dashboard）";
    throw new ConfigError(
      `缺少 agent token。请到 ${dash} 的「安装」页生成一个 agent token，然后运行：\n` +
        "  preapp login <粘贴 token>\n" +
        "（或设置环境变量 PREAPP_TOKEN=<token>。）",
    );
  }
  if (!baseUrl) {
    throw new ConfigError(
      "缺少服务地址 baseUrl。用 --base-url、环境变量 PREAPP_URL，或 ~/.preapp/config.json 指定。",
    );
  }
  return { token, baseUrl: baseUrl.replace(/\/+$/, "") };
}
