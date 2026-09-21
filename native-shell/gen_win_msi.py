#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
在英文中转目录为三端 Win 工程生成 MSI（避开水星路径 wix 输出被吞的问题）。
依赖：本机已装 WiX v7 (dotnet tool, wix 命令在 PATH)。
用法：python3 gen_win_msi.py   （在 Git Bash 下，PATH 含 wix）
"""
import os, sys, shutil, subprocess

ARCHIVE = "C:/tmp/msi_src"
WORK = "C:/tmp/msi_wb2"

PROJS = [
    {"key":"shuili","dir":"win-水利-水利工程一张图","name":"水利工程基础信息一张图","ver":"3.46","upg":"{A1B2C3D4-0001-4000-8000-000000000001}","exe":"水利工程基础信息一张图.exe"},
    {"key":"perc",  "dir":"win-感知-水利感知项目一张图","name":"水利感知项目一张图","ver":"1.22","upg":"{B2C3D4E5-0002-4000-8000-000000000002}","exe":"水利感知项目一张图.exe"},
    {"key":"gujian","dir":"win-古建-古建景点打卡","name":"古建景点打卡","ver":"3.4","upg":"{C3D4E5F6-0003-4000-8000-000000000003}","exe":"古建景点打卡.exe"},
]

# 通用文件清单（exe 名由配置动态填）
FILE_ROWS = [
    (None, "F_exe", "C_exe", "{D1A2B3C4-1001-4000-8000-000000000001}"),
    ("WebView2Loader.dll", "F_loader", "C_loader", "{D1A2B3C4-1002-4000-8000-000000000002}"),
    ("Microsoft.Web.WebView2.Core.xml", "F_xml1", "C_xml1", "{D1A2B3C4-1003-4000-8000-000000000003}"),
    ("Microsoft.Web.WebView2.WinForms.xml", "F_xml2", "C_xml2", "{D1A2B3C4-1004-4000-8000-000000000004}"),
    ("Microsoft.Web.WebView2.Wpf.xml", "F_xml3", "C_xml3", "{D1A2B3C4-1005-4000-8000-000000000005}"),
    ("runtimes/win-x64/native/WebView2Loader.dll", "F_rloader", "C_rloader", "{D1A2B3C4-1006-4000-8000-000000000006}"),
    ("webroot/app.js", "F_appjs", "C_appjs", "{D1A2B3C4-1007-4000-8000-000000000007}"),
    ("webroot/ai_module.js", "F_aimod", "C_aimod", "{D1A2B3C4-1016-4000-8000-000000000016}"),
    ("webroot/data.js", "F_datajs", "C_datajs", "{D1A2B3C4-1008-4000-8000-000000000008}"),
    ("webroot/index.html", "F_index", "C_index", "{D1A2B3C4-1009-4000-8000-000000000009}"),
    ("webroot/jszip.min.js", "F_jszip", "C_jszip", "{D1A2B3C4-1010-4000-8000-000000000010}"),
    ("webroot/version.json", "F_ver", "C_ver", "{D1A2B3C4-1011-4000-8000-000000000011}"),
    ("webroot/leaflet/leaflet.css", "F_lcss", "C_lcss", "{D1A2B3C4-1012-4000-8000-000000000012}"),
    ("webroot/leaflet/leaflet.js", "F_ljs", "C_ljs", "{D1A2B3C4-1013-4000-8000-000000000013}"),
    ("webroot/leaflet/leaflet/leaflet.css", "F_lcss2", "C_lcss2", "{D1A2B3C4-1014-4000-8000-000000000014}"),
    ("webroot/leaflet/leaflet/leaflet.js", "F_ljs2", "C_ljs2", "{D1A2B3C4-1015-4000-8000-000000000015}"),
]

def gen_wxs(d, p):
    # files.wxs
    rows = [(p["exe"] if src is None else src, fid, cid, guid) for src, fid, cid, guid in FILE_ROWS]
    L = ['<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">', '  <Fragment>', '    <ComponentGroup Id="MainComponents" Directory="INSTALLFOLDER">']
    for src, fid, cid, guid in rows:
        sn = ' ShortName="RVIEW2LD.DLL"' if 'runtimes' in src else ''
        L.append('      <Component Id="%s" Guid="%s">' % (cid, guid))
        L.append('        <File Id="%s" Source="%s"%s KeyPath="yes" />' % (fid, src, sn))
        L.append('      </Component>')
    L += ['    </ComponentGroup>', '  </Fragment>', '</Wix>']
    open(os.path.join(d, "files.wxs"), "w", encoding="utf-8").write("\n".join(L))

    # product.wxs
    prod = (
        '<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">\n'
        '  <Package Name="%s" Language="2052" Version="%s" Manufacturer="xiaoyi" UpgradeCode="%s">\n'
        '    <MajorUpgrade DowngradeErrorMessage="Installed newer version, uninstall first." />\n'
        '    <MediaTemplate EmbedCab="yes" />\n'
        '    <Feature Id="ProductFeature" Title="Main" Level="1">\n'
        '      <ComponentGroupRef Id="MainComponents" />\n'
        '      <ComponentRef Id="StartMenuShortcut" />\n'
        '    </Feature>\n'
        '    <StandardDirectory Id="ProgramFiles64Folder">\n'
        '      <Directory Id="INSTALLFOLDER" Name="%s" />\n'
        '    </StandardDirectory>\n'
        '    <StandardDirectory Id="ProgramMenuFolder">\n'
        '      <Directory Id="ApplicationProgramsFolder" Name="%s" />\n'
        '    </StandardDirectory>\n'
        '    <Component Id="StartMenuShortcut" Guid="{A1B2C3D4-0002-4000-8000-000000000002}" Directory="ApplicationProgramsFolder">\n'
        '      <Shortcut Id="AppShortcut" Name="%s" Target="[INSTALLFOLDER]%s" WorkingDirectory="INSTALLFOLDER" />\n'
        '      <RemoveFolder Id="CleanMenuDir" Directory="ApplicationProgramsFolder" On="uninstall" />\n'
        '      <RegistryValue Root="HKCU" Key="Software\\xiaoyi\\%s" Name="installed" Type="integer" Value="1" KeyPath="yes" />\n'
        '    </Component>\n'
        '  </Package>\n'
        '</Wix>\n'
    ) % (p["name"], p["ver"], p["upg"], p["name"], p["name"], p["name"], p["exe"], p["name"])
    open(os.path.join(d, "product.wxs"), "w", encoding="utf-8").write(prod)

def main():
    # 2026-09-01 退役：本脚本从 C:/tmp/msi_src 打包，v346 时被误用于从旧 publish_v331 复制产物，
    # 导致 MSI 内 exe 缺 WebView2 userDataFolder 修复（标准用户启动 E_ACCESSDENIED「Access is denied」）。
    # 统一改用 gen_win_msi_wix7.py（强制从 publish_win_* 构建 + exe 修复标记门禁）。
    raise SystemExit(
        "❌ gen_win_msi.py 已退役（2026-09-01，因其从 C:/tmp/msi_src 取旧产物致 MSI 带未修复 exe）。\n"
        "   请改用：python3 gen_win_msi_wix7.py"
    )

if __name__ == "__main__":
    main()
