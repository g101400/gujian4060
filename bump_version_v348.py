#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bump_version_v348.py — 三产品版本同步 v3.46/v1.22/v3.4 -> v3.48/v1.24/v3.6

v3.48 修复与优化 release（统一三日经验教训后的收敛版本）：
  水利 v3.46 -> v3.48：
    ①子菜单「长按 600ms」即可添加/移除「快捷常用」（与右侧 ☆ 并存，解决手机/平板上
      15px 星标点不准、易误触的痛点；长按后吞掉 click 不误开菜单，带振动+toast 反馈，
      MutationObserver 自动重绑，菜单重建后依然生效）；
    ②UOS deb 统一修复：运行时回归纯浏览器壳（零 PyQt6 依赖，龙芯不再崩壳）、control 补全
      postinst/postrm/md5sums、postinst 以 dpkg -L 清单为基准收敛历史残留文件、每端独立端口
      （7205/7206/7207，三端同机共存不再撞端口）、verify 门禁加 control 完整性与「Depends 不含 pyqt6」断言；
    ③Windows MSI/EXE 根治 WebView2 E_ACCESSDENIED：userDataFolder 改为用户可写目录，
      出包前强制校验 exe 含 GetWebView2DataFolder 修复标记，缺标记直接拒包；
    ④清理 webroot 历史垃圾（*.bak/*.ctxbak/*.menu1bak/*.old 与 leaflet/leaflet 嵌套冗余副本），
      打包脚本加目录剪枝，防止同步后复活。
  感知 v1.22 -> v1.24：与水利同步（保留 subsystem 子系统 + equip_type 设备类型元数据）。
  古建 v3.4  -> v3.6 ：与水利同步（保留 5 级景区组织 + 17 类古建类型 + AI 文物助手分支）。

要求：四端同步 + 小程序 baseline + 备份回退
  - travel/android (古建) / android-build/perc-v13 (感知) / android-build/shuili-v329 (水利)
  - uos + win 各三端 webroot（感知额外同步 win-webview2/webroot 供 iOS 打包）
  - make_deb.py / gen_win_msi_wix7.py / build_win_exe_nsis.py / build_ios_zip.py 硬编码版本串
  - 备份到 backup_2026-09-01_before_v348/

【本版新增 · 卡口升级】脚本末尾强制跑 sync_all_mirrors.py --check，
  非 0 直接 sys.exit 阻断出包（09-01 自省结论：把「交付前必过」从约定升级为卡口）。
"""
import json, re, shutil, os, pathlib, sys, subprocess

ROOT = "D:/Users/Claw"
NEW_BUILD_DATE = "2026-09-01"
BACKUP_DIR = os.path.join(ROOT, "backup_2026-09-01_before_v348")
ARCHIVE_OLD = "四端安装包_20260831_v346"
ARCHIVE_NEW = "四端安装包_20260901_v348"

SHUILI_DESC = ("v3.48 修复与优化（统一三日经验教训的收敛版本，功能不删不减）："
    "①子菜单「长按 600ms」即可添加/移除「快捷常用」——与右侧 ☆ 并存，解决手机/平板上 15px 星标点不准、"
    "易误触的痛点；长按触发后吞掉随后的 click 保证不误开菜单，带振动与 toast 反馈，"
    "MutationObserver 监听菜单重建自动重绑，收藏后菜单重画依然生效；"
    "②UOS deb 统一修复：运行时回归纯浏览器壳（零 PyQt6 依赖，龙芯不再崩壳）、control 补全 postinst/postrm/md5sums、"
    "postinst 以 dpkg -L 清单为基准 comm -23 收敛 /opt 下的历史残留文件（任何机器升级后自动收敛为新包结构）、"
    "每端独立端口（水利 7205 / 感知 7206 / 古建 7207，三端同机共存不再撞端口）、"
    "verify 门禁新增 control 完整性断言与「Depends 不得含 pyqt6」断言；"
    "③Windows MSI/EXE 根治 WebView2 E_ACCESSDENIED：userDataFolder 改用用户可写目录，"
    "出包前强制校验 exe 含 GetWebView2DataFolder 修复标记，缺失直接拒包（不再依赖人工记忆）；"
    "④清理 webroot 历史垃圾（*.bak/*.ctxbak/*.menu1bak/*.old 与 leaflet/leaflet 嵌套冗余副本），"
    "MSI/NSIS 打包脚本加目录剪枝，防止同步后复活。")

PERC_DESC = ("v1.24 与水利 v3.48 同步（感知核心=感知切切实设备，保留 subsystem 子系统 + equip_type 设备类型元数据）："
    "①子菜单长按添加/移除快捷常用（与 ☆ 并存，长按不误开菜单）；"
    "②UOS deb 统一修复（浏览器壳 + control 四件套 + 独立端口 7206）；"
    "③Windows MSI/EXE WebView2 userDataFolder 根治 E_ACCESSDENIED + 出包修复标记门禁；"
    "④webroot 垃圾清理与打包剪枝。")

GUJIAN_DESC = ("v3.6 与水利 v3.48 同步（古建核心=景区→园区→子景点→打卡位→标签，key=spot/area/sub/point/tag）："
    "①子菜单长按添加/移除快捷常用（古建收藏键 gi:ii 自动适配，与 ☆ 并存）；"
    "②UOS deb 统一修复（浏览器壳 + control 四件套 + 独立端口 7207）；"
    "③Windows MSI/EXE WebView2 userDataFolder 根治 E_ACCESSDENIED + 出包修复标记门禁；"
    "④webroot 垃圾清理与打包剪枝；"
    "⑤保留古建核心（5 级景区组织 + 17 类古建类型 + 历史关键词可折叠 + 周边搜索 nbtype + AI 文物助手分支）。")

PRODUCTS = {
    "shuili": dict(
        old_ver="3.46", new_ver="3.48", old_code=47, new_code=48,
        app_ver_has_v=True,
        canonical_assets=os.path.join(ROOT, "android-build/shuili-v329/assets"),
        mirror_assets=[os.path.join(ROOT, "android-build/water-v329/assets")],
        # 注意：publish_win_water/webroot 是 MSI/EXE 打包读取的目录，必须一并同步
        # （v3.48 教训：MSI 门禁因该目录 version.json 停留在 3.46 而拒包）
        webroots=[os.path.join(ROOT, "native-shell/win-water-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/win-water-webview2/publish_win_water/webroot"),
                  os.path.join(ROOT, "native-shell/uos-water-pyqt6/webroot")],
        deb_old="3.47.20260901", deb_new="3.48.20260901",
        msi_old="3.46.1", msi_new="3.48.0",
        appver_old="3.46", appver_new="3.48",
        ios_old="3.46_20260831", ios_new="3.48_20260901",
        desc=SHUILI_DESC,
    ),
    "perc": dict(
        old_ver="1.22", new_ver="1.24", old_code=27, new_code=28,
        app_ver_has_v=True,
        canonical_assets=os.path.join(ROOT, "android-build/perc-v13/assets"),
        mirror_assets=[],
        webroots=[os.path.join(ROOT, "native-shell/win-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/win-webview2/publish_win_perc/webroot"),
                  os.path.join(ROOT, "native-shell/uos-pyqt6/webroot")],
        deb_old="1.23.20260901", deb_new="1.24.20260901",
        msi_old="1.22.1", msi_new="1.24.0",
        appver_old="1.22", appver_new="1.24",
        ios_old="1.22_20260831", ios_new="1.24_20260901",
        desc=PERC_DESC,
    ),
    "gujian": dict(
        old_ver="3.4", new_ver="3.6", old_code=27, new_code=28,
        app_ver_has_v=False,
        # 注意：gujian 的真实构建真相源已是 travel/android/assets（release_v331.sh /
        # build_ios_zip.py 实际读取），旧 android-build/gujian-v31/assets 已陈旧落后；
        # 与 sync_all_mirrors.py 对齐——travel/android 为 canonical，gujian-v31 降为镜像之一。
        canonical_assets=os.path.join(ROOT, "travel/android/assets"),
        mirror_assets=[os.path.join(ROOT, "android-build/gujian-v31/assets")],
        # 同上：publish_win_gujian/webroot 必须同步，否则 MSI 门禁拒包
        webroots=[os.path.join(ROOT, "native-shell/win-gujian-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/win-gujian-webview2/publish_win_gujian/webroot"),
                  os.path.join(ROOT, "native-shell/uos-gujian-pyqt6/webroot")],
        deb_old="3.5.20260901", deb_new="3.6.20260901",
        msi_old="3.4.1", msi_new="3.6.0",
        appver_old="3.4", appver_new="3.6",
        ios_old="3.4_20260831", ios_new="3.6_20260901",
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
        print("⚠️ %s: version=%s 期望 %s（可能已 bump），跳过 version 字段" % (path, d["version"], p["old_ver"]))
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
            print("⚠️ 跳过：%s 中无 %r" % (path, a))
    pathlib.Path(path).write_text(t, encoding="utf-8")
    print("   %s: %d/%d 处版本串已更新" % (os.path.basename(path), applied, len(repls)))


def main():
    print("🔧 bump_version_v348 — 构建日期 %s" % NEW_BUILD_DATE)
    os.makedirs(BACKUP_DIR, exist_ok=True)

    for key, p in PRODUCTS.items():
        ca = p["canonical_assets"]
        patch_versionjson(os.path.join(ca, "version.json"), p)
        patch_appjs(os.path.join(ca, "app.js"), p)
        for base in p["mirror_assets"] + p["webroots"]:
            if not os.path.isdir(base):
                print("⚠️ 跳过不存在的同步目标: %s" % base)
                continue
            for fn in os.listdir(ca):
                src = os.path.join(ca, fn)
                if not os.path.isfile(src):
                    continue
                dst = os.path.join(base, fn)
                backup(dst)
                shutil.copy2(src, dst)
        print("✅ %-7s canonical+mirror(%d)+webroots(%d) 同步 v%s (code %d)"
              % (key, len(p["mirror_assets"]), len(p["webroots"]), p["new_ver"], p["new_code"]))

    print("🔧 更新构建脚本版本串...")
    vals = list(PRODUCTS.values())

    # deb（注意：归档目录名也必须同步，否则新包会打进上一版目录）
    deb_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    deb_repls += [('"ver": "%s"' % p["deb_old"], '"ver": "%s"' % p["deb_new"]) for p in vals]
    patch_build_script(os.path.join(ROOT, "native-shell/make_deb.py"), deb_repls)

    # MSI：ver / appver / 归档目录
    msi_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    msi_repls += [('"ver":"%s"' % p["msi_old"], '"ver":"%s"' % p["msi_new"]) for p in vals]
    msi_repls += [('"appver":"%s"' % p["appver_old"], '"appver":"%s"' % p["appver_new"]) for p in vals]
    patch_build_script(os.path.join(ROOT, "native-shell/gen_win_msi_wix7.py"), msi_repls)

    # NSIS EXE：ver（ver4 由 3.46.1 -> 3.48.0 前缀自动跟随）/ 归档目录
    nsis_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    nsis_repls += [('"ver": "%s"' % p["msi_old"], '"ver": "%s"' % p["msi_new"]) for p in vals]
    nsis_repls += [('"ver4": "%s.0"' % p["msi_old"], '"ver4": "%s.0"' % p["msi_new"]) for p in vals]
    patch_build_script(os.path.join(ROOT, "native-shell/build_win_exe_nsis.py"), nsis_repls)

    # iOS PWA（注意 readme_ver 带 V 前缀，必须单独替换，否则末尾打印仍是旧版本）
    ios_repls = [('"%s"' % p["ios_old"], '"%s"' % p["ios_new"]) for p in vals]
    ios_repls += [('"readme_ver": "V%s"' % p["ios_old"], '"readme_ver": "V%s"' % p["ios_new"]) for p in vals]
    patch_build_script(os.path.join(ROOT, "native-shell/water-ios/build_ios_zip.py"), ios_repls)

    # ---- 卡口：强制全量镜像对齐 + --check 门禁（09-01 自省升级：约定 -> 阻断）----
    print("🔒 卡口：sync_all_mirrors.py --real ...")
    r1 = subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py"), "--real"])
    if r1.returncode != 0:
        print("❌ sync --real 失败，阻断出包")
        sys.exit(r1.returncode)

    print("🔒 卡口：sync_all_mirrors.py --check ...")
    r2 = subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py"), "--check"])
    if r2.returncode != 0:
        print("❌ 镜像一致性门禁未通过，阻断出包（先修镜像再发版）")
        sys.exit(r2.returncode)

    print("🔒 卡口：verify_fav_longpress.js（长按收藏执行级验证）...")
    r3 = subprocess.run(["node", os.path.join(ROOT, "verify_fav_longpress.js")])
    if r3.returncode != 0:
        print("❌ 长按收藏执行级验证未通过，阻断出包")
        sys.exit(r3.returncode)

    print("🔒 卡口：小程序基线同步（jingyin v%s）..." % PRODUCTS["shuili"]["new_ver"])
    r4 = subprocess.run([sys.executable, os.path.join(ROOT, "sync_weapp_version.py"),
                         PRODUCTS["shuili"]["new_ver"], PRODUCTS["perc"]["new_ver"],
                         PRODUCTS["gujian"]["new_ver"], NEW_BUILD_DATE])
    if r4.returncode != 0:
        print("❌ 小程序基线同步失败，阻断出包")
        sys.exit(r4.returncode)
    r5 = subprocess.run([sys.executable, os.path.join(ROOT, "sync_weapp_version.py"), "--check"])
    if r5.returncode != 0:
        print("❌ 小程序基线未对齐，阻断出包")
        sys.exit(r5.returncode)

    print("📦 回退备份目录:", BACKUP_DIR)
    print("✅ bump_version_v348 完成。下一步：四端出包。")


if __name__ == "__main__":
    main()
