#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audit_menu_handlers.py — 三图家族「菜单入口函数未定义」审计
（直接回答用户需求①②③：导出建筑物表格 / 导出照片 / 其他菜单 是否 script error）

原理：点击菜单项会调用其 `f:` 处理器，或页面内 onclick="XXX(" 触发的函数；
若该函数未定义 → WebView 报 "运行错误：script error"。
本脚本扫描每个 app.js / ai_module.js：
  1. 收集所有已定义函数名（function X( / window.X = / var X = function / X = function）
  2. 收集菜单 `f: IDENT` 处理器 与 所有 onclick="IDENT(" 引用
  3. 报告任何「被引用但未定义」的标识符（疑似 script error 根因）
仅做静态审计，不修改源码。
"""
import os, re, sys

BASE = "D:/Users/Claw"
TARGETS = [
    "android-build/water-v329/assets/app.js",
    "android-build/perc-v13/assets/app.js",
    "android-build/shuili-v329/assets/app.js",
    "android-build/gujian-v31/assets/app.js",
    "travel/android/assets/app.js",
    "android-build/water-v329/assets/ai_module.js",
    "android-build/perc-v13/assets/ai_module.js",
    "android-build/gujian-v31/assets/ai_module.js",
]

# 浏览器/运行环境已知全局（调用它们不算「未定义」）
ENV_GLOBALS = {
    "window","document","location","navigator","localStorage","sessionStorage","console",
    "setTimeout","clearTimeout","setInterval","clearInterval","requestAnimationFrame",
    "fetch","XMLHttpRequest","Image","Blob","URL","alert","confirm","prompt","JSON",
    "Math","Date","Object","Array","String","Number","Boolean","RegExp","Error","Promise",
    "Map","Set","Symbol","parseInt","parseFloat","isNaN","isFinite","encodeURIComponent",
    "decodeURIComponent","encodeURI","decodeURI","eval","Function","Proxy","Reflect",
    "JSZip","L","leaflet","toast","ask","busy","idle","$","_logErr","openSheet","closeSheet",
    "getElementById","documentFragment","addEventListener","removeEventListener","webkit",
    "cordova","Android","plus","uni","wx","app","GB","globalData","CFG","API","window",
    "BUILDINGS","SHUILI_DATA","PERCEPTION_DATA","GUJIAN_DATA","SCENERY","HERITAGE",
    "DATA","KB","aiModuleGlobal","__dirname","module","exports","process","Buffer",
    "setImmediate","queueMicrotask","TextEncoder","TextDecoder","btoa","atob","FileReader",
    "File","FormData","self","globalThis","CSS","getComputedStyle","MutationObserver",
    "IntersectionObserver","WebSocket","EventSource","Worker","crypto","performance",
}

def defined_names(src):
    names = set()
    for m in re.finditer(r'function\s+([A-Za-z_$][\w$]*)\s*\(', src):
        names.add(m.group(1))
    for m in re.finditer(r'(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:function|\()', src):
        names.add(m.group(1))
    for m in re.finditer(r'window\.([A-Za-z_$][\w$]*)\s*=', src):
        names.add(m.group(1))
    for m in re.finditer(r'(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*=\s*function\b', src):
        names.add(m.group(1))
    return names

def menu_f_handlers(src):
    """提取菜单配置中的 f: IDENT 处理器"""
    out = []
    for m in re.finditer(r'\bf:\s*([A-Za-z_$][\w$]*)\b', src):
        out.append(m.group(1))
    return out

def onclick_refs(src):
    out = []
    for m in re.finditer(r'onclick="([A-Za-z_$][\w$]*)\s*\(', src):
        out.append(m.group(1))
    for m in re.finditer(r'onchange="([A-Za-z_$][\w$]*)\s*\(', src):
        out.append(m.group(1))
    return out

def audit(path):
    full = os.path.join(BASE, path)
    if not os.path.exists(full):
        return [(path, "SKIP", "文件不存在")]
    src = open(full, encoding="utf-8", errors="replace").read()
    defs = defined_names(src)
    refs = set(menu_f_handlers(src)) | set(onclick_refs(src))
    findings = []
    for r in sorted(refs):
        if r in ENV_GLOBALS:
            continue
        if r in defs:
            continue
        # 可能是对象方法调用（如 API.xxx / obj.method）已在上文 window. 捕获；此处仅报告裸调用
        findings.append(r)
    return [(path, "OK" if not findings else "RISK", findings)]

def main():
    total_risk = 0
    for p in TARGETS:
        res = audit(p)
        for path, status, info in [res] if isinstance(res, tuple) else res:
            if status == "SKIP":
                print(f"[SKIP] {path}: {info}")
            elif status == "OK":
                print(f"[OK]   {path}: 菜单/按钮处理器全部已定义")
            else:
                total_risk += 1
                print(f"[RISK] {path}: 以下被引用但未定义（疑似 script error 根因）:")
                for name in info:
                    print(f"        - {name}")
    print(f"\n=== 审计结论：发现 {total_risk} 个文件存在疑似未定义菜单处理器 ===")
    sys.exit(1 if total_risk else 0)

if __name__ == "__main__":
    main()
