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

2026-09-13 夜班自省升级：原仅核对最新 *_pub 目录（24 包），内部(int)测试包未纳入，
致「int 构建漏注入智能查询」无法被门禁捕获。现同时自动发现最新 *_pub 与最新 *_int 目录，
双通道合并核验、汇总退出码（任一 FAIL 即 EXIT≠0）。
"""
import io, os, re, subprocess, sys, shutil

SEVENZ = r"C:/Program Files/7-Zip/7z.exe"
if not os.path.exists(SEVENZ):
    SEVENZ = shutil.which("7z") or "7z"

ARCHIVE = r"D:/Users/Claw/APK归档"

def _cands(pattern_start, pattern_end, exclude=""):
    out = []
    if not os.path.isdir(ARCHIVE):
        return out
    for d in os.listdir(ARCHIVE):
        if d.startswith(pattern_start) and d.endswith(pattern_end) and os.path.isdir(os.path.join(ARCHIVE, d)):
            if exclude and exclude in d:
                continue
            m = re.search(r"(\d{8})", d)
            if m:
                out.append((m.group(1), d))
    out.sort()
    return out

def latest_pub_dir():
    """取最新的 四端安装包_<YYYYMMDD>_*_pub 目录（排除 *_oldurl_废弃）。"""
    c = _cands("四端安装包_", "_pub", exclude="_oldurl_废弃")
    return os.path.join(ARCHIVE, c[-1][1]) if c else None

def latest_int_dir():
    """取最新的 *_int 目录（内部工程测试包）。

    命名历史：早期为 测试包_<YYYYMMDD>_*_int；2026-09-13 起主出包命名改为
    四端安装包_<YYYYMMDD>_v<ver>_int。若只用前缀匹配会漏掉新命名目录、
    导致最新内部构建漏出门禁（真实盲区，已踩）。故改为「任意以 _int 结尾的目录」，
    按日期排序取最新（排除 *_oldurl_废弃）。"""
    c = []
    if os.path.isdir(ARCHIVE):
        for d in os.listdir(ARCHIVE):
            if d.endswith("_int") and os.path.isdir(os.path.join(ARCHIVE, d)) and "_oldurl_废弃" not in d:
                m = re.search(r"(\d{8})", d)
                if m:
                    c.append((m.group(1), d))
    c.sort()
    return os.path.join(ARCHIVE, c[-1][1]) if c else None

OUT = r"D:/Users/Claw/.pkgverify"
os.makedirs(OUT, exist_ok=True)

def prod_of(name):
    if "ganzhi" in name or "感知" in name: return "perc"
    if "gujian" in name or "古建" in name: return "gujian"
    return "shuili"

# 各产品演示数据条数期望值（与 verify_rebuilt_data.py 一致）
EXPECT_COUNT = {"shuili": 557, "perc": 1125, "gujian": 1032}

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

def verify_dir(root, label):
    """核验单个归档目录；返回 (ok, fail, 输出行列表)。"""
    if not root or not os.path.isdir(root):
        return 0, 0, ["[%s] ⚠️ 目录缺失，跳过: %s" % (label, root)]
    ok = fail = 0
    lines = []
    PKGS = []
    for dp, _, fns in os.walk(root):
        for f in sorted(fns):
            low = f.lower()
            if low.endswith((".apk", ".deb", ".msi", ".exe", ".zip")):
                typ = low.rsplit(".", 1)[-1]
                prod = prod_of(f)
                PKGS.append((prod, f, typ, EXPECT_COUNT[prod], os.path.join(dp, f)))
    lines.append("=== [%s] 抽包核验：智能查询后续操作 + 数据条数（ROOT=%s，包数=%d）===" % (label, root, len(PKGS)))
    for prod, fn, typ, exp, p in PKGS:
        if not os.path.exists(p):
            lines.append("  ❌ [%s] 缺包 %s" % (label, p)); fail += 1; continue
        dest = os.path.join(OUT, label + "_" + fn)
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
        lines.append("  %s %-22s [%-3s] renderQueryFurther=%s furtherQuery=%s 数据=%s(期望%d)"
                     % (status, fn, typ, has_rqf, has_fq, rec, exp))
    lines.append("[%s] 结果: PASS=%d FAIL=%d" % (label, ok, fail))
    return ok, fail, lines

# 自动发现最新发布(pub) + 内部测试(int) 目录，双通道合并核验
pub_root = latest_pub_dir() or r"D:/Users/Claw/APK归档/四端安装包_20260901_v348_智能查询"
int_root = latest_int_dir()

all_ok = 0
all_fail = 0
all_lines = []
for root, label in [(pub_root, "pub"), (int_root, "int")]:
    o, f, ls = verify_dir(root, label)
    all_ok += o
    all_fail += f
    all_lines += ls
    all_lines.append("")

print("\n".join(all_lines))
print("汇总（pub+int）: PASS=%d FAIL=%d" % (all_ok, all_fail))
sys.exit(0 if all_fail == 0 else 2)
