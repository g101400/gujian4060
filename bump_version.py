#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bump_version.py — 三产品版本八处同步（水利工程一张图 / 水利感知 / 古建打卡）
水利一张图 v3.38 -> v3.40 | 水利感知 v1.14 -> v1.16 | 古建打卡 v2.6 -> v2.8

改 version.json(真相源) + app.js(APP_VERSION/APP_BUILD_DATE)
  -> copy2 到 6 个 win/uos webroot + water staging 镜像
  -> 改 make_deb.py / gen_win_msi_wix7.py / build_ios_zip.py 内的硬编码版本串。

改动前自动备份到 backup_<date>_before_v340/ 以支持回退（铁律#9）。
用法：python3 bump_version.py
"""
import json, re, shutil, os, pathlib, sys, subprocess

ROOT = "D:/Users/Claw"
NEW_BUILD_DATE = "2026-08-29"
BACKUP_DIR = os.path.join(ROOT, "backup_2026-08-29_before_v340")

PRODUCTS = {
    "shuili": dict(
        old_ver="3.38", new_ver="3.40", old_code=40, new_code=41,
        canonical_assets=os.path.join(ROOT, "android-build/shuili-v329/assets"),
        mirror_assets=[os.path.join(ROOT, "android-build/water-v329/assets"),
                       "D:/Users/aowwei_app/webroot_shuili"],
        webroots=[os.path.join(ROOT, "native-shell/win-water-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/uos-water-pyqt6/webroot")],
        deb_ver="3.38.20260829", deb_ver_new="3.40.20260829",
        msi_ver="3.38.0", msi_ver_new="3.40.0",
        ios_ver="3.38_20260829", ios_ver_new="3.40_20260829",
        desc="v3.40：智能AI能力增强——①水利/感知新增联网在线查询选项(默认仅本地辅助，可逐次开启联网；古建默认联网)；②查询历史按时间保存(关键词/模式/时间)，可点击复用或强制重查，避免二次消耗词元；③查询结果美观排版(标题/列表/重点加粗)＋保存知识库提供「精简/不保存」选项；④建筑骨干自动播种(557条，含参数/照片/坐标，知识库一键重新播种)；四平台同步＋UOS deb ar头铁律回归保持。",
    ),
    "perc": dict(
        old_ver="1.14", new_ver="1.16", old_code=20, new_code=21,
        canonical_assets=os.path.join(ROOT, "android-build/perc-v13/assets"),
        mirror_assets=[],
        webroots=[os.path.join(ROOT, "native-shell/win-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/uos-pyqt6/webroot")],
        deb_ver="1.14.20260829", deb_ver_new="1.16.20260829",
        msi_ver="1.14.0", msi_ver_new="1.16.0",
        ios_ver="1.14_20260829", ios_ver_new="1.16_20260829",
        desc="v1.16：与水利 v3.40 同源智能AI增强——①新增联网在线查询选项(默认本地辅助，可逐次开启)；②查询历史按时间保存可复用/强制重查；③查询结果美观排版＋保存知识库精简/不保存选项；④建筑骨干自动播种(1125条)＋重新播种；四平台同步保持。",
    ),
    "gujian": dict(
        old_ver="2.6", new_ver="2.8", old_code=20, new_code=21,
        canonical_assets=os.path.join(ROOT, "travel/android/assets"),
        mirror_assets=[],
        webroots=[os.path.join(ROOT, "native-shell/win-gujian-webview2/webroot"),
                  os.path.join(ROOT, "native-shell/uos-gujian-pyqt6/webroot")],
        deb_ver="2.6.20260829", deb_ver_new="2.8.20260829",
        msi_ver="2.6.0", msi_ver_new="2.8.0",
        ios_ver="2.6_20260829", ios_ver_new="2.8_20260829",
        desc="v2.8：与水利 v3.40 同源智能AI增强——①智能AI联网查询保持(默认联网)；②查询历史按时间保存可复用/强制重查；③查询结果美观排版＋保存知识库精简/不保存选项；④建筑骨干自动播种(1032条)＋重新播种；四平台同步保持。",
    ),
}


def backup(path):
    rel = os.path.relpath(path, ROOT)
    dst = os.path.join(BACKUP_DIR, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst):
        shutil.copy2(path, dst)


def patch_appjs(path, old_ver, new_ver):
    backup(path)
    t = pathlib.Path(path).read_text(encoding="utf-8")
    t2 = t.replace('var APP_VERSION = "v%s";' % old_ver,
                   'var APP_VERSION = "v%s";' % new_ver)
    t2 = t2.replace('var APP_BUILD_DATE = "2026-08-28";',
                    'var APP_BUILD_DATE = "%s";' % NEW_BUILD_DATE)
    assert t2 != t, "%s: APP_VERSION/APP_BUILD_DATE 未命中，请检查" % path
    pathlib.Path(path).write_text(t2, encoding="utf-8")


def patch_versionjson(path, p):
    backup(path)
    d = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    assert d["version"] == p["old_ver"], \
        "%s: version=%s 期望 %s（可能已 bump）" % (path, d["version"], p["old_ver"])
    d["version"] = p["new_ver"]
    d["versionCode"] = p["new_code"]
    d["buildDate"] = NEW_BUILD_DATE
    desc = d.get("desc", "")
    new_section = "v%s：" % p["new_ver"] + p["desc"]
    new_desc, n = re.subn(r'(。)(v' + re.escape(p["old_ver"]) + r'：)',
                          lambda m: "。%s。%s" % (new_section, m.group(2)), desc, count=1)
    assert n == 1, "%s: desc 中未找到 v%s：插入点" % (path, p["old_ver"])
    d["desc"] = new_desc
    pathlib.Path(path).write_text(
        json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_build_script(path, repls):
    backup(path)
    t = pathlib.Path(path).read_text(encoding="utf-8")
    for a, b in repls:
        assert a in t, "%s: 未找到待替换串 %r" % (path, a)
        t = t.replace(a, b)
    pathlib.Path(path).write_text(t, encoding="utf-8")


def main():
    for key, p in PRODUCTS.items():
        ca = p["canonical_assets"]
        patch_versionjson(os.path.join(ca, "version.json"), p)
        patch_appjs(os.path.join(ca, "app.js"), p["old_ver"], p["new_ver"])
        for ma in p["mirror_assets"]:
            backup(os.path.join(ma, "version.json")); backup(os.path.join(ma, "app.js"))
            shutil.copy2(os.path.join(ca, "version.json"), os.path.join(ma, "version.json"))
            shutil.copy2(os.path.join(ca, "app.js"), os.path.join(ma, "app.js"))
        for wr in p["webroots"]:
            backup(os.path.join(wr, "version.json")); backup(os.path.join(wr, "app.js"))
            shutil.copy2(os.path.join(ca, "version.json"), os.path.join(wr, "version.json"))
            shutil.copy2(os.path.join(ca, "app.js"), os.path.join(wr, "app.js"))
        print("✅ %-7s canonical+mirrors+%d webroots 同步 v%s (code %d)"
              % (key, len(p["webroots"]), p["new_ver"], p["new_code"]))

    # make_deb.py
    mdeb = os.path.join(ROOT, "native-shell/make_deb.py")
    patch_build_script(mdeb, [('"ver": "%s"' % p["deb_ver"], '"ver": "%s"' % p["deb_ver_new"])
                              for p in PRODUCTS.values()])
    # gen_win_msi_wix7.py
    mmsi = os.path.join(ROOT, "native-shell/gen_win_msi_wix7.py")
    patch_build_script(mmsi, [('"ver":"%s"' % p["msi_ver"], '"ver":"%s"' % p["msi_ver_new"])
                              for p in PRODUCTS.values()])
    # build_ios_zip.py
    mios = os.path.join(ROOT, "native-shell/water-ios/build_ios_zip.py")
    ios_repls = []
    for p in PRODUCTS.values():
        ios_repls.append(('"%s"' % p["ios_ver"], '"%s"' % p["ios_ver_new"]))
        ios_repls.append(('"V%s"' % p["ios_ver"], '"V%s"' % p["ios_ver_new"]))
    patch_build_script(mios, ios_repls)
    print("✅ make_deb.py / gen_win_msi_wix7.py / build_ios_zip.py 版本串已更新")
    # 全量对齐镜像副本（含 webroot_shuili / water-v329/assets）——根治多副本分叉（已第5次复发）
    print("🔄 自动全量对齐镜像副本（sync_shuili_mirror.py）...")
    _r = subprocess.run([sys.executable, os.path.join(ROOT, "sync_shuili_mirror.py")])
    if _r.returncode != 0:
        print("⚠️ sync_shuili_mirror.py 返回非零，请手动核查镜像一致性")
    print("📦 回退备份目录:", BACKUP_DIR)


if __name__ == "__main__":
    main()
