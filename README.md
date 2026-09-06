# 古建景点打卡（gujian4060）

「一张图家族」古建单通道源码：地图打点 / 多照片 / 本地知识库（切片+向量化+混合检索）/ 内置 OCR / 图文游记引擎，支持离线。PWA 源码为唯一真源，构建时衍生安卓 APK、UOS deb（amd64 / 龙芯 mips64el）、Win11（exe/msi）、iOS PWA 各端。

## 目录结构

```
gujian_app/
├── index.html            # 入口；密钥经外部脚本加载（见下）
├── js/                   # app / ai / kb / ocr / journal / upgrade / io / store
├── css/ images/ lib/     # 样式、图标、Leaflet 与 tesseract.js 本地资产
├── data.js               # 景点 POI 数据（单通道，即真实数据）
├── kb_skeleton.json      # 知识库骨架
├── secrets/
│   ├── config.js         # 提交的占位模板（无真实值）
│   └── config.local.js   # 本地真实密钥（.gitignore 排除，不入库）
└── docs/                 # 需求/设计/使用/变更文档
```

## 密钥与部署（重要）

**真实密钥绝不入库。** 详见 [`SECRETS.md`](SECRETS.md)。要点：

- 天地图双 token 等真实密钥只存在于本地 `secrets/config.local.js`（被 `.gitignore` 排除）。
- 克隆本仓库后该文件不存在，需自建并填入真实 token，再构建可部署文件。
- `git pull` / `git clone` 永远不会覆盖你本地的 `secrets/config.local.js`。

## 快速开始

```bash
git clone https://github.com/g101400/gujian4060.git
cd gujian4060
# 1) 自建本地密钥（不入库）
cp secrets/config.js secrets/config.local.js
#    用编辑器把 TIANDITU_TOKEN / TIANDITU_SERVER_TOKEN 改成你的真实值
# 2) 构建（本地构建脚本以 gujian_app 为 www 根整体打包，secrets/config.local.js 随包带入发布物）
bash ../build_channels.sh        # 或对应的古建构建入口
```

也可在应用内「设置 → 天地图密钥管理」手动输入 token（写入 localStorage，等效于本地密钥文件）。
