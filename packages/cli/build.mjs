// 打包 preapp CLI 为单文件可执行（dist/preapp.js）。
// banner 注入：① shebang（放第一行）② createRequire —— 让被打包的 CJS 依赖（yazl）里的
// require('fs') 能解析（esbuild 的 __require 助手会优先使用作用域内已定义的 require）。
import { build } from "esbuild";
import { chmodSync } from "node:fs";

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "dist/preapp.js",
  banner: {
    js: [
      "#!/usr/bin/env node",
      'import { createRequire as __preappCreateRequire } from "node:module";',
      "const require = __preappCreateRequire(import.meta.url);",
    ].join("\n"),
  },
});

chmodSync("dist/preapp.js", 0o755);
console.log("built dist/preapp.js");
