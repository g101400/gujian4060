#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bump_version_v364_int.py — 内部(偶数)版提升：shuili 3.62->3.64, perc 1.38->1.40, 古建 3.7.6->3.7.7
构建日期 2026-09-08（与上一测试包同日，属同日第 4 轮修复包）。

本轮修复（三应用同源）：
  ① 彻底消灭「getFavMenus is not defined」类 ReferenceError：隐藏/收藏能力从水利移植到
     感知/古建时，buildMenu 里的裸标识符调用在 IIFE 作用域内没有同名函数声明，只依赖文件头
     window 兜底；一旦兜底缺失/被旧资产覆盖即抛 ReferenceError 并被 window.onerror 吞成
     「运行错误:script error」，菜单整体渲染中断（古建打开菜单报错即此根因）。
     现三产品在作用域内补齐 getFavMenus/setFavMenus（古建另补 menuTitleOf/toggleFavMenu，
     收藏数据映射到古建自有键 gujian_favorites_v32，保证只有一份「快捷常用」数据）。
  ② ovkmz/KML 导入后「显示不正常 / 不能放大」根因修复（安卓 WebView 独有）：
     导入过程经历 busy 浮层/进度面板反复显隐，地图容器尺寸变化后 Leaflet 未收到 resize，
     手势缩放失效且瓦片错位 → 导入落库后显式 map.invalidateSize()（并延迟 300ms 补一次）；
     同时导入成功后 fitBounds 到本次导入要素范围（pad 0.2 / maxZoom 16），不再「导入了但看不到」。

流程：
  ① bump canonical app.js(APP_VERSION/APP_BUILD_DATE) + version.json
  ② bump make_deb.py / gen_win_msi_wix7.py / build_win_exe_nsis.py 版本串 + 归档目录名
     （iOS 版本由 build_ios_zip.py 从 webroot version.json 自动读取，无需硬编码）
  ③ sync_all_mirrors.py          （canonical -> 所有 mirror/webroot）
  ④ sync_all_mirrors.py --check  （镜像一致性门禁）
  ⑤ propagate_ai_seed.py         （ai_seed 被 sync 排除，手动传播真实密钥）
"""
import json, re, shutil, os, pathlib, sys, subprocess

ROOT = "D:/Users/Claw"
NEW_BUILD_DATE = "2026-09-08"
ARCHIVE_OLD = "四端安装包_20260905_v357_pub"
ARCHIVE_NEW = "测试包_20260908_v4_int"
BACKUP_DIR = os.path.join(ROOT, "backup_2026-09-08_before_v364")

FIX_NOTE = ("修复（菜单 script error 根因）：补齐作用域内的 getFavMenus/setFavMenus 等收藏/隐藏统一 API，"
            "根治古建打开菜单报「getFavMenus is not defined」导致菜单整体不渲染；"
            "修复（安卓 ovkmz 导入）：导入后自动 invalidateSize + fitBounds 到导入要素范围，"
            "根治安卓端导入后「显示不正常 / 不能放大」")

SHUILI_DESC = ("v3.64 内部版（与感知 v1.40 / 古建 v3.7.7 同步）：" + FIX_NOTE +
               "；其余（隐藏/收藏二次确认、deb 导出照片、APK 照片点击、管理所九所统一）回归保持。")
PERC_DESC = ("v1.40 内部版（与水利 v3.64 / 古建 v3.7.7 同步）：" + FIX_NOTE +
             "；九所严格限定与统一识别回归保持。")
GUJIAN_DESC = ("v3.7.7（与水利 v3.64 / 感知 v1.40 同步）：" + FIX_NOTE +
               "；古建收藏键 gujian_favorites_v32 与「快捷常用」共用一份数据，长按收藏与右侧 ☆ 并存。")

PRODUCTS = {
    "shuili": dict(
        old_ver="3.62", new_ver="3.64", old_code=62, new_code=64,
        app_ver_has_v=False,
        canonical_assets=os.path.join(ROOT, "android-build/shuili-v329/assets"),
        deb_old="3.57.20260905", deb_new="3.64.20260908",
        msi_old="3.57.0", msi_new="3.64.0", msi_app_old="3.57", msi_app_new="3.64",
        nsis_old="3.57.0", nsis_new="3.64.0", nsis4_old="3.57.0.0", nsis4_new="3.64.0.0",
        desc=SHUILI_DESC,
    ),
    "perc": dict(
        old_ver="1.38", new_ver="1.40", old_code=38, new_code=40,
        app_ver_has_v=False,
        canonical_assets=os.path.join(ROOT, "android-build/perc-v13/assets"),
        deb_old="1.33.20260905", deb_new="1.40.20260908",
        msi_old="1.33.0", msi_new="1.40.0", msi_app_old="1.33", msi_app_new="1.40",
        nsis_old="1.33.0", nsis_new="1.40.0", nsis4_old="1.33.0.0", nsis4_new="1.40.0.0",
        desc=PERC_DESC,
    ),
    "gujian": dict(
        old_ver="3.7.6", new_ver="3.7.7", old_code=35, new_code=36,
        app_ver_has_v=False,
        canonical_assets=os.path.join(ROOT, "android-build/gujian-v31/assets"),
        deb_old="3.7.4.20260905", deb_new="3.7.7.20260908",
        msi_old="3.7.4.0", msi_new="3.7.7.0", msi_app_old="3.7.4", msi_app_new="3.7.7",
        nsis_old="3.7.4.0", nsis_new="3.7.7.0", nsis4_old="3.7.4.0.0", nsis4_new="3.7.7.0.0",
        desc=GUJIAN_DESC,
    ),
}


def backup(path):
    if not os.path.exists(path):
        return
    rel = os.path.relpath(path, ROOT)
    dst = os.path.join(BACKUP_DIR, rel)
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(path, dst)


def patch_appjs(path, p):
    backup(path)
    t = pathlib.Path(path).read_text(encoding="utf-8")
    new_lit = ("v" if p["app_ver_has_v"] else "") + p["new_ver"]
    pat = re.compile(r'(var APP_VERSION = ")[^"]*(";)')
    t2, n = pat.subn(lambda m: m.group(1) + new_lit + m.group(2), t, count=1)
    assert n == 1, "%s: APP_VERSION 未命中（期望 1 处，实际 %d）" % (path, n)
    t2, n2 = re.subn(r'(var APP_BUILD_DATE = ")[^"]*(")', r'\g<1>%s\g<2>' % NEW_BUILD_DATE, t2, count=1)
    if n2 == 0:
        print("⚠️ %s: APP_BUILD_DATE 未命中，保留原值" % path)
    pathlib.Path(path).write_text(t2, encoding="utf-8")


def patch_versionjson(path, p):
    backup(path)
    d = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    cur = str(d["version"]).lstrip("v")
    if cur == p["new_ver"]:
        print("⏭️ %s: 已是 v%s，跳过（幂等）" % (path, p["new_ver"]))
        return
    if cur != p["old_ver"]:
        print("⚠️ %s: version=%s 期望 %s，跳过 version 字段" % (path, d["version"], p["old_ver"]))
        return
    d["version"] = p["new_ver"]
    d["versionCode"] = p["new_code"]
    d["buildDate"] = NEW_BUILD_DATE
    desc = d.get("desc", "")
    d["desc"] = desc.rstrip() + "\n\n" + ("v%s：%s。" % (p["new_ver"], p["desc"].rstrip("。")))
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
            print("⚠️ 跳过：%s 中无 %r" % (os.path.basename(path), a))
    pathlib.Path(path).write_text(t, encoding="utf-8")
    print("   %s: %d/%d 处版本串已更新" % (os.path.basename(path), applied, len(repls)))


def main():
    print("🔧 bump_version_v364_int — 内部(偶数)版，构建日期 %s" % NEW_BUILD_DATE)
    os.makedirs(BACKUP_DIR, exist_ok=True)

    for key, p in PRODUCTS.items():
        patch_versionjson(os.path.join(p["canonical_assets"], "version.json"), p)
        patch_appjs(os.path.join(p["canonical_assets"], "app.js"), p)
        print("✅ %-7s canonical app.js/version.json -> v%s (code %d)" % (key, p["new_ver"], p["new_code"]))

    vals = list(PRODUCTS.values())
    deb_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    deb_repls += [('"ver": "%s"' % p["deb_old"], '"ver": "%s"' % p["deb_new"]) for p in vals]
    patch_build_script(os.path.join(ROOT, "native-shell/make_deb.py"), deb_repls)

    msi_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    msi_repls += [('"ver":"%s"' % p["msi_old"], '"ver":"%s"' % p["msi_new"]) for p in vals]
    msi_repls += [('"appver":"%s"' % p["msi_app_old"], '"appver":"%s"' % p["msi_app_new"]) for p in vals]
    patch_build_script(os.path.join(ROOT, "native-shell/gen_win_msi_wix7.py"), msi_repls)

    nsis_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    nsis_repls += [('"ver": "%s"' % p["nsis_old"], '"ver": "%s"' % p["nsis_new"]) for p in vals]
    nsis_repls += [('"ver4": "%s"' % p["nsis4_old"], '"ver4": "%s"' % p["nsis4_new"]) for p in vals]
    patch_build_script(os.path.join(ROOT, "native-shell/build_win_exe_nsis.py"), nsis_repls)

    print("🔒 卡口：sync_all_mirrors.py ...")
    r1 = subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py")])
    if r1.returncode != 0:
        print("⚠️ sync 返回非零（可能有镜像不存在），继续 check")
    r2 = subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py"), "--check"])
    if r2.returncode != 0:
        print("❌ 镜像一致性门禁未通过，阻断出包")
        sys.exit(r2.returncode)

    print("🔒 真实 ai_seed 手动传播（shuili/perc）...")
    for prod in ("shuili", "perc"):
        r = subprocess.run([sys.executable, os.path.join(ROOT, "propagate_ai_seed.py"), prod])
        if r.returncode != 0:
            print("❌ propagate_ai_seed %s 失败，阻断出包" % prod)
            sys.exit(r.returncode)

    print("📦 回退备份目录: %s" % BACKUP_DIR)
    print("✅ bump_version_v364_int 完成。下一步：四端出包（内部版）。")


if __name__ == "__main__":
    main()
