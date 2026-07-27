import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist", "preapp.js");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
let isolatedDir = "";
let isolatedCli = "";

describe("standalone CLI bundle", () => {
  beforeAll(async () => {
    execFileSync(process.execPath, [join(root, "build.mjs")], { cwd: root, stdio: "pipe" });
    isolatedDir = mkdtempSync(join(tmpdir(), "preapp-bundle-"));
    isolatedCli = join(isolatedDir, "preapp");
    await cp(dist, isolatedCli);
  });

  afterAll(async () => {
    await rm(isolatedDir, { recursive: true, force: true });
  });

  it("prints its embedded version without a neighboring package.json", () => {
    const output = execFileSync(process.execPath, [isolatedCli, "--version"], { encoding: "utf8" });
    expect(output.trim()).toBe(`preapp ${pkg.version}`);
  });

  it("shows help from the isolated single file", () => {
    const output = execFileSync(process.execPath, [isolatedCli, "--help"], { encoding: "utf8" });
    expect(output).toContain("preapp publish");
  });

  it("starts the MCP server without a neighboring package.json", async () => {
    const child = spawn(process.execPath, [isolatedCli, "mcp"], { stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.includes(`preapp mcp server ${pkg.version} ready`)) child.stdin.end();
    });
    const code = await new Promise<number | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`MCP bundle did not become ready: ${stderr}`));
      }, 5_000);
      child.once("error", reject);
      child.once("exit", (exitCode) => {
        clearTimeout(timer);
        resolve(exitCode);
      });
    });
    expect(code).toBe(0);
    expect(stderr).toContain(`preapp mcp server ${pkg.version} ready`);
  });
});
