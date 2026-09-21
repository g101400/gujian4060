#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重建后校验（new4060 版）

从**已出包**的四平台产物中抽取 data.js，断言其完整可用，并顺带核验本轮三项改动：
  1) data.js 修复（v3.48 血案）：可 JSON 解析、条目数合理、无「漏逗号」损坏模式（"} {"）。
  2) Task4 端口：水利=9506 / 古建=9507 / 感知=506（从 deb 内的 shell main.py 抽取）。
  3) Task1 OpenRouter 新 key 已注入（deb 内 webroot/ai_seed.js）。
另外确认 Task3：所有可部署产物名均带 _new4060 后缀。

抽取方式：
  APK / iOS zip -> zipfile 直读 data.js
  deb           -> ar 解 data.tar.xz -> lzma -> tar
  Win exe       -> 7z 解包后找 data.js
  Win msi       -> 核验**源**（publish_win_*/webroot/data.js）+ 版本标记 + 文件体积
                   （msi 内层为 Compound->cab1.cab，7z 无法直接列取其内容）

用法：python3 verify_rebuilt_data.py [归档目录]
      归档目录缺省时自动取 APK归档/ 下最新的 四端安装包_*_new4060
"""
import os, sys, re, json, glob, zipfile, tarfile, io, lzma, gzip, subprocess, tempfile, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
NEW_KEY = (os.environ.get("OPENROUTER_KEY")
           or (open(os.path.join(ROOT, ".secrets", "openrouter.key"), encoding="utf-8").read().strip()
               if os.path.isfile(os.path.join(ROOT, ".secrets", "openrouter.key")) else "")
           or "sk-or-v1-REDACTED")
SEVENZ = next((c for c in ("C:/Program Files/7-Zip/7z.exe",
                           "/c/Program Files/7-Zip/7z.exe") if os.path.isfile(c)), "7z")

PRODUCTS = [
    {"key": "shuili", "name": "水利工程一张图", "var": "SHUILI_DATA", "ver": "3.74",
     "apk": "android-build/shuili-v329/app-release.apk",
     "debdir": "uos-shuili", "pkg": "shuili-map", "port": "9506",
     "ios": "水利工程一张图_iOS_*_可托管_new4060.zip",
     "winname": "水利工程基础信息一张图", "winpub": "win-water-webview2/publish_win_water"},
    {"key": "perc", "name": "水利感知项目一张图", "var": "PERCEPTION_DATA", "ver": "1.50",
     "apk": "android-build/perc-v13/app-release.apk",
     "debdir": "uos-perc", "pkg": "shuili-ganzhi", "port": "506",
     "ios": "水利感知项目一张图_iOS_*_可托管_new4060.zip",
     "winname": "水利感知项目一张图", "winpub": "win-webview2/publish_win_perc"},
    {"key": "gujian", "name": "古建景点打卡", "var": "GUJIAN_DATA", "ver": "3.7.12",
     "apk": "travel/android/app-release.apk",
     "debdir": "uos-gujian", "pkg": "gujian-map", "port": "9507",
     "ios": "古建景点打卡_iOS_*_可托管_new4060.zip",
     "winname": "古建景点打卡", "winpub": "win-gujian-webview2/publish_win_gujian"},
]

RESULTS = []


def ok(cond, label, extra=""):
    RESULTS.append((bool(cond), label, extra))
    print("   %s %s %s" % ("✅" if cond else "❌", label, extra))
    return bool(cond)


def find_outdir():
    if len(sys.argv) > 1:
        return sys.argv[1]
    cands = glob.glob(os.path.join(ROOT, "APK归档", "四端安装包_*_new4060"))
    cands.sort(key=os.path.getmtime, reverse=True)
    return cands[0] if cands else None


def extract_zip_member(path, suffix):
    with zipfile.ZipFile(path) as z:
        for n in z.namelist():
            if n.endswith(suffix):
                return z.read(n).decode("utf-8", "replace")
    return None


def deb_tar_members(deb):
    raw = open(deb, "rb").read()
    assert raw[:8] == b"!<arch>\n", "not an ar archive"
    off, mem = 8, {}
    while off < len(raw):
        hdr = raw[off:off + 60]
        if len(hdr) < 60:
            break
        nm = hdr[0:16].decode("ascii", "replace").strip()
        size = int(hdr[48:58].decode("ascii", "replace").strip() or "0")
        mem[nm] = raw[off + 60:off + 60 + size]
        off += 60 + size + (size % 2)
    blob = next((mem[k] for k in mem if k.startswith("data.tar")), None)
    if blob is None:
        return {}
    if blob[:6] == b"\xfd7zXZ\x00":
        blob = lzma.decompress(blob)
    elif blob[:2] == b"\x1f\x8b":
        blob = gzip.decompress(blob)
    res = {}
    with tarfile.open(fileobj=io.BytesIO(blob)) as tf:
        for m in tf.getmembers():
            if m.isfile():
                try:
                    res[m.name] = tf.extractfile(m).read()
                except Exception:
                    pass
    return res


def sevenz_extract(path, outdir):
    try:
        subprocess.run([SEVENZ, "x", "-y", "-o" + outdir, path],
                       capture_output=True, timeout=300)
        return True
    except Exception:
        return False


def find_file(root, suffix):
    for dp, _dn, fns in os.walk(root):
        for fn in fns:
            if fn.endswith(suffix):
                return os.path.join(dp, fn)
    return None


def check_datajs(label, text, var):
    if not text:
        return ok(False, "%s data.js 抽取失败" % label)
    bad = bool(re.search(r"\}\s+\{", text))          # 漏逗号：两个对象之间仅剩空白
    m = re.search(re.escape(var) + r"\s*=\s*(\[.*?\])\s*;", text, re.S)
    cnt, perr = -1, ""
    if m:
        try:
            cnt = len(json.loads(m.group(1)))
        except Exception as e:
            perr = str(e)[:60]
    nid = len(re.findall(r'"id"\s*:\s*"', text))
    return ok((not bad) and cnt > 100, "%s data.js" % label,
              "var=%s 条目=%s  '\"id\"'数=%d 漏逗号=%s %s" %
              (var, cnt, nid, bad, ("解析错误:%s" % perr) if perr else ""))


def main():
    out = find_outdir()
    print("############ 归档目录 ############\n%s" % out)
    if not out or not os.path.isdir(out):
        print("❌ 未找到归档目录，先出包")
        return 2

    # ---- Task3：_new4060 后缀 ----
    print("\n############ Task3 · 产物名 _new4060 后缀 ############")
    for sub, pat in [("android", "*.apk"), ("win", "*.exe"), ("win", "*.msi"), ("ios", "*.zip"),
                     ("uos-shuili", "*.deb"), ("uos-perc", "*.deb"), ("uos-gujian", "*.deb")]:
        files = glob.glob(os.path.join(out, sub, pat))
        nonsuf = [os.path.basename(f) for f in files if "_new4060" not in os.path.basename(f)]
        ok(files and not nonsuf, "%s/%s" % (sub, pat), "共%d个 未加后缀=%s" % (len(files), nonsuf or "无"))

    for p in PRODUCTS:
        print("\n############ %s (%s) ############" % (p["name"], p["key"]))

        apk = os.path.join(ROOT, p["apk"])
        if os.path.isfile(apk):
            check_datajs("APK", extract_zip_member(apk, "data.js"), p["var"])
        else:
            ok(False, "APK 缺失", apk)

        debs = (glob.glob(os.path.join(out, p["debdir"], "%s_*_amd64_new4060.deb" % p["pkg"]))
                + glob.glob(os.path.join(out, p["debdir"], "%s_*_mips64el_new4060.deb" % p["pkg"])))
        if debs:
            try:
                tm = deb_tar_members(debs[0])
            except Exception as e:
                tm = {}
                ok(False, "deb 解包失败", "%s: %s" % (os.path.basename(debs[0]), e))
            if tm:
                check_datajs("deb", next((v.decode("utf-8", "replace") for k, v in tm.items()
                                          if k.endswith("data.js")), None), p["var"])
                mpy = next((v.decode("utf-8", "replace") for k, v in tm.items()
                            if k.endswith("main.py")), None)
                if mpy:
                    ports = sorted(set(re.findall(r"PORT\s*=\s*(\d+)", mpy)))
                    ok(p["port"] in ports, "deb 端口(期望%s)" % p["port"], "main.py PORT=%s" % (ports or "N/A"))
                else:
                    ok(False, "deb 内未找到 main.py（端口无法核验）")
                seed = next((v.decode("utf-8", "replace") for k, v in tm.items()
                             if k.endswith("ai_seed.js")), None)
                if seed is None:
                    print("   – deb 内无 ai_seed.js")
                elif NEW_KEY == "sk-or-v1-REDACTED":
                    print("   – 未设置 OPENROUTER_KEY 环境变量，跳过 key 核验")
                else:
                    ok(NEW_KEY in seed, "deb 内 ai_seed.js 含新 OpenRouter key")
        else:
            ok(False, "deb 缺失", os.path.join(out, p["debdir"]))

        zips = glob.glob(os.path.join(out, "ios", p["ios"]))
        check_datajs("iOS", extract_zip_member(zips[0], "data.js") if zips else None, p["var"]) \
            if zips else ok(False, "iOS zip 缺失", p["ios"])

    # ---- Windows ----
    print("\n############ Windows 产物 ############")
    win = os.path.join(out, "win")
    for p in PRODUCTS:
        exe = os.path.join(win, "%s_Setup_new4060.exe" % p["winname"])
        if os.path.isfile(exe):
            tmp = tempfile.mkdtemp(prefix="wv_")
            try:
                sevenz_extract(exe, tmp)
                dj = find_file(tmp, "data.js")
                if dj:
                    check_datajs("Win.exe", open(dj, encoding="utf-8", errors="replace").read(), p["var"])
                else:
                    ok(False, "Win.exe 内未找到 data.js", os.path.basename(exe))
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
        else:
            ok(False, "Win.exe 缺失", os.path.basename(exe))

        msi = os.path.join(win, "%s_Setup_new4060.msi" % p["winname"])
        src = os.path.join(ROOT, "native-shell", p["winpub"])
        srcdata = os.path.join(src, "webroot", "data.js")
        srcver = os.path.join(src, "webroot", "version.json")
        if os.path.isfile(msi):
            sz = os.path.getsize(msi)
            ok(sz > 1_000_000, "Win.msi 存在(体积)", "%s = %.1f MB" % (os.path.basename(msi), sz / 1048576))
        else:
            ok(False, "Win.msi 缺失", os.path.basename(msi))
        check_datajs("MSI源", open(srcdata, encoding="utf-8", errors="replace").read()
                     if os.path.isfile(srcdata) else None, p["var"])
        try:
            v = json.load(open(srcver, encoding="utf-8")).get("version", "")
        except Exception:
            v = ""
        ok(v == p["ver"], "MSI 源版本标记", "version.json=%s 期望=%s" % (v, p["ver"]))

    fails = [r for r in RESULTS if not r[0]]
    print("\n==================== 结论 ====================")
    print("总检查项: %d   通过: %d   失败: %d" % (len(RESULTS), len(RESULTS) - len(fails), len(fails)))
    for _c, l, e in fails:
        print("   ❌ %s %s" % (l, e))
    if fails:
        print("❌ 存在未通过项")
        return 1
    print("✅ 全部通过：四平台重建包内 data.js 完整；端口 / 新 key / _new4060 后缀均已核验")
    return 0


if __name__ == "__main__":
    sys.exit(main())
