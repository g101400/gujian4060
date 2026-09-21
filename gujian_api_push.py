#!/usr/bin/env python3
# 通过 GitHub Git Data REST API 推送(规避本环境 git 直连被代理拦截的问题)
# 增量同步：遍历工作区、遵守 .gitignore、在现有 main 上追加一次提交。
# 用法: TOK=xxx python3 gujian_api_push.py
import os, sys, json, base64, subprocess, tempfile, datetime

REPO = "g101400/gujian-travel"
LOCAL = r"D:/Users/Claw/android-build/gujian-v31"
TOK = os.environ.get("TOK")
if not TOK:
    print("缺少 TOK 环境变量"); sys.exit(1)

MAX_BLOB = 25 * 1024 * 1024  # 跳过 >25MB 的文件（GitHub blob 上限 100MB）

def curl(method, url, body=None):
    fd, path = tempfile.mkstemp(suffix=".json"); os.close(fd)
    if body is not None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(body, f)
        data_arg = f'-d @{path}'
    else:
        data_arg = ''
    cmd = (f'curl -s -w "\\n%{{http_code}}" -X {method} '
           f'-H "Authorization: Bearer {TOK}" '
           f'-H "Accept: application/vnd.github+json" '
           f'-H "Content-Type: application/json" '
           f'{data_arg} "{url}"')
    out = subprocess.run(cmd, capture_output=True, text=True, shell=True).stdout
    if body is not None:
        os.remove(path)
    out = out.strip()
    parts = out.rsplit("\n", 1)
    code = parts[1] if len(parts) == 2 else ""
    payload = parts[0]
    try:
        j = json.loads(payload) if payload else {}
    except Exception:
        j = {"_raw": payload}
    return int(code) if code.isdigit() else -1, j

def is_ignored(abspath):
    r = subprocess.run(["git", "-C", LOCAL, "check-ignore", "-q", abspath],
                       capture_output=True, shell=True)
    return r.returncode == 0

def collect_files():
    out = []
    for dp, dns, fns in os.walk(LOCAL):
        dns[:] = [d for d in dns if d != ".git"]
        for fn in fns:
            ab = os.path.join(dp, fn)
            rel = os.path.relpath(ab, LOCAL).replace(os.sep, "/")
            if is_ignored(ab):
                continue
            sz = os.path.getsize(ab)
            if sz > MAX_BLOB:
                print(f"  ⚠️ 跳过超大文件 {rel} ({sz//1024//1024}MB)"); continue
            out.append((rel, ab, sz))
    out.sort()
    return out

print("== 0) 收集工作区文件(遵守 .gitignore) ==")
files = collect_files()
total = sum(s for _, _, s in files)
print(f"  共 {len(files)} 个文件, 总 {total//1024}KB")

print("== 1) 取得 main 当前 SHA(空仓库则 bootstrap) ==")
code, j = curl("GET", f"https://api.github.com/repos/{REPO}/git/refs/heads/main")
if code == 200 and "object" in j:
    base = j["object"]["sha"]
    print("  main 现有:", base)
elif code == 404:
    readme = open(os.path.join(LOCAL, "README.md"), "r", encoding="utf-8").read()
    code, j = curl("PUT", f"https://api.github.com/repos/{REPO}/contents/README.md",
                  {"message": "init: bootstrap", "content": base64.b64encode(readme.encode()).decode()})
    print("  bootstrap HTTP", code, j.get("commit", {}).get("sha", j.get("message")))
    if code not in (200, 201) or "commit" not in j:
        print("  bootstrap 失败:", j); sys.exit(1)
    base = j["commit"]["sha"]
else:
    print("  获取 main 失败:", code, j); sys.exit(1)

print("== 2) 上传 blob ==")
entries = []
for rel, ab, sz in files:
    with open(ab, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    code, j = curl("POST", f"https://api.github.com/repos/{REPO}/git/blobs",
                  {"content": b64, "encoding": "base64"})
    if code not in (200, 201) or "sha" not in j:
        print("  blob 失败", rel, code, j); sys.exit(1)
    entries.append((rel, "100644", j["sha"]))
    print(f"  + {rel} ({sz//1024}KB)")

print("== 3) 建 tree ==")
tree = [{"path": p, "mode": m, "type": "blob", "sha": s} for (p, m, s) in entries]
code, j = curl("POST", f"https://api.github.com/repos/{REPO}/git/trees", {"tree": tree})
print("  tree HTTP", code, j.get("sha"))
if code not in (200, 201) or "sha" not in j:
    print("  tree 失败:", j); sys.exit(1)
tree_sha = j["sha"]

print("== 4) 建 commit ==")
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
msg = f"chore: 同步古建三端四平台工程（含 Win/UOS 原生壳源码）{now[:10]}"
code, j = curl("POST", f"https://api.github.com/repos/{REPO}/git/commits",
              {"message": msg, "tree": tree_sha, "parents": [base],
               "author": {"name": "g101400", "email": "g101400@users.noreply.github.com", "date": now},
               "committer": {"name": "g101400", "email": "g101400@users.noreply.github.com", "date": now}})
print("  commit HTTP", code, j.get("sha"))
if code not in (200, 201) or "sha" not in j:
    print("  commit 失败:", j); sys.exit(1)
commit_sha = j["sha"]

print("== 5) 更新 main 引用 ==")
code, j = curl("PATCH", f"https://api.github.com/repos/{REPO}/git/refs/heads/main",
              {"sha": commit_sha, "force": True})
print("  ref HTTP", code, j.get("message", j.get("ref")))
if code not in (200, 201):
    print("  ref 失败:", j); sys.exit(1)

print("== 完成 == 远程 main =", commit_sha)
print(commit_sha)
