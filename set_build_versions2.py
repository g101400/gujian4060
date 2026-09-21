#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""set_build_versions2.py <pub|int> — 四构建脚本版本串/归档名幂等切换（绝对值模式）
pub:  水利 3.57 / 感知 1.33 / 古建 3.7.4 / 归档 四端安装包_20260905_v357_pub
int:  水利 3.58 / 感知 1.34 / 古建 3.7.4 / 归档 四端安装包_20260905_v358_int
"""
import io, re, sys

MODE = sys.argv[1]
assert MODE in ("pub", "int")
D = "20260905"
if MODE == "pub":
    SH, PC, GJ, ARC = "3.57", "1.33", "3.7.4", "四端安装包_%s_v357_pub" % D
else:
    SH, PC, GJ, ARC = "3.58", "1.34", "3.7.4", "四端安装包_%s_v358_int" % D

def sub(path, pat, repl, tag):
    s = io.open(path, encoding="utf-8").read()
    s2, n = re.subn(pat, repl, s)
    if n:
        io.open(path, "w", encoding="utf-8", newline="").write(s2)
    print("%-46s %-22s %d 处" % (path.split("/")[-1], tag, n))

# 归档名（四个脚本统一）
sub("native-shell/make_deb.py", r"四端安装包_20260905_v\d+_(?:pub|int)", ARC, "归档名")
sub("native-shell/gen_win_msi_wix7.py", r"四端安装包_20260905_v\d+_(?:pub|int)", ARC, "归档名")
sub("native-shell/build_win_exe_nsis.py", r"四端安装包_20260905_v\d+_(?:pub|int)", ARC, "归档名")
sub("native-shell/water-ios/build_ios_zip.py", r"四端安装包_20260905_v\d+_(?:pub|int)", ARC, "归档名")

# MSI（gen_win_msi_wix7）
sub("native-shell/gen_win_msi_wix7.py", r'"ver":"\d+\.\d+\.0"', '"ver":"%s.0"' % SH, "msi shuili ver")
sub("native-shell/gen_win_msi_wix7.py", r'"ver":"\d+\.\d+\.0"', '"ver":"%s.0"' % PC, "msi perc ver")
sub("native-shell/gen_win_msi_wix7.py", r'"ver":"3\.\d+\.\d+\.0"', '"ver":"%s.0"' % GJ, "msi gujian ver")
sub("native-shell/gen_win_msi_wix7.py", r'"appver":"\d+\.\d+"', '"appver":"%s"' % SH, "msi shuili appver")
sub("native-shell/gen_win_msi_wix7.py", r'"appver":"\d+\.\d+"', '"appver":"%s"' % PC, "msi perc appver")

# NSIS（build_win_exe_nsis）
sub("native-shell/build_win_exe_nsis.py", r'"ver": "\d+\.\d+\.0", "ver4": "\d+\.\d+\.0\.0"',
    '"ver": "%s.0", "ver4": "%s.0.0"' % (SH, SH), "nsis shuili")
sub("native-shell/build_win_exe_nsis.py", r'"ver": "\d+\.\d+\.0", "ver4": "\d+\.\d+\.0\.0"',
    '"ver": "%s.0", "ver4": "%s.0.0"' % (PC, PC), "nsis perc")
sub("native-shell/build_win_exe_nsis.py", r'"ver": "3\.\d+\.\d+\.0", "ver4": "3\.\d+\.\d+\.0\.0"',
    '"ver": "%s.0", "ver4": "%s.0.0"' % (GJ, GJ), "nsis gujian")

# DEB（make_deb）
sub("native-shell/make_deb.py", r'"ver": "\d+\.\d+\.%s"' % D, '"ver": "%s.%s"' % (SH, D), "deb shuili")
sub("native-shell/make_deb.py", r'"ver": "\d+\.\d+\.%s"' % D, '"ver": "%s.%s"' % (PC, D), "deb perc")

# iOS（build_ios_zip）
for v in (SH, PC):
    sub("native-shell/water-ios/build_ios_zip.py", r'"file_ver": "\d+\.\d+_%s"' % D, '"file_ver": "%s_%s"' % (v, D), "ios file_ver %s" % v)
    sub("native-shell/water-ios/build_ios_zip.py", r'"new_ver": "\d+\.\d+_%s"' % D, '"new_ver": "%s_%s"' % (v, D), "ios new_ver %s" % v)
    sub("native-shell/water-ios/build_ios_zip.py", r'"readme_ver": "V\d+\.\d+_%s"' % D, '"readme_ver": "V%s_%s"' % (v, D), "ios readme %s" % v)

print("构建脚本已切换到 %s 通道: %s/%s/%s -> %s" % (MODE, SH, PC, GJ, ARC))
