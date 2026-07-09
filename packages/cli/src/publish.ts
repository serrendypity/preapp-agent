// `preapp publish <file-or-dir>`（api-contract Publish / CLI 节，E2E-01）。

import { randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { flagValue, parseArgs } from "./args.js";
import { ConfigError, resolveConfig } from "./config.js";
import { postPublish } from "./http.js";
import type { ExitCode, Io } from "./io.js";
import { packDirectory, UsageError } from "./pack.js";

function resolvePath(cwd: string, p: string): string {
  return isAbsolute(p) ? p : join(cwd, p);
}

/** Buffer → 独立 ArrayBuffer（Blob 要求 ArrayBuffer，Buffer 底层为 ArrayBufferLike）。 */
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

function isHtml(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".html") || lower.endsWith(".htm");
}

interface Artifact {
  bytes: Buffer;
  filename: string;
  entryField: string | undefined;
}

/** 单 HTML 直传；目录打包成 zip（entry 校验在打包内完成）。 */
async function buildArtifact(
  target: string,
  entryFlag: string | undefined,
): Promise<Artifact> {
  const stat = statSync(target); // 不存在 → ENOENT，命令层转 UsageError
  if (stat.isDirectory()) {
    const packed = await packDirectory(target, entryFlag ?? "index.html");
    return { bytes: packed.zip, filename: "content.zip", entryField: packed.entryFile };
  }
  if (stat.isFile()) {
    const name = basename(target);
    if (!isHtml(name)) {
      throw new UsageError(
        `single-file publish must be .html/.htm (got ${name}); pass a directory for other assets`,
      );
    }
    return { bytes: readFileSync(target), filename: name, entryField: entryFlag };
  }
  throw new UsageError(`not a file or directory: ${target}`);
}

function summarize(json: Record<string, unknown>): string[] {
  const lines = [
    `✓ published ${String(json.contentSlug)} · PROOF v${String(json.versionNumber)}`,
    `  view:     ${String(json.viewLink)}`,
    `  feedback: ${String(json.feedbackLink)}`,
    `  version:  ${String(json.versionLink)}`,
    `  pull:     ${String(json.feedbackCommand)}`,
  ];
  const warnings = json.warnings;
  if (Array.isArray(warnings) && warnings.length > 0) {
    lines.push(`  warnings: ${warnings.length}`);
    for (const w of warnings) lines.push(`    - ${String(w)}`);
  }
  return lines;
}

export async function runPublish(io: Io): Promise<ExitCode> {
  const { positionals, flags } = parseArgs(io.argv);
  const format = flagValue(flags, "format") ?? "json"; // agent-first：默认机器可读

  const targetArg = positionals[0];
  if (!targetArg) {
    io.stderr("usage: preapp publish <file-or-dir> [--title ...] [--slug ...]");
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

  let artifact: Artifact;
  try {
    artifact = await buildArtifact(resolvePath(io.cwd, targetArg), flagValue(flags, "entry"));
  } catch (err) {
    if (err instanceof UsageError) {
      io.stderr(err.message);
      return 2;
    }
    if ((err as { code?: string }).code === "ENOENT") {
      io.stderr(`path not found: ${targetArg}`);
      return 2;
    }
    throw err;
  }

  const form = new FormData();
  const type = artifact.filename.endsWith(".zip") ? "application/zip" : "text/html";
  form.append("artifact", new Blob([toArrayBuffer(artifact.bytes)], { type }), artifact.filename);

  const strFlags: Array<[string, string]> = [
    ["title", "title"],
    ["slug", "content"],
    ["description", "description"],
    ["change-note", "changeNote"],
    ["feedback-mode", "feedbackMode"],
  ];
  for (const [flag, field] of strFlags) {
    const v = flagValue(flags, flag);
    if (v !== undefined) form.append(field, v);
  }
  if (artifact.entryField !== undefined) form.append("entry", artifact.entryField);

  const anchorsFile = flagValue(flags, "anchors");
  if (anchorsFile !== undefined) {
    try {
      form.append("feedbackAnchors", readFileSync(resolvePath(io.cwd, anchorsFile), "utf8"));
    } catch {
      io.stderr(`anchors file not found: ${anchorsFile}`);
      return 2;
    }
  }

  const idempotencyKey = randomUUID();
  let res;
  try {
    res = await postPublish(`${config.baseUrl}/api/contents/publish`, config.token, form, idempotencyKey);
  } catch (err) {
    io.stderr((err as Error).message);
    return 1;
  }

  if (res.status === 201) {
    if (format === "json") {
      io.stdout(res.bodyText);
    } else {
      try {
        for (const line of summarize(JSON.parse(res.bodyText))) io.stdout(line);
      } catch {
        io.stdout(res.bodyText);
      }
    }
    return 0;
  }

  io.stderr(`publish failed (HTTP ${res.status}): ${res.bodyText}`);
  return 1;
}
