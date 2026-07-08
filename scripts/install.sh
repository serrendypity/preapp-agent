#!/bin/sh
# PreApp 一键安装：下载 preapp CLI、写 baseUrl、安装 skill —— 所有 harness 同一条命令（不含 token）。
# 用法：curl -fsSL <origin>/install.sh | sh -s -- --harness <claude-code|codex|openclaw|hermes> [--token <pa_live_...>] [--url <origin>]
set -e

DEFAULT_URL="https://preapp.app"
HARNESS=""
TOKEN=""
URL=""

while [ $# -gt 0 ]; do
  case "$1" in
    --harness) HARNESS="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    --url) URL="$2"; shift 2 ;;
    -h|--help)
      echo "用法：curl -fsSL <origin>/install.sh | sh -s -- --harness <claude-code|codex|openclaw|hermes> [--token <pa_live_...>] [--url <origin>]"
      exit 0 ;;
    *) echo "preapp install：未知参数 $1" >&2; exit 2 ;;
  esac
done

[ -n "$URL" ] || URL="$DEFAULT_URL"

if ! command -v node >/dev/null 2>&1; then
  echo "preapp install：需要 Node >= 20，但 PATH 中找不到 node。请先安装 Node（https://nodejs.org）后重试。" >&2
  exit 1
fi

BIN_DIR="$HOME/.preapp/bin"
mkdir -p "$BIN_DIR"

echo "-> 下载 preapp CLI  <-  $URL/cli/preapp.js"
curl -fsSL "$URL/cli/preapp.js" -o "$BIN_DIR/preapp"
chmod +x "$BIN_DIR/preapp"

# 上 PATH：优先软链到首个可写的标准 bin 目录；软链后仍不在 PATH 则改 shell rc。
LINK_PATH=""
for d in /usr/local/bin /opt/homebrew/bin "$HOME/.local/bin"; do
  if [ -d "$d" ] && [ -w "$d" ]; then
    if ln -sf "$BIN_DIR/preapp" "$d/preapp" 2>/dev/null; then
      LINK_PATH="$d/preapp"
      break
    fi
  fi
done

REOPEN=0
RC=""
if command -v preapp >/dev/null 2>&1; then
  :
else
  case "$SHELL" in
    *zsh) RC="$HOME/.zshrc" ;;
    *) RC="$HOME/.bashrc" ;;
  esac
  if [ ! -f "$RC" ] || ! grep -qF ".preapp/bin" "$RC" 2>/dev/null; then
    printf '\n# preapp CLI\nexport PATH="$HOME/.preapp/bin:$PATH"\n' >> "$RC"
  fi
  REOPEN=1
fi

# 写 config（0600）：始终写 baseUrl（装完 preapp login 即可直接用）；token 有则一并写。
# subshell 内 umask 077 避免创建瞬间的宽权限窗口。
CONFIG="$HOME/.preapp/config.json"
if [ -n "$TOKEN" ]; then
  ( umask 077; printf '{"token":"%s","baseUrl":"%s"}\n' "$TOKEN" "$URL" > "$CONFIG" )
else
  ( umask 077; printf '{"baseUrl":"%s"}\n' "$URL" > "$CONFIG" )
fi
chmod 600 "$CONFIG"

# 装 skill：用刚下载的 CLI（不依赖 PATH 是否已生效）。
if [ -n "$HARNESS" ]; then
  "$BIN_DIR/preapp" skill install --harness "$HARNESS" --force
fi

echo ""
echo "OK preapp 已安装：$BIN_DIR/preapp"
if [ -n "$LINK_PATH" ]; then echo "   已链接：$LINK_PATH"; fi
echo "   baseUrl：$URL"
if [ -n "$TOKEN" ]; then
  echo "   凭证：已写入 ~/.preapp/config.json"
else
  echo "   凭证：未配置 token —— 到 $URL/dashboard 生成 agent token 后运行：preapp login <token>"
fi
if [ -n "$HARNESS" ]; then echo "   skill：已为 $HARNESS 安装"; fi
if [ "$REOPEN" = "1" ]; then
  echo ""
  echo "!! 已把 ~/.preapp/bin 加入 shell 配置（$RC）——请重开终端，或运行：source $RC"
fi
if [ -n "$HARNESS" ]; then
  echo ""
  echo "提示：重开你的 agent 会话，让它加载新 skill。"
fi
echo ""
echo "试试：preapp --help"
