#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bump_version_v355_pub.py — 出包前把 4 个构建脚本的版本串提升到公开版
shuili 3.55 / perc 1.31 / gujian 3.7.3，日期 20260905，归档 四端安装包_20260905_v355_pub。
内部版出包前再跑 bump_version_v356_int.py。"""
import io, sys

PAIRS_COMMON = [
    ("四端安装包_20260903_v349_pub", "四端安装包_20260905_v355_pub"),
]

SHUILI = [
    ('"ver": "3.49.20260903"', '"ver": "3.55.20260905"'),
    ('"ver": "3.49.0"', '"ver": "3.55.0"'),
    ('"appver":"3.49"', '"appver":"3.55"'),
    ('"appver": "3.49"', '"appver": "3.55"'),
    ('"ver": "3.49.0", "ver4": "3.49.0.0"', '"ver": "3.55.0", "ver4": "3.55.0.0"'),
    ('"file_ver": "3.49_20260903"', '"file_ver": "3.55_20260905"'),
    ('"new_ver": "3.49_20260903"', '"new_ver": "3.55_20260905"'),
    ('"readme_ver": "V3.49_20260903"', '"readme_ver": "V3.55_20260905"'),
]
PERC = [
    ('"ver": "1.25.20260903"', '"ver": "1.31.20260905"'),
    ('"ver": "1.25.0"', '"ver": "1.31.0"'),
    ('"appver":"1.25"', '"appver":"1.31"'),
    ('"appver": "1.25"', '"appver": "1.31"'),
    ('"ver": "1.25.0", "ver4": "1.25.0.0"', '"ver": "1.31.0", "ver4": "1.31.0.0"'),
    ('"file_ver": "1.25_20260903"', '"file_ver": "1.31_20260905"'),
    ('"new_ver": "1.25_20260903"', '"new_ver": "1.31_20260905"'),
    ('"readme_ver": "V1.25_20260903"', '"readme_ver": "V1.31_20260905"'),
]
GUJIAN = [
    ('"ver": "3.7.20260902"', '"ver": "3.7.3.20260905"'),
    ('"ver": "3.7.0"', '"ver": "3.7.3.0"'),
    ('"appver":"3.7"', '"appver":"3.7.3"'),
    ('"appver": "3.7"', '"appver": "3.7.3"'),
    ('"ver": "3.7.0", "ver4": "3.7.0.0"', '"ver": "3.7.3.0", "ver4": "3.7.3.0.0"'),
    ('"file_ver": "3.7_20260902"', '"file_ver": "3.7.3_20260905"'),
    ('"new_ver": "3.7_20260902"', '"new_ver": "3.7.3_20260905"'),
    ('"readme_ver": "V3.7_20260902"', '"readme_ver": "V3.7.3_20260905"'),
]

FILES = {
    "native-shell/make_deb.py": PAIRS_COMMON + SHUILI + PERC + GUJIAN,
    "native-shell/gen_win_msi_wix7.py": PAIRS_COMMON + SHUILI + PERC + GUJIAN,
    "native-shell/build_win_exe_nsis.py": PAIRS_COMMON + SHUILI + PERC + GUJIAN,
    "native-shell/water-ios/build_ios_zip.py": PAIRS_COMMON + SHUILI + PERC + GUJIAN,
}

for path, pairs in FILES.items():
    s = io.open(path, encoding="utf-8").read()
    for old, new in pairs:
        c = s.count(old)
        if c == 0:
            print("[skip] %s 无 %s" % (path, old)); continue
        s = s.replace(old, new)
        print("[ok] %s: %s -> %s (x%d)" % (path, old.strip('"'), new.strip('"'), c))
    io.open(path, "w", encoding="utf-8", newline="").write(s)
print("公开版构建脚本版本串提升完成")
