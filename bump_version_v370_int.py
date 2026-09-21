#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bump_version_v370_int.py — 内部(偶数)版提升：shuili 3.68->3.70, perc 1.44->1.46, 古建 3.7.9->3.7.10
构建日期 2026-09-11。

本轮改动（三应用同源）：
  ① 口令门提示去除「3305」残留：secure_boot.js 提示行去掉 DEV_EXT 变量拼接（只留「开发者分机号」）。
  ② 本地导入/导出弹窗智能化：新增 confirmLocal()，本地操作不再误报「非 WiFi 网络」；
     <100MB 静默执行，≥100MB 改弹「操作提示 / 文件大小…耗时较长，是否继续？」。
  ③ 「管理处」组织一致性：orgStore() 首启补齐 5 个处；筛选栏「管理处」与「组织与类型管理」同源；
     筛选栏新增「＋添加 / ✎改名」；FIELD_ALIAS 修正（管理处独立别名，不再混入 office）。
  ④ 菜单重构（不删任何功能）：新增「导入与导出」「数据维护」「备忘录」三组；
     「知识库管理」从设置移出并入「知识库与智能」；PDF 转 Word 归入「导入与导出」。
  ⑤ 公共模块回灌：kb_rag.js / ai_module.js / ovobj_bridge.js 从水利回灌感知+古建
     （根治「知识库整句切片」「导出 ovobj 文件名可编辑」在感知/古建实际未落地）。
  ⑥ sync_all_mirrors.py 新增「跨产品公共模块 md5 门禁」。

流程：
  ① bump canonical app.js(APP_VERSION/APP_BUILD_DATE) + version.json
  ② bump make_deb.py / gen_win_msi_wix7.py / build_win_exe_nsis.py / make_secure_internal_pwa.py 版本串
  ③ sync_all_mirrors.py          （canonical -> 所有 mirror/webroot）
  ④ sync_all_mirrors.py --check  （镜像一致性门禁，含跨产品公共模块门禁）
  ⑤ propagate_ai_seed.py         （ai_seed 被 sync 排除，手动传播真实密钥）
"""
import json, re, shutil, os, pathlib, sys, subprocess

ROOT = "D:/Users/Claw"
NEW_BUILD_DATE = "2026-09-11"
ARCHIVE_OLD = "测试包_20260910_v6_int"
ARCHIVE_NEW = "测试包_20260911_v7_int"
BACKUP_DIR = os.path.join(ROOT, "backup_2026-09-11_before_v370")

FIX_NOTE = ("口令门提示去除具体口令残留（只留「开发者分机号」）；本地导入/导出不再误报「非WiFi网络」，"
            "改为按文件大小智能提示（<100MB 静默、≥100MB 弹「操作提示」）；管理处组织一致性修复"
            "（筛选栏与组织管理同源、可添加/改名、导入别名不再串到管理所）；菜单重构（新增导入与导出/"
            "数据维护/备忘录三组，知识库管理移出设置）；感知/古建回灌 kb_rag·ai_module·ovobj_bridge 公共模块")

SHUILI_DESC = ("v3.70 内部版（与感知 v1.46 / 古建 v3.7.10 同步）：" + FIX_NOTE +
               "；水利不动其余功能，回归保持。")
PERC_DESC = ("v1.46 内部版（与水利 v3.70 / 古建 v3.7.10 同步）：" + FIX_NOTE +
             "；并回灌水利公共模块（整句切片/导出文件名可编辑真正落地）。")
GUJIAN_DESC = ("v3.7.10（与水利 v3.70 / 感知 v1.46 同步）：" + FIX_NOTE +
               "；古建口令保护不启用，收藏键与「快捷常用」共用一份数据。")

PRODUCTS = {
    "shuili": dict(
        old_ver="3.68", new_ver="3.70", old_code=68, new_code=70,
        app_ver_has_v=False,
        canonical_assets=os.path.join(ROOT, "android-build/shuili-v329/assets"),
        deb_old="3.68.20260910", deb_new="3.70.20260911",
        msi_old="3.68.0", msi_new="3.70.0", msi_app_old="3.64", msi_app_new="3.70",
        nsis_old="3.68.0", nsis_new="3.70.0", nsis4_old="3.68.0.0", nsis4_new="3.70.0.0",
        ios_old="3.68_20260910", ios_new="3.70_20260911",
        desc=SHUILI_DESC,
    ),
    "perc": dict(
        old_ver="1.44", new_ver="1.46", old_code=44, new_code=46,
        app_ver_has_v=False,
        canonical_assets=os.path.join(ROOT, "android-build/perc-v13/assets"),
        deb_old="1.44.20260910", deb_new="1.46.20260911",
        msi_old="1.44.0", msi_new="1.46.0", msi_app_old="1.40", msi_app_new="1.46",
        nsis_old="1.44.0", nsis_new="1.46.0", nsis4_old="1.44.0.0", nsis4_new="1.46.0.0",
        ios_old="1.44_20260910", ios_new="1.46_20260911",
        desc=PERC_DESC,
    ),
    "gujian": dict(
        old_ver="3.7.9", new_ver="3.7.10", old_code=37, new_code=38,
        app_ver_has_v=False,
        canonical_assets=os.path.join(ROOT, "android-build/gujian-v31/assets"),
        deb_old="3.7.9.20260910", deb_new="3.7.10.20260911",
        msi_old="3.7.9.0", msi_new="3.7.10.0", msi_app_old="3.7.7", msi_app_new="3.7.10",
        nsis_old="3.7.9.0", nsis_new="3.7.10.0", nsis4_old="3.7.9.0.0", nsis4_new="3.7.10.0.0",
        ios_old="3.7.9_20260910", ios_new="3.7.10_20260911",
        desc=GUJIAN_DESC,
    ),
}


def backup(path):
    if not os.path.exists(path):
        return
    rel = os.path.relpath(path, ROOT)
    dst = os.path.join(BACKUP_DIR, rel)
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(path, dst)


def patch_appjs(path, p):
    backup(path)
    t = pathlib.Path(path).read_text(encoding="utf-8")
    new_lit = ("v" if p["app_ver_has_v"] else "") + p["new_ver"]
    pat = re.compile(r'(var APP_VERSION = ")[^"]*(";)')
    t2, n = pat.subn(lambda m: m.group(1) + new_lit + m.group(2), t, count=1)
    assert n == 1, "%s: APP_VERSION 未命中（期望 1 处，实际 %d）" % (path, n)
    t2, n2 = re.subn(r'(var APP_BUILD_DATE = ")[^"]*(")', r'\g<1>%s\g<2>' % NEW_BUILD_DATE, t2, count=1)
    if n2 == 0:
        print("⚠️ %s: APP_BUILD_DATE 未命中，保留原值" % path)
    pathlib.Path(path).write_text(t2, encoding="utf-8")


def patch_versionjson(path, p):
    backup(path)
    d = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    cur = str(d["version"]).lstrip("v")
    if cur == p["new_ver"]:
        print("⏭️ %s: 已是 v%s，跳过（幂等）" % (path, p["new_ver"]))
        return
    if cur != p["old_ver"]:
        print("⚠️ %s: version=%s 期望 %s，跳过 version 字段" % (path, d["version"], p["old_ver"]))
        return
    d["version"] = p["new_ver"]
    d["versionCode"] = p["new_code"]
    d["buildDate"] = NEW_BUILD_DATE
    desc = d.get("desc", "")
    d["desc"] = desc.rstrip() + "\n\n" + ("v%s：%s。" % (p["new_ver"], p["desc"].rstrip("。")))
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
            print("⚠️ 跳过：%s 中无 %r" % (os.path.basename(path), a))
    pathlib.Path(path).write_text(t, encoding="utf-8")
    print("   %s: %d/%d 处版本串已更新" % (os.path.basename(path), applied, len(repls)))


def main():
    print("🔧 bump_version_v370_int — 内部(偶数)版，构建日期 %s" % NEW_BUILD_DATE)
    os.makedirs(BACKUP_DIR, exist_ok=True)

    for key, p in PRODUCTS.items():
        patch_versionjson(os.path.join(p["canonical_assets"], "version.json"), p)
        patch_appjs(os.path.join(p["canonical_assets"], "app.js"), p)
        print("✅ %-7s canonical app.js/version.json -> v%s (code %d)" % (key, p["new_ver"], p["new_code"]))

    vals = list(PRODUCTS.values())
    deb_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    deb_repls += [('"ver": "%s"' % p["deb_old"], '"ver": "%s"' % p["deb_new"]) for p in vals]
    patch_build_script(os.path.join(ROOT, "native-shell/make_deb.py"), deb_repls)

    msi_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    msi_repls += [('"ver":"%s"' % p["msi_old"], '"ver":"%s"' % p["msi_new"]) for p in vals]
    msi_repls += [('"appver":"%s"' % p["msi_app_old"], '"appver":"%s"' % p["msi_app_new"]) for p in vals]
    patch_build_script(os.path.join(ROOT, "native-shell/gen_win_msi_wix7.py"), msi_repls)

    nsis_repls = [(ARCHIVE_OLD, ARCHIVE_NEW)]
    nsis_repls += [('"ver": "%s"' % p["nsis_old"], '"ver": "%s"' % p["nsis_new"]) for p in vals]
    nsis_repls += [('"ver4": "%s"' % p["nsis4_old"], '"ver4": "%s"' % p["nsis4_new"]) for p in vals]
    patch_build_script(os.path.join(ROOT, "native-shell/build_win_exe_nsis.py"), nsis_repls)

    # iOS 内部加密 PWA 的 JOBS 路径含版本串
    ios_repls = [(p["ios_old"], p["ios_new"]) for p in vals]
    patch_build_script(os.path.join(ROOT, "native-shell/water-ios/make_secure_internal_pwa.py"), ios_repls)

    print("🔒 卡口：sync_all_mirrors.py ...")
    r1 = subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py")])
    if r1.returncode != 0:
        print("⚠️ sync 返回非零（可能有镜像不存在），继续 check")
    r2 = subprocess.run([sys.executable, os.path.join(ROOT, "sync_all_mirrors.py"), "--check"])
    if r2.returncode != 0:
        print("❌ 镜像一致性门禁未通过，阻断出包")
        sys.exit(r2.returncode)

    print("🔒 真实 ai_seed 手动传播（shuili/perc）...")
    for prod in ("shuili", "perc"):
        r = subprocess.run([sys.executable, os.path.join(ROOT, "propagate_ai_seed.py"), prod])
        if r.returncode != 0:
            print("❌ propagate_ai_seed %s 失败，阻断出包" % prod)
            sys.exit(r.returncode)

    print("📦 回退备份目录: %s" % BACKUP_DIR)
    print("✅ bump_version_v370_int 完成。下一步：四端出包（内部版）。")


if __name__ == "__main__":
    main()
