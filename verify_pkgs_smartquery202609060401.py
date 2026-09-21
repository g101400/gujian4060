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

ROOT = r"D:/Users/Claw/APK归档/四端安装包_20260901_v348_智能查询"
OUT = r"D:/Users/Claw/.pkgverify"
os.makedirs(OUT, exist_ok=True)

# 期望数据全局/条数：按产品映射（与 verify_rebuilt_data.py 一致）
PRODUCT_EXPECT = {
    "水利工程一张图":     ("SHUILI_DATA", 557),
    "水利感知项目一张图": ("PERCEPTION_DATA", 1125),
    "古建景点打卡":       ("GUJIAN_DATA", 1032),
}

# 自动发现归档内所有安装包（APK/deb/msi/exe/zip），覆盖全部 4 架构 deb，
# 不再硬编码包清单（避免新增架构 deb 漏检 —— 见 2026-09-02 夜班自省）。
PKGS = []
for name, (dkey, exp) in PRODUCT_EXPECT.items():
    pdir = os.path.join(ROOT, name)
    if not os.path.isdir(pdir):
        continue
    for f in sorted(os.listdir(pdir)):
        low = f.lower()
        if low.endswith((".apk", ".deb", ".msi", ".exe", ".zip")):
            typ = low.rsplit(".", 1)[-1]
            PKGS.append((name, f, typ, dkey, exp))

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
print("=== 抽包核验：智能查询后续操作 + 数据条数 ===")
for name, fn, typ, dkey, exp in PKGS:
    p = os.path.join(ROOT, name, fn)
    if not os.path.exists(p):
        print("  ❌ 缺包 %s" % p); fail += 1; continue
    dest = os.path.join(OUT, name + "_" + typ)
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
