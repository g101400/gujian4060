#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
忠实复现统信 deepin security-verify 使用的 github.com/myml/ar 解析逻辑，
在 Windows 本地穷举校验生成的 .deb 是否会被 UOS 安装器判为「请检查deb包是否损坏」
或触发 `slice bounds out of range [3:1]` panic；并检查 data.tar 是否声明全部父目录条目
（DIRTYPE），否则 dpkg 为文件暂存 `.dpkg-new` 时父目录缺失 -> ENOENT「没有那个文件或目录」。

复现要点（来自 myml/ar reader.go 真实源码）：
  string(b): 仅从右往左修剪 空格(0x20)，不修剪 NUL(0x00)  -> NUL 填充名会保留尾部 NUL
  octal(b) : 从右往左修剪空格后，默认 start=3；若首个空格在索引3则 start=0；
             取 b[start:i+1]。当 mode='0       ' 时 i 减到 0、start=3 -> b[3:1] PANIC
  numeric(b): 十进制（size 字段按十进制解析）
依赖：仅标准库 + tarfile/lzma
"""
import sys, io, tarfile, lzma


def myml_string(b):
    i = len(b) - 1
    while i > 0 and b[i] == 32:
        i -= 1
    return b[0:i + 1]


def myml_numeric(b):
    i = len(b) - 1
    while i > 0 and b[i] == 32:
        i -= 1
    s = b[0:i + 1]
    try:
        return int(s, 10)
    except Exception:
        return 0


def myml_octal(b):
    i = len(b) - 1
    while i > 0 and b[i] == 32:
        i -= 1
    start = 3
    if b.find(32) == 3:        # bytes.IndexByte(b, ' ') == 3
        start = 0
    if start > i:              # Go 里这里会 panic: slice bounds out of range [start:i+1]
        raise ValueError("PANIC octal: mode 字段触发 b[%d:%d] (即 deepin 的 [3:1] panic)" % (start, i + 1))
    s = b[start:i + 1]
    try:
        return int(s, 8)
    except Exception:
        return 0


def parse_myml(deb):
    raw = open(deb, "rb").read()
    if raw[0:8] != b"!<arch>\n":
        raise ValueError("ar 魔数错误")
    off = 8
    members = []
    while off + 60 <= len(raw):
        h = raw[off:off + 60]
        name = myml_string(h[0:16]).decode("latin1")
        mtime = myml_numeric(h[16:28])
        uid = myml_numeric(h[28:34])
        gid = myml_numeric(h[34:40])
        mode = myml_octal(h[40:48])      # 这里会复现 panic
        size = myml_numeric(h[48:58])
        magic = h[58:60]
        if magic != b"`\n":
            raise ValueError("成员 %r 魔数错误 @%d" % (name, off))
        data = raw[off + 60: off + 60 + size]
        pad = 1 if size % 2 == 1 else 0
        members.append({"name": name, "mode": mode, "size": size, "off": off, "next": off + 60 + size + pad, "data": data})
        off = off + 60 + size + pad
    if off != len(raw):
        raise ValueError("ar 对齐异常：末成员结束于 %d，文件尾 %d（差 %d，偏移错位）" % (off, len(raw), len(raw) - off))
    return members


def check_dir_entries(tf):
    """根因 #4 断言：data.tar 中每个文件的每段父目录都必须存在对应 DIRTYPE 条目，
    否则 dpkg 为文件生成 .dpkg-new 暂存时父目录缺失 -> ENOENT「没有那个文件或目录」。"""
    members = tf.getmembers()
    names = set(m.name.rstrip("/") for m in members)
    dir_count = sum(1 for m in members if m.isdir())
    missing = []
    for m in members:
        if m.isdir():
            continue
        parts = m.name.split("/")
        for i in range(1, len(parts)):
            parent = "/".join(parts[:i])
            if parent and parent not in names:
                missing.append(parent)
    return dir_count, missing


def main():
    deb = sys.argv[1]
    print("== myml/ar 校验:", deb)
    members = parse_myml(deb)
    names = [m["name"] for m in members]
    print("   成员名:", names)
    assert "debian-binary" in names, "缺 debian-binary"
    assert "control.tar.xz" in names, "control 成员名异常（疑似 NUL 填充）: %r" % names
    assert "data.tar.xz" in names, "data 成员名异常（疑似 NUL 填充）: %r" % names

    # control
    ctrl = [m for m in members if m["name"] == "control.tar.xz"][0]["data"]
    ctrl_tar = lzma.decompress(ctrl)
    tf = tarfile.open(fileobj=io.BytesIO(ctrl_tar))
    cnames = tf.getnames()
    print("   control 成员:", cnames)
    assert "control" in cnames
    # control 完整性断言（2026-09-01 起强制）：缺 postinst/postrm/md5sums 的老式残缺包
    # 会导致权限污染无法自愈 / dpkg -V 无校验依据，直接判不通过
    for _must in ("postinst", "postrm", "md5sums"):
        assert _must in cnames, "control 缺 %s —— 非统一方案产物（3.40~3.46 残缺包特征），拒绝交付" % _must
    ctrl_text = tf.extractfile("control").read().decode("utf-8")
    pkg = None
    depends = ""
    for line in ctrl_text.splitlines():
        if line.startswith("Package:"):
            pkg = line.split(":", 1)[1].strip()
        if line.startswith("Depends:"):
            depends = line.split(":", 1)[1].strip()
            print("   Depends:", depends)
    print("   Package:", pkg)
    assert pkg, "control 无 Package 字段"
    # 统一方案断言 2：Depends 不得含 pyqt6 —— PyQt6 壳在龙芯/部分环境会崩，
    # 依赖它 = 复现「装得上打不开」；浏览器壳方案零 PyQt6 依赖
    assert "pyqt6" not in depends.lower(), (
        "Depends 含 pyqt6 —— 非浏览器壳统一方案（3.29~3.46 崩溃特征），拒绝交付")

    # data
    data = [m for m in members if m["name"] == "data.tar.xz"][0]["data"]
    data_tar = lzma.decompress(data)
    tf2 = tarfile.open(fileobj=io.BytesIO(data_tar))
    dn = tf2.getnames()
    print("   data 成员数:", len(dn))
    # entry point 兼容两种架构：新 PyQt6 原生壳用 main.py；老 native-shell 用 launch.sh
    entry = "opt/%s/main.py" % pkg
    launch = "opt/%s/launch.sh" % pkg
    assert entry in dn or launch in dn, "data 缺入口(期望 %s 或 %s)" % (entry, launch)
    for must in ["usr/bin/%s" % pkg, "usr/share/applications/%s.desktop" % pkg]:
        assert must in dn, "data 缺关键条目: " + must

    # 根因 #4：父目录条目齐备断言
    dir_count, missing = check_dir_entries(tf2)
    print("   data 目录条目数:", dir_count, "| 缺失父目录数:", len(missing))
    assert not missing, "data.tar 缺失父目录条目(将致 dpkg .dpkg-new ENOENT「没有那个文件或目录」): " + ", ".join(sorted(set(missing))[:10])

    print("   ✅ 通过 myml/ar 解析（无 panic / 成员名匹配 / 内部 tar.xz 可解压 / 关键文件齐全 / 父目录条目齐备）")


if __name__ == "__main__":
    main()
