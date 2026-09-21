#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backup_claw.py — 三图工作区每日备份（失败即大声报错，根治「静默零文件」）

根因（T-040）：原备份指向外接 E: 盘，盘未挂载时脚本 ABORT、0 文件落盘，
且无任何告警，仅剩 C:/D: 本地副本，数据丢失风险长期潜伏。

本脚本设计原则：
  1. 目标盘不可达 → 立即回退到本机可达路径（D: 同工作区下的 _backup_live），不静默放弃；
  2. 任何步骤失败 → 退出码非 0 + 写 _backup_STATUS.json（含 error 字段），便于外部调度器告警；
  3. 备份后校验「文件数 > 0 且关键目录存在」，否则判为失败。

用法：
  python3 backup_claw.py                 # 默认：优先 E:，不可达回退 D:
  python3 backup_claw.py --target E:/    # 指定目标根
退出码：0=成功，非0=失败（外部调度器应据此发告警）
"""
import os, sys, json, shutil, argparse, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
NOW = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
STATUS_FILE = os.path.join(ROOT, "_backup_STATUS.json")

# 需备份的关键目录（相对 ROOT）；跳过巨型/备份自身
INCLUDE = [
    "APK归档",
    "android-build",
    "native-shell",
    "travel",
    "jingyin",
    "aowwei_app",
    "docs_perc",
    "docs_shuili_v3",
    "项目交接台账.md",
    "项目交接卡.md",
]
EXCLUDE_DIRS = {"backup_", "_backup", "node_modules", "__pycache__", ".git"}

# 根目录散落的构建/门禁/修复脚本也必须备份（2026-09-01 发现的缺口：
# bump_version_*.py / verify_*.py|js / fix_*.py / release_*.sh / sync_*.py 全部漏备份，
# 一旦误删就无法复现出包流水线，违反「代码备份与回退」约束）
ROOT_SCRIPT_EXTS = (".py", ".js", ".sh", ".ps1", ".bat", ".cmd", ".md", ".json")
ROOT_SCRIPTS_DIR = "_root_scripts"

def status(ok, msg, detail=None):
    payload = {"ok": ok, "time": NOW, "msg": msg, "detail": detail or {}}
    with open(STATUS_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(("✅" if ok else "❌") + " " + msg)
    sys.exit(0 if ok else 1)

def choose_target(preferred):
    # 优先 preferred；不可达则回退到本机 ROOT/_backup_live
    p = os.path.abspath(preferred)
    if os.path.isdir(p) and os.access(p, os.W_OK):
        return p, "preferred"
    live = os.path.join(ROOT, "_backup_live")
    os.makedirs(live, exist_ok=True)
    return live, "fallback(D:本地, 因首选不可达)"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", default="E:/")
    args = ap.parse_args()

    tgt_root, how = choose_target(args.target)
    dest = os.path.join(tgt_root, "Claw_backup_" + NOW)
    try:
        os.makedirs(dest, exist_ok=True)
    except Exception as e:
        status(False, "创建备份目录失败: %s" % e, {"target": tgt_root})

    copied = 0
    for item in INCLUDE:
        src = os.path.join(ROOT, item)
        if not os.path.exists(src):
            continue
        dst = os.path.join(dest, item)
        try:
            if os.path.isdir(src):
                shutil.copytree(src, dst, ignore=shutil.ignore_patterns(
                    *[d + "*" for d in EXCLUDE_DIRS]))
            else:
                shutil.copy2(src, dst)
            copied += 1
        except Exception as e:
            status(False, "备份 %s 失败: %s" % (item, e), {"target": tgt_root})

    # 根目录脚本（构建/门禁/修复/升版）单独收进 _root_scripts/
    scripts = 0
    sdir = os.path.join(dest, ROOT_SCRIPTS_DIR)
    try:
        os.makedirs(sdir, exist_ok=True)
        for fn in sorted(os.listdir(ROOT)):
            fp = os.path.join(ROOT, fn)
            if not os.path.isfile(fp):
                continue
            if fn.startswith("_backup_STATUS"):
                continue
            if fn.lower().endswith(ROOT_SCRIPT_EXTS):
                shutil.copy2(fp, os.path.join(sdir, fn))
                scripts += 1
    except Exception as e:
        status(False, "备份根目录脚本失败: %s" % e, {"target": tgt_root})

    # 校验：至少包含归档与源码，且根脚本非空
    have_archive = os.path.isdir(os.path.join(dest, "APK归档"))
    have_src = os.path.isdir(os.path.join(dest, "android-build"))
    if copied == 0 or not (have_archive and have_src) or scripts == 0:
        status(False, "备份疑似空（copied=%d, archive=%s, src=%s, scripts=%d）" % (
            copied, have_archive, have_src, scripts),
            {"target": tgt_root, "copied": copied, "scripts": scripts})

    status(True, "备份成功: %s 件 + 根脚本 %s 个 -> %s (%s)" % (copied, scripts, dest, how),
           {"target": tgt_root, "dest": dest, "copied": copied, "scripts": scripts})

if __name__ == "__main__":
    main()
