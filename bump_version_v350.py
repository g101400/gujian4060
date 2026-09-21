#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bump_version_v350.py — 偶数(内部)版提升：shuili 3.49->3.50, perc 1.25->1.26, 古建 3.7 不变。
构建日期 2026-09-03。

双通道发版背景（见 T-049）：
  奇数版=公开/测试版（strip_internal --public 剥离单位内部数据+空密钥，已出包归档 四端安装包_20260903_v349_pub）；
  偶数版=内部版（本脚本，保留完整单位内部数据+真实 AI 密钥，供单位内部使用）。
古建不参与双通道（用户要求「古建不变」），故本脚本对 gujian 仅做幂等同步，不改版本号。

前置：strip_internal.py <canonical> --restore 已把真实 kb_building_seed.js / ai_seed.js 还原到 canonical。
流程：
  ① bump canonical app.js(APP_VERSION/APP_BUILD_DATE) + version.json
  ② bump 四个构建脚本的版本串 + 归档目录名
  ③ sync_all_mirrors.py --real  （canonical 真实数据 -> 所有 mirror/webroot）
  ④ sync_all_mirrors.py --check （镜像一致性门禁）
  ⑤ propagate_ai_seed.py        （ai_seed 被 sync 排除，手动把真实密钥同步进 webroot）
  ⑥ verify_fav_longpress.js     （长按收藏执行级验证，best-effort）

注意：sync_all_mirrors 不会同步 ai_seed.js（EXCLUDE_NAMES），所以第⑤步必须跑。
"""
import json, re, shutil, os, pathlib, sys, subprocess

ROOT = "D:/Users/Claw"
NEW_BUILD_DATE = "2026-09-03"
ARCHIVE_OLD = "四端安装包_20260902_v349"
ARCHIVE_NEW = "四端安装包_20260903_v350_int"

SHUILI_DESC = ("v3.50 内部版（含完整单位内部水利设施数据，仅限单位内部使用）：与感知 v1.26 / 古建 v3.7 同步。"
    "奇偶双通道发版机制落地——偶数版保留真实水利建筑物坐标/管理所/设计参数，程序标注「内部版」。")
PERC_DESC = ("v1.26 内部版（含完整单位内部感知设备数据，仅限单位内部使用）：与水利 v3.50 / 古建 v3.7 同步。"
    "偶数版保留真实感知设备坐标/子系统/设备编码，程序标注「内部版」。")
GUJIAN_DESC = ("v3.7 与水利 v3.50 / 感知 v1.26 同步（古建不参与双通道，版本号不变）："
    "保留 5 级景区组织 + 17 类古建类型 + AI 文物助手分支。")

PRODUCTS = {
    "shuili": dict(
        old_ver="3.49", new_ver="3.50", old_code=49, new_code=50,
        app_ver_has_v=True,
        canonical_assets=os.path.join(ROOT, "android-build/shuili-v329/assets"),
        mirror_assets=[os.path.join(ROOT, "android-build/water-v329/assets")],
        webroots=[os.path.join(ROOT, "native-shell/win-water-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/win-water-webview2/publish_win_water/webroot"),
                  os.path.join(ROOT, "native-shell/uos-water-pyqt6/webroot")],
        deb_old="3.49.20260902", deb_new="3.50.20260903",
        msi_old="3.49.0", msi_new="3.50.0", msi_app_old="3.49", msi_app_new="3.50",
        nsis_old="3.49.0", nsis_new="3.50.0", nsis4_old="3.49.0.0", nsis4_new="3.50.0.0",
        ios_old="3.49_20260902", ios_new="3.50_20260903",
        ios_readme_old="V3.49_20260902", ios_readme_new="V3.50_20260903",
        desc=SHUILI_DESC,
    ),
    "perc": dict(
        old_ver="1.25", new_ver="1.26", old_code=29, new_code=30,
        app_ver_has_v=True,
        canonical_assets=os.path.join(ROOT, "android-build/perc-v13/assets"),
        mirror_assets=[],
        webroots=[os.path.join(ROOT, "native-shell/win-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/win-webview2/publish_win_perc/webroot"),
                  os.path.join(ROOT, "native-shell/uos-pyqt6/webroot")],
        deb_old="1.25.20260902", deb_new="1.26.20260903",
        msi_old="1.25.0", msi_new="1.26.0", msi_app_old="1.25", msi_app_new="1.26",
        nsis_old="1.25.0", nsis_new="1.26.0", nsis4_old="1.25.0.0", nsis4_new="1.26.0.0",
        ios_old="1.25_20260902", ios_new="1.26_20260903",
        ios_readme_old="V1.25_20260902", ios_readme_new="V1.26_20260903",
        desc=PERC_DESC,
    ),
    "gujian": dict(
        old_ver="3.7", new_ver="3.7", old_code=29, new_code=29,
        app_ver_has_v=False,
        canonical_assets=os.path.join(ROOT, "travel/android/assets"),
        mirror_assets=[os.path.join(ROOT, "android-build/gujian-v31/assets")],
        webroots=[os.path.join(ROOT, "native-shell/win-gujian-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/win-gujian-webview2/publish_win_gujian/webroot"),
                  os.path.join(ROOT, "native-shell/uos-gujian-pyqt6/webroot")],
        # 古建不变：所有版本串 old==new（no-op），仅做幂等同步
        deb_old="3.7.20260902", deb_new="3.7.20260902",
        msi_old="3.7.0", msi_new="3.7.0", msi_app_old="3.7", msi_app_new="3.7",
        nsis_old="3.7.0", nsis_new="3.7.0", nsis4_old="3.7.0.0", nsis4_new="3.7.0.0",
        ios_old="3.7_20260902", ios_new="3.7_20260902",
        ios_readme_old="V3.7_20260902", ios_readme_new="V3.7_20260902",
        desc=GUJIAN_DESC,
    ),
}


def backup(path):
    if not os.path.exists(path):
        return
    rel = os.path.relpath(path, ROOT)
    dst = os.path.join(ROOT, "backup_2026-09-03_before_v350", rel)
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
    new_section = "v%s：%s。" % (p["new_ver"], p["desc"].rstrip("。"))
    d["desc"] = desc.rstrip() + "\n\n" + new_section
    pathlib.Path(path).write_text(
        json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
    print("🔧 bump_version_v350 — 内部(偶数)版，构建日期 %s" % NEW_BUILD_DATE)
    os.makedirs(os.path.join(ROOT, "backup_2026-09-03_before_v350"), exist_ok=True)

    # ① canonical app.js + version.json
    for key, p in PRODUCTS.items():
        patch_versionjson(os.path.join(p["canonical_assets"], "version.json"), p)
        patch_appjs(os.path.join(p["canonical_assets"], "app.js"), p)
        print("✅ %-7s canonical app.js/version.json -> v%s (code %d)"
              % (key, p["new_ver"], p["new_code"]))

    # ② 构建脚本版本串 + 归档目录
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

    ios_repls = [('"%s"' % p["ios_old"], '"%s"' % p["ios_new"]) for p in vals]
    ios_repls += [('"readme_ver": "%s"' % p["ios_readme_old"], '"readme_ver": "%s"' % p["ios_readme_new"]) for p in vals]
    patch_build_script(os.path.join(ROOT, "native-shell/water-ios/build_ios_zip.py"), ios_repls)

    # ③ 镜像对齐：canonical(真实) -> 所有 mirror/webroot
    print("🔒 卡口：sync_all_mirrors.py --real ...")
    r1 = subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py"), "--real"])
    if r1.returncode != 0:
        print("❌ sync --real 失败，阻断出包")
        sys.exit(r1.returncode)

    # ④ 一致性门禁
    print("🔒 卡口：sync_all_mirrors.py --check ...")
    r2 = subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py"), "--check"])
    if r2.returncode != 0:
        print("❌ 镜像一致性门禁未通过，阻断出包")
        sys.exit(r2.returncode)

    # ⑤ ai_seed 手动传播（sync 排除它）：把真实密钥同步进 webroot
    print("🔒 真实 ai_seed 手动传播（shuili/perc）...")
    for prod in ("shuili", "perc"):
        r = subprocess.run([sys.executable, os.path.join(ROOT, "propagate_ai_seed.py"), prod])
        if r.returncode != 0:
            print("❌ propagate_ai_seed %s 失败，阻断出包" % prod)
            sys.exit(r.returncode)

    # ⑥ 长按收藏执行级验证（best-effort，失败仅告警不阻断）
    print("🔍 验证：verify_fav_longpress.js（best-effort）...")
    r3 = subprocess.run(["node", os.path.join(ROOT, "verify_fav_longpress.js")])
    if r3.returncode != 0:
        print("⚠️ verify_fav_longpress.js 未通过（best-effort，不影响出包）；请人工确认长按收藏功能。")

    print("📦 回退备份目录: backup_2026-09-03_before_v350")
    print("✅ bump_version_v350 完成。下一步：四端出包（内部版）。")


if __name__ == "__main__":
    main()
