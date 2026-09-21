#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""derive_public_v377.py — 公开奇数通道派生（水利 3.77 / 感知 1.53）

流程（每端）：
  1) 备份 version.json / app.js（md5 快照，保证可回滚）
  2) strip_internal.py <webroot> --public     真实数据 -> 脱敏 demo
  3) 提升版本号到奇数公开版 + 追加 desc
  4) build_ios_zip.py <key>                   产出可托管 PWA zip
  5) 还原：strip --restore + 还原 version.json / app.js
  6) 校验 md5 与初始快照一致（不一致直接报错）

古建为单通道（公开数据同内部），不参与本流程。
"""
import os, io, json, shutil, hashlib, subprocess, sys, time

ROOT = r"D:/Users/Claw"
DATE = "2026-09-16"
BAK = r"C:/tmp/pub_bump_backup"
PUB_OUT = os.path.join(ROOT, "github_staging_v376", "pub_pages")

# key -> (webroot, 内部版, 内部code, 公开版, 公开code, desc)
PROJECTS = {
    "shuili": dict(
        webroot=os.path.join(ROOT, "native-shell/win-water-webview2/webroot"),
        intv="3.76", intc=76, pubv="3.77", pubc=77,
        desc="v3.77：公开测试版（与感知 v1.53 同批，脱敏演示数据）——功能与内部版 v3.76 完全一致："
             "①智能推荐复用 kbHybridSearch/KBRag 混合检索（向量0.45+BM250.35+模糊0.20，权重可学习）；"
             "②KB 属性结构化索引；③RAG 引用溯源（chunk 高亮+置信度）；④向量索引增量构建（启动提速）；"
             "⑤KB 多源冲突裁决；⑥query→推荐→报告→KB 闭环；⑦统信运行慢优化（首屏优先渲染+延迟非关键初始化）。"
             "本包为公开演示渠道，内置脱敏演示种子数据，不含单位内部真实数据。",
    ),
    "perc": dict(
        webroot=os.path.join(ROOT, "native-shell/win-webview2/webroot"),
        intv="1.52", intc=52, pubv="1.53", pubc=53,
        desc="v1.53：公开测试版（与水利 v3.77 同批，脱敏演示数据）——功能与内部版 v1.52 完全一致："
             "①智能推荐复用 kbHybridSearch/KBRag 混合检索；②KB 属性结构化索引；③RAG 引用溯源；"
             "④向量索引增量构建；⑤KB 多源冲突裁决；⑥query→推荐→报告→KB 闭环；⑦统信运行慢优化。"
             "水工建筑物底图种子沿用 557 条。本包为公开演示渠道，内置脱敏演示种子数据，不含单位内部真实数据。",
    ),
}


def md5(p):
    return hashlib.md5(io.open(p, "rb").read()).hexdigest()


def run(cmd, cwd=ROOT):
    print("  $ " + " ".join(cmd))
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.stdout.strip():
        print("    " + r.stdout.strip().replace("\n", "\n    "))
    if r.returncode != 0:
        print("    [STDERR] " + (r.stderr or "").strip()[:2000])
    return r.returncode


def main():
    os.makedirs(BAK, exist_ok=True)
    os.makedirs(PUB_OUT, exist_ok=True)
    produced = []

    for key, cfg in PROJECTS.items():
        w = cfg["webroot"]
        print("\n" + "=" * 70)
        print("[%s] webroot = %s" % (key, w))
        if not os.path.isdir(w):
            print("[FATAL] 目录不存在"); return 1

        vj = os.path.join(w, "version.json")
        aj = os.path.join(w, "app.js")

        # 1) 备份 + md5 快照
        kbak = os.path.join(BAK, key)
        if os.path.isdir(kbak): shutil.rmtree(kbak)
        os.makedirs(kbak)
        snap = {}
        for name, p in (("version.json", vj), ("app.js", aj)):
            if os.path.exists(p):
                shutil.copy2(p, os.path.join(kbak, name))
                snap[name] = md5(p)
        print("  快照: " + ", ".join("%s=%s" % (k, v[:8]) for k, v in snap.items()))

        try:
            # 2) 脱敏
            print("  -- strip --public --")
            rc = run([sys.executable, os.path.join(ROOT, "strip_internal.py"), w, "--public"])
            if rc != 0: print("  [WARN] strip 返回 %d" % rc)

            # 3) 提版
            d = json.load(io.open(vj, encoding="utf-8"))
            assert d["version"] == cfg["intv"], "版本基线不符: %s != %s" % (d["version"], cfg["intv"])
            d["version"] = cfg["pubv"]
            d["versionCode"] = cfg["pubc"]
            d["buildDate"] = DATE
            d["desc"] = (d.get("desc") or "") + cfg["desc"]
            io.open(vj, "w", encoding="utf-8", newline="").write(
                json.dumps(d, ensure_ascii=False, indent=2))

            s = io.open(aj, encoding="utf-8").read()
            old_v = 'var APP_VERSION = "%s";' % cfg["intv"]
            new_v = 'var APP_VERSION = "%s";' % cfg["pubv"]
            n = s.count(old_v)
            if n != 1:
                print("  [FATAL] app.js APP_VERSION 命中 %d 次（期望 1）" % n); return 1
            s = s.replace(old_v, new_v)
            io.open(aj, "w", encoding="utf-8", newline="").write(s)
            print("  提版: %s -> %s (code %d -> %d)" % (cfg["intv"], cfg["pubv"], cfg["intc"], cfg["pubc"]))

            # 4) 构建 PWA
            print("  -- build_ios_zip --")
            rc = run([sys.executable, os.path.join(ROOT, "native-shell/water-ios/build_ios_zip.py"), key])
            if rc != 0:
                print("  [FATAL] PWA 构建失败"); return 1
        finally:
            # 5) 无论如何都还原
            print("  -- restore --")
            run([sys.executable, os.path.join(ROOT, "strip_internal.py"), w, "--restore"])
            for name in ("version.json", "app.js"):
                src = os.path.join(kbak, name)
                if os.path.exists(src):
                    shutil.copy2(src, os.path.join(w, name))

        # 6) 校验回滚完整
        ok = True
        for name, h in snap.items():
            cur = md5(os.path.join(w, name))
            flag = "OK " if cur == h else "FAIL"
            if cur != h: ok = False
            print("  [%s] %s 还原 %s (%s)" % (flag, name, h[:8], cur[:8]))
        if not ok:
            print("  [FATAL] canonical 未完全还原，请检查 .strip_backup"); return 1

        produced.append((key, cfg["pubv"]))

    print("\n" + "=" * 70)
    print("派生完成: " + ", ".join("%s=%s" % p for p in produced))
    return 0


if __name__ == "__main__":
    sys.exit(main())
