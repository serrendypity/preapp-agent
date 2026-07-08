// 极简 argv 解析（不引入 CLI 框架）。已知取值 flag 消费下一个 token；其余为布尔。

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | true>;
}

/** 取值 flag 白名单：这些 flag 后面跟一个值；不在表内的 --x 视为布尔开关。 */
const VALUE_FLAGS = new Set([
  "title",
  "deck",
  "description",
  "entry",
  "change-note",
  "anchors",
  "feedback-mode",
  "format",
  "token",
  "base-url",
  "url",
  "version",
  "harness",
  "dir",
]);

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!;
    if (!tok.startsWith("--")) {
      positionals.push(tok);
      continue;
    }
    const body = tok.slice(2);
    const eq = body.indexOf("=");
    if (eq >= 0) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    if (VALUE_FLAGS.has(body)) {
      const next = argv[i + 1];
      if (next === undefined) {
        flags[body] = true; // 缺值：留给命令层报错
      } else {
        flags[body] = next;
        i++;
      }
    } else {
      flags[body] = true;
    }
  }
  return { positionals, flags };
}

/** 取字符串 flag；布尔 true（--flag 无值）视为缺失。 */
export function flagValue(flags: ParsedArgs["flags"], name: string): string | undefined {
  const v = flags[name];
  return typeof v === "string" ? v : undefined;
}
