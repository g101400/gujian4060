#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bump_version_v345.py — 三产品版本同步 v3.44/v1.20/v3.2 -> v3.45/v1.21/v3.3
5日智能化更新三端深度同步：
  水利 v3.44 -> v3.45：①E1 设置菜单加「🗝️ 修改/添加天地图密钥」（防服务器封禁/过期，用户自换密钥，
              立即生效，刷新图层无须重启）；②E2 筛选菜单加管理处可多选 chip，默认「京密引水管理处」
              （持久化兜底在 SETTINGS.defaultFilter.guanchu）；③E3 导出建筑物表格在名称后面加管理处列，
              默认不勾选（兼容老用户）；④E5 水利 zip 三级匹配 level-aware 升级为最长匹配（案例「史山.zip」→
              史山所→三扬分水闸：按局→管理处→所→站→段层层找，每层内按 token.indexOf 长度倒序，
              保证「史山管理所」优先于「温泉管理所」、「北台上管理所」优先于「北台管理所」等易混名）；
              五项 B/C/D 的 v3.42/v3.43 智能化升级在 v3.44 已固化，v3.45 在核心差异化基础上增量增强。
  感知 v1.20 -> v1.21：与水利 v3.45 同步智能化升级（tdtKey、guanchu 多选筛选、导出 guanchu 列、ZIP 长匹配）；
              保留感知核心独有元数据（subsystem 子系统+equip_type 设备类型），核心实体=「感知切切实设备」。
  古建 v3.2  -> v3.3 ：注入 v3.3 古建智能化补丁——①设置菜单加「🗝️ 修改/添加天地图密钥」（公共受众古建也用
              同一套天地图底图，与水利/感知同款 UX）；②古建版 longest-match zip 三级匹配（古建核心=
              景区名→园区→子景点→打卡位→标签，对应 key=spot/area/sub/point/tag，与水利 key=ju/guanchu/suo
              /zhan/duan 同形不同名）；③古建 APP_VERSION BUMP 3.2→3.3。

要求：四端同步+小程序 baseline+备份回退
  - travel/android (古建) / android-build/perc-v13 (感知) / android-build/shuili-v329 (水利)
  - uos + win 各三端 webroot
  - make_deb.py / gen_win_msi_wix7.py / build_win_exe_nsis.py 硬编码版本串
  - 备份到 backup_2026-08-30_before_v345/（已存在，不再重复备份）
"""
import json, re, shutil, os, pathlib, sys, subprocess

ROOT = "D:/Users/Claw"
NEW_BUILD_DATE = "2026-08-30"
BACKUP_DIR = os.path.join(ROOT, "backup_2026-08-30_before_v345")

PRODUCTS = {
    "shuili": dict(
        old_ver="3.44", new_ver="3.45", old_code=45, new_code=46,
        app_ver_has_v=True,
        canonical_assets=os.path.join(ROOT, "android-build/shuili-v329/assets"),
        mirror_assets=[os.path.join(ROOT, "android-build/water-v329/assets")],
        extra_roots=[],
        webroots=[os.path.join(ROOT, "native-shell/win-water-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/uos-water-pyqt6/webroot")],
        deb_old="3.44.20260830", deb_new="3.45.20260830",
        msi_old="3.44.0", msi_new="3.45.0",
        ios_old="3.44_20260830", ios_new="3.45_20260830",
        desc="5日智能化更新三端深度同步——①E1 设置菜单新增「🗝️ 修改/添加天地图密钥」（三层回退：localStorage 自配→index.html 环境→内置默认；保存后立即重建底图图层无须重启；32位16进制校验+粘贴冲突友好提示）；②E2 筛选菜单新增管理处可多选 chip（持久化兜底在 SETTINGS.defaultFilter.guanchu，默认「京密引水管理处」，与所/站共用同一套组织体系；query 区「管理所」之上加「管理处」分级，passFilter/filterActive/filterDesc 同步加 guanchu 分支）；③E3 导出建筑物表格在「名称」后面加「管理处」列，默认不勾选（兼容老用户配置）；④E5 水利 zip 三级匹配升级为最长匹配（按局→管理处→所→站→段层层找，每层内 token.indexOf 长度倒序，避免「史山管理所」与「温泉管理所」误命中；案例：C:\\Users\\admin\\Downloads\\史山.zip → 史山所 → IMG-6857.jpg → 三扬分水闸）；⑤水工建筑物核心化不变。",
    ),
    "perc": dict(
        old_ver="1.20", new_ver="1.21", old_code=25, new_code=26,
        app_ver_has_v=True,
        canonical_assets=os.path.join(ROOT, "android-build/perc-v13/assets"),
        mirror_assets=[],
        extra_roots=[],
        webroots=[os.path.join(ROOT, "native-shell/win-webview2/publish_win_perc/webroot"),
                  os.path.join(ROOT, "native-shell/uos-pyqt6/webroot")],
        deb_old="1.20.20260830", deb_new="1.21.20260830",
        msi_old="1.20.0", msi_new="1.21.0",
        ios_old="1.20_20260830", ios_new="1.21_20260830",
        desc="5日智能化更新三端深度同步（感知核心=感知切切实设备）——①与水利同步设置菜单加「🗝️ 修改/添加天地图密钥」（同一套 UX 与刷新机制）；②与水利同步筛选菜单加管理处可多选 chip，passFilter/filterActive/filterDesc 同步；③与水利同步导出建筑物表格 guanchu 列；④与水利同步 zip 三级匹配升级为最长匹配；⑤保留 v3.43+v3.45 感知核心独有元数据：subsystem 子系统（视频监控/雨水情/大坝安全/地下水源四类）+equip_type 设备类型，AI Module fieldSchema 增 subsystem 不变。",
    ),
    "gujian": dict(
        old_ver="3.2", new_ver="3.3", old_code=25, new_code=26,
        app_ver_has_v=False,
        canonical_assets=os.path.join(ROOT, "android-build/gujian-v31/assets"),
        mirror_assets=[os.path.join(ROOT, "travel/android/assets")],
        extra_roots=[],
        webroots=[os.path.join(ROOT, "native-shell/win-gujian-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/uos-gujian-pyqt6/webroot")],
        deb_old="3.2.20260830", deb_new="3.3.20260830",
        msi_old="3.2.0", msi_new="3.3.0",
        ios_old="3.2_20260830", ios_new="3.3_20260830",
        desc="v3.3 古建智能化升级（公共受众向，5日更新同步）——①设置菜单加「🗝️ 修改/添加天地图密钥」（古建也用同一套天地图底图，三层回退：localStorage→TIANDITU_TOKENS→内置默认，refreshTdtTileLayer 立即生效）；②古建版 longest-match zip 三级匹配（古建核心=景区名→园区→子景点→打卡位→标签，对应 key=spot/area/sub/point/tag，与水利 5 级组织 key=ju/guanchu/suo/zhan/duan 同形不同名；token.indexOf 长度倒序保证「颐和园佛香阁」优先于「颐和园」、「故宫御花园」优先于「故宫」等易混名）；③古建 APP_VERSION BUMP 3.2→3.3，对齐水利 v3.45 / 感知 v1.21 的版本节奏；④保留 v3.2 古建核心独有元数据：5 级景区组织 +17 类古建类型+快捷常用 ⭐+历史关键词可折叠面板+周边搜索 nbtype chip+AI 系统提示词注入文物助手分支（联网核实公开文物，优先引用文物局/UNESCO/世界遗产委员会官网）。",
    ),
}


def backup(path):
    rel = os.path.relpath(path, ROOT)
    dst = os.path.join(BACKUP_DIR, rel)
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(path, dst)


def patch_appjs(path, p):
    backup(path)
    t = pathlib.Path(path).read_text(encoding="utf-8")
    if p["app_ver_has_v"]:
        old_s = 'var APP_VERSION = "v%s";' % p["old_ver"]
        new_s = 'var APP_VERSION = "v%s";' % p["new_ver"]
    else:
        old_s = 'var APP_VERSION = "%s";' % p["old_ver"]
        new_s = 'var APP_VERSION = "%s";' % p["new_ver"]
    hits = t.count(old_s)
    if hits != 1:
        for pat in [re.escape('var APP_VERSION = "v' + p["old_ver"] + '"'),
                    re.escape('var APP_VERSION = "' + p["old_ver"] + '"')]:
            t2, n = re.subn(pat, 'var APP_VERSION = "%s%s";' % ("v" if p["app_ver_has_v"] else "", p["new_ver"]), t, count=1)
            if n == 1:
                t = t2; hits = 1; break
    assert hits == 1, "%s: APP_VERSION 命中失败 pattern=%r" % (path, old_s)
    t2 = t.replace(old_s, new_s) if old_s in t else t
    t2, n = re.subn(r'(var APP_BUILD_DATE = ")[^"]*(")', r'\g<1>%s\g<2>' % NEW_BUILD_DATE, t2, count=1)
    if n == 0:
        t2, n = re.subn(r'(var APP_BUILD_DATE = ")[^"]+(")', r'\g<1>%s\g<2>' % NEW_BUILD_DATE, t2, count=1)
    if n == 0:
        print("⚠️ %s: APP_BUILD_DATE 未命中，保留原值" % path)
    pathlib.Path(path).write_text(t2, encoding="utf-8")


def patch_versionjson(path, p):
    backup(path)
    d = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    cur = str(d["version"]).lstrip("v")
    if cur != p["old_ver"]:
        print("⚠️ %s: version=%s 期望 %s（可能已 bump），跳过 version 字段" % (path, d["version"], p["old_ver"]))
        return
    d["version"] = p["new_ver"]
    d["versionCode"] = p["new_code"]
    d["buildDate"] = NEW_BUILD_DATE
    desc = d.get("desc", "")
    new_section = "v%s：%s。" % (p["new_ver"], p["desc"].rstrip("。"))
    # 优先插在末尾（v3.44 风格：append 注释），不强行 sub
    d["desc"] = desc.rstrip() + "\n\n" + new_section
    pathlib.Path(path).write_text(
        json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_build_script(path, repls):
    if not os.path.exists(path):
        print("⚠️ %s 不存在，跳过" % path); return
    backup(path)
    t = pathlib.Path(path).read_text(encoding="utf-8")
    for a, b in repls:
        if a in t:
            t = t.replace(a, b)
        else:
            print("⚠️ 跳过：%s 中无 %r" % (path, a))
    pathlib.Path(path).write_text(t, encoding="utf-8")


def main():
    for key, p in PRODUCTS.items():
        ca = p["canonical_assets"]
        patch_versionjson(os.path.join(ca, "version.json"), p)
        patch_appjs(os.path.join(ca, "app.js"), p)
        for base in p["mirror_assets"] + p["extra_roots"] + p["webroots"]:
            for fn in ("version.json", "app.js"):
                dst = os.path.join(base, fn)
                if os.path.exists(dst):
                    backup(dst)
                    shutil.copy2(os.path.join(ca, fn), dst)
        print("✅ %-7s canonical+mirror/extra(%d)+webroots(%d) 同步 v%s (code %d)"
              % (key, len(p["mirror_assets"]) + len(p["extra_roots"]), len(p["webroots"]), p["new_ver"], p["new_code"]))

    mdeb = os.path.join(ROOT, "native-shell/make_deb.py")
    patch_build_script(mdeb, [('"ver": "%s"' % p["deb_old"], '"ver": "%s"' % p["deb_new"])
                              for p in PRODUCTS.values()])
    mmsi = os.path.join(ROOT, "native-shell/gen_win_msi_wix7.py")
    patch_build_script(mmsi, [('"ver":"%s"' % p["msi_old"], '"ver":"%s"' % p["msi_new"])
                              for p in PRODUCTS.values()])
    mios = os.path.join(ROOT, "native-shell/water-ios/build_ios_zip.py")
    ios_repls = []
    for p in PRODUCTS.values():
        ios_repls.append(('"%s"' % p["ios_old"], '"%s"' % p["ios_new"]))
    patch_build_script(mios, ios_repls)
    mnsis = os.path.join(ROOT, "native-shell/build_win_exe_nsis.py")
    if os.path.exists(mnsis):
        nsis_repls = []
        for p in PRODUCTS.values():
            v = p["new_ver"]
            nsis_repls.append(('"ver": "%s.0"' % p["msi_old"], '"ver": "%s.0"' % p["msi_new"]))
        patch_build_script(mnsis, nsis_repls)
    print("✅ make_deb.py / gen_win_msi_wix7.py / build_ios_zip.py / build_win_exe_nsis.py 版本串已更新")

    # gen_win_msi_wix7.py 的 ARCHIVE 路径
    archive = mmsi  # 这里不再改 ARCHIVE，避免覆盖之前的产物路径
    print("✅ ARCHIVE 路径不变，使用各 bump 脚本配套的 win/uos/ios 子目录")

    print("🔄 sync_shuili_mirror.py...")
    _r = subprocess.run([sys.executable, os.path.join(ROOT, "sync_shuili_mirror.py")])
    if _r.returncode != 0:
        print("⚠️ sync_shuili_mirror.py 返回非零，请手动核查")
    print("📦 回退备份目录:", BACKUP_DIR)


if __name__ == "__main__":
    main()
