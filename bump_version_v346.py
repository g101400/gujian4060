#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bump_version_v346.py — 三产品版本同步 v3.45/v1.21/v3.3 -> v3.46/v1.22/v3.4
v3.46 回归修复 release（水利 3.43/3.44/3.45 已知 script error / 筛选不生效 / 导入匹配回退 等修复）：
  水利 v3.45 -> v3.46：①导出建筑物表格 script error 修复；②导出照片 script error 修复；
    ③全菜单运行错误回归验证（window.onerror 全局拦截）；④导入压缩包照片回退 v3.42 level-aware 三级匹配；
    ⑤筛选菜单 管理所/管理站/建筑物类型 添加成功实际生效修复；⑥历史关键词上移紧挨查询关键词；
    ⑦本地智能查询增强（无 KB 时用 App 自有组织数据）；⑧AI 结果进一步操作提示 + 单击/双击复制关键词；
    ⑨水利/古建/感知 隐藏当前密钥显示，复制密钥需密码 3305。
  感知 v1.21 -> v1.22：与水利同步（筛选生效 / zip level-aware / AI 复制 / 密钥隐藏）；保留 subsystem+equip_type 元数据。
  古建 v3.3  -> v3.4 ：与水利同步（AI 复制 / 密钥隐藏 / script error 验证）；保留古建核心元数据。

要求：四端同步 + 小程序 baseline + 备份回退
  - travel/android (古建) / android-build/perc-v13 (感知) / android-build/shuili-v329 (水利)
  - uos + win 各三端 webroot（感知额外同步 win-webview2/webroot 供 iOS 打包）
  - make_deb.py / gen_win_msi_wix7.py / build_win_exe_nsis.py / build_ios_zip.py 硬编码版本串
  - 备份到 backup_2026-08-31_before_v346/
"""
import json, re, shutil, os, pathlib, sys, subprocess

ROOT = "D:/Users/Claw"
NEW_BUILD_DATE = "2026-08-31"
BACKUP_DIR = os.path.join(ROOT, "backup_2026-08-31_before_v346")

SHUILI_DESC = ("v3.46 回归修复（水利 3.43/3.44/3.45 已知问题修复，功能不删不减）："
    "①导出建筑物表格菜单 script error 修复（doExportTable 重绑定，菜单入口与 Excel/CSV 导出打通）；"
    "②导出照片菜单 script error 修复（导出逻辑与权限回调对齐）；"
    "③全菜单运行错误回归验证（window.onerror 全局拦截 + 关键菜单 path 兜底，确保不出现「运行错误 script error」）；"
    "④导入压缩包照片回退至 v3.42 level-aware 三级匹配（zip 文件名为主匹配参考：zip 名→文件夹→文件；"
    "按 局→管理处→所→站→段 层级 longest-match，案例 史山.zip→史山所→IMG-6857.jpg→三扬分水闸，"
    "模糊匹配命中「管理所」而非「局/管理处」）；"
    "⑤筛选菜单 管理所/管理站/建筑物类型 三项「添加成功」实际生效修复（filterState 持久化 + SETTINGS.defaultFilter 写入，"
    "重开筛选面板与地图渲染同步）；"
    "⑥历史关键词上移紧挨查询关键词（UI 顺序调整，可折叠面板置顶）；"
    "⑦本地智能查询增强（无知识库条目时改用 App 自有组织数据作答，案例「京密引水管理处有几个管理所」直接基于 ORG 数据回答）；"
    "⑧AI 结果提示进一步操作 + 单击复制关键词到查询框 / 双击自动复制关键词；"
    "⑨隐藏当前密钥显示，复制当前密钥需输入密码 3305（水利/古建/感知统一）。")

PERC_DESC = ("v1.22 与水利 v3.46 同步回归修复（感知核心=感知切切实设备，保留 subsystem 子系统 + equip_type 设备类型元数据）："
    "①筛选菜单 管理所/管理站/建筑物类型 添加生效修复（与水利同款 filterState 持久化）；"
    "②导入压缩包照片 level-aware 三级匹配（与水利同款 longest-match）；"
    "③AI 结果单击/双击复制关键词 + 进一步操作提示；"
    "④隐藏当前密钥显示 + 复制密钥需密码 3305；"
    "⑤导出建筑物表格/导出照片 script error 回归验证通过。")

GUJIAN_DESC = ("v3.4 与水利 v3.46 同步（古建核心=景区→园区→子景点→打卡位→标签，key=spot/area/sub/point/tag）："
    "①AI 结果单击/双击复制关键词 + 进一步操作提示；"
    "②隐藏当前密钥显示 + 复制密钥需密码 3305；"
    "③导出/菜单 script error 回归验证通过；"
    "④保留 v3.3 古建核心元数据（5 级景区组织 + 17 类古建类型 + 快捷⭐ + 历史关键词可折叠 + 周边搜索 nbtype + AI 文物助手分支）。")

PRODUCTS = {
    "shuili": dict(
        old_ver="3.45", new_ver="3.46", old_code=46, new_code=47,
        app_ver_has_v=True,
        canonical_assets=os.path.join(ROOT, "android-build/shuili-v329/assets"),
        mirror_assets=[os.path.join(ROOT, "android-build/water-v329/assets")],
        extra_roots=[],
        webroots=[os.path.join(ROOT, "native-shell/win-water-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/uos-water-pyqt6/webroot")],
        deb_old="3.45.20260830", deb_new="3.46.20260831",
        msi_old="3.45.0", msi_new="3.46.0",
        ios_old="3.45_20260830", ios_new="3.46_20260831",
        desc=SHUILI_DESC,
    ),
    "perc": dict(
        old_ver="1.21", new_ver="1.22", old_code=26, new_code=27,
        app_ver_has_v=True,
        canonical_assets=os.path.join(ROOT, "android-build/perc-v13/assets"),
        mirror_assets=[],
        extra_roots=[],
        # 注意：iOS 打包读 win-webview2/webroot，MSI/EXE 读 publish_win_perc/webroot，两者都同步
        webroots=[os.path.join(ROOT, "native-shell/win-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/win-webview2/publish_win_perc/webroot"),
                  os.path.join(ROOT, "native-shell/uos-pyqt6/webroot")],
        deb_old="1.21.20260830", deb_new="1.22.20260831",
        msi_old="1.21.0", msi_new="1.22.0",
        ios_old="1.21_20260830", ios_new="1.22_20260831",
        desc=PERC_DESC,
    ),
    "gujian": dict(
        old_ver="3.3", new_ver="3.4", old_code=26, new_code=27,
        app_ver_has_v=False,
        canonical_assets=os.path.join(ROOT, "android-build/gujian-v31/assets"),
        mirror_assets=[os.path.join(ROOT, "travel/android/assets")],
        extra_roots=[],
        webroots=[os.path.join(ROOT, "native-shell/win-gujian-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/uos-gujian-pyqt6/webroot")],
        deb_old="3.3.20260830", deb_new="3.4.20260831",
        msi_old="3.3.0", msi_new="3.4.0",
        ios_old="3.3_20260830", ios_new="3.4_20260831",
        desc=GUJIAN_DESC,
    ),
}


def backup(path):
    if not os.path.exists(path):
        return  # 目标文件尚不存在（首次同步），无需回退备份
    rel = os.path.relpath(path, ROOT)
    dst = os.path.join(BACKUP_DIR, rel)
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(path, dst)


def patch_appjs(path, p):
    """Robust: regex-replace 当前 APP_VERSION 字面量（兼容 perc 历史遗留 'v3.45' 与真实版本不一致）。"""
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
        print("⚠️ %s 不存在，跳过" % path); return
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
    print("🔧 bump_version_v346 — 构建日期 %s" % NEW_BUILD_DATE)
    for key, p in PRODUCTS.items():
        ca = p["canonical_assets"]
        patch_versionjson(os.path.join(ca, "version.json"), p)
        patch_appjs(os.path.join(ca, "app.js"), p)
        # 同步 mirror + webroots（含 .js/.json 等全部 assets）
        for base in p["mirror_assets"] + p["extra_roots"] + p["webroots"]:
            if not os.path.isdir(base):
                print("⚠️ 跳过不存在的同步目标: %s" % base); continue
            for fn in os.listdir(ca):
                src = os.path.join(ca, fn)
                if not os.path.isfile(src):
                    continue
                dst = os.path.join(base, fn)
                backup(dst)
                shutil.copy2(src, dst)
        print("✅ %-7s canonical+mirror(%d)+webroots(%d) 同步 v%s (code %d)"
              % (key, len(p["mirror_assets"]) + len(p["extra_roots"]), len(p["webroots"]), p["new_ver"], p["new_code"]))

    print("🔧 更新构建脚本版本串...")
    mdeb = os.path.join(ROOT, "native-shell/make_deb.py")
    patch_build_script(mdeb, [('"ver": "%s"' % p["deb_old"], '"ver": "%s"' % p["deb_new"])
                              for p in PRODUCTS.values()])

    mmsi = os.path.join(ROOT, "native-shell/gen_win_msi_wix7.py")
    mmsi_repls = [('四端安装包_20260830_v345', '四端安装包_20260831_v346')]
    mmsi_repls += [('"ver":"%s"' % p["msi_old"], '"ver":"%s"' % p["msi_new"]) for p in PRODUCTS.values()]
    patch_build_script(mmsi, mmsi_repls)

    mnsis = os.path.join(ROOT, "native-shell/build_win_exe_nsis.py")
    if os.path.exists(mnsis):
        mnsis_repls = [('四端安装包_20260830_v345', '四端安装包_20260831_v346')]
        # 全局替换 3 段版本（级联 4 段 ver4）
        mnsis_repls += [(p["msi_old"], p["msi_new"]) for p in PRODUCTS.values()]
        patch_build_script(mnsis, mnsis_repls)

    mios = os.path.join(ROOT, "native-shell/water-ios/build_ios_zip.py")
    ios_repls = [('"%s"' % p["ios_old"], '"%s"' % p["ios_new"]) for p in PRODUCTS.values()]
    patch_build_script(mios, ios_repls)

    print("🔄 sync_shuili_mirror.py ...")
    _r = subprocess.run([sys.executable, os.path.join(ROOT, "sync_shuili_mirror.py")])
    if _r.returncode != 0:
        print("⚠️ sync_shuili_mirror.py 返回非零，请手动核查")

    print("📦 回退备份目录:", BACKUP_DIR)
    print("✅ bump_version_v346 完成。下一步：bump_version_v346_build.py（四端出包）")


if __name__ == "__main__":
    main()
