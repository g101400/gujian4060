# -*- coding: utf-8 -*-
"""三产品全链路版本号同步升级 v3.32/1.8/2.0 -> v3.33/1.9/2.1（8 处位置）。
真相源：<android_proj>/assets/version.json
用法：python3 bump_version_v332.py [--dry]
"""
import io, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DRY = "--dry" in sys.argv
DATE = "2026-08-27"
DATE_C = "20260827"

CHANGELOG = {
    "shuili": (
        "v3.33：三日问题综合回归修复——①CSV 导入「读取失败：readFileText is not a function」"
        "彻底修复（Android 原生桥补 readFileText 返回 UTF-8、网页端稳健读取 readFileText→readFileBase64→清晰报错；"
        "导出/导入 CSV 格式完全一致、APP 自身可导回，与 C:/Users/admin/Downloads 实测文件往返无损）；"
        "②感知「筛选→后勤」script error 同源修复（appFly 按 id 查回建筑，根治 ReferenceError）；"
        "③管理所选项含全部 9 所（地下水源所、温泉所、龙山所、史山所、埝头所、水库所、北台上所、西田各庄所、潮河所）；"
        "④统信 UOS deb 根治「请检查deb文件是否损坏」（ar 成员大小补齐字节）；架构对照表固化："
        "3A3000/3A4000→mips64el、3A5000+→loongarch64、FT2000/鲲鹏→arm64、其余→amd64；"
        "⑤三产品四平台（Android/Win11/统信UOS/iOS PWA）webroot 全量同步，含本轮回退修复。"
    ),
    "perc": (
        "v1.9：与水利 v3.33 同步——CSV 导入 readFileText 报错修复（原生桥补 readFileText + 网页稳健读取）；"
        "筛选「后勤」script error 修复（appFly 按 id 查回建筑，根治 ReferenceError）；"
        "UOS deb 架构对照+ar 大小补齐（根除「文件损坏」提示）；四平台 webroot 全量同步。"
    ),
    "gujian": (
        "v2.1：与水利 v3.33 同步——UOS deb 架构对照+ar 大小补齐（根除「文件损坏」提示）；"
        "四平台 webroot 全量同步（样式/导出导入基线对齐）。"
    ),
}

PRODUCTS = {
    "shuili": {
        "old": "3.32", "new": "3.33", "old_code": 35, "new_code": 36, "vprefix": "v",
        "proj": "android-build/shuili-v329",
        "webroots": ["native-shell/win-water-webview2/webroot", "native-shell/uos-water-pyqt6/webroot", "D:/Users/aowwei_app/webroot_shuili"],
    },
    "perc": {
        "old": "1.8", "new": "1.9", "old_code": 14, "new_code": 15, "vprefix": "v",
        "proj": "android-build/perc-v13",
        "webroots": ["native-shell/win-webview2/webroot", "native-shell/uos-pyqt6/webroot"],
    },
    "gujian": {
        "old": "2.0", "new": "2.1", "old_code": 14, "new_code": 15, "vprefix": "",
        "proj": "travel/android",
        "webroots": ["native-shell/win-gujian-webview2/webroot", "native-shell/uos-gujian-pyqt6/webroot"],
    },
}

changed = []
def rp(p): return os.path.join(ROOT, p)
def read(p):
    with io.open(p, "r", encoding="utf-8", errors="ignore") as f: return f.read()
def write(p, t):
    if DRY: return
    with io.open(p, "w", encoding="utf-8", newline="\n") as f: f.write(t)
def sub_file(path, pairs, label):
    p = rp(path)
    if not os.path.isfile(p): print("  [skip] 不存在 %s" % path); return False
    old = read(p); new = old
    for pat, repl in pairs: new = re.sub(pat, repl, new)
    if new == old: print("  [=] %s（%s 无变化）" % (path, label)); return False
    write(p, new); changed.append(path); print("  [✓] %s ← %s" % (path, label)); return True

def bump_version_json(path, cfg, key):
    p = rp(path)
    d = json.loads(read(p))
    d["version"] = cfg["new"]; d["versionCode"] = cfg["new_code"]; d["buildDate"] = DATE
    tag = CHANGELOG[key].split("：")[0] + "："
    desc = d.get("desc", "")
    if tag not in desc:
        head, sep, tail = desc.partition("。")
        d["desc"] = (head + sep + CHANGELOG[key] + tail) if sep else (CHANGELOG[key] + desc)
    if not DRY:
        with io.open(p, "w", encoding="utf-8", newline="\n") as f:
            json.dump(d, f, ensure_ascii=False, indent=2); f.write("\n")
    changed.append(p); print("  [✓] %s ← version=%s code=%s" % (path, cfg["new"], cfg["new_code"]))

def main():
    for key, cfg in PRODUCTS.items():
        old, new, vp = cfg["old"], cfg["new"], cfg["vprefix"]
        print("\n===== %s : %s -> %s (code %s -> %s) =====" % (key, old, new, cfg["old_code"], cfg["new_code"]))
        # (1) version.json 真相源
        bump_version_json(os.path.join(cfg["proj"], "assets/version.json"), cfg, key)
        # (2) app.js APP_VERSION + APP_BUILD_DATE（容忍空格）
        sub_file(os.path.join(cfg["proj"], "assets/app.js"), [
            (r'(var\s+APP_VERSION\s*=\s*")[^"]*(")', r'\g<1>%s%s\g<2>' % (vp, new)),
            (r'(var\s+APP_BUILD_DATE\s*=\s*")[^"]*(")', r'\g<1>%s\g<2>' % DATE),
        ], "APP_VERSION=%s%s / APP_BUILD_DATE=%s" % (vp, new, DATE))
        # (3) AndroidManifest.xml 由 build_apk.sh 从 version.json 自动同步，此处不手改（避免双源冲突）
        # (4) webroot 同步（version.json + app.js + ovobj_bridge.js）—— 关键：含本轮回退修复
        src_assets = rp(os.path.join(cfg["proj"], "assets"))
        for wr in cfg["webroots"]:
            dst = rp(wr)
            if not os.path.isdir(dst): print("  [skip] webroot 不存在 %s" % wr); continue
            for fn in ("version.json", "app.js", "ovobj_bridge.js"):
                s = os.path.join(src_assets, fn)
                if os.path.isfile(s):
                    if not DRY: shutil.copy2(s, os.path.join(dst, fn))
            changed.append(wr + "/{version.json,app.js,ovobj_bridge.js}")
            print("  [✓] 同步 -> %s" % wr)
    # (5) make_deb.py 内嵌 ver
    print("\n===== make_deb.py 内嵌版本 =====")
    sub_file("native-shell/make_deb.py", [
        (r'"ver": "3\.32\.20260827"', '"ver": "3.33.20260827"'),
        (r'"ver": "1\.8\.20260827"', '"ver": "1.9.20260827"'),
        (r'"ver": "2\.0\.20260827"', '"ver": "2.1.20260827"'),
    ], "ver -> 3.33/1.9/2.1 @%s" % DATE_C)
    # (6) build_ios_zip.py CFG
    print("\n===== build_ios_zip.py CFG =====")
    sub_file("native-shell/water-ios/build_ios_zip.py", [
        (r'"file_ver": "3\.32_20260827"', '"file_ver": "3.33_20260827"'),
        (r'"new_ver": "3\.32\.20260827"', '"new_ver": "3.33.20260827"'),
        (r'"readme_ver": "V3\.32_20260827"', '"readme_ver": "V3.33_20260827"'),
        (r'"file_ver": "1\.8_20260827"', '"file_ver": "1.9_20260827"'),
        (r'"new_ver": "1\.8\.20260827"', '"new_ver": "1.9.20260827"'),
        (r'"readme_ver": "V1\.8_20260827"', '"readme_ver": "V1.9_20260827"'),
        (r'"file_ver": "2\.0_20260827"', '"file_ver": "2.1_20260827"'),
        (r'"new_ver": "2\.0\.20260827"', '"new_ver": "2.1.20260827"'),
        (r'"readme_ver": "V2\.0_20260827"', '"readme_ver": "V2.1_20260827"'),
    ], "CFG -> 3.33/1.9/2.1 @%s" % DATE_C)
    # (7) 文档（04 变更 / 05 版本历史）—— 追加本轮变更摘要
    print("\n===== 文档 =====")
    for doc, anchor in (("docs_shuili_v3/04_软件变更文档.md", "## 水利工程基础信息一张图 APP"),
                        ("docs_shuili_v3/05_版本历史与备份.md", "## 水利工程基础信息一张图 APP")):
        p = rp(doc)
        if not os.path.isfile(p): print("  [skip] 不存在 %s" % doc); continue
        t = read(p)
        block = ("\n## v3.33 / v1.9 / v2.1（%s）\n\n" % DATE
                 + "- 水利 v3.33、感知 v1.9、古建 v2.1 同期发版，版本号八处同步。\n"
                 + "- Bug1 CSV 导入 readFileText 报错修复（原生桥补齐 + 网页稳健读取，导出导入自兼容）。\n"
                 + "- Bug3 感知筛选「后勤」script error 修复（appFly 按 id 查回建筑）。\n"
                 + "- Bug5 管理所全 9 所；Bug6 统信 deb ar 大小补齐根除「文件损坏」提示。\n"
                 + "- 三产品四平台 webroot 全量同步（含本轮回退修复），iOS PWA 同步。\n\n")
        if ("v3.33" not in t) and (anchor in t):
            t = t.replace(anchor, anchor + block, 1)
            write(p, t); changed.append(p); print("  [✓] %s 追加 v3.33 变更" % doc)
        else:
            print("  [=] %s（已含或 anchro 缺失）" % doc)
    print("\n===== 汇总 =====\n修改条目：%d%s" % (len(changed), "（dry-run，未落盘）" if DRY else ""))

if __name__ == "__main__":
    main()
