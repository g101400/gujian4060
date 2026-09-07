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
import os, sys, base64, json, subprocess, time, socket, http.client
import urllib.request, urllib.error, urllib.parse

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


def api(path, method='GET', data=None, _tries=3):
    # path 为 /repos/{REPO}/ 之后的完整子路径（如 contents/foo 或 git/blobs/{sha}）
    url = 'https://api.github.com/repos/%s/%s' % (REPO, urllib.parse.quote(path, safe='/,=:'),)
    body = json.dumps(data).encode('utf-8') if data is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('Authorization', 'Bearer %s' % TOKEN)
    req.add_header('Accept', 'application/vnd.github+json')
    req.add_header('Content-Type', 'application/json')
    req.add_header('X-GitHub-Api-Version', '2022-11-28')
    # 重试：覆盖大文件(>1MB)走 git/blobs 时的瞬时断流 IncompleteRead、5xx、URLError、socket 超时/错误
    last = None
    for attempt in range(_tries):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.status, r.read().decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            code = e.code
            try:
                rb = e.read().decode('utf-8', 'replace')
            except Exception:
                rb = ''
            # 5xx 服务端瞬时错误可重试；4xx（含 401/403/404）直接返回，重试无意义
            if code >= 500 and attempt < _tries - 1:
                time.sleep(2 * (attempt + 1))
                last = (code, rb)
                continue
            return code, rb
        except (http.client.IncompleteRead, urllib.error.URLError, socket.timeout, socket.error, ConnectionError) as e:
            last = e
            if attempt < _tries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            return None, ''
    return last if isinstance(last, tuple) else (None, '')


def local_blob_sha(relpath):
    """用 git hash-object 计算本地文件的 blob SHA（与 GitHub contents 接口的 sha 同构，可做比对）"""
    try:
        return subprocess.check_output(['git', 'hash-object', '--', relpath], cwd=ROOT).decode('ascii').strip()
    except Exception:
        return None


def remote_sha(relpath):
    """取 GitHub 上某文件的 blob sha。contents 接口即使文件 >1MB 也会返回 sha，无需下载内容，
    从而避免大文件字节比对导致的网络断流/超时（这正是此前 IncompleteRead 崩溃的根因）。"""
    st, body = api('contents/%s' % relpath)
    if st != 200 or not body:
        return st, None
    try:
        return 200, json.loads(body).get('sha')
    except Exception:
        return st, None


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
        raw = fh.read()
    b64 = base64.b64encode(raw).decode('ascii')
    # 比对策略：用 git blob SHA 比对（远端 contents 返回的 sha 即 blob sha；本地用 git hash-object 计算）。
    # 彻底避免下载 >1MB 大文件内容做字节比对，规避网络断流/超时导致的 IncompleteRead 崩溃。
    st, rsha = remote_sha(f)
    if st == 404:
        st2, body2 = api('contents/%s' % f, 'PUT', {'message': 'add %s' % f, 'content': b64})
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
    elif st == 200:
        lsha = local_blob_sha(f)
        if lsha and lsha == rsha:
            print('SKIP(未变) %s' % f)
            skip += 1
            continue
        # 内容变化：带远端 blob sha 更新（rsha 已是 contents 接口的 sha，无需二次 GET）
        payload = {'message': 'update %s' % f, 'content': b64}
        if rsha:
            payload['sha'] = rsha
        st2, body2 = api('contents/%s' % f, 'PUT', payload)
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
    else:
        fail += 1
        print('FAIL %s -> GET %s' % (f, st))
print('\n完成：新增 %d / 更新 %d / 跳过 %d / 失败 %d / 共 %d' % (added, updated, skip, fail, len(files)))
sys.exit(1 if fail else 0)
