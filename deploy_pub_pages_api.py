#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""deploy_pub_pages_api.py — 通过 GitHub Git Data API 部署 gh-pages 分支

背景：本环境代理禁止 git 对 github.com 的 CONNECT（push/clone 均失败），
      但 api.github.com 可达，故改用 REST Git Data API 提交。
流程：blob(逐文件) -> tree -> commit -> update-ref
"""
import os, sys, json, base64, subprocess, urllib.request, urllib.error

ROOT = r"D:/Users/Claw"
PUB = os.path.join(ROOT, "github_staging_v376", "pub_pages")
GH = r"C:/Program Files/GitHub CLI/gh.exe"
OWNER = "g101400"
API = "https://api.github.com"

JOBS = [
    ("shuili-yitu-5090pub", "水利工程一张图 公开测试版 v3.77 (2026-09-16)"),
    ("ganzhi-yitu-5090pub", "水利感知项目一张图 公开测试版 v1.53 (2026-09-16)"),
]

SKIP_DIRS = {".git", "__pycache__"}


def get_token():
    r = subprocess.run([GH, "auth", "token"], capture_output=True, text=True)
    return (r.stdout or "").strip()


def api(tok, method, path, payload=None, raw=False):
    url = API + path
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + tok)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "pub-pages-deploy")
    if payload is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            body = r.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:500]
        raise RuntimeError("%s %s -> %d %s" % (method, path, e.code, body))


def collect(d):
    out = []
    for root, dirs, files in os.walk(d):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            p = os.path.join(root, f)
            rel = os.path.relpath(p, d).replace("\\", "/")
            out.append((rel, p))
    return out


def deploy(tok, repo, msg, d):
    print("=" * 66)
    print("[%s]" % repo)
    files = collect(d)
    print("  待提交 %d 个文件, 合计 %.1f MB" %
          (len(files), sum(os.path.getsize(p) for _, p in files) / 1048576))

    # 1) 当前 gh-pages 最新 commit（作为 parent）
    parent = None
    try:
        ref = api(tok, "GET", "/repos/%s/%s/git/ref/heads/gh-pages" % (OWNER, repo))
        parent = ref["object"]["sha"]
        print("  已存在 gh-pages, parent = %s" % parent[:10])
    except Exception as e:
        print("  gh-pages 不存在或无内容，将作为首个提交")

    # 2) blobs
    tree = []
    for i, (rel, p) in enumerate(files, 1):
        raw = open(p, "rb").read()
        b = api(tok, "POST", "/repos/%s/%s/git/blobs" % (OWNER, repo),
                {"content": base64.b64encode(raw).decode("ascii"), "encoding": "base64"})
        tree.append({"path": rel, "mode": "100644", "type": "blob", "sha": b["sha"]})
        if i % 10 == 0 or i == len(files):
            print("    blob %d/%d" % (i, len(files)))

    # 3) tree
    tp = {"tree": tree}
    if parent:
        tp["base_tree"] = parent
    t = api(tok, "POST", "/repos/%s/%s/git/trees" % (OWNER, repo), tp)

    # 4) commit
    cp = {"message": msg, "tree": t["sha"]}
    if parent:
        cp["parents"] = [parent]
    c = api(tok, "POST", "/repos/%s/%s/git/commits" % (OWNER, repo), cp)
    print("  commit = %s" % c["sha"][:10])

    # 5) update ref
    if parent:
        api(tok, "PATCH", "/repos/%s/%s/git/refs/heads/gh-pages" % (OWNER, repo),
            {"sha": c["sha"], "force": True})
    else:
        api(tok, "POST", "/repos/%s/%s/git/refs" % (OWNER, repo),
            {"ref": "refs/heads/gh-pages", "sha": c["sha"]})
    print("  ✅ https://%s.github.io/%s/" % (OWNER, repo))
    return True


def main():
    tok = get_token()
    if not tok:
        print("[FATAL] 无 gh token"); return 1
    ok = True
    for repo, msg in JOBS:
        d = os.path.join(PUB, repo)
        if not os.path.isdir(d):
            print("[FATAL] 缺目录 %s" % d); ok = False; continue
        try:
            deploy(tok, repo, msg, d)
        except Exception as e:
            print("  [FAIL] %s" % e); ok = False
    print("\n结果:", "全部成功" if ok else "存在失败")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
