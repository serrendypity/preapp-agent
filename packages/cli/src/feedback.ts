// `preapp feedback get <share-or-version-url-or-id>`（api-contract Agent Feedback API）。
// endpoint: GET /api/contents/{contentOrVersion}/feedback?format=[&version=N]
// 省略版本时读 latest（服务端缺省）。

import { flagValue, parseArgs } from "./args.js";
import { ConfigError, resolveConfig } from "./config.js";
import { getJson } from "./http.js";
import type { ExitCode, Io } from "./io.js";

interface Target {
  contentIdOrSlug: string;
  versionSegment: string; // 版本号或 "latest"
}

/** 解析分享 URL（/s/{slug} 或 /s/{slug}/v/{n}）或裸 id/slug。 */
function parseTarget(raw: string, versionFlag: string | undefined): Target | null {
  if (/^https?:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    const segs = url.pathname.split("/").filter((s) => s !== "");
    const d = segs.indexOf("s");
    if (d < 0 || d + 1 >= segs.length) return null;
    const slug = segs[d + 1]!;
    let versionSegment = "latest";
    if (segs[d + 2] === "v" && segs[d + 3]) versionSegment = segs[d + 3]!;
    if (versionFlag !== undefined) versionSegment = versionFlag; // 显式 --version 优先
    return { contentIdOrSlug: slug, versionSegment };
  }
  return { contentIdOrSlug: raw, versionSegment: versionFlag ?? "latest" };
}

export async function runFeedback(io: Io): Promise<ExitCode> {
  const { positionals, flags } = parseArgs(io.argv);
  // 期望形如 `feedback get <target>`：get 已被 main 剥离，这里 positionals[0] = target
  const targetArg = positionals[0];
  const format = flagValue(flags, "format") ?? "markdown"; // Agent Feedback Brief 为主产物

  if (format !== "markdown" && format !== "json") {
    io.stderr("format must be 'markdown' or 'json'");
    return 2;
  }
  if (!targetArg) {
    io.stderr("usage: preapp feedback get <share-url | version-url | content-id-or-slug> [--version N]");
    return 2;
  }

  const target = parseTarget(targetArg, flagValue(flags, "version"));
  if (!target) {
    io.stderr(`could not parse content target: ${targetArg}`);
    return 2;
  }

  let config;
  try {
    config = resolveConfig({
      tokenFlag: flagValue(flags, "token"),
      baseUrlFlag: flagValue(flags, "base-url"),
      env: io.env,
      homeDir: io.homeDir,
    });
  } catch (err) {
    if (err instanceof ConfigError) {
      io.stderr(err.message);
      return 2;
    }
    throw err;
  }

  const url =
    `${config.baseUrl}/api/contents/${encodeURIComponent(target.contentIdOrSlug)}/feedback` +
    `?format=${format}` +
    (target.versionSegment === "latest" ? "" : `&version=${encodeURIComponent(target.versionSegment)}`);

  let res;
  try {
    res = await getJson(url, config.token);
  } catch (err) {
    io.stderr((err as Error).message);
    return 1;
  }

  if (res.status >= 200 && res.status < 300) {
    io.stdout(res.bodyText);
    // 工作流关卡（harness 无关）：拉到反馈后交还控制权，先让用户定调整方向，别自动改。
    // markdown 走 stdout（人/agent 主读），json 走 stderr（保 stdout 为纯 JSON）。
    if (format === "json") io.stderr(WORKFLOW_GATE);
    else io.stdout(WORKFLOW_GATE);
    return 0;
  }
  io.stderr(`feedback get failed (HTTP ${res.status}): ${res.bodyText}`);
  return 1;
}

/** 两段式关卡：任何 harness 跑完 feedback get 都读到这段（比 skill 正文更贴近、更权威）。 */
const WORKFLOW_GATE: string = [
  "",
  "──────── PREAPP 两段式关卡（拉到反馈后必须照做）────────",
  "1) 把上面的反馈按编号（Q1/Q2…）连同作者、定位与原文，复述给用户。",
  "2) 停下、交还控制权，请用户给出调整指示（改哪几条、每条怎么改；或“全部按建议改”/“先不改”）。",
  "3) 在用户回复前，不要修改任何文件、不要重新 publish。",
  "唯一例外：用户在本次请求里已明确要求直接改完（如“拉反馈并直接全部改好”），才可跳过第 2 步。",
  "──────────────────────────────────────────────────────",
].join("\n");
