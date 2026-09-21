#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""逐字节对比多个 deb 的 ar 头，复现 deepin myml/ar 解析逻辑，定位损坏成因。"""
import sys, os, io, tarfile

DEBS = [
    ("3.28 成功",  r"D:/Users/Claw/jingyin/uos-deb-build/shuili-map_3.28.20260821_mips64el.deb"),
    ("3.30.2 失败(_all ar panic)", r"D:/Users/Claw/APK归档/四端安装包_20260824/水利工程一张图/shuili-map_3.30.2-20260824_all.deb"),
    ("3.30.1 失败(mips)", r"D:/Users/Claw/APK归档/四端安装包_20260824/uos-shuili/shuili-map_3.30.1.20260824_mips64el.deb"),
    ("3.31 失败",   r"D:/Users/Claw/APK归档/四端安装包_20260825_v331/水利工程一张图/shuili-map_3.31.20260825_mips64el.deb"),
    ("3.36 失败",   r"D:/Users/Claw/APK归档/四端安装包_20260828_v336/水利工程一张图/shuili-map_3.36.20260828_mips64el.deb"),
]


def dump_header(label, raw, off):
    h = raw[off:off+60]
    name = h[0:16]
    mtime = h[16:28]
    uid = h[28:34]
    gid = h[34:40]
    mode = h[40:48]
    size = h[48:58]
    magic = h[58:60]
    def show(b):
        return repr(b) + "  [" + (b.decode('latin1').replace('\x00','·')) + "]"
    print(f"  @{off} name  ={show(name)}")
    print(f"  @{off} mtime ={show(mtime)}")
    print(f"  @{off} uid   ={show(uid)}")
    print(f"  @{off} gid   ={show(gid)}")
    print(f"  @{off} mode  ={show(mode)}")
    print(f"  @{off} size  ={show(size)}")
    print(f"  @{off} magic ={show(magic)}  {'OK' if magic==b'`\n' else 'BAD!!'}")
    # 数值字段中是否含非空白非数字字符
    for nm, fld in [("mtime",mtime),("uid",uid),("gid",gid),("mode",mode),("size",size)]:
        bad = [c for c in fld if c not in b"01234567 \x00"]
        if bad:
            print(f"      ⚠️ {nm} 含非法字符: {bad}")


def parse_standard(raw):
    """标准 ar 解析：size 不含 pad，奇数 size 后跳过 1 字节 pad。"""
    assert raw[0:8] == b"!<arch>\n", "magic bad"
    off = 8
    members = []
    while off + 60 <= len(raw):
        h = raw[off:off+60]
        name = h[0:16].split(b"\x00")[0].strip().decode("latin1")
        size = int(h[48:58])
        data = raw[off+60: off+60+size]
        pad = 1 if size % 2 == 1 else 0
        members.append((name, size, len(data), off, off+60+size+pad))
        off = off + 60 + size + pad
    return members


def parse_sizeincludespad(raw):
    """make_deb.py 写法：size 含 pad，且文件物理上也写了 pad。标准解析器读 size 后不再跳 pad。"""
    assert raw[0:8] == b"!<arch>\n"
    off = 8
    members = []
    while off + 60 <= len(raw):
        h = raw[off:off+60]
        name = h[0:16].split(b"\x00")[0].strip().decode("latin1")
        size = int(h[48:58])
        data = raw[off+60: off+60+size]
        # 标准解析器读 size 字节后，若 size 为奇数才跳 pad；make_deb 的 size 在奇数时已+1(偶数)，故不跳
        pad = 1 if size % 2 == 1 else 0
        members.append((name, size, len(data), off, off+60+size+pad))
        off = off + 60 + size + pad
    return members


def try_unxz(data):
    try:
        import lzma
        return lzma.decompress(data)
    except Exception as e:
        return None

def try_ungz(data):
    try:
        import gzip
        return gzip.decompress(data)
    except Exception:
        return None


for label, path in DEBS:
    print("="*70)
    print(label, "->", os.path.basename(path))
    if not os.path.exists(path):
        print("  (文件不存在，跳过)"); continue
    raw = open(path, "rb").read()
    print("  总大小=%d bytes" % len(raw))
    # 两种解析都试，看谁能在成员边界对齐到下一个 'debian-binary/control/data' 头
    for mode, fn in [("标准(size不含pad)", parse_standard), ("size含pad", parse_sizeincludespad)]:
        try:
            members = fn(raw)
            print(f"  [{mode}] 解析到成员: {[m[0] for m in members]}")
            for (name, size, dlen, hoff, noff) in members:
                flag = "" if dlen == size else f"  ⚠️声明size={size} 实读={dlen}"
                print(f"      {name}: size={size} next_off={noff}{flag}")
            # 检查最后一个 next_off 是否到文件尾（对齐）
            if members:
                last = members[-1]
                if last[4] != len(raw):
                    print(f"      ⚠️末成员结束于 {last[4]}，文件尾 {len(raw)}，差 {len(raw)-last[4]} 字节")
        except Exception as e:
            print(f"  [{mode}] 解析异常: {e}")
    # 详细 dump 三个成员头（用标准解析定位）
    try:
        members = parse_standard(raw)
        for (name, size, dlen, hoff, noff) in members:
            print(f"  --- 成员头 {name} ---")
            dump_header(label, raw, hoff)
            # 试解压看内部 tar 是否完好
            data = raw[hoff+60:hoff+60+size]
            inner = try_unxz(data) or try_ungz(data)
            if inner is None:
                print(f"      (内部压缩体无法用 xz/gz 解压，前16字节: {data[:16].hex()})")
            else:
                try:
                    tf = tarfile.open(fileobj=io.BytesIO(inner))
                    print(f"      ✅ 内部tar 成员数={len(tf.getnames())} 示例={tf.getnames()[:3]}")
                except Exception as e:
                    print(f"      ⚠️ 内部tar 解析失败: {e}")
    except Exception as e:
        print("  dump 失败:", e)
