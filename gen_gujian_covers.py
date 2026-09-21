#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_gujian_covers.py — 古建系列 5 篇 PIL 品牌化封面（900×383）"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = r"C:/Users/admin/.workbuddy/skills/baoyu-wechat-draft/outputs/gujian-series-20260830/covers"
os.makedirs(OUT, exist_ok=True)
W, H = 900, 383

FONT_BD = r"C:/Windows/Fonts/msyhbd.ttc"
FONT_RG = r"C:/Windows/Fonts/msyh.ttc"

# 暖橙古建配色：所有封面打头都是暖暖的米黄/橙棕
SPECS = [
    # (file, c1, c2, accent, 主标, 副标, 角标, motif_name)
    ("01-manual",   (122, 76, 42),  (210, 142, 89), (255, 235, 200), "完全功能手册", "基本 · 扩展 · 高级 三级导读", "v3.1", "menu"),
    ("02-prompts",  (90, 47, 27),   (192, 110, 60), (255, 245, 220), "AI 提示词全公开", "7 组原文 · 原文可抄", "提示词工程", "prompt"),
    ("03-versions", (200, 91, 23),  (244, 178, 92), (255, 245, 220), "v1.7 → v3.1 进化史", "16 个版本复盘", "版本志", "timeline"),
    ("04-pitfalls", (78, 42, 18),   (146, 90, 51), (255, 220, 160),  "踩坑实录 16 坑", "deb / 数据 / UI / AI 四分类", "开发手记", "pit"),
    ("05-kb",       (108, 60, 32),  (190, 130, 75), (255, 230, 195), "软件工程沉淀", "文档 + 记忆 + 自我学习", "方法论", "book"),
]

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def gradient(c1, c2):
    img = Image.new("RGB", (W, H), c1)
    px = img.load()
    for y in range(H):
        t = y / max(1, H - 1)
        c = lerp(c1, c2, t)
        for x in range(W):
            px[x, y] = c
    return img

def motif(im, kind, accent):
    d = ImageDraw.Draw(im)
    if kind == "menu":
        # 三层卡片叠加
        for i, (x, dx, dy) in enumerate([(200, 0, 0), (240, 30, 20), (280, 60, 40)]):
            d.rounded_rectangle((x, 60+dy, x+330, 320+dy), radius=14, fill=(255, 255, 255, 220))
            d.rounded_rectangle((x, 60+dy, x+330, 100+dy), radius=14, fill=accent)
            for j in range(4):
                d.rounded_rectangle((x+24, 130+dy+j*42, x+310, 162+dy+j*42), radius=4, fill=accent + (50,))
    elif kind == "prompt":
        # 对话气泡
        d.ellipse((110, 80, 280, 230), fill=(255, 250, 235), outline=accent, width=3)
        d.polygon(((170, 220, 190, 270, 240, 230)), fill=(255, 250, 235))
        d.rounded_rectangle((310, 100, 820, 320), radius=18, fill=(255, 245, 220), outline=accent, width=3)
        d.text((330, 116), "{ \"type\": \"system\", \"role\": \"AI 助手\" }", font=ImageFont.truetype(FONT_RG, 14), fill=(90, 50, 30))
        d.text((330, 145), "—— 仅基于本地记录作答，不编造参数", font=ImageFont.truetype(FONT_RG, 14), fill=(90, 50, 30))
        d.text((330, 175), "—— 输出 JSON 补丁，可逐字段编辑", font=ImageFont.truetype(FONT_RG, 14), fill=(90, 50, 30))
    elif kind == "timeline":
        import math
        # 弧线时间轴
        for k in range(8):
            ang = math.pi * (0.05 + k * 0.18)
            cx = 700 + int(220 * math.cos(ang))
            cy = 200 + int(100 * math.sin(ang))
            r = 18
            d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=(255, 230, 195), outline=(255, 220, 160), width=2)
            d.text((cx-5, cy-12), f"v{1+k//2}.{k%2}", font=ImageFont.truetype(FONT_BD, 14), fill=(90, 50, 30))
        d.line((50, 200, 850, 200), fill=accent, width=3)
    elif kind == "pit":
        # 警示锥 + 裂缝
        for cx, cy, h in [(380, 280, 95), (430, 295, 130), (480, 310, 165)]:
            d.polygon([(cx-h/2, 280-h), (cx+h/2, 280-h), (cx+h/4, 280), (cx-h/4, 280)], fill=(255, 180, 90))
            d.rectangle((cx-h/3, 295, cx+h/3, 310), fill=(255, 220, 130))
            d.text((cx-8, 295+8), "!", font=ImageFont.truetype(FONT_BD, 22), fill=(255, 255, 255))
        d.line((140, 200, 300, 100), fill=(255, 255, 255), width=2)
        d.line((300, 100, 760, 220), fill=(255, 255, 255), width=2)
    elif kind == "book":
        import math
        # 拱门式的书本堆叠 + 飞檐剪影
        for k in range(3):
            d.rounded_rectangle((240+k*20, 250-k*8, 700+k*20, 320-k*8), radius=8, fill=(255, 245, 220), outline=accent, width=2)
        # 飞檐剪影（简化几何）
        d.polygon([(360, 130), (440, 100), (520, 130), (480, 130), (490, 110), (430, 110), (440, 130)], fill=accent)
        d.polygon([(560, 100), (640, 70), (720, 100), (680, 100), (690, 80), (630, 80), (640, 100)], fill=accent)
        # 银杏叶点缀
        for cx, cy, ang in [(170, 100, 0.3), (790, 80, 1.5), (160, 320, 2)]:
            d.ellipse((cx-12, cy-6, cx+12, cy+6), fill=accent)
            d.ellipse((cx-6, cy-12, cx+6, cy+12), fill=accent)

def main():
    fb, fr = ImageFont.truetype(FONT_BD, 42), ImageFont.truetype(FONT_RG, 22)
    for file, c1, c2, accent, title, sub, badge, kind in SPECS:
        im = gradient(c1, c2)
        motif(im, kind, accent)
        d = ImageDraw.Draw(im)
        d.text((28, 26), "古建景点打卡 · v3.1", font=ImageFont.truetype(FONT_BD, 16), fill=accent)
        d.text((28, 110), title, font=fb, fill=(255, 245, 220))
        d.text((28, 175), sub, font=fr, fill=(255, 245, 220))
        # 角标 pill
        d.rounded_rectangle((W-180, 28, W-28, 70), radius=20, fill=accent)
        d.text((W-168, 38), badge, font=ImageFont.truetype(FONT_BD, 22), fill=(90, 50, 30))
        out = os.path.join(OUT, file + ".png")
        im.save(out, "PNG")
        print("OK", out)

if __name__ == "__main__":
    main()
