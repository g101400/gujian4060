#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
strip_internal.py —— 双通道发版构建辅助（数据脱敏）。

【策略·2026-09-04 更新】
- 公开版(奇数) 与 内部版(偶数) 均保留 AI 密钥（window.AI_SEED），保证「装上即用」智能AI。
- 仅数据做脱敏：公开版用脱敏后的「像真的」演示种子（data.demo.js / kb_building_seed.demo.js）
  覆盖真实骨干知识库；内部版 --restore 还原真实数据。
- 注意：公开版数据虽用真实水利工程的「像真的」名称（都江堰/红旗渠…），但坐标/参数均为示例，
  非单位内部真实资料；内部版才含完整真实数据。

【关键】真实文件备份到 assets 目录【之外】的 D:/Users/Claw/.strip_backup/<product>/，
避免被 sync_all_mirrors 复制进 webroot、再被打进 deb/msi/exe/ios 包造成泄密。

用法：
  python3 strip_internal.py <assets_dir> --public     # 真实数据 -> 脱敏演示（先自动备份到外部）
  python3 strip_internal.py <assets_dir> --restore     # 脱敏演示 -> 真实（从外部备份还原）
"""
import os
import sys
import shutil

ROOT = "D:/Users/Claw"
# 2026-09-04：ai_seed.js 不再参与剥离（公开/内部均保留密钥，保证智能AI 装上即用）。
TARGETS = [
    ("data.js", "data.demo.js"),
    ("kb_building_seed.js", "kb_building_seed.demo.js"),
    # 2026-09-11：感知 App 内置「水工建筑物底图种子」也需脱敏（水利/古建无此文件，自动跳过）
    ("water_data.js", "water_data.demo.js"),
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
