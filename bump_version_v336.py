# -*- coding: utf-8 -*-
"""三产品全链路版本号同步升级 v3.35/1.11/2.3 -> v3.36/1.12/2.4（8 处位置）。
真相源：<android_proj>/assets/version.json
用法：python3 bump_version_v336.py [--dry]
"""
import io, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DRY = "--dry" in sys.argv
DATE = "2026-08-28"
DATE_C = "20260828"

CHANGELOG = {
    "shuili": (
        "v3.36：问题修复与体验优化——①修复智能AI 联网查询报「String contains non ISO-8859-1 code point」（HTTP 头中文 appName 经 toLatin1 转 ASCII）；"
        "②菜单顺序智能调整：关于/帮助移至末尾，「删除古建/恢复初始数据」归入新建「设置」子菜单，智能AI 按同名分组自动合并；"
        "③新增显示界面右键上下文菜单（地图/标注/列表：获取坐标、周边搜索、导航、智能补全、智能描述此地），调用大模型自动填充简介/特征；"
        "④更换 OpenRouter 账号密钥（openclaw626），三个免费模型（MiniMax M2.7 / GLM 5.2 / Nemotron 3 Nano Omni）failover 实测；"
        "⑤CSV 导入 readFileText、UOS deb ar 大小补齐等回归保持。"
    ),
    "perc": (
        "v1.12：与水利 v3.36 同源问题修复与优化——①chatOne 头中文转 ASCII，修复智能AI 本地辅助报错；"
        "②菜单顺序智能调整（关于/帮助置底、危险操作归设置）；③新增右键上下文菜单（地图/标注/列表）智能补全；"
        "④更换 OpenRouter 密钥（openclaw626）三个免费模型 failover 实测；内部设备资料保持「本地辅助」不联网编造；"
        "CSV 导入 readFileText、筛选后勤 script error、UOS deb 架构对照+ar 大小补齐等回归保持。"
    ),
    "gujian": (
        "v2.4：问题修复与优化——①修复进入页面闪动（map 启动加 booting 守卫 + invalidateSize），及智能AI 联网查询「String contains non ISO-8859-1 code point」（HTTP 头中文转 ASCII）；"
        "②菜单顺序智能调整：关于/帮助移至末尾，删除古建/恢复初始数据归「设置」子菜单；③新增右键上下文菜单（地图/标注/列表：获取坐标、周边搜索、导航、智能补全、智能描述此地）；"
        "④更换 OpenRouter 密钥（openclaw626）三个免费模型 failover 实测；UOS deb 架构对照+ar 大小补齐回归保持。"
    ),
}

PRODUCTS = {
    "shuili": {
        "old": "3.35", "new": "3.36", "old_code": 38, "new_code": 39, "vprefix": "v",
        "proj": "android-build/shuili-v329",
        "webroots": ["native-shell/win-water-webview2/webroot", "native-shell/uos-water-pyqt6/webroot", "D:/Users/aowwei_app/webroot_shuili"],
    },
    "perc": {
        "old": "1.11", "new": "1.12", "old_code": 17, "new_code": 18, "vprefix": "v",
        "proj": "android-build/perc-v13",
        "webroots": ["native-shell/win-webview2/webroot", "native-shell/uos-pyqt6/webroot"],
    },
    "gujian": {
        "old": "2.3", "new": "2.4", "old_code": 17, "new_code": 18, "vprefix": "",
        "proj": "travel/android",
        "webroots": ["native-shell/win-gujian-webview2/webroot", "native-shell/uos-gujian-pyqt6/webroot", "travel/webroot"],
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
        (r'"ver": "3\.35\.20260828"', '"ver": "3.36.20260828"'),
        (r'"ver": "1\.11\.20260828"', '"ver": "1.12.20260828"'),
        (r'"ver": "2\.3\.20260828"', '"ver": "2.4.20260828"'),
    ], "ver -> 3.36/1.12/2.4 @%s" % DATE_C)
    print("\n===== build_ios_zip.py CFG =====")
    sub_file("native-shell/water-ios/build_ios_zip.py", [
        (r'"file_ver": "3\.35_20260828"', '"file_ver": "3.36_20260828"'),
        (r'"new_ver": "3\.35\.20260828"', '"new_ver": "3.36_20260828"'),
        (r'"readme_ver": "V3\.35_20260828"', '"readme_ver": "V3.36_20260828"'),
        (r'"file_ver": "1\.11_20260828"', '"file_ver": "1.12_20260828"'),
        (r'"new_ver": "1\.11\.20260828"', '"new_ver": "1.12_20260828"'),
        (r'"readme_ver": "V1\.11_20260828"', '"readme_ver": "V1.12_20260828"'),
        (r'"file_ver": "2\.3_20260828"', '"file_ver": "2.4_20260828"'),
        (r'"new_ver": "2\.3\.20260828"', '"new_ver": "2.4_20260828"'),
        (r'"readme_ver": "V2\.3_20260828"', '"readme_ver": "V2.4_20260828"'),
    ], "CFG -> 3.36/1.12/2.4 @%s" % DATE_C)
    print("\n===== 文档 =====")
    for doc, anchor in (("docs_shuili_v3/04_软件变更文档.md", "## 水利工程基础信息一张图 APP"),
                        ("docs_shuili_v3/05_版本历史与备份.md", "## 水利工程基础信息一张图 APP")):
        p = rp(doc)
        if not os.path.isfile(p): print("  [skip] 不存在 %s" % doc); continue
        t = read(p)
        block = ("\n## v3.36 / v1.12 / v2.4（%s）\n\n" % DATE
                 + "- 水利 v3.36、感知 v1.12、古建 v2.4 同期发版，版本号八处同步。\n"
                 + "- 修复智能AI 联网查询「String contains non ISO-8859-1 code point」：HTTP 头中文 appName 经 toLatin1 转 ASCII。\n"
                 + "- 菜单顺序智能调整：关于/帮助移至末尾，删除/恢复初始数据归「设置」子菜单，智能AI 按同名分组自动合并。\n"
                 + "- 新增显示界面右键上下文菜单（地图/标注/列表）：获取坐标、周边搜索、导航、智能补全、智能描述此地；调用大模型自动填充简介/特征。\n"
                 + "- 更换 OpenRouter 密钥（openclaw626），三个免费模型（MiniMax M2.7 / GLM 5.2 / Nemotron 3 Nano Omni）failover 实测；古建开放联网智能查询/更新/纠错，水利/感知保持「本地辅助」不联网编造。\n"
                 + "- 三日问题（CSV 导入 readFileText、管理所全 9 所、UOS deb ar 大小补齐）回归保持。\n\n")
        if ("v3.36" not in t) and (anchor in t):
            t = t.replace(anchor, anchor + block, 1)
            write(p, t); changed.append(p); print("  [✓] %s 追加 v3.36 变更" % doc)
        else:
            print("  [=] %s（已含或 anchor 缺失）" % doc)
    print("\n===== 汇总 =====\n修改条目：%d%s" % (len(changed), "（dry-run，未落盘）" if DRY else ""))

if __name__ == "__main__":
    main()
