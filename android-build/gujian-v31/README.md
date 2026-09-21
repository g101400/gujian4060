# 古建景点打卡 (GuJian Travel)

古建景点打卡与旅游路线管理 APP 的前端工程。基于 Leaflet + WebView 的跨平台方案：
Android / Windows(WebView2) / UOS(Linux) / iOS(PWA) 四端共享同一套 Web 源码。

## 工程结构

- `assets/` —— Web 前端源码（随 APK / Win / UOS / iOS 打包的核心）
  - `index.html` 入口
  - `app.js` 主逻辑（版本唯一真相源由 `version.json` 同步）
  - `data.js` 初始种子数据（1032 处古建/文物景点，覆盖 34 省级行政区）
  - `kb_rag.js` 知识库切片与 RAG 检索
  - `ai_module.js` 智能 AI 查询融合
  - `ocr/` 离线 OCR 引擎（tesseract wasm + 训练数据）
- `native-shell/` —— 各平台原生壳源码（仅源码入库，构建产物/备份/签名经 `.gitignore` 排除）
  - `android-gujian/`（Android 原生壳，包名 `com.gujian.travel`）：`AndroidManifest.xml`、`src/com/gujian/travel/MainActivity.java` + `LargeFileManager.java`、`res/`（图标+strings）、`build_apk.sh` + `gen_icons.py`。`assets/` 是 Web 源码拷贝，构建期生成、已忽略。
  - `win-gujian-webview2/`（Windows WebView2 原生壳）：`Program.cs` 加载器、`ShuiliMap.csproj`、`app.ico`、`build_msi.bat` + `build_msi.wxs`（WiX 一键打 MSI）
  - `uos-gujian-pyqt6/`（UOS 原生壳）：`main.py`（PyQt6 + QWebEngineView 承载网页）、`build_deb.sh`（dpkg-deb 一键打包，四类国产架构通用）
  - `gujian-ios/`（iOS PWA 原生壳）：`build_ios_zip.py`（把 `assets/` + `pwa-shell/` 打包成可托管 HTTPS 的离线 PWA）+ `pwa-shell/`（manifest.webmanifest / sw.js / icons/ / DEPLOY_README.txt，古建品牌）

## 构建与运行

> 各原生壳构建前需先把 `assets/` 同步成壳内的 `webroot/`（即「网页资源」目录），再运行对应构建脚本。`webroot/` 是 `assets/` 的构建期拷贝，已被 `.gitignore` 排除，切勿手动提交。iOS 例外：直接用仓库内的 `gujian-ios/pwa-shell/` 作 PWA 壳，无需 webroot。

- **Android**：`native-shell/android-gujian/`（包名 `com.gujian.travel`，Eclipse/Ant 风格工程）
  - 把 `assets/` 拷为壳内 `assets/`，`keytool` 生成/使用自己的 `.jks` 签名，运行 `bash build_apk.sh` 出 `古建景点打卡.apk`（`.jks`/`.apk`/`.class`/`.dex` 等已忽略，切勿提交密钥）
- **Windows**：`native-shell/win-gujian-webview2/`（WebView2）
  - 开发：`dotnet build`（.NET 8 + Microsoft.Web.WebView2）
  - 发布：`dotnet publish -c Release` 得到 `古建景点打卡.exe`，再把 `assets/` 拷为壳内 `webroot/`，双击 `build_msi.bat`（需先装 WiX Toolset）生成 `古建景点打卡_Setup.msi`
- **UOS**：`native-shell/uos-gujian-pyqt6/`（PyQt6 + deb 包）
  - 先把 `assets/` 拷为壳内 `webroot/`，再 `sudo bash build_deb.sh`（可 `ARCH=mips64el` 显式指定架构；架构对照：3A3000/3A4000→mips64el，3A5000+→loongarch64，FT2000/鲲鹏→arm64，其余→amd64）
- **iOS**：`native-shell/gujian-ios/`（PWA + 静态 https）
  - `python3 native-shell/gujian-ios/build_ios_zip.py` 生成 `apple-package/古建景点打卡_iOS_<ver>_可托管.zip`；解压到 HTTPS 站点目录，iOS Safari「添加到主屏幕」即得类原生 App（需 HTTPS；Service Worker 离线缓存 App Shell）

## AI Key 配置（重要）

`assets/ai_seed.js` 为**私有文件**（含个人 OpenRouter Key），已被 `.gitignore` 忽略，不会入库。
首次克隆后请：

```bash
cp assets/ai_seed.demo.js assets/ai_seed.js
```

然后在 APP「设置 → 智能AI设置」中填写你自己的 Key。未配置时 AI 功能不可用，但其余功能正常。

## 同步到 GitHub（推送）

仓库：`https://github.com/g101400/gujian-travel5090`，默认分支 `main`。

### 方式 A：正常联网的机器（推荐，标准 git）

```bash
git clone https://github.com/g101400/gujian-travel5090.git
# 改完代码后
git add -A
git commit -m "本次改动说明"
git push          # 首次用 git push -u origin main
```

拉取他人/其他设备的改动：`git pull`。

### 方式 B：本机（git 出网被代理拦截时）走 GitHub API 推送

某些环境里 `git push/fetch` 连不上 github.com:443（出网只能走服务代理，而 git 用不了带路径的代理地址），但 `curl` 能通。此时用仓库内的辅助脚本 `tools/gujian_api_push.py` 走 GitHub Git Data REST API 增量同步。脚本已随仓库走、路径按自身位置自动推算，克隆到任何机器都能直接用。

**先在本机放好 token（两种方式，均被 `.gitignore` 忽略，绝不入库）：**

```bash
# 方式 1：仓库根建 .gujian_token（每行一条，首行生效）
echo "ghp_xxx或github_pat_xxx" > .gujian_token

# 方式 2：环境变量直接传（最干净，推荐）
TOK=你的GitHubPAT python3 tools/gujian_api_push.py
```

**然后推送（从仓库根目录运行）：**

```bash
cd <仓库根>
python3 tools/gujian_api_push.py        # 已配 .gujian_token 时
# 或
TOK=你的GitHubPAT python3 tools/gujian_api_push.py
```

脚本做的事：遍历工作区 → 遵守 `.gitignore` 排除构建产物/密钥 → 把每个文件作为 blob 上传 → 建 tree/commit → 更新 `main` 引用（按内容去重、幂等、增量）。
- `LOCAL` 自动取脚本所在目录的上一级（即仓库根），无需改路径；特殊场景可用环境变量 `LOCAL` 覆盖。
- 目标仓库 `REPO` 在脚本顶部（`g101400/gujian-travel5090`），非机密。
- 需 `repo`（经典）/ `contents` 权限的 PAT；跳过 >25MB 的文件。
- 该 PAT 为 **fine-grained**，**2026-10-06 到期**，到期后需重新生成。

> **密钥管理要点**：token 永远不要写进会被提交的脚本/文档，也不要 commit 任何含 token 的文件。每台机器把自己的 PAT 存进本地被忽略的 `.gujian_token`（或用时用 `TOK=` 环境变量传），脚本自动读取，仓库里只有脚本、没有密钥。
> 旧的 `D:/Users/Claw/gujian_api_push.py`（路径写死）已弃用，请改用仓库内这份 `tools/gujian_api_push.py`。

## 发布安装包到 GitHub（Release）与 App 内升级

仓库同时用 **GitHub Releases** 承载四平台可部署安装包（Android APK / Windows MSI·EXE / 统信 UOS deb×4架构 / iOS PWA 托管 zip）。App「设置 → GitHub 升级（检测新版）」会查询本仓库最新 Release，比对版本并列出各平台下载。

发新版本时（从仓库根，token 已配好）：
```bash
python3 tools/gh_release.py --repo g101400/gujian-travel5090 --tag v3.7.5 --name "古建景点打卡 v3.7.5" \
  --notes "本次更新说明" \
  --asset "D:/Users/Claw/出包_<日期>/android/xxx.apk" \
  --asset "D:/Users/Claw/出包_<日期>/ios/xxx_可托管.zip" \
  --asset "D:/Users/Claw/出包_<日期>/uos-xxx" \
  --asset "D:/Users/Claw/出包_<日期>/win/xxx_Setup.exe" \
  --asset "D:/Users/Claw/出包_<日期>/win/xxx_Setup.msi"
```
脚本自动：打 tag → 建/更新 Release → 上传全部四平台安装包（同名自动替换）。下载页：`https://github.com/g101400/gujian-travel5090/releases`。

## 版本

当前 `3.7.5`（见 `assets/version.json`，本文件为版本唯一真相源）。
