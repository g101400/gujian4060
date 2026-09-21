#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""deploy_pub_pages.py — 把已脱敏的公开 PWA 部署到 GitHub Pages（gh-pages 分支）

用法: python3 deploy_pub_pages.py
"""
import os, sys, subprocess, io

ROOT = r"D:/Users/Claw"
PUB = os.path.join(ROOT, "github_staging_v376", "pub_pages")
GH = r"C:/Program Files/GitHub CLI/gh.exe"
OWNER = "g101400"

JOBS = [
    ("shuili-yitu-5090pub", "水利工程一张图 公开测试版 v3.77 (2026-09-16)"),
    ("ganzhi-yitu-5090pub", "水利感知项目一张图 公开测试版 v1.53 (2026-09-16)"),
]


def run(cmd, cwd, env=None):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
                       encoding="utf-8", errors="replace", env=env)
    out = (r.stdout or "").strip()
    err = (r.stderr or "").strip()
    if out: print("    | " + out.replace("\n", "\n    | "))
    if err and r.returncode != 0: print("    ! " + err[:800])
    return r.returncode


def main():
    # 取 token 做免交互推送
    r = subprocess.run([GH, "auth", "token"], capture_output=True, text=True)
    token = (r.stdout or "").strip()
    if not token:
        print("[FATAL] 无法获取 gh token"); return 1

    env = dict(os.environ)
    for repo, msg in JOBS:
        d = os.path.join(PUB, repo)
        print("=" * 66)
        print("[%s] %s" % (repo, d))
        if not os.path.isdir(d):
            print("  [FATAL] 目录不存在"); return 1

        # Pages 不需要 Jekyll 处理
        io.open(os.path.join(d, ".nojekyll"), "w").write("")

        url = "https://%s@github.com/%s/%s.git" % (token, OWNER, repo)
        steps = [
            (["git", "init", "-q", "-b", "gh-pages"], "init"),
            (["git", "add", "-A"], "add"),
            (["git", "-c", "user.email=bot@local", "-c", "user.name=release-bot",
              "commit", "-q", "-m", msg], "commit"),
            (["git", "remote", "remove", "origin"], "remote-rm"),
            (["git", "remote", "add", "origin", url], "remote-add"),
            (["git", "push", "-q", "--force", "origin", "gh-pages"], "push"),
        ]
        for cmd, name in steps:
            rc = run(cmd, d, env)
            if name == "remote-rm" and rc != 0:
                continue  # 首次无 origin，忽略
            if rc != 0:
                print("  [FATAL] 步骤 %s 失败 (rc=%d)" % (name, rc)); return 1
        print("  ✅ 已推送 gh-pages -> https://%s.github.io/%s/" % (OWNER, repo))

    print("\n全部公开 Pages 部署完成")
    return 0


if __name__ == "__main__":
    sys.exit(main())
