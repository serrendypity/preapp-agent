// 目录 → 内存 zip（api-contract：目录输入由 CLI 打包）。
// 忽略规则为 denylist：.git / node_modules / 隐藏文件 / 已知垃圾 / 可执行与服务端脚本扩展名。
// 服务端另有权威 allowlist 兜底（storage/validate.ts），此处只做客户端友好过滤。

import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import yazl from "yazl";

/** CLI 层退出码 2 的用法错误。 */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

const IGNORED_DIRS = new Set([".git", "node_modules"]);
const JUNK_BASENAMES = new Set([".DS_Store", "Thumbs.db"]);

/** 可执行文件 / 服务端脚本扩展名（denylist）。 */
const DENIED_EXTENSIONS = new Set([
  "php", "phtml", "php3", "php4", "php5",
  "rb", "py", "pyc", "pl", "cgi", "jsp", "asp", "aspx", "erb",
  "sh", "bash", "zsh", "fish", "bat", "cmd", "ps1",
  "exe", "dll", "so", "dylib", "bin", "app", "deb", "rpm", "msi", "com", "scr", "jar",
]);

function extensionOf(basename: string): string | null {
  const i = basename.lastIndexOf(".");
  if (i <= 0) return null;
  return basename.slice(i + 1).toLowerCase() || null;
}

export interface PackResult {
  zip: Buffer;
  /** 打包内命中的 entry 相对路径（POSIX）。 */
  entryFile: string;
  /** 被忽略跳过的相对路径（用于 --format text 提示，可选消费）。 */
  skipped: string[];
}

export interface CollectedFile {
  relPath: string; // POSIX
  absPath: string;
}

function collectFiles(rootDir: string): { files: CollectedFile[]; skipped: string[] } {
  const files: CollectedFile[] = [];
  const skipped: string[] = [];

  const walk = (absDir: string, relDir: string): void => {
    for (const name of readdirSync(absDir)) {
      const abs = join(absDir, name);
      const rel = relDir === "" ? name : posix.join(relDir, name);

      let stat;
      try {
        stat = lstatSync(abs);
      } catch {
        skipped.push(rel);
        continue;
      }

      // 不跟随 symlink（避免穿越 / 环）
      if (stat.isSymbolicLink()) {
        skipped.push(rel);
        continue;
      }

      if (name.startsWith(".") || JUNK_BASENAMES.has(name)) {
        skipped.push(rel);
        continue;
      }

      if (stat.isDirectory()) {
        if (IGNORED_DIRS.has(name)) {
          skipped.push(rel + "/");
          continue;
        }
        walk(abs, rel);
        continue;
      }

      if (!stat.isFile()) {
        skipped.push(rel);
        continue;
      }

      const ext = extensionOf(name);
      if (ext !== null && DENIED_EXTENSIONS.has(ext)) {
        skipped.push(rel);
        continue;
      }

      files.push({ relPath: rel, absPath: abs });
    }
  };

  walk(rootDir, "");
  return { files, skipped };
}

export function zipFiles(files: CollectedFile[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    const chunks: Buffer[] = [];
    zip.outputStream.on("data", (c: Buffer) => chunks.push(c));
    zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    zip.outputStream.on("error", reject);
    // 稳定顺序，便于复现
    for (const f of [...files].sort((a, b) => a.relPath.localeCompare(b.relPath))) {
      zip.addBuffer(readFileSync(f.absPath), f.relPath);
    }
    zip.end();
  });
}

/** 打包目录；entry 默认 index.html，必须存在于打包结果中，否则 UsageError（退出码 2）。 */
export async function packDirectory(rootDir: string, entry = "index.html"): Promise<PackResult> {
  const { files, skipped } = collectFiles(rootDir);
  if (files.length === 0) {
    throw new UsageError(`directory has no packable files: ${rootDir}`);
  }
  const entryFile = entry.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!files.some((f) => f.relPath === entryFile)) {
    throw new UsageError(
      `entry file not found in directory: ${entryFile} (pass --entry or add ${entryFile})`,
    );
  }
  const zip = await zipFiles(files);
  return { zip, entryFile, skipped };
}
