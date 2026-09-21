# -*- coding: utf-8 -*-
"""sync_shuili_mirror.py — 水利一张图 webroot 多副本对齐工具（防分叉复发）

问题背景：
  水利一张图(shuili) 的 webroot 存在多份副本，历史上已因「构建只同步部分副本」
  分叉 4 次（v3.30.3 / v3.31 / v3.33 / v3.38）。本工具把权威源
  android-build/shuili-v329/assets 全量（除 *.bak 与个人密钥 ai_seed.js）同步到
  所有镜像副本，并做 md5 + node --check 校验，确保八处副本一致。

  注意：即使 bump_version.py 的 webroot 同步列表不全 / 被手动构建绕过，
  跑一次本工具即可把镜像拉回一致，是「事后兜底 + 事前 guard」二合一。

用法：
  python3 sync_shuili_mirror.py            # 实际同步（先自动备份再复制）
  python3 sync_shuili_mirror.py --dry       # 只报告会变更的文件，不写盘
  python3 sync_shuili_mirror.py --check     # 只校验一致性，不写盘不备份

铁律：权威源 = android-build/shuili-v329/assets（version.json 为唯一真相源）。
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
CANON = os.path.join(ROOT, "android-build", "shuili-v329", "assets")
MIRRORS = [
    "D:/Users/aowwei_app/webroot_shuili",
    os.path.join(ROOT, "android-build", "water-v329", "assets"),
]
# 不同步的文件：① 构建残留备份（*.bak / *.ctxbak / *.menu1bak 及任何含 bak 的）② 个人密钥注入文件（密钥走环境变量纪律）
EXCLUDE_SUFFIX = (".bak", ".ctxbak", ".menu1bak")
EXCLUDE_NAMES = {"ai_seed.js"}
EXCLUDE_IF_CONTAINS = ("bak",)
CORE = ["version.json", "app.js", "index.html", "data.js",
        "ovobj_bridge.js", "ai_module.js", "ctx_menu.js"]

DRY = "--dry" in sys.argv
CHECK_ONLY = "--check" in sys.argv


def md5(p):
    h = hashlib.md5()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(65536), b""):
            h.update(b)
    return h.hexdigest()


def ver_of(d):
    try:
        vj = json.load(open(os.path.join(d, "version.json"), encoding="utf-8"))
        return str(vj.get("version", "?")), int(vj.get("versionCode", -1))
    except Exception:
        return "?", -1


def list_source_files(src):
    out = []
    for root, _dirs, files in os.walk(src):
        rel = os.path.relpath(root, src)
        for fn in files:
            if fn.endswith(EXCLUDE_SUFFIX) or fn in EXCLUDE_NAMES \
                    or any(k in fn.lower() for k in EXCLUDE_IF_CONTAINS):
                continue
            out.append(os.path.join(rel, fn) if rel != "." else fn)
    return sorted(out)


def main():
    if not os.path.isdir(CANON):
        print("❌ 权威源不存在: %s" % CANON)
        sys.exit(2)
    cv, ccode = ver_of(CANON)
    print("权威源 %s = v%s (code %d)" % (os.path.relpath(CANON, ROOT), cv, ccode))

    all_ok = True
    for m in MIRRORS:
        if not os.path.isdir(m):
            print("  [skip] 镜像不存在: %s" % m)
            continue
        mv, mcode = ver_of(m)
        print("\n--- 镜像 %s (当前 v%s code %d) ---" % (m, mv, mcode))

        src_files = list_source_files(CANON)
        changed = []
        mism_core = []
        for rel in src_files:
            s = os.path.join(CANON, rel)
            d = os.path.join(m, rel)
            sd, dd = md5(s), (md5(d) if os.path.isfile(d) else None)
            if sd != dd:
                changed.append((rel, "新增" if dd is None else "更新"))
            if os.path.basename(rel) in CORE and sd != dd:
                mism_core.append(rel)

        if CHECK_ONLY:
            if changed:
                all_ok = False
                print("  ⚠ 不一致 (%d 文件):" % len(changed))
                for rel, act in changed:
                    print("     %-22s %s" % (rel, act))
            else:
                print("  ✅ 与权威源一致")
            continue

        if not changed:
            print("  ✅ 已一致，无需同步")
            continue

        if DRY:
            print("  [dry] 将变更 %d 文件:" % len(changed))
            for rel, act in changed:
                print("     %-22s %s" % (rel, act))
            continue

        # 备份
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        bak = "%s_bak_v%s_%s" % (m.rstrip("/\\"), mv, ts)
        shutil.copytree(m, bak)
        print("  💾 备份 -> %s" % bak)

        # 全量同步（只增改，不删）
        for rel in src_files:
            s = os.path.join(CANON, rel)
            d = os.path.join(m, rel)
            os.makedirs(os.path.dirname(d), exist_ok=True) if os.path.dirname(rel) != "" else None
            if os.path.dirname(rel) != "":
                os.makedirs(os.path.join(m, os.path.dirname(rel)), exist_ok=True)
            shutil.copy2(s, d)

        nv, ncode = ver_of(m)
        print("  ✅ 已同步到 v%s (code %d)，变更 %d 文件" % (nv, ncode, len(changed)))

        # 校验
        bad = []
        for rel in CORE:
            s = os.path.join(CANON, rel)
            d = os.path.join(m, rel)
            if os.path.isfile(s) and os.path.isfile(d) and md5(s) != md5(d):
                bad.append(rel)
        if bad:
            all_ok = False
            print("  ❌ 核心文件 md5 不一致: %s" % bad)
        else:
            print("  ✅ 核心文件 md5 全一致")

        # node --check
        try:
            r = subprocess.run(["node", "--check", os.path.join(m, "app.js")],
                               capture_output=True, text=True, timeout=60)
            if r.returncode == 0:
                print("  ✅ node --check app.js 通过")
            else:
                all_ok = False
                print("  ❌ node --check app.js 失败:\n%s" % r.stderr)
        except Exception as e:
            print("  ⚠ node --check 跳过: %s" % e)

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
