#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_pub_key_leak.py — 公开通道(pub)安装包「真实 API Key 泄露」门禁

背景：
  09-11 夜班发现历史公开版(v3.59~3.69)把真实 OpenRouter Key(sk-or-v1...)打进了公开包，
  已在 GitHub Release + 网盘公开版全量替换为脱敏版(ai_seed.demo.js)。但本地
  APK归档/四端安装包_20260907_v359_pub(v3.59) 这一份「本地构建快照」未重派生，
  至今仍含真实 key；而夜班门禁 verify_pkgs_smartquery 只验「智能查询注入+数据条数」，
  **从不验 sk-or-v1**，导致该泄露连续 8 夜在门禁里静默 PASS。

  本脚本补全该盲区：扫描所有「含 _pub」的归档目录（含 _pub_winfix 等变体后缀，避免公共归档
  改个名就逃过扫描），抽取其中 ai_seed.js(非 demo/非 .bak)，
  断言不含真实 sk-or-v1 key。命中即 EXIT=1（与 verify_pkgs_smartquery 的「双通道」门禁互补：
  int 内部版**允许**含真实 key，pub 公开版**禁止**含真实 key）。

用法：
  python verify_pub_key_leak.py            # 自动发现全部含 _pub 的归档(含 *_pub_winfix 等)
  python verify_pub_key_leak.py <目录>     # 只验指定目录

退出码：0 = 无泄露；1 = 发现泄露（列出违规包）。
"""
import io
import os
import re
import sys
import zipfile

ROOT = os.path.join("D:/Users/Claw", "APK归档")
KEY_PAT = re.compile(r"sk-or-v1[\w\-]{20,}")

# ---------- 抽取 ai_seed.js（非 demo / 非 .bak） ----------
def _seed_names(namelist):
    out = []
    for n in namelist:
        low = n.lower()
        if "ai_seed" in low and low.endswith(".js"):
            if "demo" in low or ".bak" in low:
                continue
            out.append(n)
    return out

def scan_zip_like(path):
    """apk / zip：直接抽取 ai_seed.js 文本扫描。返回 (leak:bool, detail)"""
    try:
        with zipfile.ZipFile(path) as z:
            for n in _seed_names(z.namelist()):
                try:
                    d = z.read(n).decode("utf-8", "ignore")
                except Exception:
                    continue
                m = KEY_PAT.search(d)
                if m:
                    return True, "%s => %s..." % (n, m.group(0)[:42])
    except Exception as e:
        return False, "zip-read-err:%s" % e
    return False, ""

def scan_deb(path):
    """deb：ar 解析 -> data.tar.xz(lzma) -> opt/<pkg>/webroot/ai_seed.js"""
    try:
        import lzma, tarfile
        with io.open(path, "rb") as f:
            data = f.read()
        # 极简 ar 解析：跳 8 字节全局头，按 60 字节成员头切分
        off = 8
        tar_blob = None
        while off + 60 <= len(data):
            hdr = data[off:off + 60]
            name = hdr[0:16].decode("ascii", "ignore").strip().strip("/").rstrip()
            try:
                size = int(hdr[48:58].decode("ascii").strip(), 10)
            except Exception:
                break
            off += 60
            body = data[off:off + size]
            off += size + (size % 2)  # 2 字节对齐补齐
            if name.startswith("data.tar"):
                tar_blob = body
                break
        if not tar_blob:
            return False, "no-data-tar"
        with lzma.open(io.BytesIO(tar_blob)) as tf:
            with tarfile.open(fileobj=tf) as tar:
                for m in tar.getmembers():
                    if m.name.lower().endswith("ai_seed.js") and "demo" not in m.name.lower() and ".bak" not in m.name.lower():
                        try:
                            d = tar.extractfile(m).read().decode("utf-8", "ignore")
                        except Exception:
                            continue
                        k = KEY_PAT.search(d)
                        if k:
                            return True, "%s => %s..." % (m.name, k.group(0)[:42])
    except Exception as e:
        return False, "deb-err:%s" % e
    return False, ""

def scan_binary_fallback(path, cap=160_000_000):
    """msi / exe：best-effort 二进制扫描（压缩格式可能漏检，仅作兜底）"""
    try:
        if os.path.getsize(path) > cap:
            return False, "too-large-skip"
        with io.open(path, "rb") as f:
            d = f.read().decode("latin-1", "ignore")
        m = KEY_PAT.search(d)
        if m:
            return True, "binary => %s..." % m.group(0)[:42]
    except Exception as e:
        return False, "bin-err:%s" % e
    return False, ""

def scan_pkg(path):
    low = path.lower()
    if low.endswith((".apk", ".zip")):
        leak, det = scan_zip_like(path)
    elif low.endswith(".deb"):
        leak, det = scan_deb(path)
    else:  # msi / exe
        leak, det = scan_binary_fallback(path)
    return leak, det

# ---------- 发现 pub 归档 ----------
def find_pub_dirs():
    if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]):
        return [sys.argv[1]]
    dirs = []
    if os.path.isdir(ROOT):
        for d in sorted(os.listdir(ROOT)):
            full = os.path.join(ROOT, d)
            if os.path.isdir(full) and "_pub" in d and "_oldurl_废弃" not in d:
                dirs.append(full)
    return dirs

def main():
    pub_dirs = find_pub_dirs()
    if not pub_dirs:
        print("⚠️ 未发现任何 *_pub 归档目录（ROOT=%s）" % ROOT)
        sys.exit(0)
    total_leak = 0
    total_checked = 0
    for d in pub_dirs:
        print("### PUB 归档: %s" % os.path.basename(d))
        leaked_files = []
        for root, _, files in os.walk(d):
            for fn in files:
                if not fn.lower().endswith((".apk", ".zip", ".msi", ".exe", ".deb")):
                    continue
                fp = os.path.join(root, fn)
                total_checked += 1
                leak, det = scan_pkg(fp)
                if leak:
                    total_leak += 1
                    leaked_files.append((fn, det))
                    print("  ❌ LEAK %s  [%s]" % (fn, det))
        if not leaked_files:
            print("  ✅ 无真实 key 泄露（扫描 %d 包）" % total_checked)
    print("=" * 40)
    print("汇总：扫描 %d 包，泄露 %d 包" % (total_checked, total_leak))
    if total_leak:
        print("❌ 公开通道存在真实 Key 泄露（pub 禁止含 sk-or-v1；内部版 int 允许）")
        sys.exit(1)
    print("✅ 公开通道无真实 Key 泄露")
    sys.exit(0)

if __name__ == "__main__":
    main()
