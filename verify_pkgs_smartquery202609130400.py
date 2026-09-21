#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_pkgs_smartquery.py — 抽包核验（铁律-出包 门禁 B）：从本次重建的每个包里抽出 app.js / data.js，
确认『智能查询后续操作』(renderQueryFurther / window.furtherQuery) 已随包分发，
并 JSON 级校验数据条数（557/1125/1032）。禁止 mock，真实解包。

包内布局差异（统一用 7z，按内容识别，不依赖文件名）：
  APK : assets/{app.js,data.js}
  DEB : ar -> data.tar(.xz) -> opt/<pkg>/webroot/{app.js,data.js}
  MSI : Compound(OLE) -> cab1.cab(LZX) -> 成员名被哈希，需用内容识别 app.js/data.js
  EXE : NSIS 自解压 -> webroot/{app.js,data.js}
  ZIP : webroot/{app.js,data.js}
"""
import io, os, re, subprocess, sys, shutil

SEVENZ = r"C:/Program Files/7-Zip/7z.exe"
if not os.path.exists(SEVENZ):
    SEVENZ = shutil.which("7z") or "7z"

ARCHIVE = r"D:/Users/Claw/APK归档"

def latest_pub_dir():
    """取最新的 四端安装包_<YYYYMMDD>_*_pub 目录（排除 *_oldurl_废弃）。"""
    cands = []
    for d in os.listdir(ARCHIVE):
        if d.startswith("四端安装包_") and d.endswith("_pub") and os.path.isdir(os.path.join(ARCHIVE, d)):
            m = re.search(r"(\d{8})", d)
            if m:
                cands.append((m.group(1), d))
    cands.sort()
    return os.path.join(ARCHIVE, cands[-1][1]) if cands else None

# 自动定位最新公开发布目录（失效路径防护：不再硬编码 20260901）
ROOT = latest_pub_dir() or r"D:/Users/Claw/APK归档/四端安装包_20260901_v348_智能查询"
OUT = r"D:/Users/Claw/.pkgverify"
os.makedirs(OUT, exist_ok=True)

def prod_of(name):
    if "ganzhi" in name or "感知" in name: return "perc"
    if "gujian" in name or "古建" in name: return "gujian"
    return "shuili"

# 各产品演示数据条数期望值（与 verify_rebuilt_data.py 一致）
EXPECT_COUNT = {"shuili": 557, "perc": 1125, "gujian": 1032}

# 自动发现最新发布目录内所有安装包（APK/deb/msi/exe/zip），递归遍历，
# 不再依赖 <产品名>/ 子目录布局（2026-09-05 起归档改为 android/ios/uos-*/win/ 结构）。
PKGS = []
for dp, _, fns in os.walk(ROOT):
    for f in sorted(fns):
        low = f.lower()
        if low.endswith((".apk", ".deb", ".msi", ".exe", ".zip")):
            typ = low.rsplit(".", 1)[-1]
            prod = prod_of(f)
            PKGS.append((prod, f, typ, EXPECT_COUNT[prod], os.path.join(dp, f)))

def run(args):
    return subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def collect(dest):
    files = []
    for dp, _, fns in os.walk(dest):
        for f in fns:
            files.append(os.path.join(dp, f))
    return files

def extract_all(pkg_path, dest):
    """递归解包：先把 pkg 解出，若产物里有 .tar/.tar.xz/.tar.gz 再解一层（deb 场景）。返回全部文件路径。"""
    shutil.rmtree(dest, ignore_errors=True)
    os.makedirs(dest, exist_ok=True)
    run([SEVENZ, "x", "-y", "-o" + dest, pkg_path])
    files = collect(dest)
    for f in list(files):
        if re.search(r"\.tar(\.xz|\.gz)?$", f):
            sub = f + "_x"
            shutil.rmtree(sub, ignore_errors=True)
            os.makedirs(sub, exist_ok=True)
            run([SEVENZ, "x", "-y", "-o" + sub, f])
            files += collect(sub)
    return files

def count_records(data_src):
    m = re.search(r"window\.(SHUILI_DATA|PERCEPTION_DATA|GUJIAN_DATA|HERITAGE|SCENERY)\s*=\s*\[", data_src)
    if not m:
        return None
    key = m.group(1)
    start = m.end() - 1  # 正则末尾吃掉 '['，回退一位到数组起始 '['
    depth = 0
    end = -1
    for i, ch in enumerate(data_src[start:], start):
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                end = i
                break
    arr = data_src[start:end + 1]
    return arr.count('"id"')  # 每条记录形如 {"id": ...}

ok = fail = 0
print("=== 抽包核验：智能查询后续操作 + 数据条数（ROOT=%s）===" % ROOT)
for prod, fn, typ, exp, p in PKGS:
    if not os.path.exists(p):
        print("  ❌ 缺包 %s" % p); fail += 1; continue
    dest = os.path.join(OUT, fn)
    files = extract_all(p, dest)
    app_src = data_src = ""
    for f in files:
        try:
            c = io.open(f, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        if not app_src and ("window.furtherQuery = function" in c or "function renderQueryFurther" in c):
            app_src = c
        if not data_src and re.search(r"window\.(SHUILI_DATA|PERCEPTION_DATA|GUJIAN_DATA|HERITAGE|SCENERY)\s*=\s*\[", c):
            data_src = c
    has_rqf = "renderQueryFurther" in app_src
    has_fq = "window.furtherQuery = function" in app_src
    rec = count_records(data_src) if data_src else None
    status = "✅" if (has_rqf and has_fq and rec == exp) else "❌"
    if status == "✅":
        ok += 1
    else:
        fail += 1
    print("  %s %-22s [%-3s] renderQueryFurther=%s furtherQuery=%s 数据=%s(期望%d)"
          % (status, fn, typ, has_rqf, has_fq, rec, exp))

print("\n结果: PASS=%d FAIL=%d" % (ok, fail))
sys.exit(0 if fail == 0 else 2)
