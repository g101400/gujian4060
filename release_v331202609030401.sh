#!/bin/bash
# release_v331.sh —— 三产品 × 四平台 v3.31 发布流水线
#
#   Android : aapt2+d8+zipalign+apksigner（build_apk.sh，含版本门禁）
#   Win11   : dotnet8 publish → WiX7 MSI + NSIS 一键安装 EXE
#   统信UOS : make_deb.py（架构对照表，默认 mips64el）
#   iOS     : build_ios_zip.py（PWA 可托管 ZIP）
#
# 用法：bash release_v331.sh [输出根目录] [UOS架构]
set -u

ROOT="D:/Users/Claw"
DATE="20260828"
OUT_ROOT="${1:-$ROOT/APK归档/四端安装包_${DATE}_v336}"
UOS_ARCH="${2:-mips64el}"

export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-C:/Users/admin/.workbuddy/android-sdk}"
export PATH="$PATH:/c/Users/admin/.dotnet/tools"
BT="$ANDROID_SDK_ROOT/build-tools/34.0.0"
NSIS_BIN="/c/Program Files (x86)/NSIS/makensis.exe"
SKILL_DIR="C:/Users/admin/.workbuddy/skills/multi-platform-app-pack"

# key | 产品名 | 版本 | 安卓工程 | Win工程 | UpgradeCode | exe名
PRODUCTS=(
"shuili|水利工程一张图|3.36|$ROOT/android-build/shuili-v329|$ROOT/native-shell/win-water-webview2|{A1B2C3D4-0001-4000-8000-000000000001}|水利工程基础信息一张图.exe"
"perc|水利感知项目一张图|1.12|$ROOT/android-build/perc-v13|$ROOT/native-shell/win-webview2|{B2C3D4E5-0002-4000-8000-000000000002}|水利感知项目一张图.exe"
"gujian|古建景点打卡|2.4|$ROOT/travel/android|$ROOT/native-shell/win-gujian-webview2|{C3D4E5F6-0003-4000-8000-000000000003}|古建景点打卡.exe"
)

FAIL=0
note() { echo "  $*"; }
fail() { echo "  ❌ $*" >&2; FAIL=1; }

# ---------- 0) 防回归：水利镜像副本 aowwei_app/webroot_shuili 与 canonical 对齐 ----------
# 根因：bump_version_*.py 的 webroots 仅含 6 个 native-shell 副本，遗漏此镜像，致其多次停在旧版
#       (v3.26→08-25 同步 v3.30.3；v3.31→08-26 重新同步；v3.32→08-28 重新同步到 v3.33)。
#       此处每轮构建前强制与 canonical (android-build/shuili-v329/assets) 对齐，杜绝再次分叉。
MIRROR="D:/Users/aowwei_app/webroot_shuili"
CANON="$ROOT/android-build/shuili-v329/assets"
if [ -d "$MIRROR" ] && [ -d "$CANON" ]; then
  for f in version.json app.js ovobj_bridge.js; do
    if ! cmp -s "$CANON/$f" "$MIRROR/$f" 2>/dev/null; then
      cp -p "$CANON/$f" "$MIRROR/$f"
      echo "  🔄 水利镜像同步 $f -> $MIRROR ($(stat -c%s "$MIRROR/$f") bytes)"
    else
      echo "  ✅ 水利镜像 $f 已与 canonical 一致"
    fi
  done
else
  echo "  ⚠️ 水利镜像($MIRROR) 或 canonical($CANON) 缺失，跳过镜像同步"
fi

for line in "${PRODUCTS[@]}"; do
  IFS='|' read -r KEY NAME VER APROJ WPROJ UPG EXE <<< "$line"
  OUT="$OUT_ROOT/$NAME"
  mkdir -p "$OUT"
  echo ""
  echo "==================================================="
  echo "📦 $NAME  V$VER  ($DATE)"
  echo "==================================================="

  # ---------- 0) 重建 APK（根治版本滞后：从 version.json 同步 manifest 再签名）----------
  echo "[0/4] 重建 APK（build_apk.sh：version.json → manifest → 签名）"
  if [ -f "$APROJ/build_apk.sh" ]; then
    ( cd "$APROJ" && bash build_apk.sh ) || { fail "build_apk.sh 失败（$APROJ）"; continue; }
  else
    echo "  ⚠️ 无 build_apk.sh，跳过重建（沿用既有 app-release.apk）"
  fi

  # ---------- 1) Android APK ----------
  echo "[1/4] Android APK"
  APK="$APROJ/app-release.apk"
  if [ ! -f "$APK" ]; then
    fail "APK 缺失，先跑 $APROJ/build_apk.sh"
  else
    BADGE="$("$BT/aapt2.exe" dump badging "$APK" 2>/dev/null | grep -m1 "^package:")"
    echo "$BADGE" | grep -q "versionName='$VER'" \
      && note "badging OK: $(echo "$BADGE" | grep -oE "versionCode='[0-9]+' versionName='[^']+'")" \
      || fail "APK versionName 不是 $VER → $BADGE"
    "$BT/apksigner.bat" verify "$APK" >/dev/null 2>&1 \
      && note "签名校验 OK" || fail "apksigner verify 失败"
    cp "$APK" "$OUT/${NAME}V${VER}_${DATE}_5090.apk"
    note "✅ ${NAME}V${VER}_${DATE}_5090.apk ($(stat -c%s "$APK") bytes)"
  fi

  # ---------- 2) 统信 UOS DEB ----------
  echo "[2/4] 统信 UOS DEB ($UOS_ARCH)"
  DEB_OUT_DIR="$OUT" python3 "$ROOT/native-shell/make_deb.py" "$KEY" "$UOS_ARCH" \
    && note "✅ deb 完成" || fail "deb 构建失败"

  # ---------- 3) Win11：publish → MSI + NSIS EXE ----------
  echo "[3/4] Win11 (dotnet publish → WiX7 MSI + NSIS EXE)"
  PUB="$WPROJ/publish_v331"
  rm -rf "$PUB" 2>/dev/null
  ( cd "$WPROJ" && dotnet publish ShuiliMap.csproj -c Release -r win-x64 \
      --self-contained false -o "$PUB" -v quiet --nologo ) >/tmp/pub_$KEY.log 2>&1
  if [ ! -f "$PUB/$EXE" ]; then
    fail "dotnet publish 失败（见 /tmp/pub_$KEY.log）"; tail -5 /tmp/pub_$KEY.log
  else
    note "publish OK ($(find "$PUB" -type f | wc -l) 个文件)"
    # webroot 以 canonical 为准再覆盖一次，防 Content 缓存
    cp -r "$WPROJ/webroot/." "$PUB/webroot/" 2>/dev/null
    python3 "$ROOT/native-shell/gen_msi_v331.py" --pub "$PUB" --name "$NAME" \
      --ver "$VER" --upgrade "$UPG" --exe "$EXE" \
      --out "$OUT/${NAME}V${VER}_${DATE}_Win11_x64.msi" || fail "MSI 生成失败"
    # NSIS 一键安装 EXE（与 MSI 并行提供，便于无管理员权限场景）
    if [ -f "$NSIS_BIN" ]; then
      python3 "$(cygpath -w "$SKILL_DIR")/assets/build_win_nsis.py" \
        --src "$(cygpath -w "$PUB")" \
        --out "$(cygpath -w "$OUT/${NAME}V${VER}_${DATE}_Win11_x86_64_一键安装.exe")" \
        --app "$NAME" --version "$VER" --date "$DATE" --publisher xitian \
        --makensis "$(cygpath -w "$NSIS_BIN")" >/tmp/nsis_$KEY.log 2>&1 \
        && note "✅ NSIS EXE 完成" || { note "⚠️ NSIS 失败（见 /tmp/nsis_$KEY.log）"; tail -3 /tmp/nsis_$KEY.log; }
    fi
  fi

  # ---------- 4) iOS PWA ----------
  echo "[4/4] iOS PWA 可托管 ZIP"
  python3 "$ROOT/native-shell/water-ios/build_ios_zip.py" "$KEY" >/tmp/ios_$KEY.log 2>&1 \
    && { IOSZIP="$(ls -t "$ROOT/native-shell/water-ios/apple-package/"*"${VER}_${DATE}"*.zip 2>/dev/null | head -1)"
         [ -n "$IOSZIP" ] && cp "$IOSZIP" "$OUT/" && note "✅ $(basename "$IOSZIP")" || fail "iOS zip 未找到"; } \
    || { fail "iOS 构建失败"; tail -5 /tmp/ios_$KEY.log; }
done

echo ""
echo "==================================================="
echo "📋 产物清单：$OUT_ROOT"
echo "==================================================="
find "$OUT_ROOT" -type f \( -name "*.apk" -o -name "*.deb" -o -name "*.msi" -o -name "*.exe" -o -name "*.zip" \) \
  -printf "%-92p %10s bytes\n" 2>/dev/null | sort
echo ""
[ "$FAIL" -eq 0 ] && echo "✅ 四平台全部构建成功" || echo "⚠️ 存在失败项，见上方 ❌"
exit $FAIL
