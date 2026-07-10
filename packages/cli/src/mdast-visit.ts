// 极简 mdast 先序遍历（避免把 unist-util-visit 生态拉进 CLI bundle）。
export function visit(node: unknown, fn: (node: unknown) => void): void {
  fn(node);
  const children = (node as { children?: unknown[] }).children;
  if (Array.isArray(children)) for (const c of children) visit(c, fn);
}
