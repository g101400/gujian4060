# -*- coding: utf-8 -*-
"""sync_all_mirrors.py — 三产品 webroot 多副本统一对齐工具（防分叉复发，v2）

背景：
  水利一张图 / 水利感知 / 古建景点 三款 APP 的 webroot 各有多份副本（canonical
  app assets + 多端 webroot + 母版镜像）。历史上因 bump_version*.py 只同步「手挑的
  部分副本」，已分叉 6 次（v3.30.3/v3.31/v3.33/v3.38/v3.41/v3.45）。旧工具
  sync_shuili_mirror.py 只覆盖水利一个产品，感知/古建没有等价工具，导致
  win-webview2(perc) / win-gujian / uos-gujian 等源 webroot 长期落后于 canonical。

本工具把「完整 canonical → 全部镜像」映射固化在一处，一次跑齐三产品所有镜像：
  - 仅 add/update（绝不删除镜像里 canonical 没有的文件，例如各端自带的 leaflet 目录）
  - 自动备份镜像到 *_bak_vXX_<时间戳>
  - 逐镜像做 核心文件 md5 一致性 + node --check app.js 校验
  - 支持 --check（只校验不写盘）/ --dry（只报告不写盘）

铁律：每个产品的 canonical = 其 android app assets（version.json 为该产品唯一真相源）。
用法：
  python3 sync_all_mirrors.py            # 实际全量同步（先备份再复制）
  python3 sync_all_mirrors.py --dry       # 只报告会变更的文件
  python3 sync_all_mirrors.py --check     # 只校验一致性，退出码 0/1
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime

ROOT = "D:/Users/Claw"

# 完整 canonical -> 全部镜像 映射（含此前 bump 脚本漏掉的源 webroot）
PRODUCTS = {
    "shuili": dict(
        canonical=os.path.join(ROOT, "android-build", "shuili-v329", "assets"),
        mirrors=[
            "D:/Users/aowwei_app/webroot_shuili",
            os.path.join(ROOT, "android-build", "water-v329", "assets"),
            os.path.join(ROOT, "native-shell", "win-water-webview2", "webroot"),
            os.path.join(ROOT, "native-shell", "uos-water-pyqt6", "webroot"),
        ],
    ),
    "perc": dict(
        canonical=os.path.join(ROOT, "android-build", "perc-v13", "assets"),
        mirrors=[
            os.path.join(ROOT, "native-shell", "uos-pyqt6", "webroot"),
            os.path.join(ROOT, "native-shell", "win-webview2", "publish_win_perc", "webroot"),
            os.path.join(ROOT, "native-shell", "win-webview2", "webroot"),
        ],
    ),
    "gujian": dict(
        canonical=os.path.join(ROOT, "android-build", "gujian-v31", "assets"),
        mirrors=[
            os.path.join(ROOT, "native-shell", "win-gujian-webview2", "webroot"),
            os.path.join(ROOT, "native-shell", "uos-gujian-pyqt6", "webroot"),
        ],
    ),
}

# 排除：构建残留备份 / 个人密钥（密钥走环境变量纪律）
EXCLUDE_SUFFIX = (".bak", ".ctxbak", ".menu1bak")
EXCLUDE_NAMES = {"ai_seed.js"}
EXCLUDE_IF_CONTAINS = ("bak",)
CORE = ["version.json", "app.js", "index.html", "data.js",
        "ovobj_bridge.js", "ai_module.js", "ctx_menu.js"]


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
    DRY = "--dry" in sys.argv
    CHECK_ONLY = "--check" in sys.argv
    all_ok = True
    for pname, p in PRODUCTS.items():
        canon = p["canonical"]
        if not os.path.isdir(canon):
            print("❌ [%s] canonical 不存在: %s" % (pname, canon))
            all_ok = False
            continue
        cv, ccode = ver_of(canon)
        print("\n################ %s canonical = v%s (code %d) ################"
              % (pname, cv, ccode))
        for m in p["mirrors"]:
            if not os.path.isdir(m):
                print("  [skip] 镜像不存在: %s" % m)
                continue
            mv, mcode = ver_of(m)
            print("\n--- 镜像 %s (当前 v%s code %d) ---" % (m, mv, mcode))
            src_files = list_source_files(canon)
            changed, mism_core = [], []
            for rel in src_files:
                s = os.path.join(canon, rel)
                d = os.path.join(m, rel)
                sd = md5(s)
                dd = md5(d) if os.path.isfile(d) else None
                if sd != dd:
                    changed.append((rel, "新增" if dd is None else "更新"))
                if os.path.basename(rel) in CORE and sd != dd:
                    mism_core.append(rel)

            if CHECK_ONLY:
                if changed:
                    all_ok = False
                    print("  ⚠ 不一致 (%d 文件):" % len(changed))
                    for rel, act in changed:
                        print("     %-26s %s" % (rel, act))
                else:
                    print("  ✅ 与 canonical 一致")
                continue

            if not changed:
                print("  ✅ 已一致，无需同步")
                continue
            if DRY:
                print("  [dry] 将变更 %d 文件:" % len(changed))
                for rel, act in changed:
                    print("     %-26s %s" % (rel, act))
                continue

            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            bak = "%s_bak_v%s_%s" % (m.rstrip("/\\"), mv, ts)
            shutil.copytree(m, bak)
            print("  💾 备份 -> %s" % bak)

            for rel in src_files:
                s = os.path.join(canon, rel)
                d = os.path.join(m, rel)
                if os.path.dirname(rel) != "":
                    os.makedirs(os.path.join(m, os.path.dirname(rel)), exist_ok=True)
                shutil.copy2(s, d)

            nv, ncode = ver_of(m)
            print("  ✅ 已同步到 v%s (code %d)，变更 %d 文件" % (nv, ncode, len(changed)))

            bad = []
            for rel in CORE:
                s = os.path.join(canon, rel)
                d = os.path.join(m, rel)
                if os.path.isfile(s) and os.path.isfile(d) and md5(s) != md5(d):
                    bad.append(rel)
            if bad:
                all_ok = False
                print("  ❌ 核心文件 md5 不一致: %s" % bad)
            else:
                print("  ✅ 核心文件 md5 全一致")

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

    print("\n==== 总结 ====")
    if all_ok:
        print("✅ 全部镜像与 canonical 一致")
        sys.exit(0)
    else:
        print("⚠ 存在不一致（见上）")
        sys.exit(1)


if __name__ == "__main__":
    main()
