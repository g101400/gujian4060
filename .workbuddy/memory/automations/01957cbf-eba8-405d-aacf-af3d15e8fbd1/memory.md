# 自动化：同步古建源码到 GitHub g101400/gujian4060

## 2026-09-06 19:34 执行

- 工作树状态：`git status` 无改动（clean），故跳过 `git commit`。
- 经 REST 内容 API 推送（`python build/push.py`，托管 Python 3.13.12）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 111 个文件。
- 结果：新增 0 / 更新 0 / 跳过(未变) 111 / 失败 0。退出码 0。
- 结论：本地与 GitHub 完全一致，无需改动。
- 安全：`.gitignore` 已排除 `secrets/config.local.js` 与 `build/targets/keystore/`，推送列表仅含 `secrets/config.js` 占位模板，密钥未外泄。
- Token 取用：`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`（文件存在，94 字节）。

## 2026-09-07 16:51 执行

- 工作树有改动：`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-07_16:51:15"`（6 文件，+450/-15），含 `.workbuddy/memory/automations/.../memory.md` 与新增 `build/publish_release.py` 等。
- 经 REST 内容 API 推送（`python build/push.py`，托管 Python 3.13.12）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 113 个文件。
- 结果：新增 0 / 更新 0 / 跳过(未变) 113 / 失败 0。退出码 0。
- 结论：本地与 GitHub 完全一致，本次提交内容此前已通过 API 推送，无新内容需上传。
- 安全：`secrets/config.local.js` 与 `build/targets/keystore/` 被 .gitignore 排除，推送列表仅含 `secrets/config.js` 占位模板，密钥未外泄。

## 2026-09-07 23:17 执行

- 工作树有改动：`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-07_23:17:45"`（8 文件，+453/-6：index.html / js/ai.js / js/app.js / js/kb.js / docs 两篇 / 自动化 memory.md / 新增 .workbuddy/memory/2026-09-07.md）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，本次运行约 2m55s 后台完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 114 个文件（含 git 前次新增的 2026-09-07.md）。
- 结果：新增 0 / 更新 7 / 跳过(未变) 107 / 失败 0 / 共 114。退出码 0。
- 更新 7 个：build/targets/uos/package.json、build/verify/verify_popup.mjs、docs/README.md、docs/软件需求说明书.md、js/store.js、lib/leaflet.css、platform_matrix.js。
- 安全：`secrets/config.local.js` 与 `build/targets/keystore/` 被 .gitignore 排除，推送列表仅含 `secrets/config.js` 占位模板，密钥零外泄。

## 2026-09-07 19:53 执行

- 工作树有改动：`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-07_19:53:42"`（4 文件，+191/-14：index.html / js/app.js / js/io.js / 自动化 memory.md）。
- 首次 `python build/push.py` 失败（exit=1）：>1MB 大文件走 `git/blobs` 比对时网络 `IncompleteRead`（读到 2.34MB 断流），原脚本无重试直接崩。
- 修复 `build/push.py`：①`api()` 加瞬时错误重试（IncompleteRead/5xx/URLError/socket 超时，3 次退避，超时 180s）；②改用 git blob SHA 比对替代大文件字节下载（远端 contents 的 blob sha vs 本地 `git hash-object`），彻底绕开大文件下载。
- 二次运行 exit=0：新增 1 / 更新 10 / 跳过 103 / 失败 0（共 114）。其中「新增 1」为误推的 `build/__pycache__/push.cpython-313.pyc`（Python 字节码缓存，因 `__pycache__` 未被 .gitignore 排除）。
- 清理：经 REST API 删除远端该 .pyc（DELETE 200）+ 本地 `rm -rf __pycache__`，并把 `__pycache__/`、`.pyc` 加入 `.gitignore`。
- 提交 `.gitignore` + `push.py`（d001c0a），重跑 exit=0：新增 0 / 更新 10 / 跳过 103 / 失败 0（共 113）。第二轮更新含 .gitignore / build/push.py / 各端构建与文档。
- 安全：`secrets/config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，推送列表仅含 `secrets/config.js` 占位模板，密钥零外泄。
