#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bump_version_v341.py — 三产品版本八处同步（水利工程一张图 / 水利感知 / 古建打卡）
水利一张图 v3.40 -> v3.41 (code 41->42) | 水利感知 v1.16 -> v1.17 (21->22) | 古建打卡 v2.8 -> v2.9 (21->22)

改 version.json(真相源) + app.js(APP_VERSION/APP_BUILD_DATE)
  -> copy2 到 win/uos webroot + travel/webroot(古建 dev 根) + water staging 镜像
  -> 改 make_deb.py / gen_win_msi_wix7.py / water-ios/build_ios_zip.py 内的硬编码版本串。

本版额外：
  * 修复上一版 desc 遗留的双前缀（v3.40：v3.40：）与双句号（。。v3.38：）；
  * gujian APP_VERSION 无 v 前缀坑（带 v/不带 v 双模式匹配，精确断言命中一次）。

改动前自动备份到 backup_2026-08-29_before_v341/ 以支持回退（铁律#9）。
用法：python3 bump_version_v341.py
"""
import json, re, shutil, os, pathlib, sys, subprocess

ROOT = "D:/Users/Claw"
NEW_BUILD_DATE = "2026-08-29"
BACKUP_DIR = os.path.join(ROOT, "backup_2026-08-29_before_v341")

PRODUCTS = {
    "shuili": dict(
        old_ver="3.40", new_ver="3.41", old_code=41, new_code=42,
        app_ver_has_v=True,
        canonical_assets=os.path.join(ROOT, "android-build/shuili-v329/assets"),
        mirror_assets=[os.path.join(ROOT, "android-build/water-v329/assets"),
                       "D:/Users/aowwei_app/webroot_shuili"],
        extra_roots=[],
        webroots=[os.path.join(ROOT, "native-shell/win-water-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/uos-water-pyqt6/webroot")],
        deb_old="3.40.20260829", deb_new="3.41.20260829",
        msi_old="3.40.0", msi_new="3.41.0",
        ios_old="3.40_20260829", ios_new="3.41_20260829",
        desc="智能AI×知识库深度融合与交互修复——①发行前预生成建筑骨干知识库：kb_building_seed.js 随安装包内置(557条)，安装即有本地KB，支持重新播种/导出/导入；②智能AI查询与知识库查询融合同一引擎：先查本地(结果标注🔒本地)，本地无且允许联网再走大模型(标注🌐在线)，无结果友好提示，根治「运行错误: script error」，查询前增加确认按钮；③知识库支持读取网页入库(普通网页/微信公众号/微博)；④智能更新补丁预览改可编辑输入框，应用前可逐字段修改；⑤修复筛选照片状态点击卡顿/死机(事件委托，不再重建DOM)；⑥筛选管理所/管理站支持手动添加与改名(逐个确认同步受影响建筑物)，添加/编辑建筑物表单管理所/管理站改下拉选择(读持久化记录)；⑦筛选关键词历史记录(可展开/收起)；⑧周边搜索新增当前位置/地图选坐标中心+按周边建筑物类型筛选；⑨导出建筑物表格/照片管理所覆盖全部9所并按建筑物自动匹配；⑩导出 ovkmz/ovobj/照片/表格均支持自定义文件名(ovkmz/ovobj 新增导出前对话框)；四平台同步＋UOS deb ar头铁律回归保持。",
    ),
    "perc": dict(
        old_ver="1.16", new_ver="1.17", old_code=21, new_code=22,
        app_ver_has_v=True,
        canonical_assets=os.path.join(ROOT, "android-build/perc-v13/assets"),
        mirror_assets=[],
        extra_roots=[],
        webroots=[os.path.join(ROOT, "native-shell/win-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/uos-pyqt6/webroot")],
        deb_old="1.16.20260829", deb_new="1.17.20260829",
        msi_old="1.16.0", msi_new="1.17.0",
        ios_old="1.16_20260829", ios_new="1.17_20260829",
        desc="与水利 v3.41 同源智能AI增强——①发行前预生成知识库种子(1125条监测设施随包内置，含子系统/参数/照片/坐标)；②智能AI×知识库查询融合：本地优先(🔒本地)→在线兜底(🌐在线)，无结果友好提示，根治script error，查询前确认按钮；③知识库支持读取网页入库(普通网页/微信公众号/微博)；④智能更新补丁预览改可编辑输入框；四平台同步保持。",
    ),
    "gujian": dict(
        old_ver="2.8", new_ver="2.9", old_code=21, new_code=22,
        app_ver_has_v=False,
        canonical_assets=os.path.join(ROOT, "travel/android/assets"),
        mirror_assets=[],
        extra_roots=[os.path.join(ROOT, "travel/webroot")],
        webroots=[os.path.join(ROOT, "native-shell/win-gujian-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/uos-gujian-pyqt6/webroot")],
        deb_old="2.8.20260829", deb_new="2.9.20260829",
        msi_old="2.8.0", msi_new="2.9.0",
        ios_old="2.8_20260829", ios_new="2.9_20260829",
        desc="与水利 v3.41 同源智能AI增强——①发行前预生成知识库种子(1032条古建随包内置，含属地/朝代/级别/简介/特点)；②智能AI×知识库查询融合：本地优先(🔒本地)→在线兜底(🌐在线)，无结果友好提示，根治script error；③知识库支持读取网页入库(普通网页/微信公众号/微博)；④智能更新补丁预览改可编辑输入框；四平台同步保持。",
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
    assert hits == 1, "%s: APP_VERSION 命中 %d 次（期望1） pattern=%r" % (path, hits, old_s)
    t2 = t.replace(old_s, new_s)
    t2, n = re.subn(r'(var APP_BUILD_DATE = ")[^"]*(");', r'\g<1>%s\g<2>' % NEW_BUILD_DATE, t2, count=1)
    assert n == 1, "%s: APP_BUILD_DATE 未命中" % path
    pathlib.Path(path).write_text(t2, encoding="utf-8")


def patch_versionjson(path, p):
    backup(path)
    d = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    cur = str(d["version"]).lstrip("v")
    assert cur == p["old_ver"], "%s: version=%s 期望 %s（可能已 bump）" % (path, d["version"], p["old_ver"])
    d["version"] = p["new_ver"]
    d["versionCode"] = p["new_code"]
    d["buildDate"] = NEW_BUILD_DATE
    desc = d.get("desc", "")
    # 修复上一版遗留：双版本前缀 + 双句号
    desc = desc.replace("%s：%s：" % (p["old_ver"], p["old_ver"]), "%s：" % p["old_ver"])
    desc = re.sub(r"。。(v%s：)" % re.escape(p["old_ver"]), r"。\1", desc)
    # 插入新版本段：在「。v<old>：」前插入「v<new>：<text>。」（单句号分隔）
    new_section = "v%s：%s。" % (p["new_ver"], p["desc"].rstrip("。"))
    new_desc, n = re.subn(r"(。)(v%s：)" % re.escape(p["old_ver"]),
                          lambda m: m.group(1) + new_section + m.group(2), desc, count=1)
    assert n == 1, "%s: desc 中未找到 v%s：插入点" % (path, p["old_ver"])
    d["desc"] = new_desc
    pathlib.Path(path).write_text(
        json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_build_script(path, repls):
    backup(path)
    t = pathlib.Path(path).read_text(encoding="utf-8")
    for a, b in repls:
        assert a in t, "%s: 未找到待替换串 %r" % (path, a)
        t = t.replace(a, b)
    pathlib.Path(path).write_text(t, encoding="utf-8")


def main():
    for key, p in PRODUCTS.items():
        ca = p["canonical_assets"]
        patch_versionjson(os.path.join(ca, "version.json"), p)
        patch_appjs(os.path.join(ca, "app.js"), p)
        for base in p["mirror_assets"] + p["extra_roots"] + p["webroots"]:
            for fn in ("version.json", "app.js"):
                dst = os.path.join(base, fn)
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
    # 全量对齐镜像副本（含 webroot_shuili / water-v329/assets）——根治多副本分叉（已第5次复发）
    print("🔄 自动全量对齐镜像副本（sync_shuili_mirror.py）...")
    _r = subprocess.run([sys.executable, os.path.join(ROOT, "sync_shuili_mirror.py")])
    if _r.returncode != 0:
        print("⚠️ sync_shuili_mirror.py 返回非零，请手动核查镜像一致性")
    print("📦 回退备份目录:", BACKUP_DIR)


if __name__ == "__main__":
    main()
