#!/usr/bin/env python3
# 通过 GitHub Git Data REST API 推送（规避本环境 git 直连被代理拦截的问题）
#
# 用法（任选其一）：
#   1) 环境变量传 token（推荐，最干净）：
#        TOK=ghp_xxx python3 tools/gujian_api_push.py
#   2) 把 token 写进仓库根目录的 .gujian_token（每行一条，已被 .gitignore 忽略，绝不入库）：
#        echo "ghp_xxx" > .gujian_token
#        python3 tools/gujian_api_push.py
#   3) 也支持 .env 文件（同目录或仓库根，键名 GUJIAN_GITHUB_TOKEN，已被忽略）。
#
# 增量同步：遍历工作区、遵守 .gitignore、在现有 main 上追加一次提交。
# 路径自推算（脚本位于 仓库根/tools/），克隆到任何机器都能直接用，无需改路径。
import os, sys, json, base64, subprocess, tempfile, datetime

REPO = "g101400/gujian-travel5090"  # 目标仓库（公开，5090 命名）

# LOCAL 默认 = 脚本所在目录的上一级（即仓库根）；可用环境变量 LOCAL 覆盖。
_HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL = os.environ.get("LOCAL") or os.path.dirname(_HERE)

def load_token():
    # 优先级：环境变量 TOK > 仓库根 .gujian_token（首行）> 同目录/.env、仓库根/.env
    tok = os.environ.get("TOK")
    if tok:
        return tok.strip()
    candidates = [
        os.path.join(LOCAL, ".gujian_token"),
        os.path.join(_HERE, ".env"),
        os.path.join(LOCAL, ".env"),
    ]
    for p in candidates:
        if os.path.isfile(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        # 支持 .env 的 KEY=VALUE 形式
                        if "=" in line:
                            k, v = line.split("=", 1)
                            if k.strip() == "GUJIAN_GITHUB_TOKEN":
                                return v.strip()
                        else:
                            return line  # 纯 token 行（.gujian_token）
            except Exception:
                continue
    return None

TOK = load_token()
if not TOK:
    print("缺少 GitHub Token。请用以下任一方式提供：")
    print("  TOK=xxx python3 tools/gujian_api_push.py")
    print("  或把 token 写入仓库根 .gujian_token（已被 .gitignore 忽略，不会入库）")
    sys.exit(1)

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
print("  LOCAL =", LOCAL)
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
msg = f"chore: 同步古建三端四平台工程（含原生壳源码）{now[:10]}"
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
