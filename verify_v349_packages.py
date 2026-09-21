#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v3.49 交付包全量核验：从每个安装包抽取 version.json / app.js，确认版本号 + logRuntime 诊断随版本注入。"""
import os, zipfile, tarfile, io, subprocess, re, sys, glob

ARCHIVE = r"D:/Users/Claw/APK归档/四端安装包_20260902_v349"
SEVEN = r"C:/Program Files (x86)/NSIS/.."  # unused
SEVENZ = r"C:/Program Files/7-Zip/7z.exe"
EXP = {  # (pkg_dir, expected version)
    "shuili": "3.49", "perc": "1.25", "gujian": "3.7",
}
EXE_PATHS = {  # NSIS exe / MSI 内的 webroot version.json 探测
}

def read_version_json_from_ziplike(zf, prefix):
    """在 zipfile 对象中找 version.json（任意路径：webroot/ / assets/ / 顶层均可），返回 (version, buildDate)。"""
    for n in zf.namelist():
        if n.endswith("version.json"):
            try:
                import json
                d = json.loads(zf.read(n).decode("utf-8", "ignore"))
                return d.get("version"), d.get("buildDate")
            except Exception:
                pass
    return None, None

def appjs_has(zf, token):
    for n in zf.namelist():
        if n.endswith("app.js") or n.endswith("assets/app.js"):
            try:
                return token in zf.read(n).decode("utf-8", "ignore")
            except Exception:
                return False
    return False

def version_in_appjs(zf):
    for n in zf.namelist():
        if n.endswith("app.js") or n.endswith("assets/app.js"):
            t = zf.read(n).decode("utf-8", "ignore")
            m = re.search(r'APP_VERSION\s*=\s*"([^"]+)"', t)
            return m.group(1) if m else None
    return None

def extract_ar_data_tarxz(path):
    """解析 .deb (ar) -> 返回 data.tar.xz 的字节。"""
    with open(path, "rb") as f:
        data = f.read()
    # ar magic
    assert data[:8] == b"!<arch>\n", "not ar"
    off = 8
    members = {}
    while off < len(data):
        if data[off:off+8] == b"":
            break
        name = data[off:off+16].decode().strip()
        size = int(data[off+48:off+58].decode().strip() or 0)
        # 跳过 header(60) + 内容 + 2 字节补齐
        content = data[off+60: off+60+size]
        members[name] = content
        off += 60 + size + (2 - size % 2) % 2
    return members.get("data.tar.xz") or members.get("data.tar.Z") or b""

def deb_version(path):
    raw = extract_ar_data_tarxz(path)
    if not raw:
        return None, None, False
    tf = tarfile.open(fileobj=io.BytesIO(raw), mode="r:xz")
    vj = None
    for m in tf.getmembers():
        if m.name.endswith("webroot/version.json"):
            import json
            vj = json.loads(tf.extractfile(m).read().decode("utf-8", "ignore"))
            break
    log = False
    for m in tf.getmembers():
        if m.name.endswith("webroot/app.js") or m.name.endswith("assets/app.js"):
            t = tf.extractfile(m).read().decode("utf-8", "ignore")
            log = "logRuntime" in t
            break
    if vj:
        return vj.get("version"), vj.get("buildDate"), log
    return None, None, log

def seven_extract_version(path, tmp):
    """用 7z 从 MSI/EXE 抽取 version.json + app.js（NSIS/WiX 内含 cab）。
    注意：WiX7 MSI 把文件以「无扩展名的哈希名」（F_xxxx）存入 cab，无法靠文件名匹配
    version.json / app.js。故改为按内容探测：
      - version：对 <200KB 的文件尝试 json.loads，命中含 "version" 键的 dict 即取之；
      - logRuntime：对 <2MB 的文件扫描是否含该字符串（跳过 26MB 的嵌入 exe 等二进制）。
    """
    os.makedirs(tmp, exist_ok=True)
    subprocess.run([SEVENZ, "x", "-y", "-o"+tmp, path],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    import json
    ver = bdate = None
    log = False
    for root, _, files in os.walk(tmp):
        for fn in files:
            fp = os.path.join(root, fn)
            try:
                sz = os.path.getsize(fp)
            except OSError:
                continue
            if ver is None and sz < 200_000:
                try:
                    d = json.loads(open(fp, encoding="utf-8", errors="ignore").read())
                    if isinstance(d, dict) and "version" in d:
                        ver = d.get("version"); bdate = d.get("buildDate")
                except Exception:
                    pass
            if not log and sz < 2_000_000:
                try:
                    if "logRuntime" in open(fp, encoding="utf-8", errors="ignore").read():
                        log = True
                except Exception:
                    pass
    return ver, bdate, log

results = []
def rec(pkg, ftype, path, ver, bdate, log):
    exp = EXP.get(pkg)
    ok = (ver == exp)
    results.append((ftype, os.path.basename(path), f"ver={ver} exp={exp} build={bdate} logRuntime={log}", "OK" if ok else "MISMATCH"))

# ---- APK ----
for apk in glob.glob(os.path.join(ARCHIVE, "android", "*.apk")):
    zf = zipfile.ZipFile(apk)
    ver, bdate = read_version_json_from_ziplike(zf, "")
    log = appjs_has(zf, "logRuntime")
    pkg = "shuili" if "水利工程" in apk else ("perc" if "感知" in apk else "gujian")
    rec(pkg, "APK", apk, ver, bdate, log)

# ---- deb ----
for deb in glob.glob(os.path.join(ARCHIVE, "uos-*", "*.deb")):
    ver, bdate, log = deb_version(deb)
    pkg = "shuili" if "shuili-map" in deb else ("perc" if "ganzhi" in deb else "gujian")
    rec(pkg, "deb", deb, ver, bdate, log)

# ---- MSI + EXE (7z) ----
for ext in ("*.msi", "*.exe"):
    for p in glob.glob(os.path.join(ARCHIVE, "win", ext)):
        tmp = "C:/tmp/verify_349_%s" % os.path.basename(p).replace(".", "_")
        ver, bdate, log = seven_extract_version(p, tmp)
        pkg = "shuili" if "水利工程" in p else ("perc" if "感知" in p else "gujian")
        rec(pkg, ext.strip("*"), p, ver, bdate, log)

# ---- iOS zip ----
for z in glob.glob(os.path.join(ARCHIVE, "ios", "*.zip")):
    zf = zipfile.ZipFile(z)
    ver, bdate = read_version_json_from_ziplike(zf, "")
    log = appjs_has(zf, "logRuntime")
    pkg = "shuili" if "水利工程" in z else ("perc" if "感知" in z else "gujian")
    rec(pkg, "iOS", z, ver, bdate, log)

# ---- 汇总 ----
print("=== v3.49 交付包全量核验 ===")
mismatch = 0
for ftype, name, info, status in results:
    print(f"[{ftype:4}] {name:34} {info:55} {status}")
    if status != "OK":
        mismatch += 1
print(f"\n总计 {len(results)} 件，MISMATCH={mismatch}")
sys.exit(1 if mismatch else 0)
