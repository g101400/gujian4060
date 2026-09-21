#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 bump_version_v348.py 生成 bump_version_v349.py（版本号 + 日期 + 描述 + 归档目录提升）。"""
import pathlib

SRC = pathlib.Path("D:/Users/Claw/bump_version_v348.py")
DST = pathlib.Path("D:/Users/Claw/bump_version_v349.py")

t = SRC.read_text(encoding="utf-8")

repls = [
    # 文档头
    ('bump_version_v348.py — 三产品版本同步 v3.46/v1.22/v3.4 -> v3.48/v1.24/v3.6',
     'bump_version_v349.py — 三产品版本同步 v3.48/v1.24/v3.6 -> v3.49/v1.25/v3.7'),
    ('v3.48 修复与优化 release（统一三日经验教训后的收敛版本）：',
     'v3.49 文档与诊断增强 release（与感知 v1.25 / 古建 v3.7 同步）：'),
    # 日期 / 备份 / 归档
    ('NEW_BUILD_DATE = "2026-09-01"', 'NEW_BUILD_DATE = "2026-09-02"'),
    ('BACKUP_DIR = os.path.join(ROOT, "backup_2026-09-01_before_v348")',
     'BACKUP_DIR = os.path.join(ROOT, "backup_2026-09-02_before_v349")'),
    ('ARCHIVE_OLD = "四端安装包_20260831_v346"', 'ARCHIVE_OLD = "四端安装包_20260901_v348"'),
    ('ARCHIVE_NEW = "四端安装包_20260901_v348"', 'ARCHIVE_NEW = "四端安装包_20260902_v349"'),
    # 打印
    ('🔧 bump_version_v348 — 构建日期 %s' % "2026-09-01",
     '🔧 bump_version_v349 — 构建日期 %s' % "2026-09-02"),
    ('✅ bump_version_v348 完成。下一步：四端出包。',
     '✅ bump_version_v349 完成。下一步：四端出包。'),

    # ---- shuili 产品字段 ----
    ('old_ver="3.46", new_ver="3.48", old_code=47, new_code=48,',
     'old_ver="3.48", new_ver="3.49", old_code=48, new_code=49,'),
    ('deb_old="3.47.20260901", deb_new="3.48.20260901",',
     'deb_old="3.48.20260901", deb_new="3.49.20260902",'),
    ('msi_old="3.46.1", msi_new="3.48.0",',
     'msi_old="3.48.0", msi_new="3.49.0",'),
    ('appver_old="3.46", appver_new="3.48",',
     'appver_old="3.48", appver_new="3.49",'),
    ('ios_old="3.46_20260831", ios_new="3.48_20260901",',
     'ios_old="3.48_20260901", ios_new="3.49_20260902",'),

    # ---- perc 产品字段 ----
    ('old_ver="1.22", new_ver="1.24", old_code=27, new_code=28,',
     'old_ver="1.24", new_ver="1.25", old_code=28, new_code=29,'),
    ('deb_old="1.23.20260901", deb_new="1.24.20260901",',
     'deb_old="1.24.20260901", deb_new="1.25.20260902",'),
    ('msi_old="1.22.1", msi_new="1.24.0",',
     'msi_old="1.24.0", msi_new="1.25.0",'),
    ('appver_old="1.22", appver_new="1.24",',
     'appver_old="1.24", appver_new="1.25",'),
    ('ios_old="1.22_20260831", ios_new="1.24_20260901",',
     'ios_old="1.24_20260901", ios_new="1.25_20260902",'),

    # ---- gujian 产品字段 ----
    ('old_ver="3.4", new_ver="3.6", old_code=27, new_code=28,',
     'old_ver="3.6", new_ver="3.7", old_code=28, new_code=29,'),
    ('deb_old="3.5.20260901", deb_new="3.6.20260901",',
     'deb_old="3.6.20260901", deb_new="3.7.20260902",'),
    ('msi_old="3.4.1", msi_new="3.6.0",',
     'msi_old="3.6.0", msi_new="3.7.0",'),
    ('appver_old="3.4", appver_new="3.6",',
     'appver_old="3.6", appver_new="3.7",'),
    ('ios_old="3.4_20260831", ios_new="3.6_20260901",',
     'ios_old="3.6_20260901", ios_new="3.7_20260902",'),
]

missed = []
for a, b in repls:
    if a not in t:
        missed.append(a)
        continue
    t = t.replace(a, b)

# SHUILI_DESC 整段替换
old_s = ('SHUILI_DESC = ("v3.48 修复与优化（统一三日经验教训的收敛版本，功能不删不减）："')
assert old_s in t, "SHUILI_DESC anchor not found"
new_s = ('SHUILI_DESC = ("v3.49 文档与诊断增强（功能不删不减，与感知 v1.25 / 古建 v3.7 同步）："')
t = t.replace(old_s, new_s, 1)
# 把 SHUILI_DESC 末尾的 ④清理... 行替换为新结尾（定位稳定锚点）
t = t.replace(
    '    "④清理 webroot 历史垃圾（*.bak/*.ctxbak/*.menu1bak/*.old 与 leaflet/leaflet 嵌套冗余副本），"\n'
    '    "MSI/NSIS 打包脚本加目录剪枝，防止同步后复活。")',
    '    "④新增全平台启动诊断：app 启动即在控制台与本地诊断缓冲记录当前版本/构建日期/运行平台（UOS 另由 server.py 写入 launch_err.log，版本号随 version.json 自动更新），便于发现「装了新版却显示旧版」；"\n'
    '    "⑤UOS 保留 no-store 防缓存头与每次启动写 launch_err.log + install.log；四平台同步保持。")',
    1)

# PERC_DESC 整段
t = t.replace(
    'PERC_DESC = ("v1.24 与水利 v3.48 同步（感知核心=感知切切实设备，保留 subsystem 子系统 + equip_type 设备类型元数据）："',
    'PERC_DESC = ("v1.25 与水利 v3.49 同步（感知核心=感知切切实设备，保留 subsystem 子系统 + equip_type 设备类型元数据）："', 1)
t = t.replace(
    '    "④webroot 垃圾清理与打包剪枝。")',
    '    "③新增全平台启动诊断（app 启动即记录版本/平台，UOS 另写 launch_err.log）；④UOS 保留 no-store 防缓存 + 每次启动写 launch_err.log/install.log。")', 1)

# GUJIAN_DESC 整段
t = t.replace(
    'GUJIAN_DESC = ("v3.6 与水利 v3.48 同步（古建核心=景区→园区→子景点→打卡位→标签，key=spot/area/sub/point/tag）："',
    'GUJIAN_DESC = ("v3.7 与水利 v3.49 同步（古建核心=景区→园区→子景点→打卡位→标签，key=spot/area/sub/point/tag）："', 1)
t = t.replace(
    '    "⑤保留古建核心（5 级景区组织 + 17 类古建类型 + 历史关键词可折叠 + 周边搜索 nbtype + AI 文物助手分支）。")',
    '    "⑤保留古建核心（5 级景区组织 + 17 类古建类型 + 历史关键词可折叠 + 周边搜索 nbtype + AI 文物助手分支）；"\n'
    '    "⑥新增全平台启动诊断（app 启动即记录版本/平台，UOS 另写 launch_err.log）；⑦UOS 保留 no-store 防缓存 + 每次启动写日志。")', 1)

if missed:
    print("⚠️ 未命中的替换（请人工核对）：")
    for m in missed:
        print("   ", repr(m[:60]))
else:
    print("✅ 所有版本字段替换命中")

DST.write_text(t, encoding="utf-8")
print("✅ 已写入", DST)
