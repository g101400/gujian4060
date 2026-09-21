#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复 09-01 b103 坐标更新时丢失的逗号：b103 与 b104 之间缺 ',' 导致 SHUILI_DATA 解析失败。
仅修复 4 个活动 water webroot（备份/归档目录不动）。修复后 JSON.parse 校验。"""
import os, json, io

BASE = "D:/Users/Claw"
FILES = [
    "android-build/shuili-v329/assets/data.js",
    "android-build/water-v329/assets/data.js",
    "native-shell/uos-water-pyqt6/webroot/data.js",
    "native-shell/win-water-webview2/webroot/data.js",
]
BAD = '"lat": 40.336104} {"id": "b104"'
GOOD = '"lat": 40.336104}, {"id": "b104"'

def parse_array(src):
    i = src.index("window.SHUILI_DATA =")
    arr = src[i + len("window.SHUILI_DATA ="):].strip()
    arr = arr.rstrip(";").strip()
    return json.loads(arr)

for rel in FILES:
    fp = os.path.join(BASE, rel)
    if not os.path.exists(fp):
        print(f"[SKIP] {rel}: 不存在")
        continue
    raw = io.open(fp, encoding="utf-8").read()
    # 先确认确为坏文件
    try:
        parse_array(raw); print(f"[OK-ALREADY] {rel}: 已合法，无需修"); continue
    except Exception as e:
        pass
    assert BAD in raw, f"{rel} 未找到损坏特征串（{BAD}）；请人工核对"
    # 仅替换一处（b103→b104 唯一）
    new = raw.replace(BAD, GOOD, 1)
    assert new != raw, f"{rel} 替换无效"
    io.open(fp, "w", encoding="utf-8").write(new)
    try:
        n = len(parse_array(new))
        print(f"[FIXED] {rel}: 逗号已补，SHUILI_DATA 解析成功，条目数={n}")
    except Exception as e:
        print(f"[STILL-BAD] {rel}: {e}")
