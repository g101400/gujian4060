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

## 2026-09-08 02:21 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-08_02:21:46"`（1 文件，+9）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m29s 完成）。`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 114 个文件。
- 结果：新增 0 / 更新 8 / 跳过(未变) 106 / 失败 0 / 共 114。退出码 0。
- 更新 8 个：`.workbuddy/memory/automations/.../memory.md`、`build/targets/uos/package.json`、`build/verify/verify_popup.mjs`、`docs/README.md`、`docs/软件需求说明书.md`、`js/store.js`、`lib/leaflet.css`、`platform_matrix.js`。
- 安全复核：`git ls-files` 枚举中不含 `secrets/config.local.js`、`build/targets/keystore/`、`__pycache__/*.pyc`；推送列表 secrets 项仅 `secrets/config.js` 占位模板，密钥零外泄。

## 2026-09-08 05:24 执行

- 工作树有改动：`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-08_05:24:30"`（3 文件，+602/-11：自动化 memory.md、docs/软件需求说明书.md、新增未追踪 `docs/软件需求说明书.md._bak_20260908_0435` 备份）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m36s 完成）。`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`（94 字节）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 115 个文件。
- 结果：新增 1 / 更新 9 / 跳过(未变) 105 / 失败 0 / 共 115。退出码 0。
- 更新 9 个：docs/README.md、docs/软件变更文档.md、docs/软件需求说明书.md、js/store.js、lib/leaflet.css、platform_matrix.js 等；「新增 1」为需求文档的 `_bak_20260908_0435` 备份（非敏感，系本次 git add -A 一并纳入）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板，`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-08 08:27 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-08_08:27:03"`（1 文件，+9）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m31s 完成）。`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 115 个文件。
- 结果：新增 0 / 更新 8 / 跳过(未变) 107 / 失败 0 / 共 115。退出码 0。
- 更新 8 个：`.workbuddy/memory/automations/.../memory.md`、`build/targets/uos/package.json`、`build/verify/verify_popup.mjs`、`docs/README.md`、`docs/软件需求说明书.md`、`js/store.js`、`lib/leaflet.css`、`platform_matrix.js`。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板，`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-08 11:29 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-08_11:29:48"`（1 文件，+9，提交 `f5d6fbd`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 1m26s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 115 个文件。
- 结果：新增 0 / 更新 8 / 跳过(未变) 107 / 失败 0 / 共 115。退出码 0。
- 更新 8 个：`.workbuddy/memory/automations/.../memory.md`、`build/targets/uos/package.json`、`build/verify/verify_popup.mjs`、`docs/README.md`、`docs/软件需求说明书.md`、`js/store.js`、`lib/leaflet.css`、`platform_matrix.js`。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档），`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-08 17:36 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-08_17:36:33"`（1 文件，+9，提交 `30dd7da`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 1m30s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 115 个文件。
- 结果：新增 0 / 更新 8 / 跳过(未变) 107 / 失败 0 / 共 115。退出码 0。
- 更新 8 个：`.workbuddy/memory/automations/.../memory.md`、`build/targets/uos/package.json`、`build/verify/verify_popup.mjs`、`docs/README.md`、`docs/软件需求说明书.md`、`js/store.js`、`lib/leaflet.css`、`platform_matrix.js`。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档），`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-08 20:39 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-08_20:39:16"`（1 文件，+9，提交 `912ff23`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 2m52s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 115 个文件。
- 结果：新增 0 / 更新 8 / 跳过(未变) 107 / 失败 0 / 共 115。退出码 0。
- 更新 8 个：`.workbuddy/memory/automations/.../memory.md`、`build/targets/uos/package.json`、`build/verify/verify_popup.mjs`、`docs/README.md`、`docs/软件需求说明书.md`、`js/store.js`、`lib/leaflet.css`、`platform_matrix.js`。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档），`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-08 23:42 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-08_23:42:58"`（1 文件，+9，提交 `1f39955`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 2m23s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 115 个文件。
- 结果：新增 0 / 更新 8 / 跳过(未变) 107 / 失败 0 / 共 115。退出码 0。
- 更新 8 个：`.workbuddy/memory/automations/.../memory.md`、`build/targets/uos/package.json`、`build/verify/verify_popup.mjs`、`docs/README.md`、`docs/软件需求说明书.md`、`js/store.js`、`lib/leaflet.css`、`platform_matrix.js`。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档），`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-08 14:32 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-08_14:32:48"`（1 文件，+9，提交 `3a6d8bf`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 2m22s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 115 个文件。
- 结果：新增 0 / 更新 8 / 跳过(未变) 107 / 失败 0 / 共 115。退出码 0。
- 更新 8 个（tail 截断显示 5 个）：`.workbuddy/memory/automations/.../memory.md`、`build/targets/uos/package.json`、`build/verify/verify_popup.mjs`、`docs/README.md`、`docs/软件需求说明书.md`、`js/store.js`、`lib/leaflet.css`、`platform_matrix.js`。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档），`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-09 02:46 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-09_02:46:21"`（1 文件，+9，提交 `8d4d97e`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 1m32s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 115 个文件。
- 结果：新增 0 / 更新 8 / 跳过(未变) 107 / 失败 0 / 共 115。退出码 0。
- 更新 8 个：`.workbuddy/memory/automations/.../memory.md`、`build/targets/uos/package.json`、`build/verify/verify_popup.mjs`、`docs/README.md`、`docs/软件需求说明书.md`、`js/store.js`、`lib/leaflet.css`、`platform_matrix.js`。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档），`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-09 05:49 执行

- 工作树有改动：`build/push.py`（坑 40 修复：用基于「即将上传原始字节」的 `git_blob_sha()` 替代受 `core.autocrlf=true` 影响的 `git hash-object`，CRLF 文件不再被误判为更新）+ 自动化 memory.md。`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-09_05:49:09"`（2 文件，+23/-9，提交 `9cb533e`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 1m23s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 115 个文件。
- 结果：新增 0 / 更新 0 / 跳过(未变) 115 / 失败 0 / 共 115。退出码 0。
- 关键验证：新比对逻辑下全部 115 文件均为「未变」——印证坑 40 修复生效，先前因 `git hash-object` LF 归一化导致的 CRLF 文件每轮伪更新噪音已消除。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-09 12:00 执行

- 工作树有改动：css/style.css、index.html、js/app.js、js/io.js、新增 js/imgutil.js、自动化 memory.md。`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-09_12:00:48"`（6 文件，+312/-10，提交 `0401da3`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 1m27s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 1 / 更新 5 / 跳过(未变) 110 / 失败 0 / 共 116。退出码 0。
- 更新 5 个：css/style.css、index.html、js/app.js、js/io.js、自动化 memory.md；「新增 1」为 js/imgutil.js（新文件）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-09 15:05 执行

- 工作树有改动：`.workbuddy/memory/automations/.../memory.md` + `js/app.js`（CRLF 警告出现，但坑 40 修复后比对仍正确）。`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-09_15:03:57"`（2 文件，+10/-1，提交 `2feb48d`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 1m27s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 2 / 跳过(未变) 114 / 失败 0 / 共 116。退出码 0。
- 更新 2 个：`.workbuddy/memory/automations/.../memory.md`、`js/app.js`。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-09 08:56 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-09_08:54:52"`（1 文件，+9，提交 `39905e6`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 1m19s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 115 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 114 / 失败 0 / 共 115。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-09 21:09 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-09_21:09:11"`（1 文件，+9，提交 `d946305`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 3m52s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-09 18:06 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-09_18:06:22"`（1 文件，+9，提交 `09d137f`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 1m31s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-10 00:13 执行

- 工作树有改动：`.workbuddy/memory/automations/.../memory.md`、`css/style.css`、`index.html`、`js/app.js`、新增未追踪 `js/objsearch.js`。`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-10_00:13:59"`（5 文件，+619/-5，提交 `3fc1638`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m56s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 117 个文件。
- 结果：新增 1 / 更新 4 / 跳过(未变) 112 / 失败 0 / 共 117。退出码 0。
- 更新 4 个：`index.html`、`js/app.js`、`.workbuddy/memory/automations/.../memory.md`、`css/style.css`；「新增 1」为 `js/objsearch.js`（新文件，593 行）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-10 06:19 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-10_06:19:25"`（1 文件，+9，提交 `0549b5f`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m26s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 117 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 116 / 失败 0 / 共 117。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-10 03:16 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-10_03:16:57"`（1 文件，+9，提交 `fae622e`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m26s 完成）。`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 117 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 116 / 失败 0 / 共 117。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-10 12:28 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-10_12:28:16"`（1 文件，+9，提交 `46f159e`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m27s 完成）。`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 117 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 116 / 失败 0 / 共 117。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-10 09:25 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-10_09:25:21"`（1 文件，+9，提交 `0c92a79`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 1m26s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 117 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 116 / 失败 0 / 共 117。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-10 18:32 执行

- 工作树：`git status` clean，`git add -A` 后无 porcelain 改动，跳过 `git commit`。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 1m24s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 117 个文件。
- 结果：新增 0 / 更新 0 / 跳过(未变) 117 / 失败 0 / 共 117。退出码 0。
- 结论：本地与 GitHub `g101400/gujian4060` 完全一致，无需改动。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-10 21:35 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-10_21:35:04"`（1 文件，+9，提交 `ac4ab60`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`，后台约 4m15s 完成）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 117 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 116 / 失败 0 / 共 117。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-11 03:43 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-11_03:43:13"`（1 文件，+9，提交 `2257b6a`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m25s 完成，退出码 0）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 117 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 116 / 失败 0 / 共 117。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-11 06:45 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-11_06:45:40"`（1 文件，+9，提交 `fec1001`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m20s 完成，退出码 0）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 0 / 跳过(未变) 116 / 失败 0 / 共 116。退出码 0。
- 结论：本地与 GitHub `g101400/gujian4060` 完全一致，无需改动。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-11 09:56 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-11_09:56:19"`（1 文件，+9，提交 `0425477`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m19s 完成，退出码 0）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-11 00:41 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-11_00:40:26"`（1 文件，+9，提交 `3c66cd7`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m28s 完成，退出码 0）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 117 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 116 / 失败 0 / 共 117。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-11 19:08 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-11_19:08:14"`（1 文件，+8，提交 `15a0ed9`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m21s 完成，退出码 0）。`GITHUB_TOKEN` 环境变量未设 → 回退读取 `D:/Users/WorkBuddy/.github_token`（94 字节）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-11 16:04 执行

- 工作树有改动（10 文件，+129/-79）：`.workbuddy/memory/automations/.../memory.md`、`docs` 五篇（用户使用/软件变更/软件概要设计/软件详细设计/软件需求说明书）、`js/app.js`、`js/io.js`、`kb_skeleton.json`、`platform_matrix.js`。`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-11_16:04:50"`（提交 `e572d29`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m35s 完成，退出码 0）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 10 / 跳过(未变) 106 / 失败 0 / 共 116。退出码 0。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-11 13:01 执行

- 工作树有改动（16 文件，+333/-115）：`.workbuddy/memory/automations/.../memory.md`、`css/style.css`、`index.html`、`js/app.js`、`js/io.js`、`js/journal.js`、`js/objsearch.js`、`kb_skeleton.json`、`platform_matrix.js`、`docs` 七篇（APP风格色彩字体搭配/用户使用/软件变更/软件概要设计/软件详细设计/软件需求说明书/README）。`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-11_13:01:12"`（提交 `418e3b5`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m47s 完成，退出码 0）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`kb_skeleton.json`（本轮真正内容有别的文件）。其余 15 个本地产提文件经 `git_blob_sha` 比对已与 GitHub 一致（坑 40 修复生效，CRLF/LF 归一化不触发伪更新）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-11 22:10 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-11_22:10:45"`（1 文件，+9，提交 `721807b`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 4m01s 完成，退出码 0）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-12 04:18 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-12_04:18:15"`（1 文件，+9，提交 `4d5f2a4`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m25s 完成，退出码 0）。Token 回退读取 `D:/Users/WorkBuddy/.github_token`。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-12 07:20 执行

- 工作树有改动（4 文件，+38/-29）：`.workbuddy/memory/automations/.../memory.md` + `docs` 三篇（APP风格色彩字体搭配文档 / 用户使用文档 / 软件变更文档）。`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-12_07:20:28"`（提交 `1d50c48`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m29s 完成，退出码 0）。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 4 / 跳过(未变) 112 / 失败 0 / 共 116。退出码 0。
- 更新 4 个：`.workbuddy/memory/automations/.../memory.md`、`docs/APP风格色彩字体搭配文档.md`、`docs/用户使用文档.md`、`docs/软件变更文档.md`。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-12 01:16 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-12_01:16:01"`（1 文件，+9，提交 `7e61a2f`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m24s 完成，退出码 0）。Token 回退读取 `D:/Users/WorkBuddy/.github_token`。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-12 13:31 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-12_13:31:24"`（1 文件，+9，提交 `8293848`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m37s 完成，退出码 0）。Token 回退读取 `D:/Users/WorkBuddy/.github_token`。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-12 10:27 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-12_10:27:38"`（1 文件，+9，提交 `a949373`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m25s 完成，退出码 0）。Token 回退读取 `D:/Users/WorkBuddy/.github_token`。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-12 16:34 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-12_16:34:30"`（1 文件，+9，提交 `24a3930`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，后台约 1m31s 完成，退出码 0）。Token 回退读取 `D:/Users/WorkBuddy/.github_token`。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-12 19:37 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-12_19:37:25"`（1 文件，+9，提交 `177dac7`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，前台约 1m24s 完成，退出码 0）。Token 回退读取 `D:/Users/WorkBuddy/.github_token`。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-12 22:41 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-12_22:41:20"`（1 文件，+9，提交 `cca5cce`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12）。
- 首次运行（约 3m47s）结果：新增 0 / 更新 1 / 跳过 114 / 失败 1 / 共 116，退出码 1。`js/app.js` 比对阶段 `GET None`（拉取远端 blob sha 瞬时网络抖动，非鉴权错误、非内容差异）。
- 重跑（约 3m10s）结果：新增 0 / 更新 0 / 跳过 116 / 失败 0 / 共 116，退出码 0。印证首轮 `js/app.js` 失败为瞬时故障，重跑即恢复一致。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-13 01:49 执行

- 工作树：仅自动化 memory.md 一处未提交改动（上次运行遗留），`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-13_01:49:45"`（1 文件，+8，提交 `71cd784`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，前台约 1m24s 完成，退出码 0）。Token 回退读取 `D:/Users/WorkBuddy/.github_token`。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 1 / 跳过(未变) 115 / 失败 0 / 共 116。退出码 0。
- 更新 1 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`（本轮自动化自身的执行记录）。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。

## 2026-09-13 04:52 执行

- 工作树有改动（4 文件，+12）：`.workbuddy/memory/automations/.../memory.md` + `docs` 三篇（软件概要设计 / 软件详细设计 / 软件需求说明书）。`git add -A` 后 `git commit -m "sync: 自动同步本地改动 2026-09-13_04:52:06"`（提交 `2d25cc7`）。
- 经 REST 内容 API 推送（`build/push.py`，托管 Python 3.13.12，前台约 1m25s 完成，退出码 0）。Token 回退读取 `D:/Users/WorkBuddy/.github_token`。
- 枚举 `git ls-files --cached --others --exclude-standard` 共 116 个文件。
- 结果：新增 0 / 更新 4 / 跳过(未变) 112 / 失败 0 / 共 116。退出码 0。
- 更新 4 个：`.workbuddy/memory/automations/01957cbf-eba8-405d-aacf-af3d15e8fbd1/memory.md`、`docs/软件概要设计.md`、`docs/软件详细设计.md`、`docs/软件需求说明书.md`。
- 安全复核：推送列表 secrets 项仅 `secrets/config.js` 占位模板（另 `SECRETS.md` 为说明文档）；`config.local.js` 与 `build/targets/keystore/` 始终被 .gitignore 排除，密钥零外泄。
