#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
古建景点打卡 · iOS 可托管 PWA ZIP 生成器
--------------------------------------------------
把仓库「Web 源码 (assets/)」+「PWA 壳 (本目录 pwa-shell/)」打包成可托管到 HTTPS 的离线 PWA。

PWA 壳来源：本目录 pwa-shell/（manifest.webmanifest / sw.js / icons/ / DEPLOY_README.txt），
已从古建 iOS 基线包抽取并改为古建品牌，随仓库版本管理，无需外部基线 zip。

用法：
  python3 native-shell/gujian-ios/build_ios_zip.py
产物：
  native-shell/gujian-ios/apple-package/古建景点打卡_iOS_<ver>_可托管.zip
"""
import os, re, json, zipfile, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))          # 仓库根（android-build/gujian-v31）
WEBROOT = os.path.join(ROOT, "assets")                 # 古建 Web 源码（四端同源）
PWA_SHELL = os.path.join(HERE, "pwa-shell")            # 古建 PWA 壳
APPLE_DIR = os.path.join(HERE, "apple-package")
NAME = "古建景点打卡"

# 版本：动态读取 assets/version.json
try:
    with open(os.path.join(WEBROOT, "version.json"), encoding="utf-8") as f:
        VER = json.load(f).get("version", "0")
except Exception:
    VER = "0"

# webroot 中只打包「网页本体」，排除 Windows 启动器/说明
EXCLUDE_NAMES = {"launch.bat", "http_server.ps1", "安装说明.txt", "ai_seed.js"}

def stage_pwa_shell(stage):
    print("[pwa] 复制 PWA 壳 ->", stage)
    if os.path.isdir(stage):
        shutil.rmtree(stage)
    shutil.copytree(PWA_SHELL, stage)

def sync_webroot(stage):
    print("[web] 同步 assets 网页资源 ->", stage)
    for name in os.listdir(WEBROOT):
        if name in EXCLUDE_NAMES:
            continue
        s = os.path.join(WEBROOT, name)
        d = os.path.join(stage, name)
        if os.path.isdir(s):
            if os.path.isdir(d):
                shutil.rmtree(d)
            shutil.copytree(s, d)
        else:
            shutil.copyfile(s, d)

def bump_meta(stage):
    mp = os.path.join(stage, "manifest.webmanifest")
    if os.path.exists(mp):
        data = json.load(open(mp, encoding="utf-8"))
        data["version"] = VER
        json.dump(data, open(mp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("[meta] manifest.webmanifest version ->", VER)
    rp = os.path.join(stage, "DEPLOY_README.txt")
    if os.path.exists(rp):
        t = open(rp, encoding="utf-8").read()
        t = re.sub(r"版本：.*", "版本：" + VER, t)
        open(rp, "w", encoding="utf-8").write(t)
        print("[meta] DEPLOY_README.txt 版本已更新")

def build_zip(stage, out_zip):
    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for base, _, files in os.walk(stage):
            for fn in files:
                full = os.path.join(base, fn)
                arc = os.path.relpath(full, stage).replace(os.sep, "/")
                zf.write(full, arc)
    print("[zip] ->", os.path.relpath(out_zip, ROOT), os.path.getsize(out_zip), "bytes")

if __name__ == "__main__":
    import tempfile
    os.makedirs(APPLE_DIR, exist_ok=True)
    stage = tempfile.mkdtemp(prefix="ios_stage_")
    out_zip = os.path.join(APPLE_DIR, "%s_iOS_%s_可托管_new4060.zip" % (NAME, VER))
    stage_pwa_shell(stage)
    sync_webroot(stage)
    bump_meta(stage)
    build_zip(stage, out_zip)
    shutil.rmtree(stage, ignore_errors=True)
    print("完成：iOS PWA 可托管包 %s (版本 %s)" % (NAME, VER))
