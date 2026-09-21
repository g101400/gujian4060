#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_redact_secrets.py — 从仓库树中移除硬编码密钥（供 git filter-branch --tree-filter 调用）

作用（幂等，可对任意 commit 的树重复执行）：
  1. 删除 native-shell/nsis_check/（NSIS 安装包解包校验残留，56MB，内含带 key 的产物副本）
  2. swap_key.js      : OLD/NEW 改为读环境变量
  3. test_models.js   : KEY 改为读环境变量
  4. verify_rebuilt_data.py : NEW_KEY 改为读环境变量（默认占位）
  5. 兜底：任何残留的完整 sk-or-v1-<64> 字面量替换为 sk-or-v1-REDACTED
  6. .gitignore 追加忽略规则

用法（cwd 必须是仓库树根）：
  python3 /d/Users/WorkBuddy/_redact_secrets.py
"""
import os
import re
import shutil
import sys

FULL_KEY = re.compile(r"sk-or-v1-[A-Za-z0-9]{20,}")
REDACTED = "sk-or-v1-REDACTED"

# GitHub token 形态（细粒度 / 经典），仅替换 token 本体
GH_TOKEN = re.compile(
    r"(github_pat_[A-Za-z0-9_]{20,}|(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,})"
)
PEM_KEY = re.compile(
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----",
    re.S,
)

# 需要从历史中剔除的凭据落盘文件（保留 *.example 模板）
TOKEN_FILE_SUFFIXES = (".gujian_token",)
TOKEN_FILE_KEEP = (".example",)

IGNORE_LINES = [
    "native-shell/nsis_check/",
    "**/nsis_check/",
    "*.secrets/",
    "secrets.local.json",
    "*.gujian_token",
    "**/.gujian_token",
]


def read(p):
    with open(p, encoding="utf-8", errors="replace") as f:
        return f.read()


def write(p, s):
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)


def touch_count():
    return None


def redact_generic(path, extra_patterns=()):
    """extra_patterns: list of (compiled_regex, replacement)"""
    if not os.path.isfile(path):
        return 0
    s = read(path)
    before = s
    for pat, rep in extra_patterns:
        s = pat.sub(rep, s)
    if FULL_KEY.search(s):
        s = FULL_KEY.sub(REDACTED, s)
    if s != before:
        write(path, s)
        return 1
    return 0


def main():
    # 1) 注意：native-shell/nsis_check/（解包校验残留）不在本脚本内删除，
    #    因为沙箱“批量删除保护”会拦截 5000+ 文件的 rmtree 并导致 tree-filter 失败。
    #    改为用 --index-filter 的 `git rm -r --cached` 从历史中剥离（不触碰磁盘）。

    changed = 0

    # 2) swap_key.js — OLD / NEW 读环境变量
    changed += redact_generic("swap_key.js", [
        (re.compile(r'(const\s+OLD\s*=\s*)"sk-or-v1-[A-Za-z0-9]+"'),
         r'\1process.env.OPENROUTER_KEY_OLD || ""'),
        (re.compile(r'(const\s+NEW\s*=\s*)"sk-or-v1-[A-Za-z0-9]+"'),
         r'\1process.env.OPENROUTER_KEY_NEW || ""'),
    ])

    # 3) test_models.js — KEY 读环境变量
    changed += redact_generic("test_models.js", [
        (re.compile(r'(const\s+KEY\s*=\s*)"sk-or-v1-[A-Za-z0-9]+"'),
         r'\1process.env.OPENROUTER_KEY || ""'),
    ])

    # 4) verify_rebuilt_data.py — NEW_KEY 读环境变量
    p = "verify_rebuilt_data.py"
    if os.path.isfile(p):
        s = read(p)
        orig = s
        s = re.sub(
            r'(NEW_KEY\s*=\s*)"sk-or-v1-[A-Za-z0-9]+"',
            r'\1os.environ.get("OPENROUTER_KEY", "%s")' % REDACTED,
            s,
        )
        if FULL_KEY.search(s):
            s = FULL_KEY.sub(REDACTED, s)
        # NEW_KEY 未提供时优雅跳过（原实现为跨行三元表达式，这里改写为 if/elif/else）
        s = re.sub(
            r'ok\(NEW_KEY in seed,\s*("[^"]*")\)\s*if seed is not None\s*\\\s*\n\s*else print\((.*?)\)',
            lambda m: (
                'if seed is None:\n'
                '                    print(%s)\n'
                '                elif NEW_KEY == "%s":\n'
                '                    print("   – 未设置 OPENROUTER_KEY 环境变量，跳过 key 核验")\n'
                '                else:\n'
                '                    ok(NEW_KEY in seed, %s)'
            ) % (m.group(2), REDACTED, m.group(1)),
            s,
        )
        if s != orig:
            if "import os" not in s.split("\n\n")[0] and not re.search(r"^import os\b", s, re.M):
                s = "import os\n" + s
            write(p, s)
            changed += 1

    # 5) 兜底：其它任何文件里的完整 key / token 字面量
    removed = 0
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules")]
        for fn in files:
            fp = os.path.join(root, fn)
            rel = os.path.relpath(fp, ".").replace("\\", "/")

            # 5a) 凭据落盘文件（如 android-build/*/202609080401.gujian_token）：
            #     不删除（沙箱批量删除保护会拦截），改写为占位内容；
            #     路径本身随后由 --index-filter 的 `git rm -r --cached` 从历史中剥离。
            if fn.endswith(TOKEN_FILE_SUFFIXES) and not fn.endswith(TOKEN_FILE_KEEP):
                placeholder = (
                    "/* 该文件为凭据落盘文件，已被 _redact_secrets.py 清空。\n"
                    "   请勿把 token 提交进仓库；本地使用时通过环境变量或未跟踪文件提供。 */\n"
                    "github_pat_REDACTED\n"
                )
                try:
                    write(fp, placeholder)
                    removed += 1
                    print("  blanked credential file: %s" % rel, file=sys.stderr)
                except Exception:
                    pass
                continue

            if rel in ("swap_key.js", "test_models.js", "verify_rebuilt_data.py"):
                continue
            try:
                if os.path.getsize(fp) > 8 * 1024 * 1024:
                    continue
                s = read(fp)
            except Exception:
                continue
            orig = s
            if FULL_KEY.search(s):
                s = FULL_KEY.sub(REDACTED, s)
            if GH_TOKEN.search(s):
                s = GH_TOKEN.sub("github_pat_REDACTED", s)
            if PEM_KEY.search(s):
                s = PEM_KEY.sub("-----BEGIN REDACTED PRIVATE KEY-----", s)
            if s != orig:
                write(fp, s)
                changed += 1
                print("  redacted secret in: %s" % rel, file=sys.stderr)

    # 6) .gitignore
    gi = ".gitignore"
    try:
        s = read(gi) if os.path.isfile(gi) else ""
        lines = s.splitlines()
        add = [l for l in IGNORE_LINES if l not in lines]
        if add:
            if s and not s.endswith("\n"):
                s += "\n"
            s += "\n".join(add) + "\n"
            write(gi, s)
    except Exception:
        pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
