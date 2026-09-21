#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
strip_internal.py —— 双通道发版构建辅助（防泄密）。

奇数版(公开/测试)不得含单位内部数据：构建前用演示种子覆盖真实骨干知识库，
并剥离 AI 私有密钥；构建后 --restore 还原，供偶数版(内部)使用。

【关键】真实文件备份到 assets 目录【之外】的 D:/Users/Claw/.strip_backup/<product>/，
避免被 sync_all_mirrors 复制进 webroot、再被打进 deb/msi/exe/ios 包造成泄密。

用法：
  python3 strip_internal.py <assets_dir> --public     # 真实 -> 演示（先自动备份到外部）
  python3 strip_internal.py <assets_dir> --restore     # 演示 -> 真实（从外部备份还原）
"""
import os
import sys
import shutil

ROOT = "D:/Users/Claw"
TARGETS = [
    ("data.js", "data.demo.js"),
    ("kb_building_seed.js", "kb_building_seed.demo.js"),
    ("ai_seed.js", "ai_seed.demo.js"),
]


def product_of(assets_dir):
    d = assets_dir.replace("\\", "/").lower()
    if "perc" in d:
        return "perc"
    if "shuili" in d:
        return "shuili"
    # 兜底：用 assets 父目录名
    return os.path.basename(os.path.dirname(assets_dir.rstrip("/")))


def backup_dir(assets_dir):
    return os.path.join(ROOT, ".strip_backup", product_of(assets_dir))


def do_public(assets_dir):
    bd = backup_dir(assets_dir)
    for real, demo in TARGETS:
        rp = os.path.join(assets_dir, real)
        dp = os.path.join(assets_dir, demo)
        if not os.path.isfile(dp):
            print(f"[skip] 缺演示文件 {demo}，跳过 {real}")
            continue
        if not os.path.isfile(rp):
            print(f"[skip] 缺真实文件 {real}，跳过")
            continue
        os.makedirs(bd, exist_ok=True)
        bak = os.path.join(bd, real + ".real.bak")
        if not os.path.isfile(bak):
            shutil.copy2(rp, bak)
            print(f"[backup] {real} -> .strip_backup/{product_of(assets_dir)}/{os.path.basename(bak)}")
        shutil.copy2(dp, rp)
        print(f"[public] 已用演示覆盖 {real}")


def do_restore(assets_dir):
    bd = backup_dir(assets_dir)
    for real, demo in TARGETS:
        rp = os.path.join(assets_dir, real)
        bak = os.path.join(bd, real + ".real.bak")
        if not os.path.isfile(bak):
            print(f"[skip] 无备份 {os.path.relpath(bak, ROOT)}，跳过 {real}")
            continue
        shutil.copy2(bak, rp)
        print(f"[restore] 已还原 {real}")


def main():
    if len(sys.argv) < 3:
        print("用法: strip_internal.py <assets_dir> --public|--restore")
        sys.exit(2)
    assets_dir = sys.argv[1]
    mode = sys.argv[2]
    if not os.path.isdir(assets_dir):
        print(f"[FATAL] 目录不存在: {assets_dir}")
        sys.exit(1)
    if mode == "--public":
        do_public(assets_dir)
    elif mode == "--restore":
        do_restore(assets_dir)
    else:
        print(f"[FATAL] 未知模式: {mode}")
        sys.exit(2)
    print("[done]")


if __name__ == "__main__":
    main()
