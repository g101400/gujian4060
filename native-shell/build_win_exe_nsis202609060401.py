#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用 NSIS (makensis.exe) 生成三端 Win EXE 安装包（单文件自释放安装器）。

与 WiX MSI 互为补充：MSI 走官方安装数据库，EXE 走 NSIS 自释放，二者都
  - 安装到 $PROGRAMFILES64/<中文名>（RequestExecutionLevel admin 提权 -> 安装目录有写权限）
  - 携带 app.ico 图标（安装器本身图标 + 开始菜单/桌面快捷方式图标）
  - 创建 开始菜单 + 桌面 快捷方式（指向 ASCII 命名的 exe，避免中文 exe 路径兼容问题）
  - 写入标准卸载注册表项，附 Uninstall.exe

前置：NSIS makensis.exe（默认 C:/Program Files (x86)/NSIS/makensis.exe）
产物：APK归档/四端安装包_20260830_v343/win/<name>_Setup.exe
用法：python3 build_win_exe_nsis.py
"""
import os, shutil, subprocess

NATIVE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(NATIVE)
ARCHIVE = os.path.join(ROOT, "APK归档", "四端安装包_20260903_v349_pub", "win")
MAKENSIS = r"C:/Program Files (x86)/NSIS/makensis.exe"

PROJS = [
    {"key": "shuili", "proj": "win-water-webview2", "pub": "publish_win_water",
     "name": "水利工程基础信息一张图", "cn_exe": "水利工程基础信息一张图.exe", "exe": "ShuiliMap.exe",
     "ver": "3.49.0", "ver4": "3.49.0.0", "upg": "shuili_map_setup"},
    {"key": "perc", "proj": "win-webview2", "pub": "publish_win_perc",
     "name": "水利感知项目一张图", "cn_exe": "水利感知项目一张图.exe", "exe": "ShuiliPerc.exe",
     "ver": "1.25.0", "ver4": "1.25.0.0", "upg": "shuili_perc_setup"},
    {"key": "gujian", "proj": "win-gujian-webview2", "pub": "publish_win_gujian",
     "name": "古建景点打卡", "cn_exe": "古建景点打卡.exe", "exe": "GujianMap.exe",
     "ver": "3.7.0", "ver4": "3.7.0.0", "upg": "gujian_map_setup"},
]
# 安装器/卸载器不需要的文件
SKIP_EXT = (".wxs", ".wixobj", ".msi", ".cab", ".wixpdb", ".pdb", ".bak", ".ctxbak", ".menu1bak")


def find_makensis():
    if os.path.isfile(MAKENSIS):
        return MAKENSIS
    for p in os.environ.get("PATH", "").split(os.pathsep):
        cand = os.path.join(p, "makensis.exe")
        if os.path.isfile(cand):
            return cand
    raise SystemExit("未找到 makensis.exe，请先安装 NSIS")


def stage(p):
    """复制发布目录到 ASCII 暂存目录（exe 改名 ASCII，避免中文名在快捷/注册表兼容问题）。"""
    src = os.path.join(NATIVE, p["proj"], p["pub"])
    if not os.path.isdir(src):
        print("⚠️ 跳过 %s：发布目录不存在 %s" % (p["key"], src))
        return None
    import time as _t
    dst = os.path.join("C:/tmp/nsis_wb2", "%s_%d" % (p["key"], int(_t.time())))
    os.makedirs(dst, exist_ok=True)
    n = 0
    for dp, dns, fns in os.walk(src):
        # 剪枝备份/残留目录（与 gen_win_msi_wix7.py 的 is_skip_dir 对齐），避免旧数据整包混入安装器
        dns[:] = [d for d in dns if not (
            d.startswith("webroot_bak_") or d.startswith("backup_") or d == "bak"
            or d.endswith(".bak") or d.endswith(".ctxbak") or d.endswith(".menu1bak")
            or (d.lower() == "leaflet" and os.path.basename(dp).lower() == "leaflet"))]
        for fn in fns:
            if fn.lower().endswith(SKIP_EXT):
                continue
            full = os.path.join(dp, fn)
            rel = os.path.relpath(full, src)
            tdir = os.path.join(dst, os.path.dirname(rel))
            os.makedirs(tdir, exist_ok=True)
            tname = p["exe"] if fn == p["cn_exe"] else fn
            shutil.copy2(full, os.path.join(tdir, tname))
            n += 1
    ico = os.path.join(NATIVE, p["proj"], "app.ico")
    if os.path.isfile(ico):
        shutil.copy2(ico, os.path.join(dst, "app.ico"))
    print("  [%s] 暂存文件=%d -> %s" % (p["key"], n, dst))
    return dst


def gen_nsi(p, stage_dir, out_exe):
    name, exe, key = p["name"], p["exe"], p["upg"]
    sd = stage_dir.replace("\\", "/")
    L = []
    L.append("Unicode true")
    L.append("RequestExecutionLevel admin")
    L.append('InstallDir "$PROGRAMFILES64\\%s"' % name)
    L.append('Name "%s"' % name)
    L.append('Icon "%s/app.ico"' % sd)
    L.append('UninstallIcon "%s/app.ico"' % sd)
    L.append('OutFile "%s"' % out_exe.replace("\\", "/"))
    L.append('VIProductVersion "%s"' % p["ver4"])
    L.append('VIAddVersionKey "ProductName" "%s"' % name)
    L.append('VIAddVersionKey "FileVersion" "%s"' % p["ver"])
    L.append('VIAddVersionKey "LegalCopyright" "小七"')
    L.append("Page directory")
    L.append("Page instfiles")
    L.append("Section \"主程序\"")
    L.append('  SetOutPath "$INSTDIR"')
    L.append('  File /r "%s"' % (sd.replace('/', '\\') + '\\*'))
    L.append('  CreateDirectory "$SMPROGRAMS"')
    L.append('  CreateShortCut "$SMPROGRAMS\\%s.lnk" "$INSTDIR\\%s" "" "$INSTDIR\\app.ico"' % (name, exe))
    L.append('  CreateShortCut "$DESKTOP\\%s.lnk" "$INSTDIR\\%s" "" "$INSTDIR\\app.ico"' % (name, exe))
    L.append('  WriteUninstaller "$INSTDIR\\Uninstall.exe"')
    L.append('  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\%s" "DisplayName" "%s"' % (key, name))
    L.append('  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\%s" "UninstallString" "$\\"$INSTDIR\\Uninstall.exe$\\""' % key)
    L.append('  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\%s" "DisplayIcon" "$INSTDIR\\app.ico"' % key)
    L.append('  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\%s" "Publisher" "小七"' % key)
    L.append('  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\%s" "NoModify" "1"' % key)
    L.append("SectionEnd")
    L.append("Section \"Uninstall\"")
    L.append('  RMDir /r "$INSTDIR"')
    L.append('  Delete "$SMPROGRAMS\\%s.lnk"' % name)
    L.append('  Delete "$DESKTOP\\%s.lnk"' % name)
    L.append('  DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\%s"' % key)
    L.append("SectionEnd")
    return "\n".join(L)


def main():
    mk = find_makensis()
    print("makensis:", mk)
    os.makedirs(ARCHIVE, exist_ok=True)
    for p in PROJS:
        src = os.path.join(NATIVE, p["proj"], p["pub"])
        exe_path = os.path.join(src, p["cn_exe"])
        if os.path.isfile(exe_path):
            with open(exe_path, "rb") as f:
                if b"GetWebView2DataFolder" not in f.read():
                    raise SystemExit("❌ [%s] exe 缺 WebView2 userDataFolder 修复标记（旧产物），禁止打包" % p["key"])
        sd = stage(p)
        if not sd:
            continue
        out_exe = os.path.join(ARCHIVE, "%s_Setup.exe" % p["name"])
        nsi = gen_nsi(p, sd, out_exe)
        nsi_path = os.path.join("C:/tmp/nsis_wb2", "%s.nsi" % p["key"])
        open(nsi_path, "w", encoding="utf-8-sig").write(nsi)  # UTF-8 BOM，NSIS Unicode 识别
        if os.path.isfile(out_exe):
            os.remove(out_exe)
        r = subprocess.run([mk, nsi_path], capture_output=True, text=True)
        if os.path.isfile(out_exe):
            print("✅ %s_Setup.exe %d bytes -> %s" % (p["name"], os.path.getsize(out_exe), out_exe))
        else:
            print("❌ %s 失败 exit=%d" % (p["name"], r.returncode))
            print(r.stdout[-1000:])
            print(r.stderr[-1000:])


if __name__ == "__main__":
    main()
