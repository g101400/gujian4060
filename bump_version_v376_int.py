#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bump_version_v376_int.py — 三端同批（内部）提升：
    shuili 3.74 -> 3.76   (code 74 -> 76)
    perc   1.50 -> 1.52   (code 50 -> 52)
    gujian 3.7.12 -> 3.7.13 (code 40 -> 41)
构建日期 2026-09-16。

本轮特性（源码已落 trunk，仅提版出包）：
  · AI·知识库能力增强（D-1~D-6）：智能推荐复用 kbHybridSearch/KBRag 混合检索、
    属性结构化索引、RAG 引用溯源+可学习权重、向量索引增量构建、多源冲突裁决、
    query→推荐→报告→KB 闭环。
  · 统信运行慢优化（C-1）：首屏优先渲染 + 启动耗时 profiling + 延迟非关键初始化。

流程：
  ① bump canonical app.js(APP_VERSION/APP_BUILD_DATE) + version.json
  ② bump make_deb.py / gen_win_msi_wix7.py / build_win_exe_nsis.py / make_secure_internal_pwa.py 版本串
  ③ sync_all_mirrors.py + --check（镜像一致性 + 跨产品公共模块门禁）
  ④ propagate_ai_seed.py（ai_seed 被 sync 排除，手动传播真实密钥）
"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = "D:/Users/Claw"
NEW_BUILD_DATE = "2026-09-16"
ARCHIVE_OLD = "测试包_20260913_v10_int"
ARCHIVE_NEW = "四端安装包_20260916_v376_int"
BACKUP_DIR = os.path.join(ROOT, "backup_2026-09-16_before_v376")

SHUILI_DESC = ("v3.76 内部版（与感知 v1.52 / 古建 v3.7.13 同批）：AI·知识库能力增强 + 统信运行慢优化——"
               "①智能推荐复用 kbHybridSearch/KBRag 混合检索（向量0.45+BM250.35+模糊0.20，权重可学习），"
               "替代孤立文本匹配并修复晚3复制条件 bug；②KB 属性结构化索引（kb_vector.js 数值等值/范围查询融合向量召回）；"
               "③RAG 引用溯源（chunk 原文高亮 + 置信度 + 混合权重可学习）；④向量索引增量构建（切片签名缓存 + ts diff，提速启动）；"
               "⑤KB 多源冲突裁决（OCR/网页/Hermes 来源置信度 + 人工修订优先 + 冲突提示）；"
               "⑥query→推荐→报告→KB 闭环（报告导出 + 写回知识库）；⑦统信运行慢优化（首屏优先渲染 + 启动耗时 profiling + "
               "延迟非关键初始化 AI 菜单/CtxMenu/cleanInbox）。")

PERC_DESC = ("v1.52 内部版（与水利 v3.76 / 古建 v3.7.13 同批）：AI·知识库能力增强（同水利 ①~⑥）+ 统信运行慢优化（⑦）；"
             "水工建筑物底图种子 water_data.js(557 条) 沿用 v1.52。")

GUJIAN_DESC = ("v3.7.13（与水利 v3.76 / 感知 v1.52 同批）：AI·知识库能力增强（同水利 ①~⑥）+ 统信运行慢优化（⑦）；古建单通道。")

PRODUCTS = {
    "shuili": dict(
        old_ver="3.74", new_ver="3.76", old_code=74, new_code=76,
        canonical_assets=os.path.join(ROOT, "android-build/shuili-v329/assets"),
        deb_old="3.74.20260913", deb_new="3.76.20260916",
        msi_old="3.74.0", msi_new="3.76.0", msi_app_old="3.74", msi_app_new="3.76",
        nsis_old="3.74.0", nsis_new="3.76.0", nsis4_old="3.74.0.0", nsis4_new="3.76.0.0",
        ios_old="3.74_20260913", ios_new="3.76_20260916",
        desc=SHUILI_DESC, bump_ver=True,
    ),
    "perc": dict(
        old_ver="1.50", new_ver="1.52", old_code=50, new_code=52,
        canonical_assets=os.path.join(ROOT, "android-build/perc-v13/assets"),
        deb_old="1.50.20260913", deb_new="1.52.20260916",
        msi_old="1.50.0", msi_new="1.52.0", msi_app_old="1.50", msi_app_new="1.52",
        nsis_old="1.50.0", nsis_new="1.52.0", nsis4_old="1.50.0.0", nsis4_new="1.52.0.0",
        ios_old="1.50_20260913", ios_new="1.52_20260916",
        desc=PERC_DESC, bump_ver=True,
    ),
    "gujian": dict(
        old_ver="3.7.12", new_ver="3.7.13", old_code=40, new_code=41,
        canonical_assets=os.path.join(ROOT, "android-build/gujian-v31/assets"),
        deb_old="3.7.12.20260913", deb_new="3.7.13.20260916",
        msi_old="3.7.12.0", msi_new="3.7.13.0", msi_app_old="3.7.12", msi_app_new="3.7.13",
        nsis_old="3.7.12.0", nsis_new="3.7.13.0", nsis4_old="3.7.12.0.0", nsis4_new="3.7.13.0.0",
        ios_old="3.7.12_20260913", ios_new="3.7.13_20260916",
        desc=GUJIAN_DESC, bump_ver=True,
    ),
}


def backup(path):
    if not os.path.exists(path):
        return
    dst = os.path.join(BACKUP_DIR, os.path.relpath(path, ROOT))
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(path, dst)


def patch_appjs(path, p):
    backup(path)
    t = pathlib.Path(path).read_text(encoding="utf-8")
    t2, n = re.subn(r'(var APP_VERSION = ")[^"]*(";)', r'\g<1>%s\g<2>' % p["new_ver"], t, count=1)
    assert n == 1, "%s: APP_VERSION 未命中" % path
    t2, n2 = re.subn(r'(var APP_BUILD_DATE = ")[^"]*(")', r'\g<1>%s\g<2>' % NEW_BUILD_DATE, t2, count=1)
    if n2 == 0:
        print("⚠️ %s: APP_BUILD_DATE 未命中，保留原值" % path)
    pathlib.Path(path).write_text(t2, encoding="utf-8")


def patch_versionjson(path, p):
    backup(path)
    d = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    cur = str(d["version"]).lstrip("v")
    if cur != p["old_ver"] and cur != p["new_ver"]:
        print("❌ %s: version=%s 期望 %s，阻断" % (path, d["version"], p["old_ver"]))
        sys.exit(1)
    if p["bump_ver"]:
        d["version"] = p["new_ver"]
        d["versionCode"] = p["new_code"]
    d["buildDate"] = NEW_BUILD_DATE
    desc = d.get("desc", "")
    d["desc"] = desc.rstrip() + "\n\n" + ("v%s：%s" % (p["new_ver"], p["desc"]))
    pathlib.Path(path).write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_build_script(path, repls):
    if not os.path.exists(path):
        print("⚠️ %s 不存在，跳过" % path)
        return
    backup(path)
    t = pathlib.Path(path).read_text(encoding="utf-8")
    applied = 0
    for a, b in repls:
        if a in t:
            t = t.replace(a, b)
            applied += 1
        else:
            print("   ⚠️ 跳过：%s 中无 %r" % (os.path.basename(path), a))
    pathlib.Path(path).write_text(t, encoding="utf-8")
    print("   %s: %d/%d 处已更新" % (os.path.basename(path), applied, len(repls)))


def main():
    print("🔧 bump_version_v376_int — 三端同批（内部），构建日期 %s" % NEW_BUILD_DATE)
    os.makedirs(BACKUP_DIR, exist_ok=True)

    for key, p in PRODUCTS.items():
        patch_versionjson(os.path.join(p["canonical_assets"], "version.json"), p)
        patch_appjs(os.path.join(p["canonical_assets"], "app.js"), p)
        print("✅ %-7s canonical -> v%s (code %d)" % (key, p["new_ver"], p["new_code"]))

    vals = [PRODUCTS[k] for k in ("shuili", "perc", "gujian")]

    deb_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    deb_repls += [('"ver": "%s"' % p["deb_old"], '"ver": "%s"' % p["deb_new"]) for p in vals if p["deb_old"]]
    patch_build_script(os.path.join(ROOT, "native-shell/make_deb.py"), deb_repls)

    msi_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    msi_repls += [('"ver":"%s"' % p["msi_old"], '"ver":"%s"' % p["msi_new"]) for p in vals if p["msi_old"]]
    msi_repls += [('"appver":"%s"' % p["msi_app_old"], '"appver":"%s"' % p["msi_app_new"]) for p in vals if p["msi_app_old"]]
    patch_build_script(os.path.join(ROOT, "native-shell/gen_win_msi_wix7.py"), msi_repls)

    nsis_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    nsis_repls += [('"ver": "%s"' % p["nsis_old"], '"ver": "%s"' % p["nsis_new"]) for p in vals if p["nsis_old"]]
    nsis_repls += [('"ver4": "%s"' % p["nsis4_old"], '"ver4": "%s"' % p["nsis4_new"]) for p in vals if p["nsis4_old"]]
    patch_build_script(os.path.join(ROOT, "native-shell/build_win_exe_nsis.py"), nsis_repls)

    ios_repls = [(p["ios_old"], p["ios_new"]) for p in vals if p["ios_old"]]
    patch_build_script(os.path.join(ROOT, "native-shell/water-ios/make_secure_internal_pwa.py"), ios_repls)

    print("🔒 卡口：sync_all_mirrors.py ...")
    subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py")])
    if subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py"), "--check"]).returncode != 0:
        print("❌ 镜像一致性门禁未通过，阻断出包")
        sys.exit(1)

    print("🔒 真实 ai_seed 手动传播（shuili/perc）...")
    for prod in ("shuili", "perc"):
        if subprocess.run([sys.executable, os.path.join(ROOT, "propagate_ai_seed.py"), prod]).returncode != 0:
            print("❌ propagate_ai_seed %s 失败，阻断出包" % prod)
            sys.exit(1)

    print("📦 回退备份目录: %s" % BACKUP_DIR)
    print("✅ bump_version_v376_int 完成。下一步：四端出包（内部版 3.76/1.52/3.7.13）。")


if __name__ == "__main__":
    main()
