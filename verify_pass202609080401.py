#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verify_pass.py <归档目录> <pub|int> — 双通道抽包核验 v2（APK/iOS zip/deb/NSIS EXE）
标记：shuili 演示=红旗渠所/内部=京密引水；perc 演示=百色/内部=北台上；gujian 公开数据不做标记断言。
每包抽 data.js + version.json + app.js。"""
import io, os, re, sys, zipfile, lzma, shutil, subprocess

ARCH, MODE = sys.argv[1], sys.argv[2]
MARK = {"shuili": ("红旗渠所", "京密引水"), "perc": ("百色", "北台上"), "gujian": (None, None)}
EXPECT = {"pub": {"shuili": ("3.57", "v3.57"), "perc": ("1.33", "v1.33"), "gujian": ("3.7.4", "3.7.4")},
          "int": {"shuili": ("3.58", "v3.58"), "perc": ("1.34", "v1.34"), "gujian": ("3.7.4", "3.7.4")}}
SEVENZ = r"C:/Program Files/7-Zip/7z.exe"
results = []

def prod_of(name):
    if "ganzhi" in name or "感知" in name: return "perc"
    if "gujian" in name or "古建" in name: return "gujian"
    return "shuili"

def check(tag, data_js, ver_js, app_js):
    prod = prod_of(tag)
    demo, internal = MARK[prod]
    if MODE == "int":
        ok_data = (internal in data_js) if internal else True
    else:
        ok_data = (demo in data_js and (internal is None or internal not in data_js)) if demo else (internal not in data_js if internal else True)
    ver, appver = EXPECT[MODE][prod]
    ok_ver = ('"%s"' % ver) in ver_js
    m = re.search(r'var APP_VERSION = "([^"]+)"', app_js or "")
    ok_app = bool(m) and m.group(1) == appver
    ok = ok_data and ok_ver and ok_app
    results.append((tag, ok))
    print("%s %-58s 数据=%s 版本=%s APP_VERSION=%s" % ("✅" if ok else "❌", tag, ok_data, ok_ver, m.group(1) if m else "无"))

def pick(names, base):
    hits = [n for n in names if n.split("/")[-1] == base]
    return hits[0] if hits else None

def handle_zip(p):
    with zipfile.ZipFile(p) as z:
        names = z.namelist()
        dj, vj, aj = pick(names, "data.js"), pick(names, "version.json"), pick(names, "app.js")
        if dj: check(os.path.basename(p), z.read(dj).decode("utf-8", "ignore"),
                     z.read(vj).decode("utf-8", "ignore") if vj else "",
                     z.read(aj).decode("utf-8", "ignore") if aj else "")

for root, _d, fs in os.walk(ARCH):
    for fn in sorted(fs):
        p = os.path.join(root, fn)
        if fn.endswith(".apk") or (fn.endswith(".zip") and "iOS" in fn):
            handle_zip(p)

# deb: ar -> tar
def read_deb(p):
    blob = open(p, "rb").read()
    assert blob[:8] == b"!<arch>\n"
    off, members = 8, {}
    while off + 60 <= len(blob):
        hdr = blob[off:off + 60]
        name = hdr[0:16].decode("ascii", "ignore").rstrip().rstrip("/")
        size = int(hdr[48:58].decode().strip())
        members[name] = blob[off + 60: off + 60 + size]
        off += 60 + size + (size % 2)
    for k, v in members.items():
        if k.startswith("data.tar.xz"): return lzma.decompress(v)
        if k.startswith("data.tar.gz"):
            import gzip; return gzip.decompress(v)
        if k == "data.tar": return v
    raise SystemExit("deb 无 data.tar: " + p)

def tar_find(tar, base):
    off, out = 0, None
    while off + 512 <= len(tar):
        hdr = tar[off:off + 512]
        name = hdr[0:100].split(b"\0")[0].decode("utf-8", "ignore")
        if not name: break
        try: size = int(hdr[124:136].split(bytes([0]))[0].strip() or b"0", 8)
        except Exception: break
        if name.split("/")[-1] == base: out = tar[off + 512: off + 512 + size]
        off += 512 + ((size + 511) // 512) * 512
    return out

for root, _d, fs in os.walk(ARCH):
    for fn in sorted(fs):
        if fn.endswith(".deb"):
            tar = read_deb(os.path.join(root, fn))
            dj, vj, aj = tar_find(tar, "data.js"), tar_find(tar, "version.json"), tar_find(tar, "app.js")
            if dj: check(fn, dj.decode("utf-8", "ignore"),
                         vj.decode("utf-8", "ignore") if vj else "",
                         aj.decode("utf-8", "ignore") if aj else "")

# NSIS EXE：7z 解包
tmp = "C:/tmp/verify_pass"
shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp, exist_ok=True)
for root, _d, fs in os.walk(ARCH):
    for fn in sorted(fs):
        if fn.endswith("_Setup.exe"):
            p = os.path.join(root, fn)
            out = os.path.join(tmp, fn.replace("_Setup.exe", ""))
            subprocess.run([SEVENZ, "x", "-y", "-o" + out, p], capture_output=True, text=True)
            djs, vjs, ajs = [], [], []
            for dp, _dd, f2 in os.walk(out):
                for f in f2:
                    fp = os.path.join(dp, f).replace("\\", "/")
                    if f == "data.js" and "/webroot/" in fp: djs.append(fp)
                    if f == "version.json" and "/webroot/" in fp: vjs.append(fp)
                    if f == "app.js" and "/webroot/" in fp: ajs.append(fp)
            if djs:
                check(fn, io.open(djs[0], encoding="utf-8", errors="ignore").read(),
                      io.open(vjs[0], encoding="utf-8", errors="ignore").read() if vjs else "",
                      io.open(ajs[0], encoding="utf-8", errors="ignore").read() if ajs else "")
shutil.rmtree(tmp, ignore_errors=True)

bad = [t for t, ok in results if not ok]
print("\nRESULT:", "PASS（%d 包全部符合 %s 版）" % (len(results), MODE) if not bad else "FAIL: %s" % bad)
sys.exit(0 if not bad else 1)
