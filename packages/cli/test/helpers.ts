// 共享测试 helpers（不依赖 @preapp/server）。
// cli.test.ts（纯单测，随公开仓 preapp-agent 导出）与 e2e.server.test.ts（起真服务端，仅主仓）共用。
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import type { Io } from "../src/io.js";

const tmps: string[] = [];

export function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmps.push(d);
  return d;
}

afterEach(() => {
  while (tmps.length) rmSync(tmps.pop()!, { recursive: true, force: true });
});

/** 收集 stdout/stderr 的假 io。 */
export function makeIo(overrides: Partial<Io> = {}): Io & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    argv: [],
    env: {},
    cwd: process.cwd(),
    homeDir: tmp("preapp-home-"),
    stdout: (l) => out.push(l),
    stderr: (l) => err.push(l),
    out,
    err,
    ...overrides,
  };
}

export function makeDeckDir(): string {
  const dir = tmp("preapp-deck-");
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>Deck</title><h1>hi</h1>");
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", "style.css"), "body{color:#000}");
  writeFileSync(join(dir, "assets", "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  // 应被忽略的：hidden / vcs / junk / 服务端脚本
  writeFileSync(join(dir, ".env"), "SECRET=x");
  mkdirSync(join(dir, ".git"));
  writeFileSync(join(dir, ".git", "config"), "[core]");
  writeFileSync(join(dir, "Thumbs.db"), "junk");
  writeFileSync(join(dir, "app.php"), "<?php echo 1;");
  return dir;
}
