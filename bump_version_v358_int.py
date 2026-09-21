#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bump 3.56->3.58 / 1.32->1.34 / gujian 3.7.3->3.7.4（修复升级链接 openExternal）"""
import json, io, re, sys

DATE = "2026-09-05"
DESC = {
    "shuili": "修复安卓端升级菜单「下载更新包」点击报错：改由系统浏览器/网盘App接管打开（Win/iOS 不受影响）",
    "perc":   "修复安卓端升级菜单「下载更新包」点击报错：改由系统浏览器/网盘App接管打开",
    "gujian": "修复安卓端升级菜单「下载更新包」点击报错：改由系统浏览器/网盘App接管打开",
}

def rd(p): return io.open(p, encoding="utf-8").read()
def wr(p, s): io.open(p, "w", encoding="utf-8", newline="").write(s)
def rep1(s, old, new, tag):
    c = s.count(old)
    assert c == 1, (tag, c)
    return s.replace(old, new)

JOBS = [
    # key, assets dir, old ver, new ver, old code, new code (shuili/perc 用)
    ("shuili", "android-build/shuili-v329/assets", "3.56", "3.58", 56, 58),
    ("perc",   "android-build/perc-v13/assets",    "1.32", "1.34", 32, 34),
]

for key, p, ov, nv, oc, nc in JOBS:
    s = rd(p + "/app.js")
    tag = 'var APP_VERSION = "v%s"' % ov
    if ('var APP_VERSION = "v%s"' % nv) in s:
        print("[%s] app.js 已是 %s，跳过" % (key, nv))
    else:
        s = rep1(s, tag, 'var APP_VERSION = "v%s"' % nv, key + ".APP_VERSION")
        anchor = "  var CHANGES = [\n"
        entry = '    { v: "%s", d: "%s", items: [\n      "%s"\n    ]},\n' % (nv, DATE, DESC[key])
        s = rep1(s, anchor, anchor + "\n" + entry, key + ".CHANGES")
        wr(p + "/app.js", s)
        print("[%s] app.js -> %s" % (key, nv))
    vp = p + "/version.json"
    vj = json.load(io.open(vp, encoding="utf-8"))
    if vj["version"] == nv:
        print("[%s] version.json 已是 %s，跳过" % (key, nv))
    else:
        vj["version"] = nv; vj["versionCode"] = nc
        vj["desc"] = (vj.get("desc", "") or "") + "\n\n%s：%s" % (nv, DESC[key])
        wr(vp, json.dumps(vj, ensure_ascii=False, indent=2))
        print("[%s] version.json -> %s (code %d)" % (key, nv, nc))

# gujian（APP_VERSION 无 v 前缀）
gp = "travel/android/assets"
s = rd(gp + "/app.js")
if 'var APP_VERSION = "3.7.4"' in s:
    print("[gujian] app.js 已是 3.7.4，跳过")
else:
    s = rep1(s, 'var APP_VERSION = "3.7.3"', 'var APP_VERSION = "3.7.4"', "gujian.APP_VERSION")
    wr(gp + "/app.js", s)
    print("[gujian] app.js -> 3.7.4")
vj = json.load(io.open(gp + "/version.json", encoding="utf-8"))
if vj["version"] != "3.7.4":
    vj["version"] = "3.7.4"; vj["versionCode"] = vj.get("versionCode", 32) + 1
    vj["desc"] = (vj.get("desc", "") or "") + "\n\n3.7.4：%s" % DESC["gujian"]
    wr(gp + "/version.json", json.dumps(vj, ensure_ascii=False, indent=2))
    print("[gujian] version.json -> 3.7.4 (code %d)" % vj["versionCode"])
else:
    print("[gujian] version.json 已是 3.7.4，跳过")

print("DONE bump int 3.58/1.34/3.7.4")
