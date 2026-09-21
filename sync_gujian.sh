#!/usr/bin/env bash
# 古建代码定时同步：本地有改动则提交并推送到 GitHub。
# 依赖：仓库已配置 credential helper（从 D:/Users/WorkBuddy/.github_token 读取），密钥经 .gitignore 永不入库。
set -u
cd "$(dirname "$0")" || exit 1
[ -d .git ] || { echo "$(date) 不在 git 仓库内，跳过"; exit 1; }
git add -A
if git diff --cached --quiet; then
  echo "$(date) 无本地改动，跳过"
  exit 0
fi
MSG="sync: $(date '+%Y-%m-%d %H:%M') 自动同步本地改动"
git commit -q -m "$MSG" && echo "$(date) 已提交: $MSG"
git push origin main 2>&1 | tail -5
echo "$(date) 同步完成"
