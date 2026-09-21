#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""set_build_versions.py <pub|int> — 四个构建脚本版本串/归档名双通道幂等切换"""
import io, sys

MODE = sys.argv[1]
assert MODE in ("pub", "int")
D = "20260905"

def apply(path, pairs):
    s = io.open(path, encoding="utf-8").read()
    changed = 0
    for old, new in pairs:
        c = s.count(old)
        if c:
            s = s.replace(old, new); changed += c
    io.open(path, "w", encoding="utf-8", newline="").write(s)
    print("%-42s %d 处更新" % (path, changed))

if MODE == "pub":
    SH, PC, GJ, ARC = "3.55", "1.31", "3.7.3", "四端安装包_20260905_v355_pub"
else:
    SH, PC, GJ, ARC = "3.56", "1.32", "3.7.3", "四端安装包_20260905_v356_int"
OTH = {"pub": "int", "int": "pub"}[MODE]
ARC_OTH = "四端安装包_20260905_v356_int" if MODE == "pub" else "四端安装包_20260905_v355_pub"
SH_O, PC_O = ("3.56", "1.32") if MODE == "pub" else ("3.55", "1.31")

COMMON = [(ARC_OTH, ARC)]
MSI = [(f'"ver":"{SH_O}.0"', f'"ver":"{SH}.0"'), (f'"ver":"{PC_O}.0"', f'"ver":"{PC}.0"'),
       (f'"appver":"{SH_O}"', f'"appver":"{SH}"'), (f'"appver":"{PC_O}"', f'"appver":"{PC}"')]
NSIS = [(f'"ver": "{SH_O}.0", "ver4": "{SH_O}.0.0"', f'"ver": "{SH}.0", "ver4": "{SH}.0.0"'),
        (f'"ver": "{PC_O}.0", "ver4": "{PC_O}.0.0"', f'"ver": "{PC}.0", "ver4": "{PC}.0.0"')]
DEB = [(f'"ver": "{SH_O}.{D}"', f'"ver": "{SH}.{D}"'), (f'"ver": "{PC_O}.{D}"', f'"ver": "{PC}.{D}"')]
IOS = [(f'"file_ver": "{SH_O}_{D}"', f'"file_ver": "{SH}_{D}"'), (f'"new_ver": "{SH_O}_{D}"', f'"new_ver": "{SH}_{D}"'),
       (f'"readme_ver": "V{SH_O}_{D}"', f'"readme_ver": "V{SH}_{D}"'),
       (f'"file_ver": "{PC_O}_{D}"', f'"file_ver": "{PC}_{D}"'), (f'"new_ver": "{PC_O}_{D}"', f'"new_ver": "{PC}_{D}"'),
       (f'"readme_ver": "V{PC_O}_{D}"', f'"readme_ver": "V{PC}_{D}"')]

apply("native-shell/make_deb.py", COMMON + DEB)
apply("native-shell/gen_win_msi_wix7.py", COMMON + MSI)
apply("native-shell/build_win_exe_nsis.py", COMMON + NSIS)
apply("native-shell/water-ios/build_ios_zip.py", COMMON + IOS)
print("构建脚本已切换到 %s 通道" % MODE)
