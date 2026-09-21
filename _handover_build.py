#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the handover zip for 水利/古建/感知 三端四平台 (v3.77)."""
import os, zipfile, fnmatch

ROOT = "D:/Users/Claw"
TOP  = "水利古建感知三端四平台_交接_v3.77_20260920"
ZIP  = os.path.join(ROOT, TOP + ".zip")

# ---------- 通用排除（对齐各仓库 .gitignore：备份/构建产物/密钥） ----------
JUNK_DIRS = {".git", "webroot", "bin", "obj", "dist", "__pycache__", "apple-package", "node_modules"}
JUNK_FILE_EXT = (".apk", ".idsig", ".zip", ".jks", ".bak", ".pyc")
JUNK_FILE_NAMES = {".gujian_token", ".env", ".sec_pass", "keystore.jks"}

def is_junk(name):
    if name in JUNK_DIRS or name in JUNK_FILE_NAMES:
        return True
    if name.endswith(JUNK_FILE_EXT):
        return True
    if (name.startswith("assets_bak_") or name.startswith("webroot_bak_")
            or name.startswith("_bak_") or name.startswith("publish")):
        return True
    # 编辑期自动快照（app.js.bak_* / *.flickbak / *.ctxbak 等），非交付源码
    if ".bak" in name or name.endswith(".flickbak") or name.endswith(".ctxbak"):
        return True
    return False

def collect(src_abs, dst_prefix, skip_dirs_abs=None, root_only_names=None):
    """Walk src_abs, yield (abs_path, dst_rel) for non-junk files."""
    skip_dirs_abs = set(os.path.normpath(p) for p in (skip_dirs_abs or []))
    entries = []
    for cur, dirs, files in os.walk(src_abs):
        # prune junk dirs in-place
        dirs[:] = [d for d in dirs if not is_junk(d)]
        # prune explicitly-skipped dirs
        if os.path.normpath(cur) in skip_dirs_abs:
            dirs[:] = []
            files[:] = []
            continue
        # root-only filter (for native-shell 公共构建脚本)
        if root_only_names is not None and os.path.normpath(cur) == os.path.normpath(src_abs):
            dirs[:] = [d for d in dirs if d in root_only_names]
            files[:] = [f for f in files if f in root_only_names]
        for f in files:
            if is_junk(f):
                continue
            absf = os.path.join(cur, f)
            rel = os.path.relpath(absf, src_abs)
            entries.append((absf, os.path.join(dst_prefix, rel)))
    return entries

def main():
    files = []  # list of (abs, dst_rel)

    def add(src_rel, dst_prefix, **kw):
        src_abs = os.path.join(ROOT, src_rel)
        if not os.path.exists(src_abs):
            print("!! MISSING:", src_rel); return
        if kw.get("skip_dirs_abs"):
            kw["skip_dirs_abs"] = [os.path.join(ROOT, p) for p in kw["skip_dirs_abs"]]
        for a, d in collect(src_abs, dst_prefix, **kw):
            files.append((a, d))

    def add_tool(src_abs, dst):
        """Add a single file or a directory (junk-filtered) given an absolute path."""
        if not os.path.exists(src_abs):
            print("!! MISSING:", src_abs); return
        if os.path.isdir(src_abs):
            for a, d in collect(src_abs, dst):
                files.append((a, d))
        else:
            files.append((src_abs, dst))

    # 02 Web 前端规范源
    add("android-build/water-v329/assets", "02_Web前端源码(规范源)/water-v329_assets")
    add("android-build/gujian-v31/assets", "02_Web前端源码(规范源)/gujian-v31_assets")
    add("android-build/perc-v13/assets",   "02_Web前端源码(规范源)/perc-v13_assets")

    # 03 Android 原生壳（壳内 assets 为构建期副本，排除避免与规范源重复）
    add("android-build/shuili-v329", "03_Android原生壳/shuili-v329",
        skip_dirs_abs=["android-build/shuili-v329/assets"])
    add("android-build/perc-v13", "03_Android原生壳/perc-v13")  # perc 自身 assets 即规范源，保留
    add("android-build/gujian-v31/native-shell/android-gujian", "03_Android原生壳/gujian-android",
        skip_dirs_abs=["android-build/gujian-v31/native-shell/android-gujian/assets"])

    # 04 Win/UOS/iOS 壳（排除 webroot/publish*/bin/obj 等构建产物）
    add("native-shell/win-water-webview2", "04_Win_UOS_iOS壳/win-water-webview2")
    add("native-shell/uos-water-pyqt6",    "04_Win_UOS_iOS壳/uos-water-pyqt6")
    add("native-shell/win-webview2",       "04_Win_UOS_iOS壳/win-webview2")
    add("native-shell/uos-pyqt6",          "04_Win_UOS_iOS壳/uos-pyqt6")
    add("native-shell/win-gujian-webview2","04_Win_UOS_iOS壳/gujian-win")
    add("native-shell/uos-gujian-pyqt6",   "04_Win_UOS_iOS壳/gujian-uos")
    add("android-build/gujian-v31/native-shell/gujian-ios", "04_Win_UOS_iOS壳/gujian-ios")
    add("native-shell/water-ios", "04_Win_UOS_iOS壳/water-ios")

    # 04 公共构建脚本（仅 native-shell 根级脚本 + nsis_check + win_installer_template）
    ns_root = os.path.join(ROOT, "native-shell")
    root_names = set()
    for f in os.listdir(ns_root):
        if f in {".git"}: continue
        if f.endswith((".py", ".ps1", ".sh")) or f in {"README.md", "nsis_check", "win_installer_template"}:
            root_names.add(f)
    for nm in sorted(root_names):
        p = os.path.join(ns_root, nm)
        if os.path.isdir(p):
            for a, d in collect(p, "04_Win_UOS_iOS壳/公共构建脚本/" + nm,
                                skip_dirs_abs=[os.path.join(p, "exe_new"), os.path.join(p, "msi_new")]):
                files.append((a, d))
        else:
            files.append((p, "04_Win_UOS_iOS壳/公共构建脚本/" + nm))

    # 05 需求设计文档
    add("docs_shuili_v3", "05_需求设计文档/shuili_v3")
    add("docs_gujian",    "05_需求设计文档/gujian")
    add("docs_perc",      "05_需求设计文档/perc")

    # 06 记忆与经验
    add(".workbuddy/memory", "06_记忆与经验/memory")
    admin_mem = "C:/Users/admin/.workbuddy/MEMORY.md"
    if os.path.exists(admin_mem):
        files.append((admin_mem, "06_记忆与经验/跨项目记忆_admin.md"))

    # 07 构建工具链与开发知识（便于回溯 / 复现构建）
    SKILL_ROOT = "C:/Users/admin/.workbuddy/skills"
    for sk in ["shuili-four-platform-release", "shuili-version-bump", "shuili-yitu-app",
               "uos-deb-build-verify", "win-webview-map-app", "android-webview-apk",
               "tianditu-engineering-map", "ovital-kmz-to-tianditu", "webview-app-packager"]:
        sp = os.path.join(SKILL_ROOT, sk)
        if os.path.isdir(sp):
            # 排除含真实密钥的 demo 构建产物（如 ovital/assets 含天地图 token）
            for a, d in collect(sp, "07_构建工具链与开发知识/构建技能/" + sk,
                               skip_dirs_abs=[os.path.join(sp, "assets")]):
                files.append((a, d))

    # 07.1 构建环境说明
    env_doc = os.path.join(ROOT, "_handover_docs", "07_构建环境说明.md")
    if os.path.exists(env_doc):
        files.append((env_doc, "07_构建工具链与开发知识/00_构建环境说明.md"))

    # 07.2 一键出包与版本脚本
    one_click = ["release_v331.sh", "build_four_ends.sh", "build_release_pass.sh", "build_v374.sh",
                 "verify_and_fix_v324.sh", "分析对比同步脚本.sh", "分析对比同步脚本_part2.sh",
                 "bump_version.py", "bump_version_v148_perc.py", "bump_version_v331.py",
                 "bump_version_v332.py", "bump_version_v334.py", "bump_version_v335.py",
                 "bump_version_v336.py", "bump_version_v341.py", "bump_version_v342.py",
                 "bump_version_v343.py", "bump_version_v344.py", "bump_version_v345.py",
                 "bump_version_v346.py", "bump_version_v348.py", "bump_version_v349.py",
                 "bump_version_v350.py", "bump_version_v355_pub.py", "bump_version_v356_int.py",
                 "bump_version_v358_int.py", "bump_version_v364_int.py", "bump_version_v370_int.py",
                 "bump_version_v372_int.py", "bump_version_v374_int.py", "bump_version_v376_int.py",
                 "_gen_bump349.py", "_apply_fixes_v347.py", "_handover_build.py"]
    for f in one_click:
        add_tool(os.path.join(ROOT, f), "07_构建工具链与开发知识/一键出包与版本脚本/" + f)

    # 07.3 核验与门禁脚本
    verify_scripts = ["verify_rebuilt_data.py", "verify_pkgs_smartquery.py", "verify_pub_key_leak.py",
                      "verify_v349_packages.py", "verify_pass.py", "fix_data_comma.py",
                      "patch_smart_further_query.py", "patch_gujian_v32.py", "patch_fav_longpress.py"]
    for f in verify_scripts:
        add_tool(os.path.join(ROOT, f), "07_构建工具链与开发知识/核验与门禁脚本/" + f)

    # 07.4 同步与发布脚本
    sync_scripts = ["sync_all_mirrors.py", "sync_shuili_mirror.py", "sync_weapp_version.py",
                    "propagate_ai_seed.py", "deploy_pub_pages.py", "deploy_pub_pages_api.py",
                    "gujian_api_push.py", "derive_public_v377.py", "strip_internal.py",
                    "set_build_versions.py", "set_build_versions2.py", "gen_covers_pil.py",
                    "gen_gujian_covers.py", "gen_v345_cover.py", "audit_menu_handlers.py",
                    "backup_claw.py"]
    for f in sync_scripts:
        add_tool(os.path.join(ROOT, f), "07_构建工具链与开发知识/同步与发布脚本/" + f)

    # 08 其他项目资料（IP / 备忘）
    add_tool(os.path.join(ROOT, "APP专利_技术要点备忘.md"), "08_其他项目资料/APP专利_技术要点备忘.md")

    # 00/01 顶层交接文档
    for f in ["00_项目交接文档.md", "01_本次改动记录_v3.77.md"]:
        p = os.path.join(ROOT, "_handover_docs", f)
        if os.path.exists(p):
            files.append((p, f))

    # 去重 + 排序
    seen = {}
    for a, d in files:
        seen[d] = a
    items = sorted(seen.items())

    total = 0
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for d, a in items:
            z.write(a, TOP + "/" + d)
            total += os.path.getsize(a)
    print("ZIP:", ZIP)
    print("entries:", len(items))
    print("uncompressed bytes:", total, "(%.1f MB)" % (total/1024/1024))

if __name__ == "__main__":
    main()
