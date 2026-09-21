#!/bin/bash
# 智能 App → 百度网盘 分发（2026-09-07 版：公开 3.59/1.35/3.7.5 + 内部 3.60/1.36/3.7.5）
# 内部版含真实数据，仅上传不分享；公开版分享由 bash $0 share 单独生成。
set -u
export PATH="/c/Users/admin/.local/bdpan/versions/3.7.3:$PATH"
ROOT="智能app"
LB="d:/Users/Claw/APK归档"
DOC="d:/Users/Claw/智能app_网盘"
P1="水利一张图"; P2="古建景点打卡"; P3="水利感知项目一张图"
PUB="公开版"; INT="内部版"
UOS_ARCH=(amd64 arm64 loongarch64 mips64el)
PUB_AR="$LB/四端安装包_20260907_v359_pub"
INT_AR="$LB/四端安装包_20260907_v360_int"

if ! bdpan whoami 2>/dev/null | grep -q "已登录"; then
  echo "✗ bdpan 未登录，请先 OAuth 登录" >&2; exit 2
fi
mkpath() {
  local p="$1" cur=""
  IFS='/' read -ra parts <<< "$p"
  for part in "${parts[@]}"; do
    cur="$cur$part"; bdpan mkdir "$cur" >/dev/null 2>&1 || true; cur="$cur/"
  done
}
up() {
  local local_f="$1" rdir="$2"
  if [ ! -f "$local_f" ]; then echo "SKIP(本地缺失): $local_f"; return; fi
  mkpath "$rdir"
  echo "UPLOAD -> $rdir/$(basename "$local_f")"
  bdpan upload "$local_f" "$rdir/$(basename "$local_f")" || echo "  FAIL: $local_f"
}
echo "===== 开始分发到 $ROOT ====="
# 水利一张图 公开 3.59
up "$PUB_AR/android/水利工程一张图V3.59_20260907.apk"   "$ROOT/$P1/$PUB/3.59/Android"
up "$PUB_AR/ios/水利工程一张图_iOS_3.59_20260907_可托管.zip" "$ROOT/$P1/$PUB/3.59/iOS"
for a in "${UOS_ARCH[@]}"; do up "$PUB_AR/uos-shuili/shuili-map_3.59.20260907_$a.deb" "$ROOT/$P1/$PUB/3.59/UOS"; done
up "$PUB_AR/win/水利工程基础信息一张图_Setup.exe" "$ROOT/$P1/$PUB/3.59/Windows"
up "$PUB_AR/win/水利工程基础信息一张图_Setup.msi" "$ROOT/$P1/$PUB/3.59/Windows"
# 水利一张图 内部 3.60
up "$INT_AR/android/水利工程一张图V3.60_20260907.apk"   "$ROOT/$P1/$INT/3.60/Android"
up "$INT_AR/ios/水利工程一张图_iOS_3.60_20260907_可托管.zip" "$ROOT/$P1/$INT/3.60/iOS"
for a in "${UOS_ARCH[@]}"; do up "$INT_AR/uos-shuili/shuili-map_3.60.20260907_$a.deb" "$ROOT/$P1/$INT/3.60/UOS"; done
up "$INT_AR/win/水利工程基础信息一张图_Setup.exe" "$ROOT/$P1/$INT/3.60/Windows"
up "$INT_AR/win/水利工程基础信息一张图_Setup.msi" "$ROOT/$P1/$INT/3.60/Windows"
# 古建景点打卡 3.7.5（公/内同源）
up "$PUB_AR/android/古建景点打卡V3.7.5_20260907.apk"   "$ROOT/$P2/$PUB/3.7.5/Android"
up "$PUB_AR/ios/古建景点打卡_iOS_3.7.5_20260907_可托管.zip" "$ROOT/$P2/$PUB/3.7.5/iOS"
for a in "${UOS_ARCH[@]}"; do up "$PUB_AR/uos-gujian/gujian-map_3.7.5.20260907_$a.deb" "$ROOT/$P2/$PUB/3.7.5/UOS"; done
up "$PUB_AR/win/古建景点打卡_Setup.exe" "$ROOT/$P2/$PUB/3.7.5/Windows"
up "$PUB_AR/win/古建景点打卡_Setup.msi" "$ROOT/$P2/$PUB/3.7.5/Windows"
up "$INT_AR/android/古建景点打卡V3.7.5_20260907.apk"   "$ROOT/$P2/$INT/3.7.5/Android"
up "$INT_AR/ios/古建景点打卡_iOS_3.7.5_20260907_可托管.zip" "$ROOT/$P2/$INT/3.7.5/iOS"
for a in "${UOS_ARCH[@]}"; do up "$INT_AR/uos-gujian/gujian-map_3.7.5.20260907_$a.deb" "$ROOT/$P2/$INT/3.7.5/UOS"; done
up "$INT_AR/win/古建景点打卡_Setup.exe" "$ROOT/$P2/$INT/3.7.5/Windows"
up "$INT_AR/win/古建景点打卡_Setup.msi" "$ROOT/$P2/$INT/3.7.5/Windows"
# 水利感知项目一张图 公开 1.35
up "$PUB_AR/android/水利感知项目一张图V1.35_20260907.apk"   "$ROOT/$P3/$PUB/1.35/Android"
up "$PUB_AR/ios/水利感知项目一张图_iOS_1.35_20260907_可托管.zip" "$ROOT/$P3/$PUB/1.35/iOS"
for a in "${UOS_ARCH[@]}"; do up "$PUB_AR/uos-perc/shuili-ganzhi_1.35.20260907_$a.deb" "$ROOT/$P3/$PUB/1.35/UOS"; done
up "$PUB_AR/win/水利感知项目一张图_Setup.exe" "$ROOT/$P3/$PUB/1.35/Windows"
up "$PUB_AR/win/水利感知项目一张图_Setup.msi" "$ROOT/$P3/$PUB/1.35/Windows"
# 水利感知项目一张图 内部 1.36
up "$INT_AR/android/水利感知项目一张图V1.36_20260907.apk"   "$ROOT/$P3/$INT/1.36/Android"
up "$INT_AR/ios/水利感知项目一张图_iOS_1.36_20260907_可托管.zip" "$ROOT/$P3/$INT/1.36/iOS"
for a in "${UOS_ARCH[@]}"; do up "$INT_AR/uos-perc/shuili-ganzhi_1.36.20260907_$a.deb" "$ROOT/$P3/$INT/1.36/UOS"; done
up "$INT_AR/win/水利感知项目一张图_Setup.exe" "$ROOT/$P3/$INT/1.36/Windows"
up "$INT_AR/win/水利感知项目一张图_Setup.msi" "$ROOT/$P3/$INT/1.36/Windows"
# 文档
up "$DOC/版本说明文档/版本说明文档.md" "$ROOT/版本说明文档"
up "$DOC/网盘同步规则/网盘同步规则.md" "$ROOT/网盘同步规则"
up "$DOC/网盘文件落点清单.md"           "$ROOT"
echo "===== 分发完成（内部版仅存储、不分享）====="
if [ "${1:-}" = "share" ]; then
  echo "===== 生成公开版分享链接 ====="
  for d in "$ROOT/$P1/$PUB/3.59" "$ROOT/$P2/$PUB/3.7.5" "$ROOT/$P3/$PUB/1.35"; do
    echo "SHARE: $d"; bdpan share "$d" --period 7 --json || echo "  FAIL: $d"
  done
else
  echo "[提示] 公开版分享链接未生成：bash $0 share"
fi
