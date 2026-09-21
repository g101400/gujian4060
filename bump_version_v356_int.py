#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bump_version_v356_int.py — 内部版(偶数)提升：shuili 3.55->3.56, perc 1.31->1.32, 古建 3.7.3 不变。
含：canonical app.js/version.json/CHANGES + 构建脚本版本串 + 归档名。
执行顺序：本脚本 -> strip_internal --restore ×8 -> sync_all_mirrors -> publish webroot 刷新 -> build_release_pass.sh 四端安装包_20260905_v356_int"""
import io, json, re, os, sys

ROOT = "D:/Users/Claw"
DATE = "2026-09-05"

def rd(p): return io.open(p, encoding="utf-8").read()
def wr(p, s): io.open(p, "w", encoding="utf-8", newline="").write(s)

def rep1(s, old, new, tag):
    if s.count(old) != 1:
        print("锚点异常[%s] count=%d" % (tag, s.count(old))); sys.exit(1)
    return s.replace(old, new)

# ---------- 1) canonical app.js + version.json ----------
CH = [
    ("shuili", "android-build/shuili-v329/assets", "v3.55", "v3.56", 55, 56,
     "内部版（含完整单位内部水利设施数据，仅限单位内部使用）：与感知 v1.32 / 古建 v3.7.3 同步。偶数版保留真实水利建筑物坐标/管理所/设计参数，程序标注「内部版」。知识库智能化/OCR/升级备份/四端对照单与 v3.55 相同。"),
    ("perc", "android-build/perc-v13/assets", "v1.31", "v1.32", 31, 32,
     "内部版（含完整单位内部感知设备数据，仅限单位内部使用）：与水利 v3.56 / 古建 v3.7.3 同步。偶数版保留真实感知设备坐标/子系统/设备编码，程序标注「内部版」。知识库智能化/OCR/升级备份/四端对照单与 v1.31 相同。"),
]
for key, assets, ov, nv, oc, nc, desc in CH:
    p = ROOT + "/" + assets
    s = rd(p + "/app.js")
    if ('var APP_VERSION = "%s";' % nv) in s:
        print("[%s] APP_VERSION 已是 %s，跳过" % (key, nv))
    else:
        s = rep1(s, 'var APP_VERSION = "%s";' % ov, 'var APP_VERSION = "%s";' % nv, key + ".APP_VERSION")
        anchor = "  var CHANGES = [\n"
        entry = '    { v: "%s", d: "%s", items: [\n      "%s"\n    ]},\n' % (nv, DATE, desc)
        s = rep1(s, anchor, anchor + "\n" + entry, key + ".CHANGES")
        wr(p + "/app.js", s)
    vj = json.load(io.open(p + "/version.json", encoding="utf-8"))
    if vj["version"] != nv.replace("v", ""):
        vj["version"] = nv.replace("v", ""); vj["versionCode"] = nc
        vj["desc"] = vj.get("desc", "") + "\n\n%s：%s" % (nv, desc)
        wr(p + "/version.json", json.dumps(vj, ensure_ascii=False, indent=2))
        print("[%s] version.json -> %s (code %d)" % (key, vj["version"], nc))
    else:
        print("[%s] version.json 已是 %s，跳过" % (key, vj["version"]))

# ---------- 2) 构建脚本版本串 ----------
BUILD = [
    ("native-shell/make_deb.py", [
        ("四端安装包_20260905_v355_pub", "四端安装包_20260905_v356_int"),
        ('"ver": "3.55.20260905"', '"ver": "3.56.20260905"'),
        ('"ver": "1.31.20260905"', '"ver": "1.32.20260905"'),
    ]),
    ("native-shell/gen_win_msi_wix7.py", [
        ("四端安装包_20260905_v355_pub", "四端安装包_20260905_v356_int"),
        ('"ver":"3.55.0"', '"ver":"3.56.0"'),
        ('"ver":"1.31.0"', '"ver":"1.32.0"'),
        ('"appver":"3.55"', '"appver":"3.56"'),
        ('"appver":"1.31"', '"appver":"1.32"'),
    ]),
    ("native-shell/build_win_exe_nsis.py", [
        ("四端安装包_20260905_v355_pub", "四端安装包_20260905_v356_int"),
        ('"ver": "3.55.0", "ver4": "3.55.0.0"', '"ver": "3.56.0", "ver4": "3.56.0.0"'),
        ('"ver": "1.31.0", "ver4": "1.31.0.0"', '"ver": "1.32.0", "ver4": "1.32.0.0"'),
    ]),
    ("native-shell/water-ios/build_ios_zip.py", [
        ("四端安装包_20260905_v355_pub", "四端安装包_20260905_v356_int"),
        ('"file_ver": "3.55_20260905"', '"file_ver": "3.56_20260905"'),
        ('"new_ver": "3.55_20260905"', '"new_ver": "3.56_20260905"'),
        ('"readme_ver": "V3.55_20260905"', '"readme_ver": "V3.56_20260905"'),
        ('"file_ver": "1.31_20260905"', '"file_ver": "1.32_20260905"'),
        ('"new_ver": "1.31_20260905"', '"new_ver": "1.32_20260905"'),
        ('"readme_ver": "V1.31_20260905"', '"readme_ver": "V1.32_20260905"'),
    ]),
]
for path, pairs in BUILD:
    s = rd(path)
    for old, new in pairs:
        c = s.count(old)
        if c == 0: print("[skip] %s 无 %s" % (path, old)); continue
        s = s.replace(old, new); print("[ok] %s: %s (x%d)" % (path, old, c))
    wr(path, s)
print("内部版提升完成")
