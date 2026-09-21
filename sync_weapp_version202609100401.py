#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sync_weapp_version.py — 微信小程序（jingyin）基线版本同步

背景：小程序与四平台共用一套功能基线，发版时必须同步版本号，否则跨端核对时
      无法判断小程序对应哪一版 Android/iOS（历史多次出现小程序停在旧版本号）。

同步三处（小程序没有独立 webroot，assets 仅 fonts/images，无共享 JS）：
  1. jingyin/app.js         : version / buildDate / baseline
  2. jingyin/config/config.js: VERSION / BASELINE / 头部注释 / 三端版本注释
  3. jingyin/package.json   : "version": "X.Y.0"

用法：
  python sync_weapp_version.py                       # 用下方 DEFAULTS 默认版本
  python sync_weapp_version.py 3.49 1.25 3.7 2026-09-02
  python sync_weapp_version.py --check               # 只检查是否与期望一致
"""
import io
import os
import sys

ROOT = "D:/Users/Claw"
WEAPP = os.path.join(ROOT, "jingyin")

# 默认目标版本（2026-09-09 夜班自省对齐 2026-09-08 白天发版内部版 3.64/1.40/3.7.7）
DEFAULTS = dict(shuili="3.64", perc="1.40", gujian="3.7.7", date="2026-09-08")

APP_JS = os.path.join(WEAPP, "app.js")
CONFIG_JS = os.path.join(WEAPP, "config", "config.js")
PKG_JSON = os.path.join(WEAPP, "package.json")


def repl_file(path, pairs):
    """按 (old, new) 列表精确替换，返回命中数；文件不存在返回 -1"""
    if not os.path.isfile(path):
        return -1
    with io.open(path, "r", encoding="utf-8") as f:
        t = f.read()
    hits = 0
    for a, b in pairs:
        if a in t:
            t = t.replace(a, b)
            hits += 1
        else:
            print("   ⚠️ %s 中未找到 %r（可能已同步或格式变化）" % (os.path.basename(path), a))
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(t)
    return hits


def check_file(path, expects):
    """检查文件是否包含期望串"""
    if not os.path.isfile(path):
        return False
    with io.open(path, "r", encoding="utf-8") as f:
        t = f.read()
    missing = [e for e in expects if e not in t]
    if missing:
        for m in missing:
            print("   ❌ %s 缺 %r" % (os.path.basename(path), m))
        return False
    return True


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check = "--check" in sys.argv
    v = DEFAULTS.copy()
    if len(args) >= 4:
        v = dict(shuili=args[0], perc=args[1], gujian=args[2], date=args[3])

    s, d = v["shuili"], v["date"]
    base = "Android v%s (%s)" % (s, d)

    if check:
        ok = True
        ok &= check_file(APP_JS, ["version: '%s'" % s, "buildDate: '%s'" % d, "baseline: '%s'" % base])
        ok &= check_file(CONFIG_JS, ["VERSION: '%s'" % s, "BASELINE: '%s'" % base])
        ok &= check_file(PKG_JSON, ['"version": "%s.0"' % s])
        print("✅ 小程序基线已同步 v%s (%s)" % (s, d) if ok else "❌ 小程序基线未同步")
        sys.exit(0 if ok else 1)

    print("🔄 同步小程序基线 -> v%s (%s)  [感知 v%s / 古建 v%s]" % (s, d, v["perc"], v["gujian"]))

    # 旧值：从文件里读出当前版本（避免硬编码旧版本号）
    import re
    cur = None
    with io.open(APP_JS, "r", encoding="utf-8") as f:
        m = re.search(r"version: '([^']+)'", f.read())
        if m:
            cur = m.group(1)
    if not cur:
        print("❌ 无法从 app.js 解析当前 version")
        sys.exit(1)
    if cur == s:
        print("⏭️ 小程序已是 v%s，跳过（幂等）" % s)
        sys.exit(0)

    # 旧日期
    with io.open(APP_JS, "r", encoding="utf-8") as f:
        m = re.search(r"buildDate: '([^']+)'", f.read())
        cur_date = m.group(1) if m else "2026-08-31"
    cur_base = "Android v%s (%s)" % (cur, cur_date)
    cur_triple = "水利 v%s / 感知 %s / 古建 %s" % (cur, v["perc"], v["gujian"])

    n1 = repl_file(APP_JS, [
        ("version: '%s'" % cur, "version: '%s'" % s),
        ("buildDate: '%s'" % cur_date, "buildDate: '%s'" % d),
        ("baseline: '%s'" % cur_base, "baseline: '%s'" % base),
    ])
    n2 = repl_file(CONFIG_JS, [
        ("VERSION: '%s'" % cur, "VERSION: '%s'" % s),
        ("BASELINE: '%s'" % cur_base, "BASELINE: '%s'" % base),
        ("对齐 Android v%s 基线（%s）" % (cur, cur_date), "对齐 Android v%s 基线（%s）" % (s, d)),
    ])
    n3 = repl_file(PKG_JSON, [('"version": "%s.0"' % cur, '"version": "%s.0"' % s)])

    print("   app.js %d 处 / config.js %d 处 / package.json %d 处" % (n1, n2, n3))
    print("✅ 小程序基线同步完成：v%s (%s)" % (s, d))


if __name__ == "__main__":
    main()
