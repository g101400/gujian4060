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
import os, sys, struct, tarfile, io, time, gzip

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
               "ver": "3.31.20260825", "desc": "水利工程基础信息一张图（统信 UOS 龙芯原生壳）"},
    "perc":   {"dir": "uos-pyqt6",       "pkg": "shuili-ganzhi", "name": "水利感知项目一张图",
               "ver": "1.7.20260825", "desc": "水利感知项目一张图（统信 UOS 龙芯原生壳）"},
    "gujian": {"dir": "uos-gujian-pyqt6", "pkg": "gujian-map", "name": "古建景点打卡",
               "ver": "1.9.20260825", "desc": "古建景点打卡（统信 UOS 龙芯原生壳）"},
}


def ar_member(name, data):
    """构造 ar 归档成员（System V/GNU 变体，固定 60 字节头）。"""
    name_b = name.encode()[:16].ljust(16, b"\x00")
    mtime = str(int(time.time())).encode().ljust(12, b" ")
    uid = b"0".ljust(6, b" ")
    gid = b"0".ljust(6, b" ")
    mode = b"100644".ljust(8, b" ")
    size = str(len(data)).encode().ljust(10, b" ")
    hdr = name_b + mtime + uid + gid + mode + size + b"\x60\x0a"
    assert len(hdr) == 60, "ar header must be 60 bytes, got %d" % len(hdr)
    pad = b"\n" if len(data) % 2 else b""
    return hdr + data + pad


def build_tgz(files):
    """files: list of (arcname, data_bytes) -> tar.gz bytes"""
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb") as gz:
        with tarfile.open(fileobj=gz, mode="w") as tf:
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
        ROOT, "APK归档", "四端安装包_20260824", "uos-" + key)
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
               "Depends: python3, python3-pyqt6, python3-pyqt6.qtwebengine\n"
               "Maintainer: 小七 <xiaoyi@example.com>\n"
               "Description: %s\n PyQt6 + QWebEngineView 承载网页，无后台服务残留。\n") % (
        c["pkg"], c["ver"], arch, c["desc"])
    control_tgz = build_tgz([("control", control.encode())])

    deb = b"!<arch>\n"
    deb += ar_member("debian-binary", b"2.0\n")
    deb += ar_member("control.tar.gz", control_tgz)
    deb += ar_member("data.tar.gz", data_tgz)

    out = os.path.join(out_dir, "%s_%s_%s.deb" % (c["pkg"], c["ver"], arch))
    open(out, "wb").write(deb)
    print("✅ 产出:", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    main()
