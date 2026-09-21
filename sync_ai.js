/* sync_ai.js — 将 ai_module.js + 智能AI 菜单 同步到三产品 × 四平台 webroot（Android/Win/UOS/iOS 源）
 * 用法：node sync_ai.js
 * 安全：每个文件先备份 .bak，已注入则跳过；失败不中断其它文件。
 */
const fs = require("fs");
const path = require("path");

const ROOT = "D:/Users/Claw";
const SRC_MODULE = path.join(ROOT, "travel/android/assets/ai_module.js");

// 每个目标的：app.js、index.html、domain、数据全局名、是否联网、字段清单、搜索字段、app 名
const TARGETS = [
  // 古建（在线，HERITAGE）
  { app: "travel/android/assets/app.js", html: "travel/android/assets/index.html", domain: "gujian", data: "HERITAGE", online: true,
    fields: ["province", "city", "type", "dynasty", "level", "intro", "features"], search: ["name", "province", "city"], name: "古建景点打卡" },
  { app: "travel/webroot/app.js", html: "travel/webroot/index.html", domain: "gujian", data: "HERITAGE", online: true,
    fields: ["province", "city", "type", "dynasty", "level", "intro", "features"], search: ["name", "province", "city"], name: "古建景点打卡" },
  { app: "native-shell/win-gujian-webview2/webroot/app.js", html: "native-shell/win-gujian-webview2/webroot/index.html", domain: "gujian", data: "HERITAGE", online: true,
    fields: ["province", "city", "type", "dynasty", "level", "intro", "features"], search: ["name", "province", "city"], name: "古建景点打卡" },
  { app: "native-shell/uos-gujian-pyqt6/webroot/app.js", html: "native-shell/uos-gujian-pyqt6/webroot/index.html", domain: "gujian", data: "HERITAGE", online: true,
    fields: ["province", "city", "type", "dynasty", "level", "intro", "features"], search: ["name", "province", "city"], name: "古建景点打卡" },

  // 水利（离线，BUILDINGS）
  { app: "android-build/shuili-v329/assets/app.js", html: "android-build/shuili-v329/assets/index.html", domain: "shuili", data: "BUILDINGS", online: false,
    fields: ["office", "station", "btype", "chan"], search: ["name", "office", "station"], name: "水利工程基础信息一张图" },
  { app: "native-shell/win-water-webview2/webroot/app.js", html: "native-shell/win-water-webview2/webroot/index.html", domain: "shuili", data: "BUILDINGS", online: false,
    fields: ["office", "station", "btype", "chan"], search: ["name", "office", "station"], name: "水利工程基础信息一张图" },
  { app: "native-shell/uos-water-pyqt6/webroot/app.js", html: "native-shell/uos-water-pyqt6/webroot/index.html", domain: "shuili", data: "BUILDINGS", online: false,
    fields: ["office", "station", "btype", "chan"], search: ["name", "office", "station"], name: "水利工程基础信息一张图" },

  // 感知（离线，BUILDINGS）
  { app: "android-build/perc-v13/assets/app.js", html: "android-build/perc-v13/assets/index.html", domain: "perc", data: "BUILDINGS", online: false,
    fields: ["office", "station", "btype", "subsystem", "model", "assetNo"], search: ["name", "office", "station"], name: "水利感知项目一张图" },
  { app: "native-shell/win-webview2/webroot/app.js", html: "native-shell/win-webview2/webroot/index.html", domain: "perc", data: "BUILDINGS", online: false,
    fields: ["office", "station", "btype", "subsystem", "model", "assetNo"], search: ["name", "office", "station"], name: "水利感知项目一张图" },
  { app: "native-shell/uos-pyqt6/webroot/app.js", html: "native-shell/uos-pyqt6/webroot/index.html", domain: "perc", data: "BUILDINGS", online: false,
    fields: ["office", "station", "btype", "subsystem", "model", "assetNo"], search: ["name", "office", "station"], name: "水利感知项目一张图" }
];

function bak(p) { const b = p + ".bak"; if (!fs.existsSync(b)) fs.copyFileSync(p, b); }

function genInitFn(t) {
  const D = t.data;
  const SF = JSON.stringify(t.search);
  const F = JSON.stringify(t.fields);
  return (
    "\n  /* ---------- 智能AI（设置 + 智能助手）初始化 ---------- */\n" +
    "  function initAIModule() {\n" +
    "    if (!window.AIModule) return;\n" +
    "    window.AIModule.init({\n" +
    "      domain: " + JSON.stringify(t.domain) + ",\n" +
    "      appName: " + JSON.stringify(t.name) + ",\n" +
    "      allowOnlineQuery: " + (t.online ? "true" : "false") + ",\n" +
    "      fieldSchema: " + F + ",\n" +
    "      getRecord: function (id) { return " + D + ".find(function (x) { return x.id === id; }); },\n" +
    "      searchRecords: function (q) {\n" +
    "        q = (q || \"\").trim();\n" +
    "        return " + D + ".filter(function (b) { return !q || " + SF + ".some(function (f) { return (b[f] || \"\").indexOf(q) >= 0; }); });\n" +
    "      },\n" +
    "      listAll: function () { return " + D + "; },\n" +
    "      applyUpdate: function (rec, patch) {\n" +
    "        " + F + ".forEach(function (k) { if (patch[k] != null && String(patch[k]).trim() !== \"\") rec[k] = patch[k]; });\n" +
    "        save(); render();\n" +
    "      }\n" +
    "    });\n" +
    "  }\n"
  );
}

let ok = 0, skip = 0, fail = 0;
for (const t of TARGETS) {
  const appP = path.join(ROOT, t.app);
  const htmlP = path.join(ROOT, t.html);
  try {
    // 1) 复制 ai_module.js 到目标 webroot
    const dstDir = path.dirname(appP);
    const dstMod = path.join(dstDir, "ai_module.js");
    fs.copyFileSync(SRC_MODULE, dstMod);

    let app = fs.readFileSync(appP, "utf8");
    // 2) buildMenu 注入分组
    if (app.indexOf("AIModule.getMenuGroups") < 0) {
      const bi = app.indexOf("function buildMenu()");
      const anchor = "\n    ];\n    var html = \"\";";
      const ai = app.indexOf(anchor, bi);
      if (ai < 0) throw new Error("未找到 buildMenu 分组闭合锚点 (" + t.app + ")");
      const inject = "\n    ];\n    // 智能AI（设置 + 智能助手）：参数化模块，注入菜单（同名分组自动合并）\n" +
        "    if (window.AIModule && typeof AIModule.getMenuGroups === \"function\") {\n" +
        "      AIModule.getMenuGroups().forEach(function (g) {\n" +
        "        var ex = groups.find(function (x) { return x.g === g.g; });\n" +
        "        if (ex) { g.items.forEach(function (it) { ex.items.push(it); }); }\n" +
        "        else groups.push(g);\n" +
        "      });\n" +
        "    }\n    var html = \"\";";
      app = app.slice(0, ai) + inject + app.slice(ai + anchor.length);
    }
    // 3) 启动处注入 initAIModule 调用 + 函数定义
    if (app.indexOf("initAIModule();") < 0) {
      const ci = app.lastIndexOf("buildMenu();");
      if (ci < 0) throw new Error("未找到启动 buildMenu(); (" + t.app + ")");
      app = app.slice(0, ci) + "initAIModule(); " + app.slice(ci);
      // 函数定义插到 IIFE 结尾前（函数声明提升，随处可调用）
      const ei = app.lastIndexOf("})();");
      if (ei < 0) throw new Error("未找到 IIFE 结尾 (" + t.app + ")");
      app = app.slice(0, ei) + genInitFn(t) + "\n" + app.slice(ei);
    }
    bak(appP);
    fs.writeFileSync(appP, app, "utf8");

    // 4) index.html 注入脚本标签（换行无关：仅按 app.js 标签字面插入，兼容 CRLF/LF）
    if (fs.existsSync(htmlP)) {
      let html = fs.readFileSync(htmlP, "utf8");
      if (html.indexOf("ai_module.js") < 0) {
        html = html.replace('<script src="app.js"></script>', '<script src="ai_module.js"></script>\n<script src="app.js"></script>');
        bak(htmlP);
        fs.writeFileSync(htmlP, html, "utf8");
      }
    }
    ok++;
    console.log("✅ " + t.app);
  } catch (e) {
    fail++;
    console.log("❌ " + t.app + " :: " + e.message);
  }
}
console.log("\n完成：成功 " + ok + " / 跳过? " + skip + " / 失败 " + fail);
