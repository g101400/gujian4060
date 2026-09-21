#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase B 源码修复脚本（v3.47）—— 三图同源，仅改 LIVE webroot，绝不碰 backup_* / *_bak_* / bin/Release / publish_*。

修复项：
  Issue 5 知识库：① 暴露 window.openKB/openGen（修复 openKB is not defined）
                ② kbImportExternal 拒绝 doc/docx/xls/xlsx/pdf 二进制，避免读成乱码 + 说明可入库格式
                ③ openKB 文案注明可入库格式
  Issue 3 建筑详情：popupHtml 增加「详细」按钮 + window.appDetail 全参可滚动抽屉 + .pop-detail CSS
  Issue 2 坐标修正：b99 终点 [116.62131607, 40.33620874] -> [116.62149293, 40.336104]（仅水利家族 4 处）
  Issue 1 统信启动：3 个 UOS main.py 的 launch_browser_shell 改为常驻 + notify-send + 启动日志
  Issue 4 LIDNotify：校验 LIVE 源码已无该符号（stale 构建产物，干净重建即消除）

运行：python3 _apply_fixes_v347.py
"""
import os, sys, zipfile, subprocess

ROOT = r"D:\Users\Claw"

AI = [
    r"android-build/shuili-v329/assets/ai_module.js",
    r"android-build/water-v329/assets/ai_module.js",
    r"android-build/perc-v13/assets/ai_module.js",
    r"android-build/gujian-v31/assets/ai_module.js",
    r"travel/webroot/ai_module.js",
    r"travel/android/assets/ai_module.js",
    r"native-shell/win-water-webview2/webroot/ai_module.js",
    r"native-shell/uos-water-pyqt6/webroot/ai_module.js",
    r"native-shell/win-webview2/webroot/ai_module.js",
    r"native-shell/uos-pyqt6/webroot/ai_module.js",
    r"native-shell/win-gujian-webview2/webroot/ai_module.js",
    r"native-shell/uos-gujian-pyqt6/webroot/ai_module.js",
]
APP = [p.replace("ai_module.js", "app.js") for p in AI]
INDEX = [p.replace("ai_module.js", "index.html") for p in AI]
WATER_DATA = [
    r"android-build/shuili-v329/assets/data.js",
    r"android-build/water-v329/assets/data.js",
    r"native-shell/uos-water-pyqt6/webroot/data.js",
    r"native-shell/win-water-webview2/webroot/data.js",
]
UOS_MAIN = [
    r"native-shell/uos-water-pyqt6/main.py",
    r"native-shell/uos-pyqt6/main.py",
    r"native-shell/uos-gujian-pyqt6/main.py",
]
CRITICAL = set([
    r"android-build/shuili-v329/assets/ai_module.js",
    r"android-build/shuili-v329/assets/app.js",
    r"android-build/shuili-v329/assets/index.html",
    r"android-build/shuili-v329/assets/data.js",
    r"native-shell/uos-water-pyqt6/webroot/ai_module.js",
    r"native-shell/uos-water-pyqt6/webroot/app.js",
    r"native-shell/uos-water-pyqt6/webroot/index.html",
    r"native-shell/uos-water-pyqt6/webroot/data.js",
    r"native-shell/uos-water-pyqt6/main.py",
])

# ===== JS 锚点/替换（统一用原始三双引号，\' 即 JS 需要的反斜杠+单引号） =====
OLD_AI_TAIL = r"""  // init 成功后才挂到 window；此处先声明，init 内会再赋值一次
  if (!global.AIModule) global.AIModule = API;
"""
NEW_AI_TAIL = r"""  // init 成功后才挂到 window；此处先声明，init 内会再赋值一次
  if (!global.AIModule) global.AIModule = API;
  // v3.47：把知识库入口挂到 window，供内联 onclick 调用（修复 openKB/openGen is not defined）
  window.openKB = openKB;
  window.openGen = openGen;
"""

OLD_OPENKB_TEXT = r"""      '<p style="font-size:13px;color:#3a2e28;line-height:1.6">知识库（Markdown 正文 + JSON 元数据）。支持：①读外部文件 ②读网页链接(公众号/微博/普通) ③导出zip ④导入zip。' +
"""
NEW_OPENKB_TEXT = r"""      '<p style="font-size:13px;color:#3a2e28;line-height:1.6">知识库（Markdown 正文 + JSON 元数据）。可入库格式：①读外部文件(.txt/.md/.csv/.json) ②读网页链接(公众号/微博/普通) ③导出zip ④导入zip。Office(doc/docx/xls/xlsx)与pdf请先另存为 .txt/.csv 再入库。' +
"""

OLD_KBIMPORT_HEAD = r"""      var name = file.name || "外部文件", lower = name.toLowerCase();
      var reader = new FileReader();
"""
NEW_KBIMPORT_HEAD = r"""      var name = file.name || "外部文件", lower = name.toLowerCase();
      // v3.47：拒绝二进制 Office/PDF，避免被当文本读成乱码；明确告知可入库格式
      if (/\.(docx?|xlsx?|pdf)$/i.test(lower)) {
        toast("暂不支持直接导入 " + name + "（Office/PDF 二进制）。请先另存为 .txt/.md/.csv，或用「②读网页链接」。可入库格式：.txt .md .csv .json");
        return;
      }
      var reader = new FileReader();
"""

OLD_POPUP_ACTIONS = r"""    html += '<div class="pop-actions"><button class="pop-edit" onclick="appEdit(\'' + esc(b.id) + '\')">修改</button>' +
"""
NEW_POPUP_ACTIONS = r"""    html += '<div class="pop-actions"><button class="pop-detail" onclick="appDetail(\'' + esc(b.id) + '\')">详细</button>' +
      '<button class="pop-edit" onclick="appEdit(\'' + esc(b.id) + '\')">修改</button>' +
"""

OLD_POPUP_RETURN = r"""    return html;
  }

  function render() {
"""
NEW_POPUP_RETURN = r"""    return html;
  }

  // v3.47：建筑「详细」——完整参数（含未填写）可滚动抽屉，避免弹窗参数不全
  window.appDetail = function (id) {
    var b = BUILDINGS.filter(function (x) { return x.id === id; })[0];
    if (!b) { toast("未找到该建筑"); return; }
    function row(k, v) {
      var s = (v == null || v === "") ? "（未填写）" : (typeof v === "object" ? JSON.stringify(v) : String(v));
      if (s.length > 400) s = s.slice(0, 400) + " …";
      return "<tr><td class=\"k\">" + esc(k) + "</td><td>" + esc(s) + "</td></tr>";
    }
    var rows = [];
    ["id", "name", "office", "station", "chan", "btype", "geom", "code", "addr", "note"].forEach(function (k) {
      if (k in b) rows.push(row(k, b[k]));
    });
    if (b.geom === "Point") { rows.push(row("坐标(纬度,经度)", (b.lat != null ? (b.lat + ", " + b.lon) : ""))); }
    else if (b.geom === "Line" && b.line) {
      rows.push(row("起点(纬度,经度)", b.line[0] ? (b.line[0][1] + ", " + b.line[0][0]) : ""));
      rows.push(row("终点(纬度,经度)", b.line[1] ? (b.line[1][1] + ", " + b.line[1][0]) : ""));
    }
    if (b.attrs && b.attrs.length) b.attrs.forEach(function (a) { rows.push(row(a[0] || "（无标题）", a[1])); });
    if ((b.photos || []).length) rows.push(row("照片数", b.photos.length));
    if ((b.inspections || []).length) rows.push(row("巡视次数", b.inspections.length));
    var html = '<div style="max-height:74vh;overflow:auto;padding:2px 1px">'
      + '<table class="param-table" style="width:100%">' + rows.join("") + "</table>";
    if (b.photos && b.photos.length) {
      html += '<div class="photos">';
      b.photos.forEach(function (p, i) { html += '<img src="' + esc(photoSrc(p)) + '" loading="lazy" onclick="appLightbox(\'' + esc(b.id) + "'," + i + ')">'; });
      html += "</div>";
    }
    html += '<div class="form-actions"><button class="btn-cancel" onclick="closeSheet(\'sheetGen\')">关闭</button>'
      + '<button class="btn-save" onclick="appEdit(\'' + esc(b.id) + '\')">编辑</button></div></div>';
    if (window.openGen) window.openGen("建筑详情 · " + b.name, html);
    else toast("知识库模块未加载，无法打开详情");
  };

  function render() {
"""

OLD_POPDEL_CSS = r"""  .pop-del { background: var(--danger); }
"""
NEW_POPDEL_CSS = r"""  .pop-del { background: var(--danger); }
  .pop-detail { background:#6b46c1; }
"""

OLD_B99 = "[116.62131607, 40.33620874]"
NEW_B99 = "[116.62149293, 40.336104]"

# ===== main.py 锚点/替换（原始三单引号，含 """ 文档串也安全） =====
OLD_MAIN_LAUNCH = r'''def launch_browser_shell():
    """PyQt6 不可用时的回退：本地 http.server + 系统浏览器（对齐 V3.28 浏览器壳）。"""
    import subprocess, socket
    PORT = 7205
    URL = "http://127.0.0.1:%d/" % PORT

    def port_alive():
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        try:
            s.connect(("127.0.0.1", PORT)); return True
        except Exception:
            return False
        finally:
            try: s.close()
            except Exception: pass

    def open_browser(url):
        if shutil.which("xdg-open"):
            subprocess.Popen(["xdg-open", url], start_new_session=True); return
        for b in ["browser", "qaxbrowser", "cnbrowser", "chromium", "chromium-browser",
                  "google-chrome", "microsoft-edge", "firefox", "deepin-browser"]:
            if shutil.which(b):
                subprocess.Popen([b, url], start_new_session=True); return

    if port_alive():
        open_browser(URL); return
    py = "python3" if shutil.which("python3") else ("python" if shutil.which("python") else None)
    if not py:
        print("[uos] 未找到 python3，无法启动本地服务"); return
    subprocess.Popen([py, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                     cwd=WEBROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     start_new_session=True)
    time.sleep(1)
    open_browser(URL)
'''
NEW_MAIN_LAUNCH = r'''def launch_browser_shell():
    """PyQt6 不可用时的回退：本地 http.server（常驻）+ 系统浏览器（对齐 V3.28 浏览器壳）。
    v3.47 修复：服务进程常驻主线程，点击图标后 Python 不立即退出，避免“没反应”；
    并弹 notify-send 提示 + 写启动日志，保证桌面图标一定有反馈。"""
    import subprocess, socket, http.server
    PORT = 7205
    URL = "http://127.0.0.1:%d/" % PORT

    def _log(msg):
        try:
            with open(os.path.join(DOWNLOADS, "launch.log"), "a", encoding="utf-8") as f:
                f.write("[%s] %s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), msg))
        except Exception:
            pass

    def _notify(title, msg):
        try:
            subprocess.Popen(["notify-send", title, msg], start_new_session=True)
        except Exception:
            pass

    def port_alive():
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        try:
            s.connect(("127.0.0.1", PORT)); return True
        except Exception:
            return False
        finally:
            try: s.close()
            except Exception: pass

    def open_browser(url):
        if shutil.which("xdg-open"):
            subprocess.Popen(["xdg-open", url], start_new_session=True); return True
        for b in ["browser", "qaxbrowser", "cnbrowser", "chromium", "chromium-browser",
                  "google-chrome", "microsoft-edge", "firefox", "deepin-browser"]:
            if shutil.which(b):
                subprocess.Popen([b, url], start_new_session=True); return True
        return False

    if port_alive():
        _log("已有本地服务，直接打开浏览器")
        _notify("本地地图", "正在浏览器中打开…")
        if not open_browser(URL):
            _notify("本地地图", "未找到浏览器，请手动打开 %s" % URL)
        try:
            while True: time.sleep(3600)
        except KeyboardInterrupt:
            pass
        return

    py = "python3" if shutil.which("python3") else ("python" if shutil.which("python") else None)
    if not py:
        _log("未找到 python3，无法启动本地服务")
        _notify("本地地图", "未能启动：系统缺少 python3")
        return

    # 常驻本地服务（线程内 serve_forever），Python 进程保持存活，点击图标后不再“闪退/没反应”
    os.chdir(WEBROOT)
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=False).start()
    _log("本地服务已启动：%s" % URL)
    _notify("本地地图", "正在浏览器中打开…")
    if not open_browser(URL):
        _notify("本地地图", "未找到浏览器，请手动打开 %s" % URL)
    try:
        while True: time.sleep(3600)
    except KeyboardInterrupt:
        pass
    try: httpd.shutdown()
    except Exception: pass
'''


def patch_file(path, fixes):
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        return [(t, "MISSING") for t, _, _ in fixes]
    data = open(full, encoding="utf-8").read()
    orig = data
    report = []
    for tag, old, new in fixes:
        n = data.count(old)
        if n == 0:
            report.append((tag, "SKIP"))
        elif n > 1:
            report.append((tag, "MULTI(%d)" % n))
        else:
            data = data.replace(old, new, 1)
            report.append((tag, "OK"))
    if data != orig:
        open(full, "w", encoding="utf-8").write(data)
    return report


def main():
    stamp = "20260824_v347"
    zip_path = os.path.join(ROOT, "_phaseB_pre_patch_%s.zip" % stamp)
    live_all = AI + APP + INDEX + WATER_DATA + UOS_MAIN
    n = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for p in live_all:
            f = os.path.join(ROOT, p)
            if os.path.exists(f):
                z.write(f, p)
                n += 1
    print("✅ 已备份 %d 个 LIVE 文件 -> %s" % (n, zip_path))

    failures = []
    critical_miss = []

    fixes5 = [("ai_tail", OLD_AI_TAIL, NEW_AI_TAIL),
              ("openkb_text", OLD_OPENKB_TEXT, NEW_OPENKB_TEXT),
              ("kbimport_head", OLD_KBIMPORT_HEAD, NEW_KBIMPORT_HEAD)]
    for p in AI:
        r = patch_file(p, fixes5)
        print("  [ai_module] %s -> %s" % (p, r))
        for tag, st in r:
            if st == "SKIP" or st.startswith("MULTI"):
                failures.append((p, tag, st))
                if p in CRITICAL: critical_miss.append((p, tag, st))

    fixes3app = [("popup_actions", OLD_POPUP_ACTIONS, NEW_POPUP_ACTIONS),
                 ("app_detail", OLD_POPUP_RETURN, NEW_POPUP_RETURN)]
    fixes3css = [("pop_detail_css", OLD_POPDEL_CSS, NEW_POPDEL_CSS)]
    for p in APP:
        r = patch_file(p, fixes3app)
        print("  [app.js   ] %s -> %s" % (p, r))
        for tag, st in r:
            if st == "SKIP" or st.startswith("MULTI"):
                failures.append((p, tag, st))
                if p in CRITICAL: critical_miss.append((p, tag, st))
    for p in INDEX:
        r = patch_file(p, fixes3css)
        print("  [index.html] %s -> %s" % (p, r))
        for tag, st in r:
            if st == "SKIP" or st.startswith("MULTI"):
                failures.append((p, tag, st))
                if p in CRITICAL: critical_miss.append((p, tag, st))

    for p in WATER_DATA:
        r = patch_file(p, [("b99_coord", OLD_B99, NEW_B99)])
        print("  [data.js  ] %s -> %s" % (p, r))
        for tag, st in r:
            if st == "SKIP" or st.startswith("MULTI"):
                failures.append((p, tag, st))
                if p in CRITICAL: critical_miss.append((p, tag, st))

    for p in UOS_MAIN:
        r = patch_file(p, [("launch_shell", OLD_MAIN_LAUNCH, NEW_MAIN_LAUNCH)])
        print("  [main.py  ] %s -> %s" % (p, r))
        for tag, st in r:
            if st == "SKIP" or st.startswith("MULTI"):
                failures.append((p, tag, st))
                if p in CRITICAL: critical_miss.append((p, tag, st))

    hits = []
    for p in AI + APP:
        f = os.path.join(ROOT, p)
        if os.path.exists(f) and "LIDNotify" in open(f, encoding="utf-8").read():
            hits.append(p)
    print("  [LIDNotify] LIVE 源码命中: %s" % (hits if hits else "无（✅ 干净）"))

    print("\n== 汇总 ==")
    print("  非关键跳过/多重匹配: %s" % (failures if failures else "无"))
    if critical_miss:
        print("  ❌ 关键文件未命中: %s" % critical_miss)
        sys.exit(2)
    print("  ✅ 所有关键 LIVE 文件均已命中")

    node = None
    for c in ("node", "node.exe"):
        try:
            subprocess.run([c, "--version"], capture_output=True, check=True)
            node = c
            break
        except Exception:
            pass
    if node:
        bad = []
        for p in AI + APP:
            f = os.path.join(ROOT, p)
            if os.path.exists(f):
                try:
                    subprocess.run([node, "--check", f], capture_output=True, check=True)
                except subprocess.CalledProcessError as e:
                    bad.append((p, e.stderr.decode("utf-8", "ignore")[:300]))
        print("  node --check: %s" % ("全部通过 ✅" if not bad else "失败 %s" % bad))
    else:
        print("  ⚠️ 未检测到 node，跳过 JS 语法校验（请在 UOS/构建机复核）")
    sys.exit(0)


if __name__ == "__main__":
    main()
