#!/bin/bash
# 水利一张图版本对比分析与三端同步自动化脚本
# 用途：分析 V3.15→V3.24 变更，同步到 iOS/Win/UOS 三端

set -e

WORKSPACE="/d/Users/Claw"
APK_DIR="${WORKSPACE}/APK 引用"
BASE_VERSION="3.15"
TARGET_VERSION="3.24"
TIMESTAMP=$(date +"%Y%m%d")
ANALYSIS_DATE=$(date +"%Y-%m-%d")

# 输出目录
iOS_OUTPUT="${WORKSPACE}/水利一张图_iOS_${TARGET_VERSION}_${ANALYSIS_DATE}"
WIN11_OUTPUT="${WORKSPACE}/水利一张图_Win11_${TARGET_VERSION}_${ANALYSIS_DATE}"
UOS_OUTPUT="${WORKSPACE}/水利一张图_UOS_${TARGET_VERSION}_${ANALYSIS_DATE}"
REPORT_OUTPUT="${WORKSPACE}/版本对比分析_${TARGET_VERSION}_${ANALYSIS_DATE}.md"

echo "========================================="
echo "水利工程一张图自动同步任务"
echo "执行时间：${ANALYSIS_DATE}"
echo "版本范围：V${BASE_VERSION} → V${TARGET_VERSION}"
echo "目标平台：iOS 18+/Win11/统信 UOS"
echo "========================================="

# 检查 APK 归档目录
if [ ! -d "${APK_DIR}" ]; then
    echo "错误：APK 引用目录不存在：${APK_DIR}"
    exit 1
fi

# 查找指定版本的 APK
BASE_APK=$(ls "${APK_DIR}"/v${BASE_VERSION}_*.apk 2>/dev/null | head -1)
TARGET_APK=$(ls "${APK_DIR}"/v${TARGET_VERSION}_*.apk 2>/dev/null | head -1)

if [ -z "${BASE_APK}" ]; then
    echo "错误：未找到 V${BASE_VERSION} 版本 APK"
    exit 1
fi

if [ -z "${TARGET_APK}" ]; then
    echo "错误：未找到 V${TARGET_VERSION} 版本 APK"
    exit 1
fi

echo ""
echo "[步骤 1/6]: 提取基线版本 (${BASE_VERSION})..."
mkdir -p "${WORKSPACE}/v3.15_extract"
unzip -q "${BASE_APK}" -d "${WORKSPACE}/v3.15_extract"
cp -r "${WORKSPACE}/v3.15_extract/assets/leaflets/*.css" "${WORKSPACE}/v3.15_css_backup/"
echo "✓ 已提取 V3.15 文件到：${WORKSPACE}/v3.15_extract/"

# 解析 APK 信息
extract_apk_info() {
    local apk="$1"
    local output_dir="$2"
    
    mkdir -p "${output_dir}"
    
    # 使用 unzip 列出文件并提取 key 信息
    unzip -q "$apk" -d "${output_dir}_temp"
    
    # 提取版本号
    if [ -f "${output_dir}_temp/assets/version.json" ]; then
        grep '"version"' "${output_dir}_temp/assets/version.json" > "${output_dir}/version_info.txt"
    fi
    
    if [ -f "${output_dir}_temp/AndroidManifest.xml" ]; then
        grep -E '<versionCode>|<versionName>' "${output_dir}_temp/AndroidManifest.xml" > "${output_dir}/manifest_version.txt"
    fi
    
    rm -rf "${output_dir}_temp"
}

extract_apk_info "${BASE_APK}" "${WORKSPACE}/v3.15_meta"
echo "✓ 已提取 V3.15 版本信息"

# 提取目标版本 meta
mkdir -p "${WORKSPACE}/v3.24_meta"
unzip -q "${TARGET_APK}" -d "${WORKSPACE}/v3.24_meta"
grep '"version"' "${WORKSPACE}/v3.24_meta/assets/version.json" > "${WORKSPACE}/v3.24_meta/version_info.txt" 2>/dev/null || echo "版本信息提取中..."

echo ""
echo "[步骤 2/6]: 分析功能变更 (基于文档记录)..."

# 根据需求文档整理 V3.15-V3.24 的功能清单
cat > "${WORKSPACE}_feature_changes.txt" << 'FEATURE_EOF'
水利一张图 V3.15 → V3.24 功能变更清单（基于官方文档）

【核心新增功能】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v3.7 (2026-08-15):
├─ UI/UX 升级：菜单图标圆形色块化、筛选图标🎚️与查询🔍区分
├─ 筛选实时计数 + 结果框选：0 条提示/1 条定位/多条倒水滴高亮 + 蓝色虚线圈罩住全部
├─ 批量导入照片：本地文件 / 百度网盘 / 夸克网盘 + ZIP/7z/RAR 支持
├─ 导出照片增强：范围（全部/按管理所）、格式 (ZIP/7z)、目标多种渠道
├─ 智能匹配确认：多匹配默认勾选最匹配 + 置信度标注 + 推断范围提示

v3.20-v3.21:
├─ 修复 IIFE 闭包问题导致的功能不可用（toggleList、定位查看、进度条关闭按钮）
├─ 复制坐标/分享离线兜底：navigator.clipboard写文本无安全上下文时的 textarea 回退

v3.22:
├─ 智能匹配确认增强：实时"已选 X/N"计数 + 一键全部按最匹配 + Enter/Esc快捷操作 + 长列表滚动条常驻底部
├─ 筛选圈选动画：蓝色虚线圈（内向外展开 + 行进蚂蚁描边）+ 倒水滴淡入缩放 + "命中 N 个"徽标

v3.23:
├─ 导入提示根因修复：离线 WebView confirm()不显示 → 统一改用 ask()对话框（3 处核心 +6 处辅助）
└─ 查询圈选体验优化：0 条/1 条/多条分别提示/flyTo/绿色虚线圈罩住全部

v3.24:
├─ 查询菜单补全确认逻辑：按钮/回车触发 doQueryConfirm，与筛选同一套结果处理
├─ 双圈颜色区分：查询绿色 (#2e8b57) / 筛选浅蓝 (#4aa3e0) + 统一动画
└─ 建筑物类型规范化：CANONICAL_TYPES(19 类 +ALWAYS_TYPES 泵站/溢洪道)+脏数据过滤

【优化与修复】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UI/体验优化（贯穿各版本）:
├─ 菜单智能排序：高频功能（定位 / 列表/测距/搜索）靠前
├─ 关于页增强：建议使用环境 + 制作环境 + 当前运行环境三重显示
├─ UI 遮挡修复：测距提示与底图切换器不重叠、列表视图切换隐藏提示

性能优化:
├─ 天地图 Token 规范化：TOKEN_BROWSER / TOKEN_SERVER区分使用场景
├─ localStorage 持久化键名版本化：shuili_map_v1 → shuili_map_v2 → v3.0+ 统一

【经验教训沉淀】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

关键修复模式（可复用）:
1. offline WebView 原生对话框限制：confirm()/alert()不显示→自定义 ask()方案
2. Leaflet 动画 key pit:transform 必须在内层子元素，否则标记跳位
3. IIFE 闭包暴露：所有 onclick 绑定的函数必须 window.fn = fn 全局可达

UI设计规范:
1. 虚线圈颜色语义化：查询绿 (#2e8b57)/筛选蓝 (#4aa3e0)+统一动画系统
2. 脏数据过滤：uniq(btype)会混入备注/表格字段，需权威清单兜底 (CANONICAL_TYPES)
3. 按钮可达性增强：Enter/Esc快捷操作 + 滚动条常驻

数据兼容性:
1. localStorage 多版本共存不冲突，回退后旧数据仍在
2. 类型列表历史脏值保留为编辑选项，静默改写风险降低

【版本发布清单】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

每次发布必核项:
├─ [ ] APP_VERSION / APP_BUILD_DATE 已更新
├─ [ ] 构建语法检查：node --check app.js
├─ [ ] 签名验证：apksigner verify = Verifies
├─ [ ] Dex 安全扫描：dexdump -l plain classes.dex grep com.sun.net.httpserver = none
├─ [ ] 备份机制：backup/v{X.X}_{YYYY-MM-DD}/完整快照
└─ [ ] 文档同步：版本历史 + 变更文档 + 经验沉淀全更新

APK 交付规范:
├─ 命名格式：水利一张图 Vx.x_YYYYMMDD_5090.apk
├─ 主目录/D:/Users/Claw/同步行
└─ APK 引用目录归档同步

━━━━━━━━━━END OF FEATURE CHANGES━━━━━━━━━━━━
FEATURE_EOF

cat "${WORKSPACE}_feature_changes.txt" >> ${REPORT_OUTPUT}

echo "✓ 已生成功能变更报告"

# [步骤 3/6]: 创建 iOS 版本结构
echo ""
echo "[步骤 3/6]: 生成 iOS 18+ 版本结构..."

