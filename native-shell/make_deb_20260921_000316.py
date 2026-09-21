#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
跨平台构造 UOS DEB 包（不需要 dpkg/ar，纯 Python 实现 ar + tar.gz）。
用法：
  python3 make_deb.py <proj> [arch]   # proj ∈ {shuili, perc, gujian}
                                      # arch 可选，缺省按 CHIP 映射（见下方 ARCH_MAP）
产物：
  <proj>_deb/<pkg>_<ver>_<arch>.deb

架构对照表（已与用户固化，禁止臆测）：
  龙芯 3A3000 / 3A4000      -> mips64el   （旧世界固件，内核 4.19.0-loongson-3）
  龙芯 3A5000 / 3A6000+     -> loongarch64（新世界固件）
  飞腾 FT2000 / 鲲鹏        -> arm64
  其余 x86 平台             -> amd64
"""
import os, sys, struct, tarfile, io, time, gzip, lzma

# 架构映射：芯片关键字 -> deb Architecture 字段（按上面对照表）
ARCH_MAP = {
    "3a4000": "mips64el", "3a3000": "mips64el", "loongson-3": "mips64el",
    "3a5000": "loongarch64", "3a6000": "loongarch64", "la464": "loongarch64",
    "ft2000": "arm64", "kunpeng": "arm64", "phytium": "arm64",
    "x86": "amd64", "amd64": "amd64",
}
# 默认部署环境：用户统信 UOS 20 专业版 1050 / 龙芯 3A4000 / 内核 4.19.0-loongson-3
DEFAULT_ARCH = "mips64el"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 2026-09-01 统一方案 v3.47（对齐 V3.28 已验证规范，覆盖全 UOS 桌面环境）：
#   运行时=浏览器壳（本地 http.server + xdg-open，零 PyQt6 依赖，龙芯不再崩）
#   control=control+postinst+postrm+md5sums（postinst 含权限修复 + 清理不在新包的历史残留）
#   每端独立端口，避免同机三端共存时 7205 撞车
PROJ = {
    "shuili": {"dir": "uos-water-pyqt6", "pkg": "shuili-map", "name": "水利工程基础信息一张图",
               "ver": "3.76.20260916", "desc": "水利工程基础信息一张图（统信 UOS 浏览器壳，支持离线）",
               "icon": "android-build/shuili-v329/res/mipmap-xxxhdpi/ic_launcher.png",
               "port": 7205},
    "perc":   {"dir": "uos-pyqt6",       "pkg": "shuili-ganzhi", "name": "水利感知项目一张图",
               "ver": "1.52.20260916", "desc": "水利感知项目一张图（统信 UOS 浏览器壳，支持离线）",
               "icon": "android-build/perc-v13/res/mipmap-xxxhdpi/ic_launcher.png",
               "port": 7206},
    "gujian": {"dir": "uos-gujian-pyqt6", "pkg": "gujian-map", "name": "古建景点打卡",
               "ver": "3.7.13.20260916", "desc": "古建景点打卡（统信 UOS 浏览器壳，支持离线）",
               "icon": "travel/android/res/mipmap-xxxhdpi/ic_launcher.png",
               "port": 7207},
}
# === WB auto-version（2026-09-07：从各端 webroot version.json 自动取 ver/date，免每版手动改） ===
import json as _json
def _wb_ver(key):
    _vj = _json.load(open(os.path.join(ROOT, "native-shell", PROJ[key]["dir"], "webroot", "version.json"), encoding="utf-8"))
    return "%s.%s" % (str(_vj.get("version", "")), str(_vj.get("buildDate", "")).replace("-", ""))
for _k in list(PROJ):
    PROJ[_k]["ver"] = _wb_ver(_k)

# 打包一律剔除的备份/垃圾扩展名（含 .ctxbak/.menu1bak 等编辑器残留）
SKIP_FILE_EXT = (".bak", ".ctxbak", ".menu1bak", ".old")
# 目录剪枝：leaflet/leaflet 嵌套重复等（canonical 顶层 leaflet 才是被引用的）
def is_skip_rel(rel):
    return any("/leaflet/leaflet/" in rel for _ in [0])


def ar_member(name, data):
    """构造 ar 归档成员（固定 60 字节头）。

    完全对齐 V3.28(v326) 已验证规范，规避 deepin 的 github.com/myml/ar
    （被 deepin-security-verify 钩子调用）的两个解析雷区：
    1) name 必须用**空格**右填充到 16（不能用 \\x00）：myml/ar.string() 只修剪空格、
       不修剪 NUL，NUL 填充会让成员名变成 'control.tar.xz\\0\\0'，deepin ExtractFile
       做精确字符串匹配失败 → 安装器报「请检查deb包是否损坏」。
    2) mode 必须含 '100' 前缀（b'100644'.ljust(8)）：myml/ar.octal 默认从索引 3 取值，
       若 mode='0       '（索引1..7全空格），i 会减到 0，执行 b[3:1] →
       panic: slice bounds out of range [3:1]（即 3.30.2/3.30.3 的崩溃）。
    3) size 写真实数据长度（不含对齐补齐字节）；奇数长度成员后补一个 \\n（标准 ar 偶对齐）。
    """
    nm = name[:16].ljust(16, " ")                       # 空格填充（关键！）
    mtime = str(int(time.time())).ljust(12, " ")
    uid = "0".ljust(6, " ")
    gid = "0".ljust(6, " ")
    mode = "100644".ljust(8, " ")                        # 必须含 100 前缀
    size = str(len(data)).ljust(10, " ")
    hdr = (nm + mtime + uid + gid + mode + size + "`\n").encode("ascii")
    assert len(hdr) == 60, "ar header must be 60 bytes, got %d" % len(hdr)
    pad = b"\n" if len(data) % 2 else b""
    return hdr + data + pad


def collect_dirs(files):
    """从文件清单推断所有需声明的父目录（dpkg 解包铁律）。

    UOS dpkg 在解包时会为待安装文件先创建 `<path>.dpkg-new` 临时文件再 rename 到位；
    若 data.tar.xz 里**没有**该文件的父目录条目，dpkg 无法保证父目录已建立，
    便报「无法创建 /opt/.../webroot/ai_module.js.dpkg-new ... 没有那个文件或目录」。
    纯 Python 实现必须显式写出每个祖先目录条目（type=dir, mode 0755, root:root），
    且排在文件之前。
    """
    dirs = set()
    for arcname, _ in files:
        parts = arcname.split("/")
        for i in range(1, len(parts)):            # 不含文件本身
            dirs.add("/".join(parts[:i]) + "/")
    return sorted(dirs)                            # 自然按深度升序（最短目录在前）


def build_tgz(files, dirs=None):
    """files: list of (arcname, data_bytes) -> tar.xz 字节（GNU_FORMAT 防 PAX 头）。

    用 xz(FORMAT_XZ + CHECK_CRC64) 与 v326 一致——该格式已在 UOS 1050 龙芯实测可装；
    GNU_FORMAT 避免 Python 默认 PAX 头（部分旧 dpkg 解析异常）。
    目录条目（type=dir, mode 0755, root:root）必须在文件之前写入，确保 dpkg 解包时
    父目录已存在、可安全暂存 .dpkg-new（彻底修复「没有那个文件或目录」安装失败）。
    """
    dirs = dirs if dirs is not None else collect_dirs(files)
    buf = io.BytesIO()
    with lzma.open(buf, "wb", format=lzma.FORMAT_XZ, check=lzma.CHECK_CRC64) as xz:
        with tarfile.open(fileobj=xz, mode="w", format=tarfile.GNU_FORMAT) as tf:
            for d in dirs:
                ti = tarfile.TarInfo(name=d)
                ti.type = tarfile.DIRTYPE
                ti.mode = 0o755
                ti.uid = 0; ti.gid = 0; ti.uname = "root"; ti.gname = "root"
                ti.mtime = int(time.time())
                tf.addfile(ti)
            for arcname, data in files:
                ti = tarfile.TarInfo(name=arcname)
                ti.size = len(data)
                ti.mode = 0o755 if arcname.endswith(("main.py", "launch.sh", "server.py", "shuili-map", "shuili-ganzhi", "gujian-map")) else 0o644
                ti.uid = 0; ti.gid = 0; ti.uname = "root"; ti.gname = "root"
                ti.mtime = int(time.time())
                tf.addfile(ti, io.BytesIO(data))
    return buf.getvalue()


def make_launcher(pkg, port):
    """浏览器壳启动器（对齐 V3.28 已验证方案）+ 调试日志 + 防缓存。
    零 PyQt6 依赖；每端独立端口。
    关键改进（根治“装了 3.48 打开却是 3.28”）：
      1) 每次启动都写 /opt/<pkg>/launch_err.log（时间戳/用户/即将服务的版本/释放端口动作/自检测），
         成功也写，便于排查（之前只在报错时写，正常打开无日志，导致用户找不到日志）。
      2) 本地服务强制 Cache-Control: no-store（见 server.py），杜绝浏览器启发式缓存旧版页面
         （python -m http.server 只发 Last-Modified，浏览器会缓存旧版最多约 1 天不重新校验）。
      3) 启动前先 free_port 释放专用端口上的任何残留监听，并从本包 webroot 起服务；server.py 自身也会在
         绑定失败时自动杀掉占用端口的残留进程并重试，彻底避免“旧实例劫持端口服务旧版”。
    模板仅经 .replace() 替换（非 .format()），bash 变量/花括号必须【单】写：${PORT} / { / }。"""
    return """#!/bin/bash
# 模板仅经 .replace() 替换（非 .format()）。bash 变量/花括号必须【单】写：${PORT} / { / }。
# 切勿【双写】 $ 或【双写】花括号 —— 那是 .format() 转义写法，会原样漏进 deb，导致 bash bad substitution / 花括号语法错误。
APP_DIR="/opt/{pkg}"
WEBROOT="$APP_DIR/webroot"
PORT={port}
URL="http://127.0.0.1:${PORT}/"
# 运行时日志：菜单以【普通用户 guest】启动时，/opt/<pkg> 是 root 所有(755)，普通用户无法在该目录新建文件；
# 若 launch_err.log 因任何原因不存在/不可写（如权限被旧逻辑改回 755），则回退到用户可写的
# $HOME/.cache/<pkg>/launch_err.log，保证【必有日志】可排查（之前此处静默失败导致日志永远空）。
LOG="$APP_DIR/launch_err.log"
if [ ! -w "$LOG" ]; then
  LOG="$HOME/.cache/{pkg}/launch_err.log"
  mkdir -p "$(dirname "$LOG")" 2>/dev/null || true
fi
mkdir -p "$APP_DIR" 2>/dev/null || true
exec >>"$LOG" 2>&1
echo "===== launch $(date '+%F %T') user=$(whoami) pid=$$ log=$LOG ====="

# 释放专用端口上的任何残留监听（旧版本实例，如 V3.28 的 setsid http.server），
# 避免重装/升级后旧实例仍在端口上服务旧版网页。
free_port() {
  local p killed=0
  if command -v ss >/dev/null 2>&1; then
    for p in $(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -oE 'pid=[0-9]+' | sed 's/pid=//' | sort -u); do
      kill "$p" 2>/dev/null && { killed=1; echo "  free_port: kill pid $p on :$PORT"; }
    done
  fi
  if [ "$killed" = "0" ] && command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" 2>/dev/null && echo "  free_port: fuser -k :$PORT"
  fi
  sleep 0.6
}

# 记录即将服务的版本（来自本包 webroot/version.json，即浏览器将加载的版本）
echo "  webroot=$WEBROOT"
python3 - "$WEBROOT/version.json" <<'PY' 2>&1 || echo "  WARN: cannot read version.json"
import sys, json
try:
    print("  serving version=", json.load(open(sys.argv[1])).get("version"))
except Exception as e:
    print("  version UNREADABLE:", e)
PY

free_port

# 启动本地服务（server.py 强制 Cache-Control: no-store，避免浏览器缓存旧版导致“打开是3.28”）
(cd "$WEBROOT" && setsid nohup python3 "$APP_DIR/server.py" "$PORT" >/dev/null 2>&1 &)
sleep 1.2

# 自检测：确认本端端口已被监听 + 网页可访问
if command -v ss >/dev/null 2>&1; then
  echo "  port check:"; ss -ltnp 2>/dev/null | grep ":$PORT " || echo "    (nothing listening on :$PORT)"
fi
if command -v python3 >/dev/null 2>&1; then
  code=$(python3 -c "import urllib.request;print(urllib.request.urlopen('$URL',timeout=3).status)" 2>/dev/null)
  echo "  self-check HTTP=$code"
fi

open_browser() {
  if command -v xdg-open >/dev/null 2>&1; then
    setsid nohup xdg-open "$URL" >/dev/null 2>&1 &
    echo "  browser: xdg-open $URL"
    return 0
  fi
  for b in browser qaxbrowser cnbrowser 360se 360browser chromium-browser chromium google-chrome microsoft-edge firefox deepin-browser org.gnome.Epiphany; do
    if command -v "$b" >/dev/null 2>&1; then
      setsid nohup "$b" "$URL" >/dev/null 2>&1 &
      echo "  browser: $b $URL"
      return 0
    fi
  done
  echo "  ERROR: no browser found"
  return 1
}
open_browser
exit 0
""".replace("{pkg}", pkg).replace("{port}", str(port))


def make_server_py():
    """本地 HTTP 服务（替代 python -m http.server）：
    - 强制 Cache-Control: no-store / Pragma: no-cache / Expires: 0，杜绝浏览器缓存旧版（根治“打开是3.28”）；
    - 绑定失败时自动释放占用端口的残留进程并重试，彻底避免“旧实例劫持端口服务旧版”。"""
    return r'''#!/usr/bin/env python3
# UOS 浏览器壳本地服务：强制 no-store，避免浏览器缓存旧版（曾导致“打开是3.28”）。
import sys, os, re, time, subprocess, http.server, socketserver

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7205
HERE = os.path.dirname(os.path.abspath(__file__))

def _read_version():
    try:
        import json
        with open(os.path.join(HERE, "webroot", "version.json")) as f:
            return json.load(f).get("version")
    except Exception:
        return "unknown"

def _startup_log():
    # 服务进程自证：浏览器壳能用即说明 server.py 一定跑起来了。
    # 在此把“即将服务的版本/端口/pid”写入日志，作为 launch_err.log 万一为空时的兜底证据。
    # 优先写 <pkg>/launch_err.log（与启动器同文件），不可写则回退 $HOME/.cache/<pkg>/。
    ver = _read_version()
    line = "  server.py started: serving version=%s on :%d pid=%d no-store=on (%s)\n" % (
        ver, PORT, os.getpid(), time.strftime("%F %T"))
    pkg = os.path.basename(HERE)
    for cand in (os.path.join(HERE, "launch_err.log"),
                 os.path.join(HERE, "server.log"),
                 os.path.join(os.path.expanduser("~"), ".cache", pkg, "launch_err.log")):
        try:
            d = os.path.dirname(cand)
            if d and not os.path.isdir(d):
                os.makedirs(d, exist_ok=True)
            with open(cand, "a") as f:
                f.write(line)
        except Exception:
            pass

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()
    def log_message(self, *a):
        pass

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

def kill_holder():
    try:
        out = subprocess.check_output(["ss", "-ltnp", "sport = :%d" % PORT],
                                      stderr=subprocess.DEVNULL).decode()
        for pid in set(re.findall(r"pid=(\d+)", out)):
            try:
                os.kill(int(pid), 15)
            except Exception:
                pass
    except Exception:
        pass

_startup_log()
for _ in range(5):
    try:
        Server(("127.0.0.1", PORT), Handler).serve_forever()
        break
    except OSError:
        kill_holder()
        time.sleep(0.6)
'''


def make_postinst(pkg, port):
    """postinst：调试日志 + 权限兜底 + 清理不在新包清单里的历史残留 + 桌面数据库刷新。
    - 把安装过程写入 /opt/<pkg>/install.log（用户可据此查看安装到底做了什么）。
    - 历史版本曾出现 /opt/<pkg> 权限被 root 污染、bak 文件残留、旧版独有文件
      （如 leaflet/leaflet 嵌套、被移除的脚本）等导致「装得上打不开」；
    - 这里以 dpkg -L 的新包清单为准，把磁盘上不在清单内的历史文件全部删除，
      任何机器、任何历史状态升级安装后都能自动收敛为「结构上等于新包」。
    - 保留 *.log（运行时/安装日志）不动。"""
    return """#!/bin/bash
set -e
LOG="/opt/{pkg}/install.log"
mkdir -p /opt/{pkg}
# 运行时日志文件放行：菜单启动器以【普通用户】身份运行，而 /opt/<pkg> 默认 root 所有(755)，
# 若 launch_err.log 不可写，启动器的 `exec >> launch_err.log` 会静默失败 -> 日志永不生成、用户无法排查。
# 这里在 postinst(以 root 运行)阶段预建并置 666，保证任何用户都能追加写入。
touch /opt/{pkg}/launch_err.log /opt/{pkg}/install.log
chmod 666 /opt/{pkg}/launch_err.log /opt/{pkg}/install.log
exec >>"$LOG" 2>&1
echo "===== postinst $(date) ====="
# 0) 释放本端专用端口上的残留监听（旧版本实例，如 V3.28 的 setsid http.server），
#    避免升级后旧实例仍在端口上服务旧版网页（V3.28 平铺 /opt/<pkg>/ 与 V3.48 嵌套 webroot 路径不同）。
if command -v ss >/dev/null 2>&1; then
  for p in $(ss -ltnp 2>/dev/null | grep ":$port " | grep -oE 'pid=[0-9]+' | sed 's/pid=//' | sort -u); do kill "$p" 2>/dev/null && echo "  free_port: kill pid $p on :$port"; done
elif command -v fuser >/dev/null 2>&1; then
  fuser -k "$port/tcp" 2>/dev/null && echo "  free_port: fuser -k :$port"
fi
sleep 0.3
# 1) 清理历史残留：以本包 dpkg 清单为准，删除 /opt/{pkg} 下不在清单内的旧文件
#    （dpkg 升级不自动删旧包独有文件，需 postinst 收敛；*.log 运行时/安装日志保留）
if command -v dpkg >/dev/null 2>&1; then
  dpkg -L {pkg} 2>/dev/null | grep -E "^/opt/{pkg}/" | sort -u > /tmp/{pkg}_list.$$ || true
  find /opt/{pkg} -type f ! -name '*.log' 2>/dev/null | sort -u > /tmp/{pkg}_disk.$$ || true
  if [ -s /tmp/{pkg}_list.$$ ] && [ -s /tmp/{pkg}_disk.$$ ]; then
    comm -23 /tmp/{pkg}_disk.$$ /tmp/{pkg}_list.$$ | tee /tmp/{pkg}_rm.$$ | while IFS= read -r f; do
      rm -f "$f" 2>/dev/null || true
    done
    echo "  residue cleanup: $(wc -l < /tmp/{pkg}_rm.$$) file(s) removed"
  else
    echo "  residue cleanup: skipped (dpkg list or disk list empty)"
  fi
  rm -f /tmp/{pkg}_list.$$ /tmp/{pkg}_disk.$$ /tmp/{pkg}_rm.$$
fi
# 2) 权限兜底：老版本若被 root 跑过污染目录权限，统一修正（浏览器壳需读+执行）
chmod 755 /opt/{pkg} -R 2>/dev/null || true
chmod 755 /usr/bin/{pkg} 2>/dev/null || true
# 2b) 运行时日志必须保持 666（任何用户可追加）：上面的 `chmod 755 -R` 会把 launch_err.log /
#     install.log 一并改成 755 root 所有，导致菜单以【普通用户 guest】启动时
#     `exec >> launch_err.log` 因无写权限而静默失败 -> 日志永远空、用户无法排查（T-047c/2）。
#     故在递归 chmod 之后【重新】放行两个日志文件（关键修复）。
chmod 666 /opt/{pkg}/launch_err.log /opt/{pkg}/install.log 2>/dev/null || true
# 3) 刷新桌面数据库
if [ -x /usr/bin/update-desktop-database ]; then
  update-desktop-database /usr/share/applications || true
fi
if [ -x /usr/bin/gtk-update-icon-cache ]; then
  gtk-update-icon-cache -f /usr/share/icons/hicolor || true
fi
echo "  postinst done"
exit 0
""".replace("{pkg}", pkg).replace("{port}", str(port))


def make_postrm(pkg):
    return """#!/bin/bash
set -e
if [ -x /usr/bin/update-desktop-database ]; then
  update-desktop-database /usr/share/applications || true
fi
exit 0
"""


def build_control_tgz(control_text, postinst, postrm, md5sums):
    """control.tar.xz：control + postinst(0755) + postrm(0755) + md5sums(0644)。
    md5sums 路径为去前导斜杠的相对路径（dpkg 标准），供 dpkg -V 校验。"""
    buf = io.BytesIO()
    with lzma.open(buf, "wb", format=lzma.FORMAT_XZ, check=lzma.CHECK_CRC64) as xz:
        with tarfile.open(fileobj=xz, mode="w", format=tarfile.GNU_FORMAT) as tf:
            for name, data, mode in [
                ("control", control_text, 0o644),
                ("postinst", postinst, 0o755),
                ("postrm", postrm, 0o755),
                ("md5sums", md5sums, 0o644),
            ]:
                b = data.encode("utf-8")
                ti = tarfile.TarInfo(name=name)
                ti.size = len(b)
                ti.mode = mode
                ti.uid = 0; ti.gid = 0; ti.uname = "root"; ti.gname = "root"
                ti.mtime = int(time.time())
                tf.addfile(ti, io.BytesIO(b))
    return buf.getvalue()


def main():
    key = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in PROJ else "shuili"
    c = PROJ[key]
    # 解析架构：命令行第2参数可直接传 mips64el/loongarch64/arm64/amd64；
    # 或传芯片关键字（3a4000 等）走 ARCH_MAP；缺省用 DEFAULT_ARCH（用户 3A4000 环境）
    arch = DEFAULT_ARCH
    if len(sys.argv) > 2:
        a = sys.argv[2].lower()
        arch = ARCH_MAP.get(a, a)  # 已是合法架构名则直接用
    src = os.path.join(ROOT, "native-shell", c["dir"])
    out_dir = os.environ.get("DEB_OUT_DIR") or os.path.join(
        ROOT, "APK归档", "四端安装包_20260916_v376_int", "uos-" + key)
    os.makedirs(out_dir, exist_ok=True)

    # 收集 webroot + main.py（webroot 保留为 /opt/<pkg>/webroot/ 子目录，匹配 main.py 的 WEBROOT 路径）
    payload = []
    webroot_dir = os.path.join(src, "webroot")
    for root, dirs, files in os.walk(webroot_dir):
        # 剪枝：leaflet/leaflet 嵌套重复目录不进包
        dirs[:] = [d for d in dirs if not (os.path.relpath(os.path.join(root, d), webroot_dir).replace(os.sep, "/") + "/").startswith("leaflet/leaflet/")]
        for fn in files:
            if fn.lower().endswith(SKIP_FILE_EXT):   # 不把编辑器/历史备份打进 deb
                continue
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, webroot_dir).replace(os.sep, "/")
            arc = "opt/%s/webroot/%s" % (c["pkg"], rel)
            payload.append((arc, open(full, "rb").read()))
    payload.append(("opt/%s/main.py" % c["pkg"], open(os.path.join(src, "main.py"), "rb").read()))
    # 图标：直接打包各产品自己的 Android 启动图标，桌面项用绝对路径引用（避免 Icon=webview 无图标）
    icon_path = os.path.join(ROOT, c["icon"])
    if os.path.exists(icon_path):
        payload.append(("opt/%s/icon.png" % c["pkg"], open(icon_path, "rb").read()))
    # 浏览器壳启动器（V3.28 已验证方案）：/usr/bin/<pkg> 为桌面入口，launch.sh 为同内容备份
    launcher = make_launcher(c["pkg"], c["port"])
    payload.append(("opt/%s/launch.sh" % c["pkg"], launcher.encode()))
    payload.append(("usr/bin/%s" % c["pkg"], launcher.encode()))
    # 本地服务（强制 no-store，杜绝浏览器缓存旧版；绑定失败自动释放端口残留并重试）
    payload.append(("opt/%s/server.py" % c["pkg"], make_server_py().encode()))
    # desktop：Exec 用绝对路径 /usr/bin/<pkg>（不依赖 PATH），Icon 用绝对路径 /opt/<pkg>/icon.png
    desktop = ("[Desktop Entry]\n"
               "Name=%s\n"
               "Comment=%s\n"
               "Exec=/usr/bin/%s\n"
               "Icon=/opt/%s/icon.png\n"
               "Terminal=false\n"
               "Type=Application\n"
               "StartupNotify=true\n"
               "Categories=Utility;Science;\n"
               ) % (c["name"], c["desc"], c["pkg"], c["pkg"])
    payload.append(("usr/share/applications/%s.desktop" % c["pkg"], desktop.encode()))

    data_dirs = collect_dirs(payload)
    data_tgz = build_tgz(payload, data_dirs)
    # md5sums：dpkg 标准相对路径（去前导斜杠）
    import hashlib
    md5lines = []
    for arcname, data in payload:
        md5lines.append("%s  %s" % (hashlib.md5(data).hexdigest(), arcname))
    control = ("Package: %s\nVersion: %s\nSection: utils\nPriority: optional\nArchitecture: %s\n"
               "Depends: python3\n"
               "Maintainer: 小七 <xiaoyi@example.com>\n"
               "Description: %s\n 浏览器壳运行（本地 http.server + 系统浏览器），零 PyQt6 依赖，\n 支持离线；postinst 自动修复历史权限/残留问题。\n") % (
        c["pkg"], c["ver"], arch, c["desc"])
    control_tgz = build_control_tgz(control, make_postinst(c["pkg"], c["port"]), make_postrm(c["pkg"]),
                                    "\n".join(md5lines) + "\n")

    deb = b"!<arch>\n"
    deb += ar_member("debian-binary", b"2.0\n")
    deb += ar_member("control.tar.xz", control_tgz)
    deb += ar_member("data.tar.xz", data_tgz)

    out = os.path.join(out_dir, "%s_%s_%s.deb" % (c["pkg"], c["ver"], arch))
    open(out, "wb").write(deb)
    print("✅ 产出:", out, os.path.getsize(out), "bytes")
    print("   control.tar 成员: control + postinst + postrm + md5sums")
    print("   data 目录条目数:", len(data_dirs), "| 文件数:", len(payload))
    # 自动跑 myml/ar 门禁（复现 deepin 解析，含父目录条目断言）
    verify = os.path.join(os.path.dirname(os.path.abspath(__file__)), "verify_myml_ar.py")
    if os.path.isfile(verify):
        import subprocess
        r = subprocess.run([sys.executable, verify, out], capture_output=True, text=True)
        print(r.stdout)
        if r.returncode != 0:
            print(r.stderr)
            raise SystemExit("❌ verify_myml_ar 未通过，拒绝交付")


if __name__ == "__main__":
    main()
