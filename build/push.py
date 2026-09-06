#!/usr/bin/env python3
# 经 GitHub REST 内容 API 推送古建代码（仓库内、路径相对化，可在任意机运行）
#
# 背景：本机不通 github.com:443（git push/clone 连接失败），但 api.github.com REST 可达，
# 故用 REST 内容 API（PUT /repos/{o}/{r}/contents/{path}，base64 内容）代替 git push。
#
# 用法：python build/push.py
#   - ROOT 由本脚本位置推导（<repo>/build/push.py 的上级 = gujian_app 根），与机器无关
#   - Token 优先级：环境变量 GITHUB_TOKEN / GH_TOKEN → 本地 token 文件（GITHUB_TOKEN_FILE 指定，默认 D:/Users/WorkBuddy/.github_token）
#   - 枚举 git 追踪 + 未追踪(且未被忽略) 的全部文件，幂等上传（已存在则跳过）
import os, sys, base64, json, subprocess, urllib.request, urllib.error, urllib.parse

# 仓库标识（古建单通道，g101400 账号下）
REPO = 'g101400/gujian4060'

# ROOT = 仓库根：本脚本位于 <repo>/build/push.py，上级目录即 gujian_app 根
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_token():
    for k in ('GITHUB_TOKEN', 'GH_TOKEN'):
        v = os.environ.get(k)
        if v:
            return v.strip()
    p = os.environ.get('GITHUB_TOKEN_FILE', r'D:/Users/WorkBuddy/.github_token')
    if os.path.isfile(p):
        return open(p, encoding='utf-8').read().strip()
    sys.exit('未找到 GitHub Token：请设置环境变量 GITHUB_TOKEN，或将 token 写入 %s' % p)


TOKEN = load_token()


def api(path, method='GET', data=None):
    url = 'https://api.github.com/repos/%s/contents/%s' % (REPO, urllib.parse.quote(path, safe=''))
    body = json.dumps(data).encode('utf-8') if data is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('Authorization', 'Bearer %s' % TOKEN)
    req.add_header('Accept', 'application/vnd.github+json')
    req.add_header('Content-Type', 'application/json')
    req.add_header('X-GitHub-Api-Version', '2022-11-28')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')


# --cached --others --exclude-standard：同时枚举「已追踪 + 未追踪且未被忽略」文件，
# 这样本地未提交的新增文件也能被推送，而 .gitignore 的密钥/产物永不入库
# -z 输出 NUL 分隔且为 UTF-8 原始字节，避免 Windows 控制台 GBK 编码导致中文路径错位
out = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=ROOT)
files = [f for f in out.decode('utf-8').split('\x00') if f]
added = updated = fail = skip = 0
for f in files:
    p = os.path.join(ROOT, f)
    if not os.path.isfile(p):
        print('SKIP(缺失) %s' % f)
        skip += 1
        continue
    with open(p, 'rb') as fh:
        b64 = base64.b64encode(fh.read()).decode('ascii')
    # 比对 GitHub 现有内容：不存在则新增；存在且内容相同则跳过；存在但不同则带 sha 更新
    # （内容比对保证「本地修改也能同步更新」，而非仅首次新增）
    st, body = api(f, 'GET')
    if st == 200:
        try:
            remote = json.loads(body)
            if remote.get('content') == b64 and remote.get('encoding', 'base64') == 'base64':
                print('SKIP(未变) %s' % f)
                skip += 1
                continue
            sha = remote.get('sha')
        except Exception:
            sha = None
        payload = {'message': 'update %s' % f, 'content': b64}
        if sha:
            payload['sha'] = sha
        st2, body2 = api(f, 'PUT', payload)
        if st2 in (200, 201):
            updated += 1
            print('UPDATE %s' % f)
        else:
            fail += 1
            msg = ''
            try:
                msg = json.loads(body2).get('message', '')
            except Exception:
                msg = body2[:120]
            print('FAIL %s -> %s %s' % (f, st2, msg))
    elif st == 404:
        st2, body2 = api(f, 'PUT', {'message': 'add %s' % f, 'content': b64})
        if st2 in (200, 201):
            added += 1
            print('ADD  %s' % f)
        else:
            fail += 1
            msg = ''
            try:
                msg = json.loads(body2).get('message', '')
            except Exception:
                msg = body2[:120]
            print('FAIL %s -> %s %s' % (f, st2, msg))
    else:
        fail += 1
        print('FAIL %s -> GET %s' % (f, st))
print('\n完成：新增 %d / 更新 %d / 跳过 %d / 失败 %d / 共 %d' % (added, updated, skip, fail, len(files)))
sys.exit(1 if fail else 0)
