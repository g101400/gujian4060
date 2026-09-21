#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_covers_pil.py — 用 PIL 为 6 篇系列文章生成品牌化封面（900×383，公众号 2.35:1）"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

OUT = r"C:/Users/admin/.workbuddy/skills/baoyu-wechat-draft/outputs/shuili-series-20260830/covers"
os.makedirs(OUT, exist_ok=True)
W, H = 900, 383

FONT_BD = r"C:/Windows/Fonts/msyhbd.ttc"
FONT_RG = r"C:/Windows/Fonts/msyh.ttc"

SPECS = [
    # (file, c1, c2, accent, 标题主行, 标题次行, 角标, motif)
    ("01-manual",   (13, 71, 161),  (43, 138, 93),  (255, 224, 130), "完全功能手册", "基本 · 扩展 · 高级 三级导读", "v3.41", "menu"),
    ("02-prompts",  (26, 35, 126),  (0, 137, 123),  (255, 224, 130), "AI 提示词全公开", "6 组原文 · 原文可抄", "提示词工程", "prompt"),
    ("03-versions", (191, 54, 12),  (249, 168, 37), (255, 255, 255), "版本进化史", "从 v3.15 到 v3.41", "版本志", "timeline"),
    ("04-pitfalls", (38, 50, 56),   (69, 90, 100),  (255, 171, 64),  "踩坑实录", "16 个真实坑与修复方案", "开发手记", "pit"),
    ("05-fourends", (0, 77, 64),    (43, 138, 93),  (178, 223, 219), "一套代码跑四端", "Android / Windows / UOS / iOS", "方法论", "devices"),
    ("06-uos",      (183, 28, 28),  (230, 81, 0),   (255, 205, 210), "UOS + 龙芯适配", "deb 出包的那些铁律", "信创实录", "chip"),
]

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def gradient(c1, c2):
    img = Image.new("RGB", (W, H))
    for y in range(H):
        for seg in range(1):
            pass
    # 横向渐变（对角感）：按 x+y 混合
    px = img.load()
    for y in range(H):
        for x in range(0, W, 3):
            t = min(1.0, (x / W * 0.7 + y / H * 0.3))
            c = lerp(c1, c2, t)
            for dx in range(3):
                if x + dx < W: px[x + dx, y] = c
    return img

def motif(draw, kind, accent):
    cx, cy = 720, 190
    if kind == "menu":
        for i, w in enumerate([150, 110, 130]):
            draw.rounded_rectangle([cx - 60, 70 + i * 62, cx - 60 + w, 70 + i * 62 + 40], 10, outline=accent, width=3)
            draw.ellipse([cx - 50, 82 + i * 62, cx - 38, 94 + i * 62], fill=accent)
    elif kind == "prompt":
        draw.rounded_rectangle([cx - 110, 80, cx + 130, 180], 16, outline=accent, width=4)
        f = ImageFont.truetype(FONT_BD, 34)
        draw.text((cx - 80, 105), "{ }", font=f, fill=accent)
        draw.polygon([(cx - 40, 180), (cx - 20, 180), (cx - 45, 215)], fill=accent)
    elif kind == "timeline":
        draw.line([(cx - 140, 200), (cx + 140, 120)], fill=accent, width=6)
        for i, (x, y) in enumerate([(cx - 120, 195), (cx - 40, 168), (cx + 40, 143), (cx + 120, 118)]):
            r = 16 if i < 3 else 22
            draw.ellipse([x - r, y - r, x + r, y + r], fill=accent if i == 3 else None, outline=accent, width=4)
    elif kind == "pit":
        for i in range(3):
            x = cx - 90 + i * 70
            draw.polygon([(x, 230), (x + 56, 230), (x + 28, 150)], outline=accent, width=5)
            draw.line([(x + 28, 175), (x + 28, 200)], fill=accent, width=5)
            draw.ellipse([x + 25, 206, x + 31, 212], fill=accent)
    elif kind == "devices":
        draw.rounded_rectangle([cx - 150, 130, cx - 60, 210], 8, outline=accent, width=4)
        draw.rounded_rectangle([cx - 40, 110, cx + 60, 210], 8, outline=accent, width=4)
        draw.rounded_rectangle([cx + 80, 140, cx + 130, 210], 8, outline=accent, width=4)
        draw.ellipse([cx - 12, 40, cx + 12, 64], outline=accent, width=4)
        draw.line([(cx, 64), (cx, 100)], fill=accent, width=4)
    elif kind == "chip":
        draw.rounded_rectangle([cx - 90, 110, cx + 90, 250], 14, outline=accent, width=5)
        draw.rounded_rectangle([cx - 55, 145, cx + 55, 215], 8, outline=accent, width=3)
        for i in range(6):
            y = 128 + i * 22
            draw.line([(cx - 110, y), (cx - 90, y)], fill=accent, width=4)
            draw.line([(cx + 90, y), (cx + 110, y)], fill=accent, width=4)

for name, c1, c2, accent, t1, t2, tag, mk in SPECS:
    img = gradient(c1, c2)
    d = ImageDraw.Draw(img)
    # 半透明装饰圆
    deco = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(deco)
    dd.ellipse([-80, H - 160, 260, H + 120], fill=(255, 255, 255, 14))
    dd.ellipse([W - 300, -120, W + 80, 160], fill=(255, 255, 255, 12))
    img = Image.alpha_composite(img.convert("RGBA"), deco).convert("RGB")
    d = ImageDraw.Draw(img)
    motif(d, mk, accent)
    # 左侧文字
    f_tag = ImageFont.truetype(FONT_RG, 22)
    f_t1 = ImageFont.truetype(FONT_BD, 58)
    f_t2 = ImageFont.truetype(FONT_RG, 27)
    d.rounded_rectangle([64, 60, 64 + 24 * (len(tag) + 2), 100], 8, fill=accent)
    d.text((76, 66), tag, font=f_tag, fill=c1 if sum(c1) > 260 else (255, 255, 255))
    d.text((64, 130), t1, font=f_t1, fill=(255, 255, 255))
    d.text((64, 215), t2, font=f_t2, fill=(255, 255, 255, 230) if False else (235, 240, 245))
    # 底部横带
    d.rectangle([0, H - 10, W, H], fill=accent)
    path = os.path.join(OUT, name + ".png")
    img.save(path)
    print("OK", path)

print("ALL COVERS DONE")
