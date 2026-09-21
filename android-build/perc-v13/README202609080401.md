# 水利感知项目一张图（感知设备一张图，离线 WebView）

水利感知项目一张图（离线 WebView App），即「感知设备一张图」，package `com.shuili.ganzhi`，当前版本 v1.34。
作者：小七。覆盖视频监控 / 雨水情监测 / 大坝安全监测 / 地下水源监测 四类子系统，支持 Android / Windows(WebView2) / UOS(Linux deb) / iOS(PWA) 四端，数据离线内置（1125 条监测设施随包内置）。

## 工程结构

```
perc-v13/
├── assets/                 # Web 前端源码（核心）
│   ├── index.html app.js data.js
│   ├── ai_module.js        # AI 能力（智能助手 / 知识库）
│   ├── ai_seed.js          # ⚠️ 本地 OpenRouter Key（内部版含，公开版已脱敏排除）
│   ├── ai_seed.demo.js     # 脱敏占位（公开版所见）
│   ├── leaflet/ ocr/ kb_building_seed*.js
│   └── ...
├── AndroidManifest.xml src/ res/   # Android 原生壳
├── build_apk.sh
└── tools/gh_sync.py        # GitHub 推送脚本（API 方式）
```

## 公开版 vs 内部版

本应用在两个 GitHub 仓库同步发布：

| 版本 | 仓库 | 可见性 | 密钥处理 |
|------|------|--------|----------|
| 内部版 | `g101400/ganzhi-yitu5090` | **私有** | 保留 `assets/ai_seed.js`（密钥不变） |
| 公开版 | `g101400/ganzhi-yitu`      | **公开** | 自动排除 `ai_seed.js`（脱敏，仅留 `ai_seed.demo.js`） |

内部版仓库名末尾带 `5090`，且设为私有；公开版公开、不含密钥。

## 同步到 GitHub

本环境 git 直连被代理拦截，统一用 `tools/gh_sync.py`（GitHub REST API 推送）。

**方式 A：正常机器（有 git 出网）**

```bash
git add -A && git commit -m "更新" && git push
```

**方式 B：本环境（git 连不上 github.com）**

```bash
cp .gujian_token.example .gujian_token   # 填入你的 GitHub PAT
python3 tools/gh_sync.py                 # 一次推内部版(全量)+公开版(脱敏)
```

脚本按目录自动识别为感知应用，分别推 `ganzhi-yitu5090`（全量含密钥）与 `ganzhi-yitu`（排除 ai_seed.js）。

## 从 GitHub 下载 / 克隆

```bash
git clone https://github.com/g101400/ganzhi-yitu.git         # 公开版
git clone https://github.com/g101400/ganzhi-yitu5090.git      # 内部版（需私有仓库权限）
```

## 密钥安全管理

- `assets/ai_seed.js`（含真实 OpenRouter Key）仅在**内部版私有仓库**出现；公开版已排除。
- 本地 GitHub PAT 放在被忽略的 `.gujian_token`（不入库）；公开版仓库里只有空模板 `.gujian_token.example`。
- 切勿把真实 token 写进任何会被提交的脚本 / 文档。
