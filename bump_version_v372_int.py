#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bump_version_v372_int.py — 三端同批（内部）提升：
    shuili 3.70 -> 3.72   (code 70 -> 72)
    perc   1.48 -> 1.48   (重出：新增内置水工建筑物底图种子，版本号不变)
    gujian 3.7.10 -> 3.7.11 (code 38 -> 39)
构建日期 2026-09-11。

流程：
  ① bump canonical app.js(APP_VERSION/APP_BUILD_DATE) + version.json（perc 只更新 desc / buildDate）
  ② bump make_deb.py / gen_win_msi_wix7.py / build_win_exe_nsis.py / make_secure_internal_pwa.py 版本串
  ③ sync_all_mirrors.py + --check（镜像一致性 + 跨产品公共模块门禁）
  ④ propagate_ai_seed.py（ai_seed 被 sync 排除，手动传播真实密钥）
"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = "D:/Users/Claw"
NEW_BUILD_DATE = "2026-09-11"
ARCHIVE_OLD = "测试包_20260911_v8_int"
ARCHIVE_NEW = "测试包_20260911_v9_int"
BACKUP_DIR = os.path.join(ROOT, "backup_2026-09-11_before_v372")

SHUILI_DESC = ("v3.72 内部版（与感知 v1.48 / 古建 v3.7.11 同批）：本轮为三端同批重出，"
               "水利功能与 v3.70 完全一致（未改代码）；同批感知新增「内置水工建筑物底图种子」。")
PERC_DESC = ("v1.48 内部版（重出，与水利 v3.72 / 古建 v3.7.11 同批）：新增内置「水工建筑物底图种子」"
             "water_data.js（557 条水工建筑物，首启自动播种进建筑物层、可一键「重新播种」恢复），"
             "菜单/数据层面板同步补齐；其余功能与 v1.48 一致。")
GUJIAN_DESC = ("v3.7.11（与水利 v3.72 / 感知 v1.48 同批）：本轮为三端同批重出，"
               "古建功能与 v3.7.10 完全一致（未改代码）。")

PRODUCTS = {
    "shuili": dict(
        old_ver="3.70", new_ver="3.72", old_code=70, new_code=72,
        canonical_assets=os.path.join(ROOT, "android-build/shuili-v329/assets"),
        deb_old="3.70.20260911", deb_new="3.72.20260911",
        msi_old="3.70.0", msi_new="3.72.0", msi_app_old="3.70", msi_app_new="3.72",
        nsis_old="3.70.0", nsis_new="3.72.0", nsis4_old="3.70.0.0", nsis4_new="3.72.0.0",
        ios_old="3.70_20260911", ios_new="3.72_20260911",
        desc=SHUILI_DESC, bump_ver=True,
    ),
    "perc": dict(
        old_ver="1.48", new_ver="1.48", old_code=48, new_code=48,
        canonical_assets=os.path.join(ROOT, "android-build/perc-v13/assets"),
        deb_old=None, deb_new=None,
        msi_old=None, msi_new=None, msi_app_old=None, msi_app_new=None,
        nsis_old=None, nsis_new=None, nsis4_old=None, nsis4_new=None,
        ios_old=None, ios_new=None,
        desc=PERC_DESC, bump_ver=False,   # 版本号保持 1.48，仅重出 + 更新 desc
    ),
    "gujian": dict(
        old_ver="3.7.10", new_ver="3.7.11", old_code=38, new_code=39,
        canonical_assets=os.path.join(ROOT, "android-build/gujian-v31/assets"),
        deb_old="3.7.10.20260911", deb_new="3.7.11.20260911",
        msi_old="3.7.10.0", msi_new="3.7.11.0", msi_app_old="3.7.10", msi_app_new="3.7.11",
        nsis_old="3.7.10.0", nsis_new="3.7.11.0", nsis4_old="3.7.10.0.0", nsis4_new="3.7.11.0.0",
        ios_old="3.7.10_20260911", ios_new="3.7.11_20260911",
        desc=GUJIAN_DESC, bump_ver=True,
    ),
}


def backup(path):
    if not os.path.exists(path):
        return
    dst = os.path.join(BACKUP_DIR, os.path.relpath(path, ROOT))
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(path, dst)


def patch_appjs(path, p):
    backup(path)
    t = pathlib.Path(path).read_text(encoding="utf-8")
    t2, n = re.subn(r'(var APP_VERSION = ")[^"]*(";)', r'\g<1>%s\g<2>' % p["new_ver"], t, count=1)
    assert n == 1, "%s: APP_VERSION 未命中" % path
    t2, n2 = re.subn(r'(var APP_BUILD_DATE = ")[^"]*(")', r'\g<1>%s\g<2>' % NEW_BUILD_DATE, t2, count=1)
    if n2 == 0:
        print("⚠️ %s: APP_BUILD_DATE 未命中，保留原值" % path)
    pathlib.Path(path).write_text(t2, encoding="utf-8")


def patch_versionjson(path, p):
    backup(path)
    d = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    cur = str(d["version"]).lstrip("v")
    if cur != p["old_ver"] and cur != p["new_ver"]:
        print("❌ %s: version=%s 期望 %s，阻断" % (path, d["version"], p["old_ver"]))
        sys.exit(1)
    if p["bump_ver"]:
        d["version"] = p["new_ver"]
        d["versionCode"] = p["new_code"]
    d["buildDate"] = NEW_BUILD_DATE
    desc = d.get("desc", "")
    d["desc"] = desc.rstrip() + "\n\n" + ("v%s：%s" % (p["new_ver"], p["desc"]))
    pathlib.Path(path).write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_build_script(path, repls):
    if not os.path.exists(path):
        print("⚠️ %s 不存在，跳过" % path)
        return
    backup(path)
    t = pathlib.Path(path).read_text(encoding="utf-8")
    applied = 0
    for a, b in repls:
        if a in t:
            t = t.replace(a, b)
            applied += 1
        else:
            print("   ⚠️ 跳过：%s 中无 %r" % (os.path.basename(path), a))
    pathlib.Path(path).write_text(t, encoding="utf-8")
    print("   %s: %d/%d 处已更新" % (os.path.basename(path), applied, len(repls)))


def main():
    print("🔧 bump_version_v372_int — 三端同批（内部），构建日期 %s" % NEW_BUILD_DATE)
    os.makedirs(BACKUP_DIR, exist_ok=True)

    for key, p in PRODUCTS.items():
        patch_versionjson(os.path.join(p["canonical_assets"], "version.json"), p)
        patch_appjs(os.path.join(p["canonical_assets"], "app.js"), p)
        print("✅ %-7s canonical -> v%s (code %d)%s" % (key, p["new_ver"], p["new_code"],
              "" if p["bump_ver"] else "  [重出，版本号不变]"))

    vals = [PRODUCTS[k] for k in ("shuili", "perc", "gujian")]

    deb_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    deb_repls += [('"ver": "%s"' % p["deb_old"], '"ver": "%s"' % p["deb_new"]) for p in vals if p["deb_old"]]
    patch_build_script(os.path.join(ROOT, "native-shell/make_deb.py"), deb_repls)

    msi_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    msi_repls += [('"ver":"%s"' % p["msi_old"], '"ver":"%s"' % p["msi_new"]) for p in vals if p["msi_old"]]
    msi_repls += [('"appver":"%s"' % p["msi_app_old"], '"appver":"%s"' % p["msi_app_new"]) for p in vals if p["msi_app_old"]]
    patch_build_script(os.path.join(ROOT, "native-shell/gen_win_msi_wix7.py"), msi_repls)

    nsis_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    nsis_repls += [('"ver": "%s"' % p["nsis_old"], '"ver": "%s"' % p["nsis_new"]) for p in vals if p["nsis_old"]]
    nsis_repls += [('"ver4": "%s"' % p["nsis4_old"], '"ver4": "%s"' % p["nsis4_new"]) for p in vals if p["nsis4_old"]]
    patch_build_script(os.path.join(ROOT, "native-shell/build_win_exe_nsis.py"), nsis_repls)

    ios_repls = [(p["ios_old"], p["ios_new"]) for p in vals if p["ios_old"]]
    patch_build_script(os.path.join(ROOT, "native-shell/water-ios/make_secure_internal_pwa.py"), ios_repls)

    print("🔒 卡口：sync_all_mirrors.py ...")
    subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py")])
    if subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py"), "--check"]).returncode != 0:
        print("❌ 镜像一致性门禁未通过，阻断出包")
        sys.exit(1)

    print("🔒 真实 ai_seed 手动传播（shuili/perc）...")
    for prod in ("shuili", "perc"):
        if subprocess.run([sys.executable, os.path.join(ROOT, "propagate_ai_seed.py"), prod]).returncode != 0:
            print("❌ propagate_ai_seed %s 失败，阻断出包" % prod)
            sys.exit(1)

    print("📦 回退备份目录: %s" % BACKUP_DIR)
    print("✅ bump_version_v372_int 完成。下一步：四端出包（内部版）。")


if __name__ == "__main__":
    main()
