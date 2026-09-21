#!/bin/bash
# build_four_ends.sh - 多产品四端打包驱动（Android/UOS/Win/Apple）
#
# 循环多个产品，逐个调用 multi-platform-app-pack 的构建脚本。
# 每个产品一行配置： APP_NAME|VERSION|DATE|SRC_WEBROOT|APK_SRC
#
# 用法：
#   bash build_four_ends.sh <输出目录>
#
# 依赖：python3、NSIS(可选,回退7z)、7z(可选)
set -e

OUT_ROOT="${1:-D:/Users/Claw/APK归档/四端安装包_20260824_v33}"
DATE="20260824"
SKILL_DIR="C:/Users/admin/.workbuddy/skills/multi-platform-app-pack"
SKILL_WIN="$(cygpath -w "$SKILL_DIR" 2>/dev/null || echo "$SKILL_DIR")"

# NSIS 探测
NSIS_BIN="${NSIS:-}"
[ -z "$NSIS_BIN" ] && [ -f "/c/Program Files (x86)/NSIS/makensis.exe" ] && NSIS_BIN="/c/Program Files (x86)/NSIS/makensis.exe"
[ -z "$NSIS_BIN" ] && [ -f "/c/Program Files/NSIS/makensis.exe" ] && NSIS_BIN="/c/Program Files/NSIS/makensis.exe"
SEVENZ="$(command -v 7z 2>/dev/null || true)"
[ -z "$SEVENZ" ] && [ -f "/c/Program Files/7-Zip/7z.exe" ] && SEVENZ="/c/Program Files/7-Zip/7z.exe"
NSIS_BIN_WIN="$(cygpath -w "$NSIS_BIN" 2>/dev/null || echo "$NSIS_BIN")"

# ---------- 产品配置（APP_NAME|VERSION|SRC|APK） ----------
PRODUCTS=(
 "水利工程一张图|3.30.3|D:/Users/Claw/native-shell/win-water-webview2/webroot|D:/Users/Claw/android-build/shuili-v329/app-release.apk"
 "水利感知项目一张图|1.6.3|D:/Users/Claw/native-shell/win-webview2/webroot|D:/Users/Claw/android-build/perc-v13/app-release.apk"
 "古建景点打卡|1.8.3|D:/Users/Claw/native-shell/win-gujian-webview2/webroot|D:/Users/Claw/travel/android/app-release.apk"
)

# ---------- APK 签名门禁 ----------
check_apk_signed() {
  local apk_win="$(cygpath -w "$1" 2>/dev/null || echo "$1")"
  python3 - "$apk_win" <<'PY'
import sys, zipfile
try:
    z = zipfile.ZipFile(sys.argv[1])
except Exception as e:
    print("APK 无法读取:", e); sys.exit(2)
names = z.namelist()
signed = any(n.startswith("META-INF/") and (n.endswith(".SF") or n.endswith(".RSA")
          or n.endswith(".DSA") or n == "META-INF/MANIFEST.MF") for n in names)
sys.exit(0 if signed else 1)
PY
}

build_one() {
  local APP="$1" VER="$2" SRC="$3" APK="$4"
  local DEB_PKG="shuili-map"
  local SRC_WIN="$(cygpath -w "$SRC" 2>/dev/null || echo "$SRC")"
  local OUT="$OUT_ROOT/$APP"
  mkdir -p "$OUT"
  local OUT_WIN="$(cygpath -w "$OUT" 2>/dev/null || echo "$OUT")"
  echo ""
  echo "============================================="
  echo "📦 $APP V$VER ($DATE)"
  echo "============================================="

  # 1) Android APK
  echo "[1/4] Android APK"
  if [ ! -f "$APK" ]; then echo "  ❌ APK 源缺失: $APK" >&2; return 1; fi
  if ! check_apk_signed "$APK"; then echo "  ❌ APK 未签名: $APK" >&2; return 1; fi
  cp "$APK" "$OUT/${APP}V${VER}_${DATE}_5090.apk"
  echo "  ✅ ${APP}V${VER}_${DATE}_5090.apk"

  # 2) UOS DEB
  echo "[2/4] UOS DEB"
  python3 "${SKILL_WIN}/assets/build_deb.py" --version "${VER}-${DATE}" --src "$SRC_WIN" --out "${OUT_WIN}/${DEB_PKG}_${VER}-${DATE}_all.deb"
  echo "  ✅ ${DEB_PKG}_${VER}-${DATE}_all.deb"

  # 3) Win11 EXE
  echo "[3/4] Win11 EXE"
  local stage="/tmp/win-stage-${APP// /_}-${DATE}"
  rm -rf "$stage" && mkdir -p "$stage"
  cp -r "$SRC"/* "$stage/"
  cat > "$stage/run.bat" << EOF
@echo off
cd /d %~dp0
echo ==========================================
echo    ${APP} V${VER} - Win11 x86_64 启动
echo ==========================================
echo.
where python >nul 2>nul
if %errorlevel%==0 (
  echo 启动本地服务 http://127.0.0.1:8899 ...
  start "" http://127.0.0.1:8899/index.html
  python -m http.server 8899
) else (
  echo 未检测到 Python，直接打开离线版（file://）
  start "" "%~dp0index.html"
)
EOF
  cat > "$stage/安装说明.txt" << EOF
${APP}（Win11 x86_64 安装版）
版本：V${VER}_${DATE}
要求：Windows 11 x86_64
EOF
  local win_stage="$(cygpath -w "$stage" 2>/dev/null || echo "$stage")"
  local win_out="$(cygpath -w "$OUT/${APP}V${VER}_${DATE}_Win11_x86_64_一键安装.exe" 2>/dev/null || echo "$OUT/${APP}V${VER}_${DATE}_Win11_x86_64_一键安装.exe")"
  if [ -n "$NSIS_BIN" ] && [ -f "$NSIS_BIN" ]; then
    python3 "${SKILL_WIN}/assets/build_win_nsis.py" --src "$win_stage" --out "$win_out" --app "$APP" --version "$VER" --date "$DATE" --publisher xitian --makensis "$NSIS_BIN_WIN"
    echo "  ✅ NSIS 真安装器"
  elif [ -n "$SEVENZ" ]; then
    cat > "$stage/config.txt" <<'CFG'
;!@Install@!UTF-8!
BeginPrompt="确定安装？"
Directory="%ProgramFiles%\\APPNAME"
RunProgram="run.bat"
;!@InstallEnd@!
CFG
    sed -i "s/APPNAME/${APP}/g" "$stage/config.txt"
    local sevenz_win="$(cygpath -w "$SEVENZ" 2>/dev/null || echo "$SEVENZ")"
    local cfg_win="$(cygpath -w "$stage/config.txt" 2>/dev/null || echo "$stage/config.txt")"
    "$sevenz_win" a -sfx -y "$win_out" "$cfg_win" "$win_stage" >/dev/null
    echo "  ✅ 7z SFX 自解压"
  else
    echo "  ❌ 无 NSIS 且无 7z，无法生成 Win11 EXE" >&2; return 1
  fi

  # 4) Apple PWA ZIP
  echo "[4/4] Apple iOS PWA ZIP"
  python3 "${SKILL_WIN}/assets/build_apple_zip.py" --version "${VER}_${DATE}" --app "$APP" --src "$SRC_WIN" --out "${OUT_WIN}/${APP}_iOS_${VER}_${DATE}_可托管.zip"
  echo "  ✅ ${APP}_iOS_${VER}_${DATE}_可托管.zip"

  # 校验
  echo "[校验] verify_pkg.py"
  python3 "${SKILL_WIN}/assets/verify_pkg.py" \
    --apk "$OUT_WIN/${APP}V${VER}_${DATE}_5090.apk" \
    --deb "$OUT_WIN/${DEB_PKG}_${VER}-${DATE}_all.deb" \
    --exe "$OUT_WIN/${APP}V${VER}_${DATE}_Win11_x86_64_一键安装.exe" \
    --zip "$OUT_WIN/${APP}_iOS_${VER}_${DATE}_可托管.zip" \
    --version "$VER" || true

  # 对照单
  python3 "${SKILL_WIN}/assets/gen_compare.py" --version "$VER" --date "$DATE" --app "$APP" --out "$OUT_WIN/四端功能对照单_V${VER}.md"
  echo "  ✅ 四端功能对照单_V${VER}.md"
}

for line in "${PRODUCTS[@]}"; do
  IFS='|' read -r APP VER SRC APK <<< "$line"
  build_one "$APP" "$VER" "$SRC" "$APK"
done

echo ""
echo "✅ 三产品四端打包完成，产物位于：$OUT_ROOT"
