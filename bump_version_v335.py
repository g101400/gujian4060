# -*- coding: utf-8 -*-
"""三产品全链路版本号同步升级 v3.34/1.10/2.2 -> v3.35/1.11/2.3（8 处位置）。
真相源：<android_proj>/assets/version.json
用法：python3 bump_version_v335.py [--dry]
"""
import io, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DRY = "--dry" in sys.argv
DATE = "2026-08-28"
DATE_C = "20260828"

CHANGELOG = {
    "shuili": (
        "v3.35：智能AI 能力增强——内置 OpenRouter 三个免费模型预设（MiniMax M2.7 / GLM 5.2 / Nemotron 3 Nano Omni，均 :free 兼容 OpenAI），"
        "默认自动调用策略改为 failover（免费模型上游限流时自动切换下一个，避免单模型 429 中断）；"
        "本地 ai_seed.js 注入个人 OpenRouter Key（密钥不写进共享源码 ai_module.js）；"
        "chatOne 增加 OpenRouter 推荐头（HTTP-Referer/X-Title）与 429/401 友好提示、reasoning 模型 content 兜底；"
        "水利/感知仍为「本地辅助」模式（内部资料不联网编造）；CSV 导入 readFileText、筛选后勤 script error、管理所全 9 所、UOS deb ar 大小补齐等回归保持。"
    ),
    "perc": (
        "v1.11：与水利 v3.35 同源智能AI 增强——内置三个 OpenRouter 免费模型预设、默认 failover 策略、本地 ai_seed.js 注入 Key、"
        "chatOne 头与 429/reasoning 兜底；内部设备资料保持「本地辅助」不联网编造；CSV 导入 readFileText、筛选后勤 script error、UOS deb 架构对照+ar 大小补齐等回归保持。"
    ),
    "gujian": (
        "v2.3：智能AI 增强——内置三个 OpenRouter 免费模型预设（MiniMax M2.7 / GLM 5.2 / Nemotron 3 Nano Omni）、默认 failover 策略、本地 ai_seed.js 注入 Key、"
        "chatOne 头与 429/reasoning 兜底；联网智能查询/智能更新(补丁确认写入)/智能纠错(标注差异)保持；UOS deb 架构对照+ar 大小补齐回归保持。"
    ),
}

PRODUCTS = {
    "shuili": {
        "old": "3.34", "new": "3.35", "old_code": 37, "new_code": 38, "vprefix": "v",
        "proj": "android-build/shuili-v329",
        "webroots": ["native-shell/win-water-webview2/webroot", "native-shell/uos-water-pyqt6/webroot", "D:/Users/aowwei_app/webroot_shuili"],
    },
    "perc": {
        "old": "1.10", "new": "1.11", "old_code": 16, "new_code": 17, "vprefix": "v",
        "proj": "android-build/perc-v13",
        "webroots": ["native-shell/win-webview2/webroot", "native-shell/uos-pyqt6/webroot"],
    },
    "gujian": {
        "old": "2.2", "new": "2.3", "old_code": 16, "new_code": 17, "vprefix": "",
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
        (r'"ver": "3\.34\.20260828"', '"ver": "3.35.20260828"'),
        (r'"ver": "1\.10\.20260828"', '"ver": "1.11.20260828"'),
        (r'"ver": "2\.2\.20260828"', '"ver": "2.3.20260828"'),
    ], "ver -> 3.35/1.11/2.3 @%s" % DATE_C)
    print("\n===== build_ios_zip.py CFG =====")
    sub_file("native-shell/water-ios/build_ios_zip.py", [
        (r'"file_ver": "3\.34_20260828"', '"file_ver": "3.35_20260828"'),
        (r'"new_ver": "3\.34\.20260828"', '"new_ver": "3.35.20260828"'),
        (r'"readme_ver": "V3\.34_20260828"', '"readme_ver": "V3.35_20260828"'),
        (r'"file_ver": "1\.10_20260828"', '"file_ver": "1.11_20260828"'),
        (r'"new_ver": "1\.10\.20260828"', '"new_ver": "1.11.20260828"'),
        (r'"readme_ver": "V1\.10_20260828"', '"readme_ver": "V1.11_20260828"'),
        (r'"file_ver": "2\.2_20260828"', '"file_ver": "2.3_20260828"'),
        (r'"new_ver": "2\.2\.20260828"', '"new_ver": "2.3.20260828"'),
        (r'"readme_ver": "V2\.2_20260828"', '"readme_ver": "V2.3_20260828"'),
    ], "CFG -> 3.35/1.11/2.3 @%s" % DATE_C)
    print("\n===== 文档 =====")
    for doc, anchor in (("docs_shuili_v3/04_软件变更文档.md", "## 水利工程基础信息一张图 APP"),
                        ("docs_shuili_v3/05_版本历史与备份.md", "## 水利工程基础信息一张图 APP")):
        p = rp(doc)
        if not os.path.isfile(p): print("  [skip] 不存在 %s" % doc); continue
        t = read(p)
        block = ("\n## v3.35 / v1.11 / v2.3（%s）\n\n" % DATE
                 + "- 水利 v3.35、感知 v1.11、古建 v2.3 同期发版，版本号八处同步。\n"
                 + "- 智能AI 增强：内置 OpenRouter 三个免费模型预设（MiniMax M2.7 / GLM 5.2 / Nemotron 3 Nano Omni，均 :free 兼容 OpenAI）；默认自动调用策略改为 failover（免费模型限流自动切换）；本地 ai_seed.js 注入个人 Key（不写进共享源码）；chatOne 增加 OpenRouter 推荐头与 429/401 提示、reasoning 模型兜底。\n"
                 + "- 古建开放联网智能查询/智能更新/智能纠错；水利/感知为内部资料，保持「本地辅助」模式不联网编造。\n"
                 + "- 三日问题（CSV 导入 readFileText、感知筛选后勤 script error、管理所全 9 所、UOS deb ar 大小补齐）回归保持。\n\n")
        if ("v3.35" not in t) and (anchor in t):
            t = t.replace(anchor, anchor + block, 1)
            write(p, t); changed.append(p); print("  [✓] %s 追加 v3.35 变更" % doc)
        else:
            print("  [=] %s（已含或 anchor 缺失）" % doc)
    print("\n===== 汇总 =====\n修改条目：%d%s" % (len(changed), "（dry-run，未落盘）" if DRY else ""))

if __name__ == "__main__":
    main()
