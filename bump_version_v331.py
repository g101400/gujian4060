# -*- coding: utf-8 -*-
"""三产品全链路版本号同步升级（8 处位置）。

真相源：<android_proj>/assets/version.json
用法：python3 bump_version_v331.py [--dry]
"""
import io
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DRY = "--dry" in sys.argv

DATE = "2026-08-25"
DATE_C = "20260825"

CHANGELOG = {
    "shuili": (
        "v3.31：ovobj/obj 全面修复 + 四平台同步——①导入 ovobj/obj 仿 ovkmz 增加"
        "「选单个文件 / 选整个文件夹批量」двух选择，弹窗明确列出可选后缀（.ovobj/.obj/.txt/.csv），"
        "解决「点了没反应、不知道从哪个文件导入」；②原生桥 escapeJson 补转义单引号，"
        "根治文件名含 ' 时的「运行错误：Script error. @0:0」；③新增 pickFolder（"
        "ACTION_OPEN_DOCUMENT_TREE 递归枚举，最多 6 层，按后缀过滤）；④建筑物与照片同时添加时"
        "表单文字实时回写（oninput→flushEditFields），不再因重建表单丢失已填信息；"
        "⑤导出 zip 照片前先压缩（>1.5MB 走 canvasCompress），导出体积大幅下降；"
        "⑥UOS DEB 架构对照修正（龙芯 3A3000/3A4000→mips64el、3A5000+→loongarch64、"
        "FT2000/鲲鹏→arm64、其余→amd64），支持 ARCH= 覆盖，修复「架构不匹配」安装失败；"
        "⑦三产品四平台（Android/Win11/统信UOS/iOS PWA）webroot 全量同步，index.html 补加载 ovobj_bridge.js。"
    ),
    "perc": (
        "v1.7：与水利 v3.31 同步——ovobj/obj 导入支持「单文件/整文件夹批量」选择并明示可选后缀；"
        "原生桥 escapeJson 补单引号转义根治 Script error @0:0；新增 pickFolder 目录递归枚举；"
        "感知设施与照片同时添加时表单文字实时回写不丢失；导出 zip 照片前先压缩；"
        "UOS DEB 架构对照修正（默认 mips64el，支持 ARCH= 覆盖）；四平台 webroot 全量同步。"
    ),
    "gujian": (
        "v1.9：与水利 v3.31 同步——ovobj/obj 导入支持「单文件/整文件夹批量」选择并明示可选后缀；"
        "原生桥 escapeJson 补单引号转义根治 Script error @0:0；新增 pickFolder 目录递归枚举；"
        "古建与照片同时添加时表单文字实时回写不丢失；导出 zip 照片前先压缩；"
        "UOS DEB 架构对照修正（默认 mips64el，支持 ARCH= 覆盖）；四平台 webroot 全量同步。"
    ),
}

PRODUCTS = {
    "shuili": {
        "old": "3.30.3", "new": "3.31",
        "old_code": 33, "new_code": 34,
        "old_msi": "3.30.1", "old_msi_full": "3.30.1.20260824",
        "vprefix": "v",
        "proj": "android-build/shuili-v329",
        "mirror_assets": ["android-build/water-v329/assets"],
        "webroots": ["native-shell/win-water-webview2/webroot",
                     "native-shell/uos-water-pyqt6/webroot"],
        "wxs": "native-shell/win-water-webview2/build_msi.wxs",
        "debsh": "native-shell/uos-water-pyqt6/build_deb.sh",
    },
    "perc": {
        "old": "1.6.3", "new": "1.7",
        "old_code": 12, "new_code": 13,
        "old_msi": "1.6.1", "old_msi_full": "1.6.1.20260824",
        "vprefix": "v",
        "proj": "android-build/perc-v13",
        "mirror_assets": [],
        "webroots": ["native-shell/win-webview2/webroot",
                     "native-shell/uos-pyqt6/webroot"],
        "wxs": "native-shell/win-webview2/build_msi.wxs",
        "debsh": "native-shell/uos-pyqt6/build_deb.sh",
    },
    "gujian": {
        "old": "1.8.3", "new": "1.9",
        "old_code": 12, "new_code": 13,
        "old_msi": "1.8.1", "old_msi_full": "1.8.1.20260824",
        "vprefix": "",
        "proj": "travel/android",
        "mirror_assets": [],
        "webroots": ["native-shell/win-gujian-webview2/webroot",
                     "native-shell/uos-gujian-pyqt6/webroot"],
        "wxs": "native-shell/win-gujian-webview2/build_msi.wxs",
        "debsh": "native-shell/uos-gujian-pyqt6/build_deb.sh",
    },
}

changed = []


def rp(p):
    return os.path.join(ROOT, p)


def read(p):
    with io.open(p, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def write(p, t):
    if DRY:
        return
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(t)


def sub_file(path, pairs, label):
    """pairs: [(regex, repl)]，全部按 re.sub 执行。"""
    p = rp(path)
    if not os.path.isfile(p):
        print("  [skip] 不存在 %s" % path)
        return False
    old = read(p)
    new = old
    for pat, repl in pairs:
        new = re.sub(pat, repl, new)
    if new == old:
        print("  [=] %s（%s 无变化）" % (path, label))
        return False
    write(p, new)
    changed.append(path)
    print("  [✓] %s ← %s" % (path, label))
    return True


def bump_version_json(path, cfg, key):
    p = rp(path)
    if not os.path.isfile(p):
        print("  [skip] 不存在 %s" % path)
        return
    d = json.loads(read(p))
    d["version"] = cfg["new"]
    d["versionCode"] = cfg["new_code"]
    d["buildDate"] = DATE
    desc = d.get("desc", "")
    tag = CHANGELOG[key].split("：")[0] + "："
    if tag not in desc:
        # 在第一句（产品说明）后插入新版变更
        head, sep, tail = desc.partition("。")
        d["desc"] = (head + sep + CHANGELOG[key] + tail) if sep else (CHANGELOG[key] + desc)
    if not DRY:
        with io.open(p, "w", encoding="utf-8", newline="\n") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
            f.write("\n")
    changed.append(path)
    print("  [✓] %s ← version=%s code=%s date=%s" % (path, cfg["new"], cfg["new_code"], DATE))


def main():
    for key, cfg in PRODUCTS.items():
        old, new = cfg["old"], cfg["new"]
        vp = cfg["vprefix"]
        print("\n===== %s : %s -> %s (code %s -> %s) =====" % (key, old, new, cfg["old_code"], cfg["new_code"]))

        # (1) assets/version.json —— 唯一真相源
        bump_version_json(os.path.join(cfg["proj"], "assets/version.json"), cfg, key)

        # (2) assets/app.js —— APP_VERSION + APP_BUILD_DATE
        sub_file(os.path.join(cfg["proj"], "assets/app.js"), [
            (r'(var\s+APP_VERSION\s*=\s*")[^"]*(")', r'\g<1>%s%s\g<2>' % (vp, new)),
            (r'(var\s+APP_BUILD_DATE\s*=\s*")[^"]*(")', r'\g<1>%s\g<2>' % DATE),
        ], "APP_VERSION=%s%s / APP_BUILD_DATE=%s" % (vp, new, DATE))

        # (3) AndroidManifest.xml
        sub_file(os.path.join(cfg["proj"], "AndroidManifest.xml"), [
            (r'android:versionCode="\d+"', 'android:versionCode="%d"' % cfg["new_code"]),
            (r'android:versionName="[^"]*"', 'android:versionName="%s"' % new),
        ], "versionCode/versionName")

        # (4) webroot 同步（version.json + app.js + ovobj_bridge.js）
        src_assets = rp(os.path.join(cfg["proj"], "assets"))
        for wr in cfg["webroots"] + cfg["mirror_assets"]:
            dst = rp(wr)
            if not os.path.isdir(dst):
                print("  [skip] webroot 不存在 %s" % wr)
                continue
            for fn in ("version.json", "app.js", "ovobj_bridge.js"):
                s = os.path.join(src_assets, fn)
                if os.path.isfile(s):
                    if not DRY:
                        shutil.copy2(s, os.path.join(dst, fn))
            changed.append(wr + "/{version.json,app.js,ovobj_bridge.js}")
            print("  [✓] 同步 -> %s" % wr)

        # (5) build_msi.wxs
        sub_file(cfg["wxs"], [
            (r'(<Package[^>]*?Version=")[0-9.]+(")', r'\g<1>%s\g<2>' % new),
        ], 'wxs Package Version="%s"' % new)

        # (6) build_deb.sh
        sub_file(cfg["debsh"], [
            (r'VERSION="[^"]*"', 'VERSION="%s.%s"' % (new, DATE_C)),
        ], 'VERSION="%s.%s"' % (new, DATE_C))

    # (7) 集中式构建脚本（三产品一处）
    print("\n===== 集中构建脚本 =====")
    pairs_common = []
    for key, cfg in PRODUCTS.items():
        pairs_common += [
            (re.escape(cfg["old_msi_full"]), "%s.%s" % (cfg["new"], DATE_C)),
            (re.escape(cfg["old"] + "_20260824"), "%s_%s" % (cfg["new"], DATE_C)),
            (re.escape("V" + cfg["old_msi"] + "_20260824"), "V%s_%s" % (cfg["new"], DATE_C)),
            (re.escape(cfg["old_msi"] + "_20260824"), "%s_%s" % (cfg["new"], DATE_C)),
            (r'\|' + re.escape(cfg["old"]) + r'\|', "|%s|" % cfg["new"]),
            (r'"ver"\s*:\s*"' + re.escape(cfg["old_msi"]) + r'"', '"ver":"%s"' % cfg["new"]),
        ]
    for f in ["native-shell/make_deb.py", "native-shell/make_msi.py",
              "native-shell/gen_win_msi.py", "native-shell/water-ios/build_ios_zip.py",
              "build_four_ends.sh"]:
        sub_file(f, pairs_common, "版本串 -> v3.31/1.7/1.9 @%s" % DATE_C)

    print("\n===== 汇总 =====")
    print("修改条目：%d" % len(changed))
    if DRY:
        print("(dry-run，未落盘)")


if __name__ == "__main__":
    main()
