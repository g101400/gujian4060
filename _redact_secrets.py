#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_redact_secrets.py — 从仓库树中移除硬编码密钥（供 git filter-branch --tree-filter 调用）

作用（幂等，可对任意 commit 的树重复执行）：
  1. swap_key.js      : OLD/NEW 改为读环境变量
  2. test_models.js   : KEY 改为读环境变量
  3. verify_rebuilt_data.py : NEW_KEY 改为先读 CLI/env，再读本地 .secrets/，都没有则跳过校验
  4. 其它 .py：内部加密 PWA 口令 SEC_PASS 的**硬编码默认值** → 改为
     「环境变量 → 同目录 .sec_pass → 缺失则 FATAL 退出」（项目规范）
  5. 兜底：任何残留的完整 sk-or-v1-<64> / github_pat_* / PEM 私钥 → REDACTED
  6. 凭据落盘文件（*.gujian_token，非 .example）→ 原地清空为占位内容
  7. .gitignore 追加忽略规则（含 *.sec_pass / .secrets/）

注：`.sec_pass`（本地口令文件）本脚本**不清空内容**（会破坏本地构建），
    只把它加进 .gitignore；若它已被入库，用 index-filter 从历史剥离：
      git filter-branch -f --index-filter \
        'git rm --cached --ignore-unmatch -q native-shell/water-ios/.sec_pass' -- main

安全边界（重要）：
  默认**只处理 git 已跟踪的文件**。因为仓库里常有一份未跟踪的**本地凭据文件**
  （如 android-build/*/.gujian_token，推送脚本真正在用的那份）：
  它本来就不会进仓，清空它只会把本地构建/推送脚本搞坏。用 --all 才处理全部文件
  （仅在非 git 目录、或明确知道无本地凭据文件时使用）。

注：从历史中「移除文件」不在本脚本内做（沙箱批量删除保护会拦截 rmtree）。
    请用 `git filter-branch --index-filter 'git rm -r --cached --ignore-unmatch <path>'`。

用法（cwd 必须是仓库树根）：
  python3 _redact_secrets.py            # 只清洗已跟踪文件（推荐）
  python3 _redact_secrets.py --all      # 清洗所有文件（含未跟踪）
  python3 _redact_secrets.py --dry-run  # 只报告，不改动
"""
import os
import re
import subprocess
import sys

TRACKED_ONLY = True
DRY_RUN = False

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

# 内部加密 PWA 口令：源码里不得出现默认值（必须走 env / 本地 .sec_pass）
# 注意：下面的正则不能在「本文件自身」里命中，否则会把文档示例当代码替换（已踩过）。
SEC_PASS_DEFAULT = re.compile(
    r'os\.environ\.get\(\s*(["\'])SEC_PASS\1\s*,\s*(["\'])[^"\']+\2\s*\)'
)
# 合规写法：环境变量 → 同目录 .sec_pass → 都没有则 FATAL 退出
SEC_PASS_OK = (
    '(os.environ.get("SEC_PASS")\n'
    '           or (open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".sec_pass"),\n'
    '                    encoding="utf-8").read().strip()\n'
    '               if os.path.isfile(os.path.join(os.path.dirname(os.path.abspath(__file__)),'
    ' ".sec_pass")) else ""))'
)
SEC_PASS_FATAL = (
    "\nif not PASS:\n"
    "    sys.exit(\"[FATAL] 未提供内部口令：请设置环境变量 SEC_PASS，"
    "或在脚本同目录创建 .sec_pass 文件。\")\n"
)
SELF = "_redact_secrets.py"

IGNORE_LINES = [
    "native-shell/nsis_check/",
    "**/nsis_check/",
    ".secrets/",
    "**/.secrets/",
    "secrets.local.json",
    "*.gujian_token",
    "**/.gujian_token",
    ".sec_pass",
    "**/.sec_pass",
    "*.sec_pass",
]


def read(p):
    with open(p, encoding="utf-8", errors="replace") as f:
        return f.read()


def write(p, s):
    if DRY_RUN:
        print("  [dry-run] 将改写: %s" % p, file=sys.stderr)
        return
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)


def tracked_paths():
    """返回 git 已跟踪文件集合（POSIX 相对路径）；非 git 仓库返回 None。"""
    try:
        r = subprocess.run(
            ["git", "ls-files", "-z"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=True,
        )
    except Exception:
        return None
    out = r.stdout.decode("utf-8", "replace")
    return set(p.replace("\\", "/") for p in out.split("\0") if p)


_TRACKED = None


def is_target(rel):
    """当前模式是否应该处理该相对路径。"""
    if not TRACKED_ONLY or _TRACKED is None:
        return True
    return rel in _TRACKED


def redact_generic(path, extra_patterns=()):
    """extra_patterns: list of (compiled_regex, replacement)"""
    if not os.path.isfile(path):
        return 0
    if not is_target(path.replace("\\", "/")):
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
    global _TRACKED
    # 0) 默认只处理 git 已跟踪文件：仓库里常有一份**未跟踪的本地凭据文件**
    #    （android-build/*/.gujian_token），清空它只会把本地推送/构建脚本搞坏。
    if TRACKED_ONLY:
        _TRACKED = tracked_paths()
        if _TRACKED is None:
            print("  ! 当前不是 git 仓库：改为处理全部文件", file=sys.stderr)
        else:
            print("  tracked-only：git 跟踪 %d 个文件" % len(_TRACKED), file=sys.stderr)

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

    # 4) verify_rebuilt_data.py — NEW_KEY 改为：CLI/env → 本地 .secrets/ → 跳过
    p = "verify_rebuilt_data.py"
    if os.path.isfile(p) and is_target(p):
        s = read(p)
        orig = s
        s = re.sub(
            r'(NEW_KEY\s*=\s*)(?:"sk-or-v1-[A-Za-z0-9]+"'
            r'|os\.environ\.get\("OPENROUTER_KEY",\s*"sk-or-v1-REDACTED"\))',
            r'\1(os.environ.get("OPENROUTER_KEY")\n'
            r'           or (open(os.path.join(ROOT, ".secrets", "openrouter.key"), encoding="utf-8").read().strip()\n'
            r'               if os.path.isfile(os.path.join(ROOT, ".secrets", "openrouter.key")) else "")\n'
            r'           or "sk-or-v1-REDACTED")',
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
                '                    print("   – 未提供 key（OPENROUTER_KEY 或 .secrets/openrouter.key），跳过 key 核验")\n'
                '                else:\n'
                '                    ok(NEW_KEY in seed, %s)'
            ) % (m.group(2), REDACTED, m.group(1)),
            s,
        )
        if s != orig:
            if not re.search(r"^import os\b", s, re.M):
                s = "import os\n" + s
            write(p, s)
            changed += 1

    # 4b) 内部加密 PWA 口令（.sec_pass）不得以默认值形式写在源码里。
    #     项目规范：环境变量 SEC_PASS → 同目录本地 .sec_pass → 缺失则 FATAL。
    #     老版本脚本曾把 4 位口令写成环境变量取值的默认参数，等于随源码公开口令。
    targets = sorted(_TRACKED) if _TRACKED else None
    if targets is None:
        targets = []
        for root, dirs, files in os.walk("."):
            dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "__pycache__")]
            for fn in files:
                if fn.endswith(".py"):
                    targets.append(os.path.relpath(os.path.join(root, fn), ".")
                                   .replace("\\", "/"))
    for rel in targets:
        if rel.endswith("/" + SELF) or rel == SELF:
            continue  # 本文件是清洗工具本身，跳过（防自匹配）
        if not rel.endswith(".py") or not os.path.isfile(rel):
            continue
        s = read(rel)
        if not SEC_PASS_DEFAULT.search(s):
            continue
        s2 = SEC_PASS_DEFAULT.sub(lambda _m: SEC_PASS_OK, s)
        if "FATAL" not in s2:
            s2 = s2.replace("PASS = " + SEC_PASS_OK,
                            "PASS = " + SEC_PASS_OK + SEC_PASS_FATAL, 1)
        if s2 != s:
            write(rel, s2)
            changed += 1
            print("  scrubbed SEC_PASS default: %s" % rel, file=sys.stderr)

    # 5) 兜底：其它任何文件里的完整 key / token 字面量
    removed = 0
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules")]
        for fn in files:
            fp = os.path.join(root, fn)
            rel = os.path.relpath(fp, ".").replace("\\", "/")

            # 只处理 git 已跟踪的文件（见文件头「安全边界」）
            if not is_target(rel):
                continue

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
                # 占位串刻意不含 "BEGIN <...>PRIVATE KEY" 字面形态，
                # 否则后续用 grep 扫 PEM 私钥时本文件会自命中（误报）。
                s = PEM_KEY.sub("-----BEGIN-PRIVATE-KEY-REDACTED-----", s)
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
    args = set(sys.argv[1:])
    if "--all" in args:
        TRACKED_ONLY = False
    if "--dry-run" in args:
        DRY_RUN = True
    sys.exit(main())
