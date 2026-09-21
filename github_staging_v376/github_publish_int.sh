#!/usr/bin/env bash
# ============================================================
# 三图一张图 v3.76 / 1.52 / 3.7.13  GitHub 内部 Release 发布剧本
# 仅内部仓 Release（APK + 4 deb + 1 iOS）；公开 Pages 见 github_publish_pub.sh
# 前置：gh auth login 已完成（gh 经 GH 环境变量传入绝对路径）
# ============================================================
set -eu
GH="${GH:-gh}"
STAGE="$(cd "$(dirname "$0")" && pwd)"
ARCHS=(amd64 arm64 loongarch64 mips64el)

echo "==> [0] 鉴权检查"
if ! "$GH" auth status >/dev/null 2>&1; then
  echo "❌ 未登录 GitHub。请先执行：gh auth login"
  exit 1
fi

# ---------- 内部仓 Release 资产 ----------
publish_release () {
  local repo="$1" tag="$2" title="$3" notes="$4"; shift 4
  echo "==> [release] $repo @ $tag"
  if "$GH" release view "$tag" --repo "$repo" >/dev/null 2>&1; then
    echo "   已存在 release，跳过创建（如需补资产请手动 gh release upload）"
  else
    "$GH" release create "$tag" --repo "$repo" --title "$title" --notes-file "$notes" --latest "$@"
    echo "   ✅ release 已创建"
  fi
}

# 水利 shuili
DEBS_SH=()
for a in "${ARCHS[@]}"; do DEBS_SH+=("$STAGE/shuili-yitu5090/uos/shuili-map_3.76.20260916_$a.deb"); done
publish_release "g101400/shuili-yitu5090" "v3.76" "水利工程一张图 v3.76" "$STAGE/RELEASE_NOTES.md" \
  "$STAGE/shuili-yitu5090/android/水利工程一张图V3.76_20260916.apk" \
  "${DEBS_SH[@]}" \
  "$STAGE/shuili-yitu5090/ios/水利工程一张图_iOS_3.76_20260916_可托管.zip"

# 感知 ganzhi
DEBS_GZ=()
for a in "${ARCHS[@]}"; do DEBS_GZ+=("$STAGE/ganzhi-yitu5090/uos/shuili-ganzhi_1.52.20260916_$a.deb"); done
publish_release "g101400/ganzhi-yitu5090" "v1.52" "水利感知项目一张图 v1.52" "$STAGE/RELEASE_NOTES.md" \
  "$STAGE/ganzhi-yitu5090/android/水利感知项目一张图V1.52_20260916.apk" \
  "${DEBS_GZ[@]}" \
  "$STAGE/ganzhi-yitu5090/ios/水利感知项目一张图_iOS_1.52_20260916_可托管.zip"

# 古建 gujian
DEBS_GJ=()
for a in "${ARCHS[@]}"; do DEBS_GJ+=("$STAGE/gujian-travel5090/uos/gujian-map_3.7.13.20260916_$a.deb"); done
publish_release "g101400/gujian-travel5090" "v3.7.13" "古建景点打卡 v3.7.13" "$STAGE/RELEASE_NOTES.md" \
  "$STAGE/gujian-travel5090/android/古建景点打卡V3.7.13_20260916.apk" \
  "${DEBS_GJ[@]}" \
  "$STAGE/gujian-travel5090/ios/古建景点打卡_iOS_3.7.13_20260916_可托管.zip"

echo "✅ 内部 Release 全部发布完成"
