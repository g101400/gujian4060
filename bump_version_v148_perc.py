#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bump_version_v148_perc.py — 感知 App 单独提版：1.46 -> 1.48（内部偶数版），构建日期 2026-09-11

本轮改动（仅感知 App，水利/古建不动）：
  §8 感知 App 集成「水工建筑物数据层」——
  ① 双库双 key：感知设备 perc_map_v2（沿用）/ 水工建筑物 perc_water_v2（新增），
     作用域视图 BUILDINGS 默认=device，原有 117 处引用零行为变更。
  ② 6 处写操作改按归属路由（addRec / removeIds / importTargetStore），
     导入水工建筑物只写建筑物层，绝不触碰/覆盖设备库。
  ③ 新增菜单组「水工建筑物层」：导入水工建筑物 / 导出水工建筑物 / 数据层切换 /
     跨层周边查询 / 新增建筑物·地点 / 清空建筑物层。
  ④ 筛选面板 + 顶部「数据层」按钮（感知设备 / 水工建筑物 / 全部）。
  ⑤ 地图分层：建筑物层灰色 ▣ 图标并置底（zIndexOffset -1000）。
  ⑥ 跨层自然语言周边问答（建筑物 ↔ 设备，双向，本地算完出结论，无坐标走同管理单位口径）。
  ⑦ 建筑详情/编辑/新增（含照片）沿用既有表单，写入只落建筑物层。

流程：canonical app.js/version.json → 构建脚本版本串（仅 perc）→ sync_all_mirrors → --check → propagate_ai_seed perc
"""
import json, re, os, shutil, pathlib, sys, subprocess

ROOT = "D:/Users/Claw"
NEW_BUILD_DATE = "2026-09-11"
ARCHIVE_OLD = "测试包_20260911_v7_int"
ARCHIVE_NEW = "测试包_20260911_v8_int"
BACKUP_DIR = os.path.join(ROOT, "backup_2026-09-11_before_v148_perc_wbuilds")

CANON = os.path.join(ROOT, "android-build/perc-v13/assets")
OLD_VER, NEW_VER = "1.46", "1.48"
OLD_CODE, NEW_CODE = 46, 48
DESC = ("v1.48 内部版：感知 App 集成「水工建筑物数据层」——双库双 key（设备 perc_map_v2 / 建筑物 perc_water_v2），"
        "默认作用域=感知设备（原功能零变更）；新增「水工建筑物层」菜单组（导入/导出水工建筑物、数据层切换、"
        "跨层周边查询、新增建筑物·地点、清空建筑物层）；筛选面板与顶部新增数据层开关；地图分层"
        "（建筑物灰色置底）；跨层自然语言周边问答（建筑物↔设备，双向，本地计算）；建筑物可查看/修改/新增含照片。"
        "水利 v3.70 / 古建 v3.7.10 本轮不动。")


def backup(path):
    if not os.path.exists(path):
        return
    dst = os.path.join(BACKUP_DIR, os.path.relpath(path, ROOT))
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(path, dst)


def patch_appjs(path):
    backup(path)
    p = pathlib.Path(path)
    t = p.read_text(encoding="utf-8")
    t2, n = re.subn(r'(var APP_VERSION = ")[^"]*(";)', lambda m: m.group(1) + NEW_VER + m.group(2), t, count=1)
    assert n == 1, "%s: APP_VERSION 未命中" % path
    t2, n2 = re.subn(r'(var APP_BUILD_DATE = ")[^"]*(")', lambda m: m.group(1) + NEW_BUILD_DATE + m.group(2), t2, count=1)
    assert n2 == 1, "%s: APP_BUILD_DATE 未命中" % path
    p.write_text(t2, encoding="utf-8")


def patch_versionjson(path):
    backup(path)
    p = pathlib.Path(path)
    d = json.loads(p.read_text(encoding="utf-8"))
    cur = str(d["version"]).lstrip("v")
    if cur == NEW_VER:
        print("   ⏭️ version.json 已是 v%s，跳过" % NEW_VER)
        return
    assert cur == OLD_VER, "%s: version=%s 期望 %s" % (path, d["version"], OLD_VER)
    d["version"] = NEW_VER
    d["versionCode"] = NEW_CODE
    d["buildDate"] = NEW_BUILD_DATE
    d["desc"] = d.get("desc", "").rstrip() + "\n\n" + DESC
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_script(path, repls):
    if not os.path.exists(path):
        print("   ⚠️ %s 不存在，跳过" % path)
        return
    backup(path)
    p = pathlib.Path(path)
    t, applied = p.read_text(encoding="utf-8"), 0
    for a, b in repls:
        if a in t:
            t = t.replace(a, b); applied += 1
        else:
            print("   ⚠️ %s 中无 %r" % (os.path.basename(path), a))
    p.write_text(t, encoding="utf-8")
    print("   %s: %d/%d" % (os.path.basename(path), applied, len(repls)))


def main():
    print("🔧 bump_version_v148_perc — 仅感知 App，%s → %s（内部版），日期 %s" % (OLD_VER, NEW_VER, NEW_BUILD_DATE))
    os.makedirs(BACKUP_DIR, exist_ok=True)
    patch_versionjson(os.path.join(CANON, "version.json"))
    patch_appjs(os.path.join(CANON, "app.js"))
    print("   ✅ 感知 canonical app.js / version.json → v%s (code %d)" % (NEW_VER, NEW_CODE))

    NS = os.path.join(ROOT, "native-shell")
    patch_script(os.path.join(NS, "make_deb.py"),
                 [(ARCHIVE_OLD, ARCHIVE_NEW), ('"ver": "1.46.20260911"', '"ver": "1.48.20260911"')])
    patch_script(os.path.join(NS, "gen_win_msi_wix7.py"),
                 [(ARCHIVE_OLD, ARCHIVE_NEW), ('"ver":"1.46.0"', '"ver":"1.48.0"'), ('"appver":"1.46"', '"appver":"1.48"')])
    patch_script(os.path.join(NS, "build_win_exe_nsis.py"),
                 [(ARCHIVE_OLD, ARCHIVE_NEW), ('"ver": "1.46.0"', '"ver": "1.48.0"'), ('"ver4": "1.46.0.0"', '"ver4": "1.48.0.0"')])
    patch_script(os.path.join(NS, "water-ios/make_secure_internal_pwa.py"),
                 [("1.46_20260911", "1.48_20260911")])

    print("🔒 卡口①：sync_all_mirrors.py ...")
    subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py")])
    print("🔒 卡口②：sync_all_mirrors.py --check ...")
    r = subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py"), "--check"])
    if r.returncode != 0:
        print("❌ 镜像一致性门禁未通过，阻断出包"); sys.exit(r.returncode)
    print("🔒 卡口③：propagate_ai_seed.py perc ...")
    r = subprocess.run([sys.executable, os.path.join(ROOT, "propagate_ai_seed.py"), "perc"])
    if r.returncode != 0:
        print("❌ propagate_ai_seed perc 失败，阻断出包"); sys.exit(r.returncode)
    print("📦 回退备份：%s" % BACKUP_DIR)
    print("✅ bump 完成。下一步：四端出包（内部版）。")


if __name__ == "__main__":
    main()
