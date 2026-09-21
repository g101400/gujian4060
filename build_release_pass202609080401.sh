#!/bin/bash
# build_release_pass.sh <归档名> — 三产品×四平台单通道构建
# 前置：构建源已处于本通道对应的数据状态（公开=已脱敏 / 内部=真实数据），构建脚本版本串已 bump。
set -u
ROOT="D:/Users/Claw"
ARCHIVE_NAME="${1:-四端安装包_20260905_v355_pub}"
V_SHUILI="${2:-3.55}"; V_PERC="${3:-1.31}"; V_GUJIAN="${4:-3.7.3}"
DATE="20260905"
OUT="$ROOT/APK归档/$ARCHIVE_NAME"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-C:/Users/admin/.workbuddy/android-sdk}"
BT="$ANDROID_SDK_ROOT/build-tools/34.0.0"
FAIL=0
note() { echo "  $*"; }
fail() { echo "  ❌ $*" >&2; FAIL=1; }

mkdir -p "$OUT/android" "$OUT/ios" "$OUT/win"

echo "========== [1/4] Android APK =========="
declare -A APK_NAMES=( [shuili]="水利工程一张图V${V_SHUILI}_${DATE}.apk" [perc]="水利感知项目一张图V${V_PERC}_${DATE}.apk" [gujian]="古建景点打卡V${V_GUJIAN}_${DATE}.apk" )
for proj in shuili-v329 perc-v13; do
  d="$ROOT/android-build/$proj"
  echo "[$proj] build_apk.sh ..."
  ( cd "$d" && bash build_apk.sh ) >/tmp/apk_$proj.log 2>&1 \
    && note "$proj APK OK" || { fail "$proj build_apk.sh 失败"; tail -8 /tmp/apk_$proj.log; continue; }
done
( cd "$ROOT/travel/android" && bash build_apk.sh ) >/tmp/apk_gujian.log 2>&1 \
  && note "gujian APK OK" || { fail "gujian build_apk.sh 失败"; tail -8 /tmp/apk_gujian.log; }

cp "$ROOT/android-build/shuili-v329/app-release.apk"   "$OUT/android/${APK_NAMES[shuili]}" 2>/dev/null || fail "shuili APK 复制失败"
cp "$ROOT/android-build/perc-v13/app-release.apk"      "$OUT/android/${APK_NAMES[perc]}" 2>/dev/null || fail "perc APK 复制失败"
cp "$ROOT/travel/android/app-release.apk"              "$OUT/android/${APK_NAMES[gujian]}" 2>/dev/null || fail "gujian APK 复制失败"
for f in "$OUT"/android/*.apk; do
  b="$("$BT/aapt2.exe" dump badging "$f" 2>/dev/null | grep -m1 '^package:')"
  echo "  $(basename "$f") -> $(echo "$b" | grep -oE "versionCode='[0-9]+' versionName='[^']+'")"
  "$BT/apksigner.bat" verify "$f" >/dev/null 2>&1 && note "签名 OK $(basename "$f")" || fail "签名失败 $f"
done

echo "========== [2/4] UOS DEB (4 架构) =========="
for key in shuili perc gujian; do
  for arch in mips64el loongarch64 arm64 amd64; do
    DEB_OUT_DIR="$OUT/uos-$key" python3 "$ROOT/native-shell/make_deb.py" "$key" "$arch" >/tmp/deb_${key}_${arch}.log 2>&1 \
      && note "deb $key/$arch OK" || { fail "deb $key/$arch 失败"; tail -5 /tmp/deb_${key}_${arch}.log; }
  done
done

echo "========== [3/4] Win MSI + NSIS EXE =========="
python3 "$ROOT/native-shell/gen_win_msi_wix7.py" >/tmp/win_msi.log 2>&1 \
  && note "MSI ×3 OK" || { fail "MSI 构建失败"; tail -15 /tmp/win_msi.log; }
python3 "$ROOT/native-shell/build_win_exe_nsis.py" >/tmp/win_exe.log 2>&1 \
  && note "NSIS EXE ×3 OK" || { fail "NSIS 构建失败"; tail -15 /tmp/win_exe.log; }

echo "========== [4/4] iOS PWA ZIP =========="
for key in shuili perc gujian; do
  python3 "$ROOT/native-shell/water-ios/build_ios_zip.py" "$key" >/tmp/ios_$key.log 2>&1 \
    && note "iOS $key OK" || { fail "iOS $key 失败"; tail -8 /tmp/ios_$key.log; }
done
cp "$ROOT"/native-shell/water-ios/apple-package/*_"${DATE}"_可托管.zip "$OUT/ios/" 2>/dev/null || fail "iOS zip 复制失败"

echo ""
echo "========== 产物清单 $OUT =========="
find "$OUT" -type f -printf "%-100p %10s bytes\n" | sort
[ "$FAIL" -eq 0 ] && echo "✅ 本通道全部构建成功" || echo "⚠️ 存在失败项"
exit $FAIL
