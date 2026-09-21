#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 Android 启动图标（纯 Python 写 PNG，无需 PIL）。蓝底 + 白色水滴标记。"""
import math, os, struct, zlib

DENS = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "res")

def write_png(path, w, h, rgba):
    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    raw = b"".join(b"\x00" + rgba[y * w * 4:(y + 1) * w * 4] for y in range(h))
    idat = zlib.compress(raw, 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))

def make_icon(size):
    bg = (31, 58, 95, 255)        # #1f3a5f
    drop = (255, 255, 255, 255)   # 白色水滴
    r = size * 0.34
    cx = cy = size / 2.0
    buf = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            i = (y * size + x) * 4
            dx, dy = x - cx, y - cy
            # 水滴：上尖下圆的近似（用椭圆 + 顶部尖角）
            # 用距离中心的圆 + 顶部收窄
            dist = math.hypot(dx, dy * 1.05)
            # 顶部尖角：x 越靠近中轴，允许更高的 y
            tip = (abs(dx) < (r * (cy - y) / (cy * 1.4))) and (y < cy - r * 0.4)
            if dist <= r or tip:
                buf[i:i + 4] = bytearray(drop)
            else:
                buf[i:i + 4] = bytearray(bg)
    return bytes(buf)

for d, s in DENS.items():
    ddir = os.path.join(OUT, "mipmap-" + d)
    os.makedirs(ddir, exist_ok=True)
    write_png(os.path.join(ddir, "ic_launcher.png"), s, s, make_icon(s))
    print("wrote", d, s)
