#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
跨平台构造 UOS DEB 包（不需要 dpkg/ar，纯 Python 实现 ar + tar.gz）。
用法：
  python3 make_deb.py <proj> [arch]   # proj ∈ {shuili, perc, gujian}
                                      # arch 可选，缺省按 CHIP 映射（见下方 ARCH_MAP）
产物：
  <proj>_deb/<pkg>_<ver>_<arch>.deb

架构对照表（已与用户固化，禁止臆测）：
  龙芯 3A3000 / 3A4000      -> mips64el   （旧世界固件，内核 4.19.0-loongson-3）
  龙芯 3A5000 / 3A6000+     -> loongarch64（新世界固件）
  飞腾 FT2000 / 鲲鹏        -> arm64
  其余 x86 平台             -> amd64
"""
import os, sys, struct, tarfile, io, time, gzip, lzma

# 架构映射：芯片关键字 -> deb Architecture 字段（按上面对照表）
ARCH_MAP = {
    "3a4000": "mips64el", "3a3000": "mips64el", "loongson-3": "mips64el",
    "3a5000": "loongarch64", "3a6000": "loongarch64", "la464": "loongarch64",
    "ft2000": "arm64", "kunpeng": "arm64", "phytium": "arm64",
    "x86": "amd64", "amd64": "amd64",
}
# 默认部署环境：用户统信 UOS 20 专业版 1050 / 龙芯 3A4000 / 内核 4.19.0-loongson-3
DEFAULT_ARCH = "mips64el"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = {
    "shuili": {"dir": "uos-water-pyqt6", "pkg": "shuili-map", "name": "水利工程基础信息一张图",
               "ver": "3.45.20260830", "desc": "水利工程基础信息一张图（统信 UOS 龙芯原生壳）"},
    "perc":   {"dir": "uos-pyqt6",       "pkg": "shuili-ganzhi", "name": "水利感知项目一张图",
               "ver": "1.21.20260830", "desc": "水利感知项目一张图（统信 UOS 龙芯原生壳）"},
    "gujian": {"dir": "uos-gujian-pyqt6", "pkg": "gujian-map", "name": "古建景点打卡",
               "ver": "3.3.20260830", "desc": "古建景点打卡（统信 UOS 龙芯原生壳）"},
}


def ar_member(name, data):
    """构造 ar 归档成员（固定 60 字节头）。

    完全对齐 V3.28(v326) 已验证规范，规避 deepin 的 github.com/myml/ar
    （被 deepin-security-verify 钩子调用）的两个解析雷区：
    1) name 必须用**空格**右填充到 16（不能用 \\x00）：myml/ar.string() 只修剪空格、
       不修剪 NUL，NUL 填充会让成员名变成 'control.tar.xz\\0\\0'，deepin ExtractFile
       做精确字符串匹配失败 → 安装器报「请检查deb包是否损坏」。
    2) mode 必须含 '100' 前缀（b'100644'.ljust(8)）：myml/ar.octal 默认从索引 3 取值，
       若 mode='0       '（索引1..7全空格），i 会减到 0，执行 b[3:1] →
       panic: slice bounds out of range [3:1]（即 3.30.2/3.30.3 的崩溃）。
    3) size 写真实数据长度（不含对齐补齐字节）；奇数长度成员后补一个 \\n（标准 ar 偶对齐）。
    """
    nm = name[:16].ljust(16, " ")                       # 空格填充（关键！）
    mtime = str(int(time.time())).ljust(12, " ")
    uid = "0".ljust(6, " ")
    gid = "0".ljust(6, " ")
    mode = "100644".ljust(8, " ")                        # 必须含 100 前缀
    size = str(len(data)).ljust(10, " ")
    hdr = (nm + mtime + uid + gid + mode + size + "`\n").encode("ascii")
    assert len(hdr) == 60, "ar header must be 60 bytes, got %d" % len(hdr)
    pad = b"\n" if len(data) % 2 else b""
    return hdr + data + pad


def build_tgz(files):
    """files: list of (arcname, data_bytes) -> tar.xz 字节（GNU_FORMAT 防 PAX 头）。

    用 xz(FORMAT_XZ + CHECK_CRC64) 与 v326 一致——该格式已在 UOS 1050 龙芯实测可装；
    GNU_FORMAT 避免 Python 默认 PAX 头（部分旧 dpkg 解析异常）。
    """
    buf = io.BytesIO()
    with lzma.open(buf, "wb", format=lzma.FORMAT_XZ, check=lzma.CHECK_CRC64) as xz:
        with tarfile.open(fileobj=xz, mode="w", format=tarfile.GNU_FORMAT) as tf:
            for arcname, data in files:
                ti = tarfile.TarInfo(name=arcname)
                ti.size = len(data)
                ti.mode = 0o755 if arcname.endswith(("main.py", "shuili-map", "shuili-ganzhi", "gujian-map")) else 0o644
                ti.mtime = int(time.time())
                tf.addfile(ti, io.BytesIO(data))
    return buf.getvalue()


def main():
    key = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in PROJ else "shuili"
    c = PROJ[key]
    # 解析架构：命令行第2参数可直接传 mips64el/loongarch64/arm64/amd64；
    # 或传芯片关键字（3a4000 等）走 ARCH_MAP；缺省用 DEFAULT_ARCH（用户 3A4000 环境）
    arch = DEFAULT_ARCH
    if len(sys.argv) > 2:
        a = sys.argv[2].lower()
        arch = ARCH_MAP.get(a, a)  # 已是合法架构名则直接用
    src = os.path.join(ROOT, "native-shell", c["dir"])
    out_dir = os.environ.get("DEB_OUT_DIR") or os.path.join(
        ROOT, "APK归档", "四端安装包_20260830_v345", "uos-" + key)
    os.makedirs(out_dir, exist_ok=True)

    # 收集 webroot + main.py（webroot 保留为 /opt/<pkg>/webroot/ 子目录，匹配 main.py 的 WEBROOT 路径）
    payload = []
    for root, _, files in os.walk(os.path.join(src, "webroot")):
        for fn in files:
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, os.path.join(src, "webroot")).replace(os.sep, "/")
            arc = "opt/%s/webroot/%s" % (c["pkg"], rel)
            payload.append((arc, open(full, "rb").read()))
    payload.append(("opt/%s/main.py" % c["pkg"], open(os.path.join(src, "main.py"), "rb").read()))
    # 启动器
    launcher = "#!/bin/bash\nexec python3 /opt/%s/main.py \"$@\"\n" % c["pkg"]
    payload.append(("usr/bin/%s" % c["pkg"], launcher.encode()))
    # desktop
    desktop = "[Desktop Entry]\nName=%s\nComment=%s\nExec=%s\nTerminal=false\nType=Application\nIcon=webview\nCategories=Utility;Science;\n" % (c["name"], c["desc"], c["pkg"])
    payload.append(("usr/share/applications/%s.desktop" % c["pkg"], desktop.encode()))

    data_tgz = build_tgz(payload)
    control = ("Package: %s\nVersion: %s\nSection: utils\nPriority: optional\nArchitecture: %s\n"
               "Depends: python3\n"
               "Maintainer: 小七 <xiaoyi@example.com>\n"
               "Description: %s\n PyQt6 + QWebEngineView 承载网页；若系统无 PyQt6 则自动回退系统浏览器壳，无后台服务残留。\n") % (
        c["pkg"], c["ver"], arch, c["desc"])
    control_tgz = build_tgz([("control", control.encode())])

    deb = b"!<arch>\n"
    deb += ar_member("debian-binary", b"2.0\n")
    deb += ar_member("control.tar.xz", control_tgz)
    deb += ar_member("data.tar.xz", data_tgz)

    out = os.path.join(out_dir, "%s_%s_%s.deb" % (c["pkg"], c["ver"], arch))
    open(out, "wb").write(deb)
    print("✅ 产出:", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    main()
