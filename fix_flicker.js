/* fix_flicker.js — 修复古建进入页面闪动：初始化 moveend 不触发重渲染，布局稳定后刷新尺寸 */
const fs = require("fs");
const path = require("path");
const ROOT = "D:/Users/Claw";
const TARGETS = [
  "travel/android/assets/app.js",
  "travel/webroot/app.js",
  "native-shell/win-gujian-webview2/webroot/app.js",
  "native-shell/uos-gujian-pyqt6/webroot/app.js",
];

// 1) scheduleRender 增加 booting 守卫
const A1 = `  var _renderTimer = null;
  function scheduleRender() {
    clearTimeout(_renderTimer);
    _renderTimer = setTimeout(function () { _renderTimer = null; render(); }, 200);
  }`;
const B1 = `  var _renderTimer = null;
  var _mapBooting = false;
  function scheduleRender() {
    if (_mapBooting) return; // 启动期间忽略 setView 触发的 moveend，避免二次整图重渲染闪动
    clearTimeout(_renderTimer);
    _renderTimer = setTimeout(function () { _renderTimer = null; render(); }, 200);
  }`;

// 2) initMap 开头置 booting
const A2 = `  function initMap() {
    map = L.map("map", { zoomControl: true, attributionControl: true }).setView([35.5, 105], 4);`;
const B2 = `  function initMap() {
    _mapBooting = true;
    map = L.map("map", { zoomControl: true, attributionControl: true }).setView([35.5, 105], 4);`;

// 3) 启动后布局稳定再 invalidateSize + 解除保护（并整图重渲染一次对齐视窗）
const A3 = `  load(); initMap(); initAIModule(); buildMenu(); render();
})();`;
const B3 = `  load(); initMap(); initAIModule(); buildMenu(); render();
  // 修复进入页面闪动：布局稳定后刷新地图尺寸并解除 booting 保护
  setTimeout(function () {
    if (map) { try { map.invalidateSize(); } catch (e) {} }
    _mapBooting = false; render();
  }, 300);
})();`;

let ok = 0, fail = 0;
for (const rel of TARGETS) {
  const p = path.join(ROOT, rel);
  try {
    if (!fs.existsSync(p)) throw new Error("文件不存在");
    let s = fs.readFileSync(p, "utf8");
    [["#1", A1, B1], ["#2", A2, B2], ["#3", A3, B3]].forEach(function (pair) {
      if (s.indexOf(pair[1]) < 0) throw new Error("未找到锚点 " + pair[0]);
      s = s.replace(pair[1], pair[2]);
    });
    const b = p + ".flickbak";
    if (!fs.existsSync(b)) fs.copyFileSync(p, b);
    fs.writeFileSync(p, s, "utf8");
    ok++; console.log("✅ " + rel);
  } catch (e) {
    fail++; console.log("❌ " + rel + " :: " + e.message);
  }
}
console.log("\n闪动修复：成功 " + ok + " / 失败 " + fail);
