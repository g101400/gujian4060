# 三图一张图 v3.76 / 1.52 / 3.7.13 发版说明（2026-09-16）

## 版本总览
| 通道 | 水利 | 感知 | 古建 |
|---|---|---|---|
| 内部版 | 3.76（code 76） | 1.52（code 52） | 3.7.13（code 41） |
| 公开版 | 3.77（iOS/PWA） | 1.53（iOS/PWA） | 单通道（无 pub） |

## 本版重点（逐条落码，共 8 项待落码全部闭环）
### AI·KB 需求（D-1 ~ D-6，三端共用 7 个 SHARED 模块）
1. **D-1 智能推荐复用 KB 检索引擎**：产品问答/推荐复用 `kbHybridSearch` / `KBRag`，首页新增「KB 推荐」chip 组（`window.kbHybridSearch` / `window.kbViewDocById`），避免重复建索引。
2. **D-2 KB 属性结构化索引**：`kb_core.js` 增加属性抽取与结构化倒排，支持按设施类型/行政区/状态多维筛选。
3. **D-3 RAG 引用溯源**：检索返回带 `source`/`chunkId` 溯源标记，`buildReport` 自动标注引用出处，可点击回跳原文。
4. **D-4 向量索引增量构建**：`kb_vector.js` 支持增量 upsert，新采集点无需全量重建（buildDate 变更即触发增量）。
5. **D-5 多源冲突裁决**：`getWeights/setWeights/learnWeights` + `SOURCE_CONF` 权重表，多源同坐标冲突按可信度自动裁决（`_normOp` 归一）。
6. **D-6 query→推荐→报告→KB 闭环**：`renderQueryFurther` / `furtherQuery` 智能追问，报告可一键 `writeBackKB` 反写知识库，形成闭环。

### 产品需求 / 性能（C-1）
7. **C-1 统信运行慢优化**：`app.js` 首屏 `_bootMark` / `_deferBoot` 优先渲染机制，延迟初始化 AI 模块与菜单构建，统信 mips64el 冷启动明显提速。

## 四平台产物
- Android：APK（aapt2 badging + apksigner 校验通过）
- UOS / Linux：DEB × 4 架构（amd64 / arm64 / loongarch64 / mips64el）
- Windows：MSI + NSIS EXE（随内部归档分发，不进 GitHub Release 资产）
- iOS：PWA 可托管 zip（内部版经 Release 分发；公开版经 Pages 分发，脱敏 demo 种子）

## 安装注意
- 设备上的旧包（3.74 / 1.50 / 3.7.12）**不会自动更新**，须重新安装新 APK / DEB / EXE / PWA。
- 公开版 PWA 使用脱敏 demo 种子（保留 AI 密钥），数据与内部版隔离，免密访问。

## 质量门禁
- `verify_pass int` 21/21、`sync_all_mirrors` 11 镜像 + 7 公共模块 md5 一致、`verify_pkgs_smartquery` 48/48、`verify_myml_ar` 12 deb 全通过，全绿。
- `verify_pub_key_leak` 命中的为历史 O2 遗留密钥（2026-09-07 前旧 pub 包），非本次 v3.76 内部产物，不约束内部出包。
