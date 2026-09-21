# -*- coding: utf-8 -*-
"""三产品全链路版本号同步升级 v3.33/1.9/2.1 -> v3.34/1.10/2.2（8 处位置）。
真相源：<android_proj>/assets/version.json
用法：python3 bump_version_v334.py [--dry]
"""
import io, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DRY = "--dry" in sys.argv
DATE = "2026-08-28"
DATE_C = "20260828"

CHANGELOG = {
    "shuili": (
        "v3.34：新增「智能AI」能力（设置+智能助手）并三端同源——①智能AI设置：自定义大模型接口"
        "（引用地址默认 OpenRouter、协议 OpenAI 兼容、模型 ID、API Key、可标记本地部署模型）、多模型管理与默认模型选择、"
        "模型自动调用策略（仅默认/失败切换/多模型轮询）、连接测试、配置导入导出；"
        "②古建侧开放联网「智能查询/智能更新(补丁预览确认后写入)/智能纠错(标注差异)」；"
        "③水利/感知为内部资料，智能AI切换为「本地辅助」模式：不联网编造，仅基于本地记录做问答/补全/存疑标注；"
        "④CSV 导入 readFileText 报错、感知筛选「后勤」script error、管理所全 9 所、UOS deb ar 大小补齐等三日问题回归保持。"
    ),
    "perc": (
        "v1.10：与水利 v3.34 同源新增「智能AI（本地辅助）」——内部设备资料不联网编造，"
        "提供大模型接口自定义/多模型/自动调用策略配置，以及本地辅助问答、字段补全、存疑标注；"
        "CSV 导入 readFileText 修复、筛选「后勤」script error 修复、UOS deb 架构对照+ar 大小补齐等回归保持。"
    ),
    "gujian": (
        "v2.2：新增「智能AI设置 + 智能AI」双菜单——自定义大模型（OpenRouter 默认、可本地模型）、"
        "多模型默认选择与自动调用策略、联网智能查询/智能更新(补丁确认写入)/智能纠错(标注差异)；"
        "四平台 webroot 同源同步；UOS deb 架构对照+ar 大小补齐回归保持。"
    ),
}

PRODUCTS = {
    "shuili": {
        "old": "3.33", "new": "3.34", "old_code": 36, "new_code": 37, "vprefix": "v",
        "proj": "android-build/shuili-v329",
        "webroots": ["native-shell/win-water-webview2/webroot", "native-shell/uos-water-pyqt6/webroot", "D:/Users/aowwei_app/webroot_shuili"],
    },
    "perc": {
        "old": "1.9", "new": "1.10", "old_code": 15, "new_code": 16, "vprefix": "v",
        "proj": "android-build/perc-v13",
        "webroots": ["native-shell/win-webview2/webroot", "native-shell/uos-pyqt6/webroot"],
    },
    "gujian": {
        "old": "2.1", "new": "2.2", "old_code": 15, "new_code": 16, "vprefix": "",
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
    write(p, new); changed.append(path); print("  [✓] %s <- %s" % (path, label)); return True

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
    changed.append(p); print("  [✓] %s <- version=%s code=%s" % (path, cfg["new"], cfg["new_code"]))

def main():
    for key, cfg in PRODUCTS.items():
        old, new, vp = cfg["old"], cfg["new"], cfg["vprefix"]
        print("\n===== %s : %s -> %s (code %s -> %s) =====" % (key, old, new, cfg["old_code"], cfg["new_code"]))
        bump_version_json(os.path.join(cfg["proj"], "assets/version.json"), cfg, key)
        sub_file(os.path.join(cfg["proj"], "assets/app.js"), [
            (r'(var\s+APP_VERSION\s*=\s*")[^"]*(")', r'\g<1>%s%s\g<2>' % (vp, new)),
            (r'(var\s+APP_BUILD_DATE\s*=\s*")[^"]*(")', r'\g<1>%s\g<2>' % DATE),
        ], "APP_VERSION=%s%s / APP_BUILD_DATE=%s" % (vp, new, DATE))
        # webroot 同步（version.json + app.js + ovobj_bridge.js）
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
    print("\n===== make_deb.py 内嵌版本 =====")
    sub_file("native-shell/make_deb.py", [
        (r'"ver": "3\.33\.20260827"', '"ver": "3.34.20260828"'),
        (r'"ver": "1\.9\.20260827"', '"ver": "1.10.20260828"'),
        (r'"ver": "2\.1\.20260827"', '"ver": "2.2.20260828"'),
    ], "ver -> 3.34/1.10/2.2 @%s" % DATE_C)
    print("\n===== build_ios_zip.py CFG =====")
    sub_file("native-shell/water-ios/build_ios_zip.py", [
        (r'"file_ver": "3\.33_20260827"', '"file_ver": "3.34_20260828"'),
        (r'"new_ver": "3\.33\.20260827"', '"new_ver": "3.34.20260828"'),
        (r'"readme_ver": "V3\.33_20260827"', '"readme_ver": "V3.34_20260828"'),
        (r'"file_ver": "1\.9_20260827"', '"file_ver": "1.10_20260828"'),
        (r'"new_ver": "1\.9\.20260827"', '"new_ver": "1.10.20260828"'),
        (r'"readme_ver": "V1\.9_20260827"', '"readme_ver": "V1.10_20260828"'),
        (r'"file_ver": "2\.1_20260827"', '"file_ver": "2.2_20260828"'),
        (r'"new_ver": "2\.1\.20260827"', '"new_ver": "2.2.20260828"'),
        (r'"readme_ver": "V2\.1_20260827"', '"readme_ver": "V2.2_20260828"'),
    ], "CFG -> 3.34/1.10/2.2 @%s" % DATE_C)
    print("\n===== 文档 =====")
    for doc, anchor in (("docs_shuili_v3/04_软件变更文档.md", "## 水利工程基础信息一张图 APP"),
                        ("docs_shuili_v3/05_版本历史与备份.md", "## 水利工程基础信息一张图 APP")):
        p = rp(doc)
        if not os.path.isfile(p): print("  [skip] 不存在 %s" % doc); continue
        t = read(p)
        block = ("\n## v3.34 / v1.10 / v2.2（%s）\n\n" % DATE
                 + "- 水利 v3.34、感知 v1.10、古建 v2.2 同期发版，版本号八处同步。\n"
                 + "- 新增「智能AI设置 + 智能AI」双菜单：自定义大模型接口（OpenRouter 默认、OpenAI 兼容、可本地模型）、多模型默认选择与自动调用策略（仅默认/失败切换/轮询）、连接测试、配置导入导出。\n"
                 + "- 古建开放联网智能查询/智能更新(补丁确认写入)/智能纠错(标注差异)；水利/感知为内部资料切换「本地辅助」模式，不联网编造。\n"
                 + "- 三日问题（CSV 导入 readFileText、感知筛选后勤 script error、管理所全 9 所、UOS deb ar 大小补齐）回归保持。\n\n")
        if ("v3.34" not in t) and (anchor in t):
            t = t.replace(anchor, anchor + block, 1)
            write(p, t); changed.append(p); print("  [✓] %s 追加 v3.34 变更" % doc)
        else:
            print("  [=] %s（已含或 anchor 缺失）" % doc)
    print("\n===== 汇总 =====\n修改条目：%d%s" % (len(changed), "（dry-run，未落盘）" if DRY else ""))

if __name__ == "__main__":
    main()
