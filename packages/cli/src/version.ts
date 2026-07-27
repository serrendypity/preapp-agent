declare const __PREAPP_VERSION__: string | undefined;

export async function getCliVersion(): Promise<string> {
  // The hosted installer ships one file, without package.json beside it.
  if (typeof __PREAPP_VERSION__ !== "undefined") return __PREAPP_VERSION__;
  const { createRequire } = await import("node:module");
  return (createRequire(import.meta.url)("../package.json") as { version: string }).version;
}
