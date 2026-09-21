#!/usr/bin/env bash
# 手动用 aapt2 + d8 + zipalign + apksigner 构建并签名离线 APK
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_SDK_ROOT:-C:/Users/admin/.workbuddy/android-sdk}"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
AAPT2="$BT/aapt2.exe"
D8="$BT/d8.bat"
ZIPALIGN="$BT/zipalign.exe"
APKSIGNER="$BT/apksigner.bat"

cd "$HERE"
# 清理上一轮可能残留的生成产物（TEMP 构建目录下 rm 可用）
rm -f res_compiled.zip app-unsigned.apk app-aligned.apk app-release.apk 2>/dev/null || true
echo "[1] 编译资源 res -> res_compiled.zip"
"$AAPT2" compile --dir res -o res_compiled.zip
echo "[2] 链接资源 + 打包 assets -> app-unsigned.apk"
"$AAPT2" link -o app-unsigned.apk -I "$PLATFORM" --manifest AndroidManifest.xml -A assets res_compiled.zip
echo "[3] 编译 Java"
mkdir -p obj
javac -encoding UTF-8 -cp "$PLATFORM" -d obj src/com/gujian/travel/MainActivity.java src/com/gujian/travel/LargeFileManager.java
echo "[4] 转 DEX"
mkdir -p dex
CLASSES=$(find obj -name "*.class")
"$D8" --lib "$PLATFORM" --output dex $CLASSES
echo "[5] 注入 classes.dex（以不压缩方式，Android 才加载）"
PY="${PY_EXE:-python3}"
"$PY" - app-unsigned.apk dex/classes.dex <<'PYEOF'
import sys, zipfile
apk, dex = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(apk, 'a', compression=zipfile.ZIP_STORED) as z:
    # 避免重复写入
    if 'classes.dex' not in z.namelist():
        z.write(dex, 'classes.dex')
print('classes.dex injected; entries:', len(zipfile.ZipFile(apk).namelist()))
PYEOF
echo "[6] zipalign"
"$ZIPALIGN" -p 4 app-unsigned.apk app-aligned.apk
echo "[7] 签名 -> app-release.apk"
"$APKSIGNER" sign --ks keystore.jks --ks-key-alias xitian \
  --ks-pass pass:xitian123 --key-pass pass:xitian123 \
  --out app-release.apk app-aligned.apk
echo "[完成] app-release.apk"
ls -la app-release.apk
