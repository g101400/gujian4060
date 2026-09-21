# 古建景点打卡（gujian4060）

「一张图家族」古建单通道源码：地图打点 / 多照片 / 本地知识库（切片+向量化+混合检索）/ 内置 OCR / 图文游记引擎，支持离线。PWA 源码为唯一真源，**本仓库完全自包含**：构建脚本与四端原生壳薄配置全部在此仓库的 `build/` 下，克隆即可离线构建。

## 目录结构

```
gujian_app/                        # 应用真源（PWA 源码）
├── index.html                     # 入口；密钥经外部脚本加载（见下）
├── js/                            # app / ai / kb / ocr / journal / upgrade / io / store
├── css/ images/ lib/              # 样式、图标、Leaflet 与 tesseract.js 本地资产
├── data.js                        # 景点 POI 数据（单通道，即真实数据）
├── kb_skeleton.json               # 知识库骨架
├── secrets/
│   ├── config.js                  # 提交的占位模板（无真实值）
│   └── config.local.js            # 本地真实密钥（.gitignore 排除，不入库）
├── docs/                          # 需求/设计/使用/变更文档
└── build/                         # 构建体系（已纳入仓库，完全自包含）
    ├── build_guijian.sh           # 古建单通道构建入口（骨架→sync→打四端）
    ├── build_all_guijian.sh       # 逐端打包引擎（仅古建）
    ├── sync_guijian.py            # 仓库相对路径的同步映射（仅古建 12 目标）
    ├── upload_release.sh          # 发版上传百度网盘
    ├── build_deb.py               # UOS amd64 deb 打包（ar 头铁律）
    ├── build_deb_mips.py          # UOS 龙芯 mips64el deb 打包
    ├── verify/                    # 回归验证套件（backup/kb_intel/kbformats/...）
    └── targets/                   # 四端原生壳薄配置（缓存/产物靠 .gitignore 排除）
        ├── win11/                 # Electron 壳（main.js/package.json/build/）
        ├── uos/                   # Electron 壳（龙芯同源）
        ├── android/               # 安卓壳（build.gradle/Manifest/MainActivity/res）
        └── ios/gujian_pwa/        # iOS PWA 壳（www 由 sync 再生）
```

## 密钥与部署（重要）

**真实密钥绝不入库。** 详见 [`SECRETS.md`](SECRETS.md)。要点：

- 天地图双 token、AI 厂商 key 等只存在于本地 `secrets/config.local.js`（被 `.gitignore` 排除）。
- 安卓发布签名 keystore 仅本地持有（`build/targets/keystore/`，`.gitignore` 排除）；仓库内 `build.gradle` 仅在本地 keystore 存在时启用发布签名，否则自动降级 debug 签名。
- 克隆本仓库后 `secrets/config.local.js` 与 `keystore/` 均不存在，`git pull` 永不覆盖它们。

## 快速开始

```bash
git clone https://github.com/g101400/gujian4060.git
cd gujian4060
# 1) 自建本地密钥（不入库）
cp secrets/config.js secrets/config.local.js
#    用编辑器把 TIANDITU_TOKEN / TIANDITU_SERVER_TOKEN 改成你的真实值
# 2) 单通道构建全部四端（apk / pwa / amd64.deb / mips64el.deb / exe / msi）
bash build/build_guijian.sh
#    产物在 releases/（含 v2.4.5 格式改造 + OCR + 知识库智能化 + v2.4.7 升级按钮）
```

也可在应用内「设置 → 天地图密钥管理」手动输入 token（写入 localStorage，等效于本地密钥文件）。

## 定时同步

本机不通 `github.com:443`，同步走 GitHub REST 内容 API。本地改动后运行：

```bash
python build/push.py
```

或等待自动化任务（每 3 小时）自动经 API 同步。详见 [`BUILD.md`](BUILD.md)。
