# 密钥管理（SECRETS）

原则：**所有真实密钥只存本地，绝不进入 Git 仓库；克隆/拉取不覆盖本地密钥；本地添加密钥后再构建可部署文件。**

## 密钥清单

| 密钥 | 用途 | 存放 |
|---|---|---|
| `TIANDITU_TOKEN` | 天地图浏览器端令牌（在线底图加载） | `secrets/config.local.js` |
| `TIANDITU_SERVER_TOKEN` | 天地图服务端令牌（瓦片下载脚本） | `secrets/config.local.js` |
| AI 厂商 Key | 智能问答（运行时） | 应用内 localStorage `ai_settings`，不入库 |
| 网盘凭证（百度/夸克） | 导入导出 | 本机配置，不入库 |
| 安卓签名 keystore | APK 签名 | `build/targets/keystore/`（本地，.gitignore），不入库 |

## 文件与加载机制

- `secrets/config.local.js`（**gitignore，本地真实值**）：
  ```js
  window.__CONFIG__ = {
    TIANDITU_TOKEN: "<真实浏览器端令牌>",
    TIANDITU_SERVER_TOKEN: "<真实服务端令牌>"
  };
  ```
- `secrets/config.js`（**已提交占位模板**）：`window.__CONFIG__ = window.__CONFIG__ || { TIANDITU_TOKEN:"", TIANDITU_SERVER_TOKEN:"" };`
- `index.html` 加载顺序：先 `secrets/config.local.js`（若存在则覆盖），再 `secrets/config.js`（兜底占位）。
- `js/app.js` 中 `TIANDITU_DEFAULT` / `TIANDITU_SERVER_DEFAULT` 为空字符串占位——仓库内无任何真实 token。

## 克隆后如何获得可运行/可部署版本

1. **填密钥文件**（推荐，构建即用）：
   ```bash
   cp secrets/config.js secrets/config.local.js
   # 编辑 secrets/config.local.js 填入真实 token
   ```
2. **或应用内输入**：「设置 → 天地图密钥管理」输入 token，写入 localStorage（等效）。

未填密钥时，仓库代码可正常打开，但地图底图不会加载（符合“密钥不外泄”预期）。

## 构建为什么带密钥

本地构建以 `gujian_app` 为 www 根整体打包，`secrets/config.local.js` 随包进入发布物（APK / deb / exe / PWA），因此**本地生成的可部署文件包含真实密钥**；而该文件被 `.gitignore` 排除，**GitHub 上永远只有占位模板**。

## 安卓发布签名（本地 keystore）

- keystore 文件放本地 `build/targets/keystore/release.keystore`（`.gitignore` 排除），口令从环境变量 `GUJIAN_STORE_PW` / `GUJIAN_KEY_PW` 读取，不入库。
- `build/targets/android/app/build.gradle`：检测到本地 keystore 才启用发布签名；否则自动降级 debug 签名。
- 克隆后无 keystore → 构建出 debug 签名 APK（功能完整，仅非发布签名）；本地放入 keystore + 设环境变量即出发布签名 APK。

## 防覆盖保障

`secrets/config.local.js` 在 `.gitignore` 中，因此：

- `git add -A` 不会暂存它；
- `git pull` / `git clone` 不会创建或改动它；
- 你本地的真实密钥在同步代码时始终安全。

## 新增密钥的步骤

1. 在 `secrets/config.local.js` 增加字段（本地）；
2. 在 `secrets/config.js` 占位模板同步增加同名空字段（提交，保持结构一致）；
3. 若需在运行时读取，于 `js/app.js` 顶部 `CFG` 取值逻辑中引用。
