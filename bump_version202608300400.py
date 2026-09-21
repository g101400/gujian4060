# -*- coding: utf-8 -*-
"""三产品全链路版本号同步（八处位置）——参数化版，下次发版直接复用。

真相源：<android_proj>/assets/version.json

用法：
  # 最简：指定三个产品的新版本 + 新 versionCode + 日期
  python3 bump_version.py --date 2026-08-26 --datec 20260826 \
      --shuili 3.32 --shuili-code 35 \
      --perc 1.8   --perc-code 14 \
      --gujian 2.0 --gujian-code 14 \
      [--clog changelog.json] [--dry]

  # 或整份 plan（推荐，可复现）：
  python3 bump_version.py --plan plan.json [--dry]

plan.json 结构见文件末尾示例。old 版本会从各文件现状自动探测，无需手填。
"""
import argparse
import io
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DRY = "--dry" in sys.argv

# 产品 → 工程目录 / webroot / wxs / debsh / 版本前缀
PRODUCTS = {
    "shuili": {
        "proj": "android-build/shuili-v329",
        "mirror_assets": ["android-build/water-v329/assets"],
        "webroots": ["native-shell/win-water-webview2/webroot",
                     "native-shell/uos-water-pyqt6/webroot",
                     "D:/Users/aowwei_app/webroot_shuili"],  # 第 6 份母版镜像（绝对路径，防 v3.31 分叉复发）
        "wxs": "native-shell/win-water-webview2/build_msi.wxs",
        "debsh": "native-shell/uos-water-pyqt6/build_deb.sh",
        "vprefix": "v",
    },
    "perc": {
        "proj": "android-build/perc-v13",
        "mirror_assets": [],
        "webroots": ["native-shell/win-webview2/webroot",
                     "native-shell/uos-pyqt6/webroot"],
        "wxs": "native-shell/win-webview2/build_msi.wxs",
        "debsh": "native-shell/uos-pyqt6/build_deb.sh",
        "vprefix": "v",
    },
    "gujian": {
        "proj": "travel/android",
        "mirror_assets": [],
        "webroots": ["native-shell/win-gujian-webview2/webroot",
                     "native-shell/uos-gujian-pyqt6/webroot"],
        "wxs": "native-shell/win-gujian-webview2/build_msi.wxs",
        "debsh": "native-shell/uos-gujian-pyqt6/build_deb.sh",
        "vprefix": "",
    },
}

# 集中构建脚本里「旧版本串」→「新版本串」的映射规则
CENTRAL_SCRIPTS = [
    "native-shell/make_deb.py", "native-shell/make_msi.py",
    "native-shell/gen_win_msi.py", "native-shell/water-ios/build_ios_zip.py",
    "build_four_ends.sh",
]

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


def detect_old_version(path, key):
    """探测 assets/version.json 当前 version，作为 old。"""
    p = rp(os.path.join(path, "assets/version.json"))
    if not os.path.isfile(p):
        return None
    try:
        return json.loads(read(p))["version"]
    except Exception:
        return None


def bump_version_json(path, cfg, key, new, code, date, clog):
    p = rp(path)
    if not os.path.isfile(p):
        print("  [skip] 不存在 %s" % path)
        return
    d = json.loads(read(p))
    d["version"] = new
    d["versionCode"] = code
    d["buildDate"] = date
    if clog:
        desc = d.get("desc", "")
        tag = clog[key].split("：")[0] + "："
        if tag not in desc:
            head, sep, tail = desc.partition("。")
            d["desc"] = (head + sep + clog[key] + tail) if sep else (clog[key] + desc)
    if not DRY:
        with io.open(p, "w", encoding="utf-8", newline="\n") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
            f.write("\n")
    changed.append(path)
    print("  [✓] %s ← version=%s code=%s date=%s" % (path, new, code, date))


def msi_ver(new):
    """MSI ProductVersion：只取前 3 段、每段 ≤65535。"""
    parts = (new.split(".") + ["0", "0", "0"])[:3]
    return ".".join(str(min(int(p), 65535)) for p in parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default="2026-08-26")
    ap.add_argument("--datec", default="20260826")
    ap.add_argument("--shuili")
    ap.add_argument("--shuili-code", type=int)
    ap.add_argument("--perc")
    ap.add_argument("--perc-code", type=int)
    ap.add_argument("--gujian")
    ap.add_argument("--gujian-code", type=int)
    ap.add_argument("--clog", help="changelog JSON 文件 {shuili/perc/gujian: '...'}")
    ap.add_argument("--plan", help="整份 plan JSON（覆盖上面所有参数）")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    if a.dry:
        global DRY
        DRY = True

    clog = {}
    if a.clog:
        clog = json.loads(read(rp(a.clog)))

    # 解析 plan / 命令行
    if a.plan:
        plan = json.loads(read(rp(a.plan)))
        date = plan["date"]
        date_c = plan["date_c"]
        cfg_ver = plan["versions"]     # {shuili:{new,code}, ...}
    else:
        date = a.date
        date_c = a.datec
        cfg_ver = {
            "shuili": {"new": a.shuili, "code": a.shuili_code},
            "perc": {"new": a.perc, "code": a.perc_code},
            "gujian": {"new": a.gujian, "code": a.gujian_code},
        }
    if not all(cfg_ver[k]["new"] for k in PRODUCTS):
        sys.exit("✗ 三个产品的新版本必须都给出（plan 或 --shuili/--perc/--gujian）")

    for key in PRODUCTS:
        cfg = PRODUCTS[key]
        new = cfg_ver[key]["new"]
        code = cfg_ver[key]["code"] or 0
        old = detect_old_version(cfg["proj"], key) or "?"

        print("\n===== %s : %s -> %s (code -> %s) =====" % (key, old, new, code))

        # (1) assets/version.json 真相源
        bump_version_json(os.path.join(cfg["proj"], "assets/version.json"),
                          cfg, key, new, code, date, clog)

        # (2) assets/app.js
        sub_file(os.path.join(cfg["proj"], "assets/app.js"), [
            (r'(var\s+APP_VERSION\s*=\s*")[^"]*(")', r'\g<1>%s%s\g<2>' % (cfg["vprefix"], new)),
            (r'(var\s+APP_BUILD_DATE\s*=\s*")[^"]*(")', r'\g<1>%s\g<2>' % date),
        ], "APP_VERSION=%s%s / APP_BUILD_DATE=%s" % (cfg["vprefix"], new, date))

        # (3) AndroidManifest.xml
        sub_file(os.path.join(cfg["proj"], "AndroidManifest.xml"), [
            (r'android:versionCode="\d+"', 'android:versionCode="%d"' % code),
            (r'android:versionName="[^"]*"', 'android:versionName="%s"' % new),
        ], "versionCode/versionName")

        # (4) webroot 同步（支持绝对路径，如第 6 份母版镜像 webroot_shuili）
        # 全量同步：复制 src_assets 下所有源文件（含 index.html/ai_module.js/ctx_menu.js
        # /data.js/ovobj_bridge.js/leaflet 等），仅排除备份(*.bak/*.ctxbak/*.menu1bak)
        # 与个人密钥 ai_seed.js。历史上只用 3 文件清单导致镜像缺文件（v3.38 第 4 次分叉）。
        # 与 sync_shuili_mirror.py 保持一致，且与源同产品（perc/gujian 各自 assets），不会串产品。
        src_assets = rp(os.path.join(cfg["proj"], "assets"))
        _bk_suffix = (".bak", ".ctxbak", ".menu1bak")
        for wr in cfg["webroots"] + cfg["mirror_assets"]:
            dst = wr if os.path.isabs(wr) else rp(wr)
            if not os.path.isdir(dst):
                print("  [skip] webroot 不存在 %s" % wr)
                continue
            copied = 0
            for root, _dirs, files in os.walk(src_assets):
                rel = os.path.relpath(root, src_assets)
                for fn in files:
                    if fn.endswith(_bk_suffix) or fn in ("ai_seed.js",) \
                            or "bak" in fn.lower():
                        continue
                    s = os.path.join(root, fn)
                    d = os.path.join(dst, rel, fn) if rel != "." else os.path.join(dst, fn)
                    if not DRY:
                        os.makedirs(os.path.dirname(d), exist_ok=True)
                        shutil.copy2(s, d)
                    copied += 1
            changed.append(wr + "/*(%d files)" % copied)
            print("  [✓] 同步 -> %s (%d files)" % (wr, copied))

        # (5) build_msi.wxs —— 只改 <Product Version>，绝不碰 <Package InstallerVersion>
        # WiX v3 schema: <Product ... Version="X.Y"> + <Package InstallerVersion="500">
        # 关键坑：InstallerVersion≠产品版本，正则必须锚定 <Product，不能匹配 <Package
        sub_file(cfg["wxs"], [
            (r'(<Product\b[^>]*?\sVersion=")[0-9.]+(")', r'\g<1>%s\g<2>' % msi_ver(new)),
        ], 'Product Version="%s"' % msi_ver(new))

        # (6) build_deb.sh
        sub_file(cfg["debsh"], [
            (r'VERSION="[^"]*"', 'VERSION="%s.%s"' % (new, date_c)),
        ], 'VERSION="%s.%s"' % (new, date_c))

    # (7) 集中构建脚本：把每个产品的旧版本串（从该脚本现状探测）替换为新串
    print("\n===== 集中构建脚本 =====")
    for f in CENTRAL_SCRIPTS:
        pf = rp(f)
        if not os.path.isfile(pf):
            print("  [skip] 不存在 %s" % f)
            continue
        txt = read(pf)
        new_txt = txt
        for key in PRODUCTS:
            cfg = PRODUCTS[key]
            new = cfg_ver[key]["new"]
            old = detect_old_version(cfg["proj"], key) or "?"
            # 从文件现状探测该产品的旧 date-stamped 串（如 3.31.20260825）
            m = re.search(re.escape(old) + r'\.(\d{8})', new_txt)
            if m:
                old_date = m.group(1)
                old_full = "%s.%s" % (old, old_date)
                new_full = "%s.%s" % (new, date_c)
                new_txt = new_txt.replace(old_full, new_full)
                new_txt = new_txt.replace(old_full.replace(".", "_"), new_full.replace(".", "_"))
                new_txt = new_txt.replace("V" + old_full.replace(".", "_"), "V" + new_full.replace(".", "_"))
            # 仅替换「孤立出现的旧版本串」(如 gen_win_msi.py 的 "3.31")，避开 数字.old / old.数字
            new_txt = re.sub(r'(?<!\d\.)' + re.escape(old) + r'(?!\.\d)', new, new_txt)
            # build_four_ends.sh 竖线配置：|3.31| -> |3.32|
            if ("|%s|" % old) in new_txt:
                new_txt = new_txt.replace("|%s|" % old, "|%s|" % new)
        if new_txt != txt:
            write(pf, new_txt)
            changed.append(f)
            print("  [✓] %s" % f)
        else:
            print("  [=] %s 无变化" % f)

    print("\n===== 汇总 =====")
    print("修改条目：%d" % len(changed))
    if DRY:
        print("(dry-run，未落盘)")


if __name__ == "__main__":
    main()

# ─────────────── plan.json 示例 ───────────────
# {
#   "date": "2026-08-26",
#   "date_c": "20260826",
#   "versions": {
#     "shuili": {"new": "3.32", "code": 35},
#     "perc":   {"new": "1.8",  "code": 14},
#     "gujian": {"new": "2.0",  "code": 14}
#   }
# }
# changelog 另用 --clog changelog.json：
#   {"shuili":"v3.32：...", "perc":"v1.8：...", "gujian":"v2.0：..."}
