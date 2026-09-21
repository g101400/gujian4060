#!/bin/bash
# 智能 App → 百度网盘(bdpan CLI) 一键分发脚本（方案 B）
# 作用：在 /apps/bdpan/智能app 下建「产品→通道→版本→平台」目录树，
#       上传公开版+内部版可部署文件（共 48 件，基线 v348 若存在一并传），
#       并存入 3 份说明文档。公开版分享链接由 `bash $0 share` 单独生成（防误分享内部版）。
# 前置：bdpan 已 OAuth 登录；本机 bdpan 二进制在下方 PATH。
# 注意：内部版含真实坐标+密钥，脚本只上传、绝不分享；分享仅限公开版目录。

set -u
export PATH="/c/Users/admin/.local/bdpan/versions/3.7.3:$PATH"

ROOT="智能app"
LB="d:/Users/Claw/APK归档"
DOC="d:/Users/Claw/智能app_网盘"

P1="水利一张图"; P2="古建景点打卡"; P3="水利感知项目一张图"
PUB="公开版"; INT="内部版"
UOS_ARCH=(amd64 arm64 loongarch64 mips64el)

PUB_AR="$LB/四端安装包_20260903_v349_pub"
INT_AR="$LB/四端安装包_20260903_v350_int"
OLD_AR="$LB/四端安装包_20260901_v348"   # 基线；缺失则自动跳过

# ---- 鉴权检查 ----
if ! bdpan whoami 2>/dev/null | grep -q "已登录"; then
  echo "✗ bdpan 未登录（或 whoami 抖动），请先完成 OAuth 登录再运行。" >&2
  exit 2
fi

# ---- 逐级建目录（bdpan mkdir 不带 -p，自行补父级）----
mkpath() {
  local p="$1" cur=""
  IFS='/' read -ra parts <<< "$p"
  for part in "${parts[@]}"; do
    cur="$cur$part"
    bdpan mkdir "$cur" >/dev/null 2>&1 || true
    cur="$cur/"
  done
}

# ---- 单文件上传（带本地存在性检查，缺失则跳过）----
up() {
  local local="$1" rdir="$2"
  if [ ! -f "$local" ]; then echo "SKIP(本地缺失): $local"; return; fi
  mkpath "$rdir"
  local fname="$(basename "$local")"
  echo "UPLOAD: $(basename "$(dirname "$local")")/... -> $rdir/$fname"
  bdpan upload "$local" "$rdir/$fname" || echo "  FAIL: $local"
}

echo "===== 开始分发到 $ROOT ====="

# ============ 水利一张图 ============
# 公开版 3.49（源 PUB_AR）
up "$PUB_AR/android/水利工程一张图V3.49_20260903.apk"                       "$ROOT/$P1/$PUB/3.49/Android"
up "$PUB_AR/ios/水利工程一张图_iOS_3.49_20260903_可托管.zip"               "$ROOT/$P1/$PUB/3.49/iOS"
for a in "${UOS_ARCH[@]}"; do up "$PUB_AR/uos-shuili/shuili-map_3.49.20260903_$a.deb" "$ROOT/$P1/$PUB/3.49/UOS"; done
up "$PUB_AR/win/水利工程基础信息一张图_Setup.exe"                          "$ROOT/$P1/$PUB/3.49/Windows"
up "$PUB_AR/win/水利工程基础信息一张图_Setup.msi"                          "$ROOT/$P1/$PUB/3.49/Windows"
# 内部版 3.50（源 INT_AR）
up "$INT_AR/android/水利工程一张图V3.50_20260903.apk"                       "$ROOT/$P1/$INT/3.50/Android"
up "$INT_AR/ios/水利工程一张图_iOS_3.50_20260903_可托管.zip"               "$ROOT/$P1/$INT/3.50/iOS"
for a in "${UOS_ARCH[@]}"; do up "$INT_AR/uos-shuili/shuili-map_3.50.20260903_$a.deb" "$ROOT/$P1/$INT/3.50/UOS"; done
up "$INT_AR/win/水利工程基础信息一张图_Setup.exe"                          "$ROOT/$P1/$INT/3.50/Windows"
up "$INT_AR/win/水利工程基础信息一张图_Setup.msi"                          "$ROOT/$P1/$INT/3.50/Windows"
# 内部版 3.48（基线，源 OLD_AR；缺失跳过）
up "$OLD_AR/android/水利工程一张图V3.48_20260901_5090.apk"                 "$ROOT/$P1/$INT/3.48/Android"
up "$OLD_AR/ios/水利工程一张图_iOS_3.48_20260901_可托管.zip"               "$ROOT/$P1/$INT/3.48/iOS"
for a in "${UOS_ARCH[@]}"; do up "$OLD_AR/uos-shuili/shuili-map_3.48.20260901_$a.deb" "$ROOT/$P1/$INT/3.48/UOS"; done
up "$OLD_AR/win/水利工程基础信息一张图_Setup.exe"                          "$ROOT/$P1/$INT/3.48/Windows"
up "$OLD_AR/win/水利工程基础信息一张图_Setup.msi"                          "$ROOT/$P1/$INT/3.48/Windows"

# ============ 古建景点打卡 ============
# 公开版 3.7（源 PUB_AR，AI 密钥已置空）
up "$PUB_AR/android/古建景点打卡V3.7_20260902_5090.apk"                    "$ROOT/$P2/$PUB/3.7/Android"
up "$PUB_AR/ios/古建景点打卡_iOS_3.7_20260902_可托管.zip"                  "$ROOT/$P2/$PUB/3.7/iOS"
for a in "${UOS_ARCH[@]}"; do up "$PUB_AR/uos-gujian/gujian-map_3.7.20260902_$a.deb" "$ROOT/$P2/$PUB/3.7/UOS"; done
up "$PUB_AR/win/古建景点打卡_Setup.exe"                                    "$ROOT/$P2/$PUB/3.7/Windows"
up "$PUB_AR/win/古建景点打卡_Setup.msi"                                    "$ROOT/$P2/$PUB/3.7/Windows"
# 内部版 3.7（源 INT_AR，真实密钥）
up "$INT_AR/android/古建景点打卡V3.7_20260902_5090.apk"                    "$ROOT/$P2/$INT/3.7/Android"
up "$INT_AR/ios/古建景点打卡_iOS_3.7_20260902_可托管.zip"                  "$ROOT/$P2/$INT/3.7/iOS"
for a in "${UOS_ARCH[@]}"; do up "$INT_AR/uos-gujian/gujian-map_3.7.20260902_$a.deb" "$ROOT/$P2/$INT/3.7/UOS"; done
up "$INT_AR/win/古建景点打卡_Setup.exe"                                    "$ROOT/$P2/$INT/3.7/Windows"
up "$INT_AR/win/古建景点打卡_Setup.msi"                                    "$ROOT/$P2/$INT/3.7/Windows"
# 内部版 3.6（基线，源 OLD_AR；缺失跳过）
up "$OLD_AR/android/古建景点打卡V3.6_20260901_5090.apk"                    "$ROOT/$P2/$INT/3.6/Android"
up "$OLD_AR/ios/古建景点打卡_iOS_3.6_20260901_可托管.zip"                  "$ROOT/$P2/$INT/3.6/iOS"
for a in "${UOS_ARCH[@]}"; do up "$OLD_AR/uos-gujian/gujian-map_3.6.20260901_$a.deb" "$ROOT/$P2/$INT/3.6/UOS"; done
up "$OLD_AR/win/古建景点打卡_Setup.exe"                                    "$ROOT/$P2/$INT/3.6/Windows"
up "$OLD_AR/win/古建景点打卡_Setup.msi"                                    "$ROOT/$P2/$INT/3.6/Windows"

# ============ 水利感知项目一张图 ============
# 公开版 1.25（源 PUB_AR）
up "$PUB_AR/android/水利感知项目一张图V1.25_20260903.apk"                  "$ROOT/$P3/$PUB/1.25/Android"
up "$PUB_AR/ios/水利感知项目一张图_iOS_1.25_20260903_可托管.zip"          "$ROOT/$P3/$PUB/1.25/iOS"
for a in "${UOS_ARCH[@]}"; do up "$PUB_AR/uos-perc/shuili-ganzhi_1.25.20260903_$a.deb" "$ROOT/$P3/$PUB/1.25/UOS"; done
up "$PUB_AR/win/水利感知项目一张图_Setup.exe"                              "$ROOT/$P3/$PUB/1.25/Windows"
up "$PUB_AR/win/水利感知项目一张图_Setup.msi"                              "$ROOT/$P3/$PUB/1.25/Windows"
# 内部版 1.26（源 INT_AR）
up "$INT_AR/android/水利感知项目一张图V1.26_20260903.apk"                  "$ROOT/$P3/$INT/1.26/Android"
up "$INT_AR/ios/水利感知项目一张图_iOS_1.26_20260903_可托管.zip"          "$ROOT/$P3/$INT/1.26/iOS"
for a in "${UOS_ARCH[@]}"; do up "$INT_AR/uos-perc/shuili-ganzhi_1.26.20260903_$a.deb" "$ROOT/$P3/$INT/1.26/UOS"; done
up "$INT_AR/win/水利感知项目一张图_Setup.exe"                              "$ROOT/$P3/$INT/1.26/Windows"
up "$INT_AR/win/水利感知项目一张图_Setup.msi"                              "$ROOT/$P3/$INT/1.26/Windows"
# 内部版 1.24（基线，源 OLD_AR；缺失跳过）
up "$OLD_AR/android/水利感知项目一张图V1.24_20260901_5090.apk"             "$ROOT/$P3/$INT/1.24/Android"
up "$OLD_AR/ios/水利感知项目一张图_iOS_1.24_20260901_可托管.zip"          "$ROOT/$P3/$INT/1.24/iOS"
for a in "${UOS_ARCH[@]}"; do up "$OLD_AR/uos-perc/shuili-ganzhi_1.24.20260901_$a.deb" "$ROOT/$P3/$INT/1.24/UOS"; done
up "$OLD_AR/win/水利感知项目一张图_Setup.exe"                              "$ROOT/$P3/$INT/1.24/Windows"
up "$OLD_AR/win/水利感知项目一张图_Setup.msi"                              "$ROOT/$P3/$INT/1.24/Windows"

# ============ 文档 ============
up "$DOC/版本说明文档/版本说明文档.md"   "$ROOT/版本说明文档"
up "$DOC/网盘同步规则/网盘同步规则.md"   "$ROOT/网盘同步规则"
up "$DOC/网盘文件落点清单.md"             "$ROOT"

echo "===== 分发完成（内部版仅存储、不分享）====="

# ============ 公开版分享链接（单独触发：bash $0 share）============
if [ "${1:-}" = "share" ]; then
  echo "===== 生成公开版分享链接（有效期 7 天）====="
  for d in "$ROOT/$P1/$PUB/3.49" "$ROOT/$P3/$PUB/1.25" "$ROOT/$P2/$PUB/3.7"; do
    echo "SHARE: $d"
    bdpan share "$d" --period 7 --json || echo "  FAIL share: $d"
  done
  echo "===== 分享链接生成完毕 ====="
else
  echo "[提示] 公开版分享链接未生成。确认上传无误后执行：bash $0 share"
fi
