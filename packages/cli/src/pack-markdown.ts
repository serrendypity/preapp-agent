// 单 Markdown 发布打包（markdown-support-design §6）：不打包父目录，只带 md + 实际引用的本地图片。
// 图片发现用 mdast AST（mdast-util-from-markdown + GFM），不用全文正则；publication root = md 所在目录，
// `../` 逃出/绝对路径/symlink/缺图直接 UsageError（退出码 2），不发布已知损坏版本。
// 始终产出内存 zip（filename=content.zip，entry=md 文件名）——与目录发布走同一条服务端校验管道。

import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { visit } from "./mdast-visit.js";
import { UsageError, zipFiles, type CollectedFile } from "./pack.js";

export interface MarkdownPackResult {
  zip: Buffer;
  entryFile: string;
  /** 被打包的本地图片（相对 md 目录的 POSIX 路径）。 */
  images: string[];
}

/** raw HTML 里的 <img src="...">（只在 AST 已判定的 html 节点文本内做局部提取）。 */
const HTML_IMG_RE = /<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

const SKIP_PROTO_RE = /^(?:https?:|data:|blob:|file:|vbscript:|javascript:)/i;

function collectImageRefs(md: string): string[] {
  const tree = fromMarkdown(md, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  const refs: string[] = [];
  const definitions = new Map<string, string>();
  visit(tree, (node) => {
    const n = node as { type: string; url?: string; identifier?: string; value?: string };
    if (n.type === "definition" && n.identifier && n.url) definitions.set(n.identifier, n.url);
  });
  visit(tree, (node) => {
    const n = node as { type: string; url?: string; identifier?: string; value?: string };
    if (n.type === "image" && n.url) refs.push(n.url);
    if (n.type === "imageReference" && n.identifier) {
      const url = definitions.get(n.identifier);
      if (url) refs.push(url);
    }
    if (n.type === "html" && n.value) {
      for (const m of n.value.matchAll(HTML_IMG_RE)) refs.push(m[1] ?? m[2] ?? "");
    }
  });
  return refs;
}

/** 解析单个本地引用 → 相对 md 目录的 POSIX 路径；越界/非法直接 UsageError。 */
function resolveLocalRef(rawRef: string, mdDir: string, mdRealDir: string): string | null {
  if (rawRef === "" || SKIP_PROTO_RE.test(rawRef) || rawRef.startsWith("//")) {
    return null; // 远程/内联协议：不打包（服务端渲染时阻止远程图片）
  }
  const cleaned = rawRef.split(/[?#]/, 1)[0]!;
  let decoded: string;
  try {
    decoded = decodeURIComponent(cleaned);
  } catch {
    throw new UsageError(`图片地址无法解码：${rawRef}`);
  }
  if (decoded.includes("\0")) throw new UsageError(`图片地址包含非法字符：${rawRef}`);
  if (isAbsolute(decoded) || /^[A-Za-z]:/.test(decoded)) {
    throw new UsageError(`不允许绝对路径图片引用：${rawRef}（改用相对 Markdown 的路径）`);
  }
  const abs = resolve(mdDir, decoded);
  let st;
  try {
    st = lstatSync(abs);
  } catch {
    throw new UsageError(`Markdown 引用的本地图片不存在：${rawRef}（解析为 ${relative(mdDir, abs) || abs}）`);
  }
  if (st.isSymbolicLink()) throw new UsageError(`不允许 symlink 图片：${rawRef}`);
  if (!st.isFile()) throw new UsageError(`图片引用不是普通文件：${rawRef}`);
  // publication root 校验：realpath 后必须仍在 md 目录内（§6.3）
  const real = realpathSync(abs);
  if (real !== mdRealDir && !real.startsWith(mdRealDir + sep)) {
    throw new UsageError(`图片引用逃出发布根目录：${rawRef}（单文件发布只允许 Markdown 同目录及子目录；需要父目录资源请改用目录模式 + --entry）`);
  }
  const rel = relative(mdDir, abs).split(sep).join("/");
  if (rel.split("/").some((s) => s.startsWith("."))) {
    throw new UsageError(`不允许隐藏路径段的图片引用：${rawRef}`);
  }
  return rel;
}

export async function packMarkdownDocument(mdPath: string): Promise<MarkdownPackResult> {
  const st = statSync(mdPath);
  if (!st.isFile()) throw new UsageError(`不是文件：${mdPath}`);
  const mdDir = dirname(mdPath);
  const mdRealDir = realpathSync(mdDir);
  const entryFile = basename(mdPath);
  const source = readFileSync(mdPath);

  const images: string[] = [];
  const seen = new Set<string>();
  for (const ref of collectImageRefs(source.toString("utf8"))) {
    const rel = resolveLocalRef(ref, mdDir, mdRealDir);
    if (rel && !seen.has(rel)) {
      seen.add(rel);
      images.push(rel);
    }
  }

  const files: CollectedFile[] = [
    { relPath: entryFile, absPath: mdPath },
    ...images.map((rel) => ({ relPath: rel, absPath: resolve(mdDir, rel) })),
  ];
  const zip = await zipFiles(files);
  return { zip, entryFile, images };
}
