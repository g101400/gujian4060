# 构建与发布说明（BUILD.md）

本仓库**完全自包含**：构建编排、逐端打包引擎、四端原生壳薄配置全部在 `build/` 下。克隆后只要有工具链即可离线构建古建单通道全部四端产物。

## 前置工具链

| 端 | 需要 |
|---|---|
| 公共（PWA） | Node.js（本地 HTTP 起服务，可选） |
| Win11（exe/msi） | Node.js + electron-builder；msi 用 WiX |
| UOS（amd64 / mips64el deb） | Python3（打包脚本 `build/build_deb.py`、`build/build_deb_mips.py`）；deb 的 `ar` 头必须为 `!<arch>`（铁律，3A4000=**mips64el**） |
| 安卓 APK | JDK 17 + Gradle 8.10 + Android SDK（路径在本地 `build/targets/android/local.properties` 的 `sdk.dir`，该文件被 gitignore） |
| iOS PWA | 同 PWA，托管到 https 静态目录 |

> 原生壳的 `node_modules`/`release`/`build`/`www` 副本由 `build/sync_guijian.py` 在构建时再生，不入库。

## 构建流程

```bash
bash build/build_guijian.sh
```

内部按序执行：

1. **骨架刷新**：`gen_kb_skeleton.mjs` 用 `data.js` 生成 `kb_skeleton.json`（古建数据源是 data.js，无脱敏）。
2. **同步 12 目标**：`build/sync_guijian.py` 把 `gujian_app` 拷贝到四端壳的 `www`/`jingmi_app`/`assets/www` 目录（仅古建映射，仓库相对路径，可在任意机运行）。
3. **逐端打包**：`build/build_all_guijian.sh` 仅处理 gujian（单通道，无脱敏、无 internal 轮），产出：
   - `releases/古建景点打卡V2.4.7_PWA_https.zip`
   - `releases/古建景点打卡V2.4.7_linux_amd64.deb` / `..._linux_mips64el.deb`
   - `releases/古建景点打卡V2.4.7_win11_setup.exe` / `..._win11_setup.msi`
   - `releases/古建景点打卡V2.4.7_android.apk`
   - `releases/古建景点打卡V2.4.7_ios_pwa.zip`
4. **发版上传**：`build/upload_release.sh`（依赖 `bdpan` CLI；未登录时优雅跳过，不阻塞本地产物）。

## 密钥与签名（本地持有，不入库）

- 天地图双 token → `secrets/config.local.js`（.gitignore）。克隆后需 `cp secrets/config.js secrets/config.local.js` 并填真实值；`git pull` 永不覆盖。
- 安卓发布签名 → `build/targets/keystore/release.keystore`（.gitignore）。`build.gradle` 检测到本地 keystore 才启用发布签名（口令从 `GUJIAN_STORE_PW` / `GUJIAN_KEY_PW` 环境变量读）；否则自动降级 debug 签名。

## deb ar 头铁律

UOS deb 打包脚本强制写 `!<arch>` 头（`build/verify_myml_ar.py` 可校验）。龙芯版架构为 **mips64el**，对应产物文件名后缀 `_linux_mips64el.deb`。

## 推送 GitHub（本机网络限制）

**本机不通 `github.com:443`**（`git push` / 克隆 / 网页端均连不上，关闭沙箱亦失败），但 `api.github.com` REST 可达。因此：

- 常规 `git push` 在此环境不可用；代码经 **GitHub REST 内容 API** 推送（仓库内 `build/push.py`，路径相对化、可在任意机运行），定时同步自动化也走此通道。
- 在能直连 `github.com` 的机器上，`git push` 同样可用（仓库、提交、remote 均已配好）。

推送脚本要点：遍历 `git ls-files`（自动排除 .gitignore 的密钥与产物），逐个 PUT 到 `/repos/g101400/gujian4060/contents/`，幂等（存在则带 sha 更新）。

## 安全红线

- `secrets/config.local.js`、`build/targets/keystore/` 绝不入库。
- 仓库内任何文件不得出现真实天地图 token 或明文签名口令（构建/打包时由本地密钥注入）。
- 发布的 APK 里也不应携带 keystore 文件，口令仅本地 gradle 运行时使用。
