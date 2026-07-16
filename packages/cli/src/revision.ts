// `preapp revision get|save`（html-prototype-feedback-prd §14.2/§14.3）：本轮修改清单。
// get：owner 确认的修改要求（Markdown 主读；Changes 可执行，Source Feedback 为未受信原文）。
// save：CLI 先读当前 brief 取 editSequence（文件未显式给 baseEditSequence 时用它；尚无 brief 用 0）；
//       服务端仍以原子 compare-and-swap 校验——CLI 的先读只是便利，不构成锁（§14.3）。

import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { flagValue, parseArgs } from "./args.js";
import { ConfigError, resolveConfig, type ResolvedConfig } from "./config.js";
import { getJson, putJson } from "./http.js";
import type { ExitCode, Io } from "./io.js";
import { parseContentTarget, type Target } from "./feedback.js";

function briefUrl(baseUrl: string, target: Target, format?: string): string {
  const qs = new URLSearchParams();
  if (target.versionSegment !== "latest") qs.set("version", target.versionSegment);
  if (format) qs.set("format", format);
  const s = qs.toString();
  return (
    `${baseUrl}/api/contents/${encodeURIComponent(target.contentIdOrSlug)}/revision-brief` +
    (s ? `?${s}` : "")
  );
}

function loadConfig(io: Io, flags: ReturnType<typeof parseArgs>["flags"]): ResolvedConfig | ExitCode {
  try {
    return resolveConfig({
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
}

export async function runRevisionGet(io: Io): Promise<ExitCode> {
  const { positionals, flags } = parseArgs(io.argv);
  const targetArg = positionals[0];
  const format = flagValue(flags, "format") ?? "markdown"; // Agent 主读格式（§14.2）
  if (format !== "markdown" && format !== "json") {
    io.stderr("format must be 'markdown' or 'json'");
    return 2;
  }
  if (!targetArg) {
    io.stderr("usage: preapp revision get <share-url | content-id-or-slug> [--version N] [--format markdown|json]");
    return 2;
  }
  const target = parseContentTarget(targetArg, flagValue(flags, "version"));
  if (!target) {
    io.stderr(`could not parse content target: ${targetArg}`);
    return 2;
  }
  const config = loadConfig(io, flags);
  if (typeof config === "number") return config;

  let res;
  try {
    res = await getJson(briefUrl(config.baseUrl, target, format), config.token);
  } catch (err) {
    io.stderr((err as Error).message);
    return 1;
  }
  if (res.status >= 200 && res.status < 300) {
    io.stdout(res.bodyText);
    return 0;
  }
  if (res.status === 404) {
    // §14.2：明确“尚未整理本轮修改”，与其它 404 区分
    io.stderr(
      "no revision brief for this version yet（尚未整理本轮修改）— the owner hasn't handed one to the agent. " +
        "Fall back to `preapp feedback get` and relay raw feedback for the owner to curate.",
    );
    return 1;
  }
  io.stderr(`revision get failed (HTTP ${res.status}): ${res.bodyText}`);
  return 1;
}

interface RevisionFile {
  baseEditSequence?: number;
  items: Array<{ instruction: string; feedbackIds?: string[] }>;
}

/** 读取并校验 revision.json（网络之前 fail-fast）；`--file -` 走 stdin。 */
function readRevisionFile(io: Io, fileFlag: string): RevisionFile | ExitCode {
  let raw: string;
  try {
    raw = fileFlag === "-" ? readFileSync(0, "utf8") : readFileSync(isAbsolute(fileFlag) ? fileFlag : join(io.cwd, fileFlag), "utf8");
  } catch {
    io.stderr(`revision file not found: ${fileFlag}`);
    return 2;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    io.stderr("revision file must be valid JSON: { \"items\": [{ \"instruction\": \"...\", \"feedbackIds\": [] }] }");
    return 2;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    io.stderr("revision file must be a JSON object with an items array");
    return 2;
  }
  const obj = parsed as Record<string, unknown>;
  // §14.3：文件不接受独立 state 字段（避免与 --ready 冲突）；state 由 CLI 按 flag 生成
  if ("state" in obj) {
    io.stderr("revision file must not contain a 'state' field — use --ready to hand the brief to the agent");
    return 2;
  }
  if (!Array.isArray(obj.items)) {
    io.stderr("revision file must contain an items array");
    return 2;
  }
  if (obj.baseEditSequence !== undefined && typeof obj.baseEditSequence !== "number") {
    io.stderr("baseEditSequence must be a number when provided");
    return 2;
  }
  return { baseEditSequence: obj.baseEditSequence as number | undefined, items: obj.items as RevisionFile["items"] };
}

export async function runRevisionSave(io: Io): Promise<ExitCode> {
  const { positionals, flags } = parseArgs(io.argv);
  const targetArg = positionals[0];
  const fileFlag = flagValue(flags, "file");
  const ready = flags["ready"] === true;
  if (!targetArg || !fileFlag) {
    io.stderr("usage: preapp revision save <share-url | content-id-or-slug> [--version N] --file <revision.json|-> [--ready]");
    return 2;
  }
  const file = readRevisionFile(io, fileFlag);
  if (typeof file === "number") return file;

  const target = parseContentTarget(targetArg, flagValue(flags, "version"));
  if (!target) {
    io.stderr(`could not parse content target: ${targetArg}`);
    return 2;
  }
  const config = loadConfig(io, flags);
  if (typeof config === "number") return config;

  // baseEditSequence：文件显式值优先；否则保存前先读当前 brief（无 brief → 0，§14.3）
  let base = file.baseEditSequence;
  if (base === undefined) {
    let pre;
    try {
      pre = await getJson(briefUrl(config.baseUrl, target, "json"), config.token);
    } catch (err) {
      io.stderr((err as Error).message);
      return 1;
    }
    if (pre.status === 404) {
      base = 0;
    } else if (pre.status >= 200 && pre.status < 300) {
      try {
        base = (JSON.parse(pre.bodyText) as { revisionBrief: { editSequence: number } }).revisionBrief.editSequence;
      } catch {
        io.stderr("could not read current editSequence from server response");
        return 1;
      }
    } else {
      io.stderr(`revision save failed reading current brief (HTTP ${pre.status}): ${pre.bodyText}`);
      return 1;
    }
  }

  let res;
  try {
    res = await putJson(briefUrl(config.baseUrl, target), config.token, {
      baseEditSequence: base,
      state: ready ? "ready" : "draft",
      items: file.items,
    });
  } catch (err) {
    io.stderr((err as Error).message);
    return 1;
  }
  if (res.status >= 200 && res.status < 300) {
    io.stdout(res.bodyText);
    return 0;
  }
  if (res.status === 409) {
    // CAS 冲突 / 已 applied（§13.3/§15.4）：不能覆盖，重新 get 并与用户确认差异后再试
    io.stderr(
      `revision save conflict (HTTP 409): ${res.bodyText}\n` +
        "The brief changed since it was read (or was already applied). Run `preapp revision get` again, confirm the diff with your human, then retry.",
    );
    return 1;
  }
  io.stderr(`revision save failed (HTTP ${res.status}): ${res.bodyText}`);
  return 1;
}
