/* sync_ctx.js — 将 ctx_menu.js（右键上下文菜单 + 智能功能）同步到三产品 × 四平台 webroot
 * 用法：node sync_ctx.js
 * 安全：每个文件先备份 .bak；失败不中断其它文件。
 */
const fs = require("fs");
const path = require("path");
const ROOT = "D:/Users/Claw";
const SRC = path.join(ROOT, "travel/android/assets/ctx_menu.js");

// 每个产品的 webroot（app.js / index.html）、数据源名、智能补全字段
const PRODUCTS = [
  {
    name: "gujian", records: "HERITAGE", textFields: '["intro", "features"]',
    files: [
      { app: "travel/android/assets/app.js", html: "travel/android/assets/index.html" },
      { app: "travel/webroot/app.js", html: "travel/webroot/index.html" },
      { app: "native-shell/win-gujian-webview2/webroot/app.js", html: "native-shell/win-gujian-webview2/webroot/index.html" },
      { app: "native-shell/uos-gujian-pyqt6/webroot/app.js", html: "native-shell/uos-gujian-pyqt6/webroot/index.html" }
    ]
  },
  {
    name: "water", records: "BUILDINGS", textFields: "[]",
    files: [
      { app: "android-build/shuili-v329/assets/app.js", html: "android-build/shuili-v329/assets/index.html" },
      { app: "native-shell/win-water-webview2/webroot/app.js", html: "native-shell/win-water-webview2/webroot/index.html" },
      { app: "native-shell/uos-water-pyqt6/webroot/app.js", html: "native-shell/uos-water-pyqt6/webroot/index.html" }
    ]
  },
  {
    name: "perc", records: "BUILDINGS", textFields: "[]",
    files: [
      { app: "android-build/perc-v13/assets/app.js", html: "android-build/perc-v13/assets/index.html" },
      { app: "native-shell/win-webview2/webroot/app.js", html: "native-shell/win-webview2/webroot/index.html" },
      { app: "native-shell/uos-pyqt6/webroot/app.js", html: "native-shell/uos-pyqt6/webroot/index.html" }
    ]
  }
];

function bak(p) { const b = p + ".ctxbak"; if (!fs.existsSync(b)) fs.copyFileSync(p, b); }

let ok = 0, fail = 0, skipHtml = 0;
for (const p of PRODUCTS) {
  const initLine = 'if (window.CtxMenu) window.CtxMenu.init({ map: map, records: function () { return ' + p.records + '; }, textFields: ' + p.textFields + ', getCoordinates: getCoordinates, nearbySearch: nearbySearch });';
  for (const t of p.files) {
    const appP = path.join(ROOT, t.app);
    const htmlP = path.join(ROOT, t.html);
    try {
      // 1) 复制 ctx_menu.js 到 webroot
      fs.copyFileSync(SRC, path.join(path.dirname(appP), "ctx_menu.js"));

      let app = fs.readFileSync(appP, "utf8");
      // 2) marker hook：render 中创建 marker 后绑定
      if (app.indexOf("window.CtxMenu.onMarker") < 0) {
        const anchor = "MARKERS[b.id] = m;";
        const ai = app.indexOf(anchor);
        if (ai < 0) throw new Error("未找到 MARKERS[b.id] = m; 锚点");
        app = app.slice(0, ai) + anchor + "\n    if (window.CtxMenu) window.CtxMenu.onMarker(m, b);" + app.slice(ai + anchor.length);
      }
      // 3) list-card 加 data-id（供列表右键定位查记录）
      if (app.indexOf('data-id="\' + esc(b.id) + \'"') < 0) {
        if (app.indexOf('<div class="list-card">') >= 0) {
          app = app.replace('<div class="list-card">', '<div class="list-card" data-id="' + "' + esc(b.id) + '" + '">');
        } else if (app.indexOf('<div class="list-card" ') >= 0) {
          app = app.replace('<div class="list-card" ', '<div class="list-card" data-id="' + "' + esc(b.id) + '" + ' ');
        }
      }
      // 4) 启动处注入 CtxMenu.init（兼容单行 / 多行启动）
      if (app.indexOf("window.CtxMenu.init(") < 0) {
        const oneLine = "load(); initMap(); initAIModule(); buildMenu(); render();";
        const si = app.indexOf(oneLine);
        if (si >= 0) {
          app = app.slice(0, si) + oneLine + "\n  " + initLine + "\n" + app.slice(si + oneLine.length);
        } else {
          const si2 = app.indexOf("initAIModule(); buildMenu();");
          if (si2 < 0) throw new Error("未找到启动锚点");
          const re = app.indexOf("render();", si2);
          if (re < 0) throw new Error("未找到启动 render();");
          app = app.slice(0, re + "render();".length) + "\n  " + initLine + "\n" + app.slice(re + "render();".length);
        }
      }
      bak(appP); fs.writeFileSync(appP, app, "utf8");

      // 5) index.html 注入 ctx_menu.js（在 ai_module.js 之后）
      if (fs.existsSync(htmlP)) {
        let html = fs.readFileSync(htmlP, "utf8");
        if (html.indexOf("ctx_menu.js") < 0) {
          const ti = html.indexOf('<script src="ai_module.js"></script>');
          if (ti >= 0) {
            html = html.slice(0, ti) + '<script src="ai_module.js"></script>\n<script src="ctx_menu.js"></script>' + html.slice(ti + '<script src="ai_module.js"></script>'.length);
            bak(htmlP); fs.writeFileSync(htmlP, html, "utf8");
          } else skipHtml++;
        }
      }
      ok++; console.log("✅ [" + p.name + "] " + t.app);
    } catch (e) {
      fail++; console.log("❌ [" + p.name + "] " + t.app + " :: " + e.message);
    }
  }
}
console.log("\n右键菜单同步：成功 " + ok + " / 失败 " + fail + " / html跳过(无ai_module标签) " + skipHtml);
