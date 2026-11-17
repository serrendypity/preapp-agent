import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist", "preapp.js");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  version: string;
  name: string;
  mcpName: string;
  files: string[];
};
const registryPath = [
  join(root, "..", "..", "server.json"),
  join(root, "..", "..", "public", "preapp-agent", "server.json"),
].find((path) => existsSync(path));
if (!registryPath) throw new Error("Official MCP Registry server.json not found");
const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
  name: string;
  version: string;
  packages: Array<{
    identifier: string;
    version: string;
    packageArguments?: Array<{ type: string; value: string }>;
    environmentVariables?: Array<{ name: string; isSecret?: boolean; value?: string }>;
  }>;
};
const npmReadme = readFileSync(join(root, "README.md"), "utf8");
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

  it("keeps npm and Official MCP Registry metadata aligned", () => {
    expect(pkg.version).toBe("0.5.1");
    expect(pkg.mcpName).toBe(registry.name);
    expect(registry.version).toBe(pkg.version);
    expect(pkg.files).toContain("README.md");

    const npmPackage = registry.packages.find((entry) => entry.identifier === pkg.name);
    expect(npmPackage?.version).toBe(pkg.version);
    expect(npmPackage?.packageArguments).toContainEqual({ type: "positional", value: "mcp" });
    expect(npmPackage?.environmentVariables).toContainEqual(
      expect.objectContaining({ name: "PREAPP_TOKEN", isSecret: true }),
    );
    expect(npmPackage?.environmentVariables).toContainEqual(
      expect.objectContaining({ name: "PREAPP_URL", value: "https://preapp.app" }),
    );
  });

  it("ships an npm README with a working direct-login path", () => {
    expect(npmReadme).toContain("preapp login <agent-token> --base-url https://preapp.app");
    expect(npmReadme).toContain("preapp mcp");
    expect(npmReadme).not.toMatch(/pa_live_[A-Za-z0-9_-]{20,}/);
  });
});
