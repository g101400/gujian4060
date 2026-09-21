#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_v345_cover.py — v3.45 三端综合封面色块（900×383）"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = r"C:/Users/admin/.workbuddy/skills/baoyu-wechat-draft/outputs/v345-release-20260830/covers"
os.makedirs(OUT, exist_ok=True)
W, H = 900, 383

FONT_BD = r"C:/Windows/Fonts/msyhbd.ttc"
FONT_RG = r"C:/Windows/Fonts/msyh.ttc"

# 三端色：水利蓝 + 感知绿 + 古建橙 三色并排展示
COL_SHUILI = (35, 84, 158)    # 水利-深蓝
COL_PERC   = (38, 132, 80)    # 感知-青绿
COL_GUJIAN = (198, 92, 38)    # 古建-橙棕
COL_BG_L   = (240, 244, 250)  # 浅蓝灰
COL_BG_R   = (252, 246, 238)  # 浅米黄


def gradient(c1, c2):
    img = Image.new("RGB", (W, H), c1)
    px = img.load()
    for y in range(H):
        t = y / H
        col = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
        for x in range(W):
            px[x, y] = col
    return img


def text(draw, xy, txt, font, fill, anchor="lt"):
    draw.text(xy, txt, font=font, fill=fill, anchor=anchor)


def make_cover():
    img = gradient(COL_BG_L, COL_BG_R)
    d = ImageDraw.Draw(img, "RGBA")

    # 主标
    f_t1 = ImageFont.truetype(FONT_BD, 56)
    text(d, (W // 2, 36), "v3.45 / v1.21 / v3.3 三端同步",
         f_t1, (40, 50, 70), "mt")
    f_sub = ImageFont.truetype(FONT_RG, 26)
    text(d, (W // 2, 96), "水利 · 感知 · 古建  5 日智能化更新深度同步",
         f_sub, (95, 105, 125), "mt")

    # 三端色块
    y0, h_box = 160, 130
    block_w = 240
    gap = (W - 3 * block_w) // 4
    centers = [gap + block_w // 2 + i * (block_w + gap) for i in range(3)]
    labels = [
        ("水利", "v3.45", "水工建筑物", "内部应用", COL_SHUILI),
        ("感知", "v1.21", "感知设备", "内部应用", COL_PERC),
        ("古建", "v3.3",  "古建景点", "公共受众", COL_GUJIAN),
    ]
    for cx, lab in zip(centers, labels):
        name, ver, core, audience, col = lab
        # 色块圆角矩形
        radius = 16
        box = (cx - block_w // 2, y0, cx + block_w // 2, y0 + h_box)
        d.rounded_rectangle(box, radius=radius, fill=col + (235,))
        # 大字名字
        f_name = ImageFont.truetype(FONT_BD, 36)
        text(d, (cx, y0 + 24), name, f_name, (255, 255, 255), "mt")
        # 版本
        f_ver = ImageFont.truetype(FONT_BD, 24)
        text(d, (cx, y0 + 66), ver, f_ver, (255, 245, 230), "mt")
        # 副标题两行
        f_d = ImageFont.truetype(FONT_RG, 18)
        text(d, (cx, y0 + 95), core, f_d, (255, 245, 230), "mt")
        text(d, (cx, y0 + 116), audience, f_d, (255, 230, 200), "mt")

    # 底部斜条副信息
    f_foot = ImageFont.truetype(FONT_RG, 15)
    text(d, (W // 2, 322),
         "🗝 天地图密钥可改  ·  🎚 管理处可多选  ·  📤 导出 guanchu  ·  📦 zip longest-match  ·  ⭐ 快捷常用  ·  ✕ 三击空白呼主菜单",
         f_foot, (90, 100, 120), "mt")
    text(d, (W // 2, 354), "2026-08-30  ·  四端同步 · 微信小程序 baseline v3.45",
         f_foot, (120, 130, 145), "mt")

    out = os.path.join(OUT, "01-release.png")
    img.save(out, "PNG", optimize=True)
    print(f"✅ saved: {out} ({os.path.getsize(out)//1024}KB)")


make_cover()
