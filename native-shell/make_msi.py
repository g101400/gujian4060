#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用纯 Python 标准库 msilib 构造 Windows MSI 安装包（不依赖 WiX）。
把某个 win-<工程> 发布目录整体打包，安装到 Program Files\<name>\，建开始菜单+桌面快捷方式。

注：msilib 仅 Windows 原生 CPython 可用，必须用 `py make_msi.py <proj>` 运行。
用法：
  py native-shell/make_msi.py <proj>     # proj ∈ {shuili, perc, gujian}
产物：
  <归档>/win-<工程>/<name>_Setup.msi
"""
import os, sys, msilib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCHIVE = os.path.join(ROOT, "APK归档", "四端安装包_20260824")

PROJ = {
    "shuili": {"dir": "win-水利-水利工程一张图", "name": "水利工程基础信息一张图",
               "manuf": "小七水利", "ver": "3.31.20260825", "upgrade": "{A1B2C3D4-0001-4000-8000-000000000001}"},
    "perc":   {"dir": "win-感知-水利感知项目一张图", "name": "水利感知项目一张图",
               "manuf": "小七水利", "ver": "1.7.20260825", "upgrade": "{B2C3D4E5-0002-4000-8000-000000000002}"},
    "gujian": {"dir": "win-古建-古建景点打卡", "name": "古建景点打卡",
               "manuf": "小七水利", "ver": "1.9.20260825", "upgrade": "{C3D4E5F6-0003-4000-8000-000000000003}"},
}

def main():
    key = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in PROJ else "shuili"
    c = PROJ[key]
    src = os.path.join(ARCHIVE, c["dir"])
    if not os.path.isdir(src):
        print("源目录不存在:", src); sys.exit(1)

    out = os.path.join(ARCHIVE, c["dir"], "%s_Setup.msi" % c["name"])

    db = msilib.init_database(out, msilib.schema, c["name"], c["upgrade"], c["ver"], c["manuf"], c["upgrade"])
    db.Property("ProductLanguage", "2052")
    db.Property("ALLUSERS", "1")
    db.Property("ARPPRODUCTICON", "File_AppExe")  # 用主exe作图标
    db.Property("DefaultDir", "PF|ProgramFiles|%s" % c["name"])

    # 目录树
    tdir = msilib.Directory(db, msilib.PID_PARENT, "TARGETDIR", None, "SourceDir")
    pf = msilib.Directory(db, tdir, "ProgramFilesFolder", "PF", None)
    app = msilib.Directory(db, pf, "AppDir", "APPDIR", c["name"])
    sm = msilib.Directory(db, tdir, "ProgramMenuFolder", "SM", None)
    sm_app = msilib.Directory(db, sm, "AppMenuDir", "SMAPP", c["name"])
    desk = msilib.Directory(db, tdir, "DesktopFolder", "DESK", None)

    # Feature
    feat = msilib.Feature(db, "MainFeature", c["name"], "核心文件", 1, 1, "YES", msilib.Required)
    feat.set_current()

    # 收集文件（递归，排除 .pdb 和 build_msi.*）
    files = []
    for dp, _, fns in os.walk(src):
        for fn in fns:
            if fn.lower().endswith(".pdb") or fn.startswith("build_msi"):
                continue
            full = os.path.join(dp, fn)
            rel = os.path.relpath(full, src).replace(os.sep, "/")
            files.append((rel, full))

    # CAB + 文件/组件/快捷方式
    cab = msilib.CAB("ag#cab1.cab")
    exe_rel = None
    for rel, full in files:
        comp_id = "CMP_" + str(abs(hash(rel)) % (10**9))
        # 组件目录：保持相对路径的子目录结构
        parent = app
        parts = rel.split("/")
        cur = app
        for p in parts[:-1]:
            # 简单：所有文件组件挂在 AppDir 下（扁平键，目录结构由 File 的 FileName 体现）
            pass
        comp = msilib.Component(db, comp_id, rel, None, app, None)
        # 加入 CAB（msilib 用相对路径作 cab 内名）
        cab.append(rel, full)
        msilib.add_data(db, "File",
            [(comp_id, rel, comp_id, None, rel, msilib.Binary(rel), 0, None, None)])
        if rel.lower().endswith(".exe") and exe_rel is None:
            exe_rel = rel
            # 开始菜单 + 桌面快捷方式
            msilib.add_data(db, "Shortcut", [
                ("SM_" + comp_id, "SMAPP", c["name"], "APPDIR", rel, None, None, None, None, None, None, "TARGETDIR"),
                ("DS_" + comp_id, "DESK", c["name"], "APPDIR", rel, None, None, None, None, None, None, "TARGETDIR"),
            ])
        # 组件归属 feature
        msilib.add_data(db, "FeatureComponents", [(feat.id, comp_id)])

    cab.commit(db)

    # Media（单 cab）
    n = len(files)
    msilib.add_data(db, "Media", [(1, n, None, "ag#cab1.cab", None, None)])

    # Icon（用主 exe 作 ARP 图标）
    if exe_rel:
        msilib.add_data(db, "Icon", [("File_AppExe", msilib.Binary(exe_rel))])
        msilib.add_data(db, "Icon", [("File_AppExe", None)])  # 占位避免报错（实际用 Binary 流）

    # 安装顺序
    msilib.add_data(db, "InstallExecuteSequence", [
        ("CostInitialize", None, 800),
        ("FileCost", None, 900),
        ("CostFinalize", None, 1000),
        ("InstallFiles", None, 4000),
        ("CreateShortcuts", None, 4500),
        ("RegisterUser", None, 6000),
        ("RegisterProduct", None, 6100),
        ("PublishFeatures", None, 6300),
        ("PublishProduct", None, 6400),
    ])
    msilib.add_data(db, "InstallUISequence", [
        ("CostInitialize", None, 800),
        ("FileCost", None, 900),
        ("CostFinalize", None, 1000),
    ])

    db.Commit()
    print("MSI 生成完成:", out, os.path.getsize(out), "bytes")
    print("  文件数:", n, " 主exe:", exe_rel)

if __name__ == "__main__":
    main()
