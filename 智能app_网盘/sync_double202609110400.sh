#!/bin/bash
# 智能 App 双同步（同步A 分发 + 同步B 备份）增量自动化脚本
# 作用：每次发版后运行一次 → 自动发现本地 APK归档 中「网盘还没有」的新版本，
#       分类增量上传到 /apps/bdpan/智能app，跑防泄露门禁，给公开版出分享链接，
#       并把工程源按日期备份到 项目备份/YYYYMMDD。
# 特性：① 增量（远端已有同名文件则跳过）② 门禁（公开版必须 verify_leakfree PASS）
#       ③ 公开/内部铁律（内部版只传不分享）④ 仅处理双通道命名归档，旧版不入盘。
# 前置：bdpan 已 OAuth 登录（Token 约 30 天，过期需重新授权）。
# 用法：bash sync_double.sh           # 正常双同步
#       bash sync_double.sh --share   # 强制重新生成全部公开版分享链接

set -u
export PATH="/c/Users/admin/.local/bdpan/versions/3.7.3:$PATH"

BDPAN_ROOT="智能app"
LB="d:/Users/Claw/APK归档"
DOC="d:/Users/Claw/智能app_网盘"
SRC="d:/Users/Claw"
LEAK="$SRC/.workbuddy/skills/dual-channel-leakfree-release/scripts/verify_leakfree.py"
BASELINE="四端安装包_20260901_v348"   # 历史基线（内部版，无 pub/int 后缀），其余旧版默认不入盘
TODAY=$(date +%Y%m%d)
LOG="$DOC/sync_double_run.log"
SHARED_LIST="$DOC/.shared_dirs.txt"
FORCE_SHARE="${1:-}"

# ---------- 文件名 → 产品/平台/版本/通道 解析 ----------
prod_of() {
  case "$1" in
    *古建*)            echo "古建景点打卡" ;;
    *感知*)            echo "水利感知项目一张图" ;;
    *水利*)            echo "水利一张图" ;;
    *shuili-map*)      echo "水利一张图" ;;
    *gujian-map*)      echo "古建景点打卡" ;;
    *shuili-ganzhi*)   echo "水利感知项目一张图" ;;
    *) echo "" ;;
  esac
}
plat_of() {
  case "$1" in
    *.apk)                echo "Android" ;;
    *_可托管.zip|*.zip)   echo "iOS" ;;
    *.deb)                echo "UOS" ;;
    *.exe|*.msi)          echo "Windows" ;;
    *) echo "" ;;
  esac
}
ver_of()  { echo "$1" | grep -oE '[0-9]+\.[0-9]+' | head -1; }
chan_of() {
  case "$1" in
    *_pub) echo "公开版" ;;
    *)     echo "内部版" ;;   # 基线（无 pub/int 后缀）与 _int 均归内部版
  esac
}

# ---------- 远端辅助 ----------
mkpath() {
  local p="$1" cur=""
  IFS='/' read -ra parts <<< "$p"
  for part in "${parts[@]}"; do
    cur="$cur$part"
    bdpan mkdir "$cur" >/dev/null 2>&1 || true
    cur="$cur/"
  done
}
exists_remote() {  # 远端 rdir 下是否已存在文件 fn
  local rdir="$1" fn="$2"
  bdpan ls "$rdir" --json 2>/dev/null \
    | python3 -c "import sys,json,os; d=json.load(sys.stdin); sys.exit(0 if any(x.get('server_filename')==os.path.basename('$fn') for x in d) else 1)" 2>/dev/null
}

NEW=0   # 本次是否有新文件上传（决定是否执行同步B）
up() {
  local localf="$1" rdir="$2"
  local fname rpath
  [ -f "$localf" ] || { echo "SKIP(本地缺失): $localf"; return; }
  fname="$(basename "$localf")"
  rpath="$rdir/$fname"
  if exists_remote "$rdir" "$fname"; then echo "EXIST: $rpath"; return; fi
  mkpath "$rdir"
  echo "UPLOAD: $rpath"
  if bdpan upload "$localf" "$rpath" 2>&1 | grep -qE "上传成功|在线查看"; then
    NEW=1
  else
    echo "  FAIL: $localf"
  fi
}

echo "===== 双同步开始 $(date) =====" | tee -a "$LOG"

# ---------- 鉴权检查 ----------
if ! bdpan whoami 2>/dev/null | grep -q "已登录"; then
  echo "✗ bdpan 未登录（whoami 抖动或 Token 过期）。请重新授权后重试：" | tee -a "$LOG"
  echo "  export PATH=\"/c/Users/admin/.local/bdpan/versions/3.7.3:\$PATH\"" | tee -a "$LOG"
  echo "  bdpan login --get-auth-url --accept-disclaimer   # 浏览器打开拿 32 位码" | tee -a "$LOG"
  echo "  echo <码> | bdpan login --set-code-stdin --accept-disclaimer" | tee -a "$LOG"
  exit 2
fi
touch "$SHARED_LIST"

# ---------- 同步A：分发（分类增量上传）----------
echo "--- 同步A：扫描本地归档 ---" | tee -a "$LOG"
# 2026-09-09：扫描范围扩展到 测试包_*（测试验证归档同样按 _pub/_int 通道入盘）
for ar in "$LB"/四端安装包_* "$LB"/测试包_*; do
  [ -d "$ar" ] || continue
  arname="$(basename "$ar")"
  # 仅处理双通道归档（*_v*_pub / *_v*_int）与历史基线；其余旧版默认不入盘
  case "$arname" in
    *_pub|*_int|$BASELINE) ;;
    *) echo "SKIP(非双通道归档): $arname"; continue ;;
  esac
  chan="$(chan_of "$arname")"
  echo "[归档] $arname → 通道=$chan" | tee -a "$LOG"

  # 门禁：公开版归档必须 verify_leakfree PASS，否则整包不上传
  if [ "$chan" = "公开版" ] && [ -f "$LEAK" ]; then
    if ! python3 "$LEAK" "$ar" >/dev/null 2>&1; then
      echo "  ✗ 门禁 FAIL：跳过公开归档 $arname（不得上传泄漏版，请先重新置空密钥）" | tee -a "$LOG"
      continue
    fi
    echo "  ✓ 门禁 PASS" | tee -a "$LOG"
  fi

  # 先按产品建版本映射（Windows 安装包文件名不含版本，需借同产品 apk/deb 的版本）
  declare -A PROD_VER=()
  while IFS= read -r g; do
    gn="$(basename "$g")"; gp="$(prod_of "$gn")"; gv="$(ver_of "$gn")"
    [ -n "$gp" ] && [ -n "$gv" ] && PROD_VER["$gp"]="$gv"
  done < <(find "$ar" -type f \( -name '*.apk' -o -name '*.deb' -o -name '*_可托管.zip' \))

  while IFS= read -r f; do
    fn="$(basename "$f")"
    prod="$(prod_of "$fn")"; plat="$(plat_of "$fn")"; ver="$(ver_of "$fn")"
    # 2026-09-09：混装归档（_int 里含公开 iOS zip）按文件名细分通道，公开文件落公开版目录
    chan_f="$chan"
    case "$fn" in *公开*) chan_f="公开版" ;; esac
    [ -z "$prod" ] && { echo "  SKIP(未知产品): $fn"; continue; }
    [ -z "$plat" ] && { echo "  SKIP(非安装包): $fn"; continue; }
    [ -z "$ver"  ] && ver="${PROD_VER[$prod]:-}"   # Windows exe/msi 借同产品版本
    [ -z "$ver"  ] && { echo "  SKIP(未知版本): $fn"; continue; }
    up "$f" "$BDPAN_ROOT/$prod/$chan_f/$ver/$plat"
  done < <(find "$ar" -type f \( -name '*.apk' -o -name '*.deb' -o -name '*.exe' -o -name '*.msi' -o -name '*_可托管.zip' \))
done

# ---------- 同步B：工程源按日期备份（仅在有新发版时）----------
BACKUP="$BDPAN_ROOT/项目备份/$TODAY"
backup_src() {
  local sp="$1" rel top n
  sp="$SRC/$1"
  [ -e "$sp" ] || { echo "  SKIP(源缺失): $1"; return; }
  if [ -d "$sp" ]; then
    rel="$1"; top="$BACKUP/$(basename "$1")"
    n=$(bdpan ls "$top" --json 2>/dev/null | python3 -c "import sys,json;print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
    if [ "$n" != "0" ]; then echo "  EXIST(今日已备份): $rel"; return; fi
    while IFS= read -r f; do up "$f" "$BACKUP/$rel/${f#$sp/}"; done < <(find "$sp" -type f)
  else
    up "$sp" "$BACKUP/$(basename "$sp")"
  fi
}
if [ "$NEW" -eq 1 ]; then
  echo "--- 同步B：工程源备份到 $BACKUP ---" | tee -a "$LOG"
  for s in "android-build" "native-shell" "travel/android" "双通道奇偶发版与信息脱敏策略.md"; do
    backup_src "$s"
  done
else
  echo "--- 同步B：无新发版，跳过 ---" | tee -a "$LOG"
fi

# ---------- 公开版分享链接（仅公开版目录；内部版永不分享）----------
echo "--- 公开版分享链接 ---" | tee -a "$LOG"
for prod in 水利一张图 古建景点打卡 水利感知项目一张图; do
  bdpan ls "$BDPAN_ROOT/$prod/公开版" --json 2>/dev/null \
    | python3 -c "import sys,json;[print(x['server_filename']) for x in json.load(sys.stdin) if x.get('isdir')]" 2>/dev/null \
    | tr -d '\r' \
    | while read -r ver; do
        d="$BDPAN_ROOT/$prod/公开版/$ver"
        if [ -z "$FORCE_SHARE" ] && grep -qxF "$d" "$SHARED_LIST"; then
          echo "  已分享: $d"; continue
        fi
        out=$(bdpan share "$d" --period 7 --json 2>&1)
        echo "$d | $out" | tee -a "$DOC/公开版分享链接.md"
        echo "$d" >> "$SHARED_LIST"
        echo "  分享: $d"
      done
done

echo "===== 双同步结束 $(date) （NEW=$NEW）=====" | tee -a "$LOG"
