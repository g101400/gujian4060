#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bump_version_v344.py — 三产品版本同步 v3.43/v1.19/v3.1 -> v3.44/v1.20/v3.2
三图三日智能化更新同步，按核心差异化：
  水利 v3.43 -> v3.44：hotfix 已经在 v3.43 全完成，此版记录感知/古建差异化对齐
  感知 v1.19 -> v1.20：修 cp 失误（APPNAME/LS_KEY/data.js 都换回感知语）
  古建 v3.1  -> v3.2 ：注入 v3.2 古建智能化补丁（5 级组织=景区、17 类古建类型、快捷常用、ZIP 三级、AI 联网、4 历史关键词）

要求：
  - travel/android 同步 v3.2（古建）
  - android-build/perc-v13 同步 v1.20（感知）
  - android-build/shuili-v329 + water-v329 同步 v3.44（水利）
  - uos-pyqt6 (perc), uos-water-pyqt6 (shuili), uos-gujian-pyqt6 (gujian) 各端同步
  - win-webview2 (publish_win_perc), win-water-webview2, win-gujian-webview2 各端同步
  - make_deb.py / gen_win_msi_wix7.py / build_ios_zip.py 硬编码版本串
  - 备份到 backup_2026-08-30_before_v344/
"""
import json, re, shutil, os, pathlib, sys, subprocess

ROOT = "D:/Users/Claw"
NEW_BUILD_DATE = "2026-08-30"
BACKUP_DIR = os.path.join(ROOT, "backup_2026-08-30_before_v344")

PRODUCTS = {
    "shuili": dict(
        old_ver="3.43", new_ver="3.44", old_code=44, new_code=45,
        app_ver_has_v=True,
        canonical_assets=os.path.join(ROOT, "android-build/shuili-v329/assets"),
        mirror_assets=[os.path.join(ROOT, "android-build/water-v329/assets"),
                       "D:/Users/aowwei_app/webroot_shuili"],
        extra_roots=[],
        webroots=[os.path.join(ROOT, "native-shell/win-water-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/uos-water-pyqt6/webroot")],
        deb_old="3.43.20260830", deb_new="3.44.20260830",
        msi_old="3.43.0", msi_new="3.44.0",
        ios_old="3.43_20260830", ios_new="3.44_20260830",
        desc="三日智能化更新三端深度同步——①感知 v1.20 修复 cp 失误遗物（APPNAME/LS_KEY/data.js 全部回归感知语义，ai_module.init 的 domain/appName/fieldSchema 区分感知子系统）；②古建 v3.2 注入 5 级景区组织（景区→园区→子景点→打卡位→标签）+17 类古建专属类型（古塔/寺庙/城墙/古桥/园林/陵墓/书院/会馆/故居/古街/楼阁/亭台/坛庙/宫殿/石窟/衙署/其他）+快捷常用 ⭐ 菜单组（星标 vs 点击严格隔离）+历史关键词可折叠面板（filter 区顶部）+ZIP 三级匹配古建版（spot→area→sub→point→tag）+AI 联网核实公开文物系统提示词；③三图核心差异化对齐完成（水利/感知=内部资料不联网；古建=公共受众，联网开+文物局权威优先）；四平台同步保持。",
    ),
    "perc": dict(
        old_ver="1.19", new_ver="1.20", old_code=24, new_code=25,
        app_ver_has_v=True,
        canonical_assets=os.path.join(ROOT, "android-build/perc-v13/assets"),
        mirror_assets=[],
        extra_roots=[],
        webroots=[os.path.join(ROOT, "native-shell/win-webview2/publish_win_perc/webroot"),
                  os.path.join(ROOT, "native-shell/uos-pyqt6/webroot")],
        deb_old="1.19.20260830", deb_new="1.20.20260830",
        msi_old="1.19.0", msi_new="1.20.0",
        ios_old="1.19_20260830", ios_new="1.20_20260830",
        desc="感知项目差异化修复——①还原 v3.41 cp 失误遗留：APPNAME 改回「水利感知项目一张图」、LS_KEY 改回「perc_map_v2」、data.js 改回 PERCEPTION_DATA、AI Module init 的 domain/appName 改回感知域；②AI Module fieldSchema 补 subsystem 设备子系统（视频监控/雨水情/大坝安全/地下水源四类子系统）；③智能查询 placeholder 自动感知语（北台上液位传感器）；④感知设备独有元数据：subsystem（子系统）+equip_type（设备类型）字段；四平台同步保持+UOS deb webroot 指向 uos-pyqt6 修正避免误用水利数据。",
    ),
    "gujian": dict(
        old_ver="3.1", new_ver="3.2", old_code=24, new_code=25,
        app_ver_has_v=False,
        canonical_assets=os.path.join(ROOT, "android-build/gujian-v31/assets"),
        mirror_assets=[os.path.join(ROOT, "travel/android/assets")],
        extra_roots=[],
        webroots=[os.path.join(ROOT, "native-shell/win-gujian-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/uos-gujian-pyqt6/webroot")],
        deb_old="3.1.20260830", deb_new="3.2.20260830",
        msi_old="3.1.0", msi_new="3.2.0",
        ios_old="3.1_20260830", ios_new="3.2_20260830",
        desc="v3.2 古建智能化升级（公共受众向）——①注入 v3.2 古建专属补丁：5 级景区组织（景区→园区→子景点→打卡位→标签，对应 key=spot/area/sub/point/tag，5 级独立可空）；②17 类古建专属 CANONICAL_TYPES（古塔/寺庙/城墙/古桥/园林/陵墓/书院/会馆/故居/古街/楼阁/亭台/坛庙/宫殿/石窟/衙署/其他，customTypes 用户可自由增删）+古建类型筛选 chip；③快捷常用 ⭐ 菜单组（v3.42 同款，菜单项右侧 ★/☆ 星标，开关 + 点击隔离，星标收藏结果在「拍照打卡」之前显示为独立分组，零依赖继承水利快捷常用）；④历史关键词可折叠面板（仿 B1，filter 区顶部，点击展开 20 条历史关键词 chip 一键回填）；⑤周边搜索 nbtype chip 升级（B4 古建版，包装原 nearbySearch，注入 nbtype_v32 chip 渲染到筛选区，点击 stopPropagation 防误触）；⑥ZIP 三级匹配古建版（itemOrgScope 按 spot→area→sub→point→tag 链式下钻）；⑦AI 系统提示词注入古建文物助手分支（联网核实公开文物，优先引用文物局/UNESCO/世界遗产委员会官网，禁止编造内部参数）；⑧AI 智能查询 placeholder 自动古建语（颐和园佛香阁的建筑年代与结构特点），已由 ai_module.js 接管；⑨ menu-fav 星标 vs 点击隔离（B5），通过 stopPropagation+preventDefault+防御性 return 实现；四平台同步保持。",
    ),
}


def backup(path):
    rel = os.path.relpath(path, ROOT)
    dst = os.path.join(BACKUP_DIR, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst):
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
        print("⚠️ %s: APP_VERSION 命中 %d 次（期望1），尝试模糊匹配" % (path, hits))
        # 模糊匹配：去掉 v 前缀
        for pat in [re.escape('var APP_VERSION = "v' + p["old_ver"] + '"'),
                    re.escape('var APP_VERSION = "' + p["old_ver"] + '"')]:
            t2, n = re.subn(pat, 'var APP_VERSION = "%s%s";' % ("v" if p["app_ver_has_v"] else "", p["new_ver"]), t, count=1)
            if n == 1:
                t = t2; hits = 1; break
    assert hits == 1, "%s: APP_VERSION 命中失败 pattern=%r" % (path, old_s)
    t2 = t.replace(old_s, new_s) if old_s in t else t
    t2, n = re.subn(r'(var APP_BUILD_DATE = ")[^"]*(")', r'\g<1>%s\g<2>' % NEW_BUILD_DATE, t2, count=1)
    if n == 0:
        # 古建 version.json 已经是 2026-08-30，APPNAME 都设置了日期，但 app.js 里的 BUILD_DATE 可能不同
        # 尝试无尾分号匹配
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
    desc = desc.replace("%s：%s：" % (p["old_ver"], p["old_ver"]), "%s：" % p["old_ver"])
    desc = re.sub(r"。。(v%s：)" % re.escape(p["old_ver"]), r"。\1", desc)
    new_section = "v%s：%s。" % (p["new_ver"], p["desc"].rstrip("。"))
    new_desc, n = re.subn(r"(。)(v%s：)" % re.escape(p["old_ver"]),
                          lambda m: m.group(1) + new_section + m.group(2), desc, count=1)
    if n == 1:
        d["desc"] = new_desc
    else:
        print("⚠️ %s: desc 中未找到 v%s：插入点，append 到 head" % (path, p["old_ver"]))
        d["desc"] = new_section + desc
    pathlib.Path(path).write_text(
        json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_build_script(path, repls):
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

    # make_deb.py
    mdeb = os.path.join(ROOT, "native-shell/make_deb.py")
    patch_build_script(mdeb, [('"ver": "%s"' % p["deb_old"], '"ver": "%s"' % p["deb_new"])
                              for p in PRODUCTS.values()])
    # gen_win_msi_wix7.py
    mmsi = os.path.join(ROOT, "native-shell/gen_win_msi_wix7.py")
    patch_build_script(mmsi, [('"ver":"%s"' % p["msi_old"], '"ver":"%s"' % p["msi_new"])
                              for p in PRODUCTS.values()])
    # build_ios_zip.py
    mios = os.path.join(ROOT, "native-shell/water-ios/build_ios_zip.py")
    ios_repls = []
    for p in PRODUCTS.values():
        ios_repls.append(('"%s"' % p["ios_old"], '"%s"' % p["ios_new"]))
        ios_repls.append(('"V%s"' % p["ios_old"], '"V%s"' % p["ios_new"]))
    patch_build_script(mios, ios_repls)
    print("✅ make_deb.py / gen_win_msi_wix7.py / build_ios_zip.py 版本串已更新")
    # sync_shuili_mirror.py 全量对齐
    print("🔄 sync_shuili_mirror.py...")
    _r = subprocess.run([sys.executable, os.path.join(ROOT, "sync_shuili_mirror.py")])
    if _r.returncode != 0:
        print("⚠️ sync_shuili_mirror.py 返回非零，请手动核查")
    print("📦 回退备份目录:", BACKUP_DIR)


if __name__ == "__main__":
    main()
