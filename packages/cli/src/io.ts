// 命令执行环境（依赖注入，便于测试用假 io + in-process server）。

export interface Io {
  /** 子命令之后的参数（不含 node/bin/subcommand）。 */
  argv: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
  homeDir: string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

/** 退出码约定：0 成功；1 服务端/网络失败；2 用法或配置错误。 */
export type ExitCode = 0 | 1 | 2;
