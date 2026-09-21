/* 古建景点打卡 — 离线 WebView 应用逻辑（模仿水利一张图，域改为古建文物） */

(function () {

  "use strict";

  window.onerror = function (msg, src, line, col, err) {

    var detail = String(msg || "");

    try {

      if (err && err.stack) detail += " | " + err.stack;

      else if (src) detail += " | @" + src + ":" + line + ":" + col;

    } catch (e2) {}

    var t = document.getElementById("toast");

    if (t) { t.textContent = "运行错误：" + detail; t.classList.add("show"); }

    try { window.__lastError = { msg: msg, src: src, line: line, col: col, stack: err ? err.stack : "" }; } catch (e3) {}

    return false;

  };

  // v1.8.3：ovobj 模块加载自检（ovobj_bridge.js 在 app.js 前引入；若缺失，点「导入 ovobj」会 ReferenceError → Script error）

  setTimeout(function () {

    try {

      if (typeof importOvobj !== "function" && typeof window.importOvobj !== "function") {

        toast("⚠ ovobj 模块未加载（ovobj_bridge.js 缺失或加载失败），导入奥维坐标功能不可用");

      }

    } catch (e) {}

  }, 1500);



  // v1.8.3：老 WebView 兼容 polyfill（安卓 5.x 系统 WebView / 老 WebKitGTK 缺 Array.prototype.find 等 ES6 API）

  if (typeof Array.prototype.find !== "function") {

    Array.prototype.find = function (pred) {

      for (var i = 0; i < this.length; i++) { if (pred(this[i], i, this)) return this[i]; }

      return undefined;

    };

  }

  if (typeof Array.prototype.findIndex !== "function") {

    Array.prototype.findIndex = function (pred) {

      for (var i = 0; i < this.length; i++) { if (pred(this[i], i, this)) return i; }

      return -1;

    };

  }

  if (typeof Array.from !== "function") {

    Array.from = function (arrLike) {

      var out = [];

      for (var i = 0; i < arrLike.length; i++) out.push(arrLike[i]);

      return out;

    };

  }

  if (typeof Object.assign !== "function") {

    Object.assign = function (t) {

      for (var i = 1; i < arguments.length; i++) {

        var s = arguments[i]; if (!s) continue;

        for (var k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; }

      }

      return t;

    };

  }

  // v3.2+v3.3：天地图浏览器端 token；三层回退 ① localStorage（用户在「🗝️ 修改/添加天地图密钥」里改的）

  // ② window.TIANDITU_TOKENS（index.html 环境配置） ③ 内置默认

  var TOKEN_BROWSER_DEFAULT = "61691764ff68bf341c4c9c4770b24b5f";

  /* ---------- v3.46：全局 script error 拦截 + 上报（用对排查线上静默 script error）----------

     把 window.onerror / unhandledrejection 收集到 localStorage("gujian_script_errors")（最多 50 条），

     用户在「信息与帮助 → 错误日志」可一键查看并复制反馈。 */

  function _logErr(kind, msg, src, lineno, col, err) {

    try {

      var arr = JSON.parse(localStorage.getItem("gujian_script_errors") || "[]");

      arr.push({ ts: Date.now(), kind: kind, msg: String(msg || "").slice(0, 500), src: src || "", lineno: lineno || 0, col: col || 0, stack: err && err.stack ? String(err.stack).slice(0, 800) : "" });

      if (arr.length > 50) arr = arr.slice(-50);

      localStorage.setItem("gujian_script_errors", JSON.stringify(arr));

    } catch (e) {}

  }

  if (typeof window !== "undefined") {

    var _prevOE = window.onerror;

    window.onerror = function (msg, src, lineno, col, err) {

      _logErr("onerror", msg, src, lineno, col, err);

      if (typeof _prevOE === "function") { try { return _prevOE.apply(this, arguments); } catch (e) {} }

      try { if (window.AIModule && AIModule.toast) AIModule.toast("⚠️ 运行错误（已记录到日志）"); } catch (e) {}

      return false;

    };

    window.addEventListener("unhandledrejection", function (e) {

      try { _logErr("promise", (e.reason && (e.reason.message || e.reason.toString())) || "unknown", "", 0, 0, e.reason); } catch (e2) {}

    });

  }

  // 帮助页暴露：查看错误日志

  window.viewScriptErrors = function () {

    var arr = []; try { arr = JSON.parse(localStorage.getItem("gujian_script_errors") || "[]"); } catch (e) {}

    var body = '<p style="font-size:13px;color:#555;margin-bottom:8px">最近 ' + arr.length + ' 条脚本错误（最多保留 50 条；可一键复制全部）</p>';

    if (!arr.length) body += '<p style="color:#2e8b57">暂无记录 ✓</p>';

    else {

      body += '<button class="tbtn" onclick="copyScriptErrors()" style="margin-bottom:8px">📋 复制全部为 JSON</button>';

      body += arr.slice(-50).reverse().map(function (e, i) {

        return '<div style="border:1px solid #ffe2b8;background:#fffaf0;border-radius:8px;padding:8px 10px;margin-bottom:6px;font-size:12px">' +

          '<b style="color:#c0392b">#' + (arr.length - i) + ' ' + esc(e.kind) + '</b> &nbsp; <span style="color:#888">' + new Date(e.ts).toLocaleString() + '</span><br>' +

          '<pre style="margin:6px 0 0;white-space:pre-wrap;font-family:monospace;color:#333">' + esc(e.msg) + '\n' + esc(e.src || "") + (e.lineno ? ':' + e.lineno : '') + (e.col ? ':' + e.col : '') + '</pre></div>';

      }).join("");

    }

    body += '<div class="form-actions"><button class="btn-cancel" onclick="closeSheet(\'sheetGen\')">关闭</button></div>';

    var title = document.getElementById("genTitle"); if (title) title.textContent = "错误日志（script error 排查）";

    var genBody = document.getElementById("genBody"); if (genBody) genBody.innerHTML = body;

    if (typeof openSheet === "function") openSheet("sheetGen");

  };

  window.copyScriptErrors = function () {

    var arr = []; try { arr = JSON.parse(localStorage.getItem("gujian_script_errors") || "[]"); } catch (e) {}

    var txt = JSON.stringify(arr, null, 2);

    try { navigator.clipboard && navigator.clipboard.writeText(txt).then(function () { toast("已复制 " + arr.length + " 条错误日志"); }); }

    catch (e) { try { toast("复制失败，可手动从「信息与帮助」查看"); } catch (e2) {} }

  };

  function loadToken() {

    try { var k = localStorage.getItem("gujian_tdt_token"); if (k && k.trim()) return k.trim(); } catch (e) {}

    return (window.TIANDITU_TOKENS && window.TIANDITU_TOKENS.browser) || TOKEN_BROWSER_DEFAULT;

  }

  function saveToken(k) { try { localStorage.setItem("gujian_tdt_token", String(k || "").trim()); } catch (e) {} }

  function clearToken() { try { localStorage.removeItem("gujian_tdt_token"); } catch (e) {} }

  var TOKEN = loadToken();

  var AUTHOR = "小七";

  var LS_KEY = "gujian_travel_v1";

  var APPNAME = "古建景点打卡";

  var APP_VERSION = "3.7.5";

  var APP_BUILD_DATE = "2026-09-07"



  var XFER = loadXfer();

  function loadXfer() {

    try { return Object.assign({ source: "local", resume: true, overwriteSame: "ask", baiduToken: "", quarkToken: "" }, JSON.parse(localStorage.getItem("gujian_xfer") || "{}")); }

    catch (e) { return { source: "local", resume: true, overwriteSame: "ask", baiduToken: "", quarkToken: "" }; }

  }

  function saveXfer() { try { localStorage.setItem("gujian_xfer", JSON.stringify(XFER)); } catch (e) {} }



  var HERITAGE = [];

  var MARKERS = {};

  var LINES = {};

  var map, baseVec, baseImg, labelVec, labelImg;

  var currentBase = "vec";

  var addMode = false;

  var pendingAdd = null;

  var editing = null;

  var editingCheckin = null;

  var filters = { provinces: new Set(), cities: new Set(), types: new Set(), text: "", photoStatus: "all" };
  var filterCircle = null; // 筛选命中后绘制的绿色虚线圈选层（供清除）

  // v3.38：筛选默认值持久化种子——首次安装默认值，故意不为"全部"，避免打开即全量渲染卡顿

  //   古建→北京市（城市）；水利/感知→水库所（各自 app.js 内定义本常量）

  var DEFAULT_FILTER_SEED = { provinces: [], cities: ["北京市"], types: [], text: "", photoStatus: "all" };

  function cloneSeed(s) { var o = {}; Object.keys(s).forEach(function (k) { o[k] = Array.isArray(s[k]) ? s[k].slice() : s[k]; }); return o; }

  var SETTINGS = loadSettings();

  function loadSettings() {

    try {

      var s = Object.assign({ defaultFilter: null }, JSON.parse(localStorage.getItem("gujian_settings") || "{}"));

      if (!s.defaultFilter) s.defaultFilter = cloneSeed(DEFAULT_FILTER_SEED);

      return s;

    } catch (e) { return { defaultFilter: cloneSeed(DEFAULT_FILTER_SEED) }; }

  }

  function saveSettings() { try { localStorage.setItem("gujian_settings", JSON.stringify(SETTINGS)); } catch (e) {} }

  function applyDefaultFilter() {

    var d = SETTINGS.defaultFilter || cloneSeed(DEFAULT_FILTER_SEED);

    Object.keys(filters).forEach(function (k) {

      var v = d[k]; if (v == null) return;

      filters[k] = (filters[k] instanceof Set) ? new Set(Array.isArray(v) ? v : []) : v;

    });

  }

  function saveDefaultFilter() {

    var o = {};

    Object.keys(filters).forEach(function (k) { var v = filters[k]; o[k] = (v instanceof Set) ? Array.from(v) : v; });

    SETTINGS.defaultFilter = o; saveSettings();

  }

  var listMode = false;

  var coordPickMode = false;



  /* ---------- v3.49：全平台启动诊断（便于发现「装了新版却显示旧版」） ----------
     app 启动即在控制台打印 + 写入本地诊断缓冲当前版本/构建日期/运行平台。
     UOS 另由 server.py 写入 /opt/<pkg>/launch_err.log（版本号随 version.json 自动更新）。 */
  function logRuntime() {
    try {
      var ua = (navigator && navigator.userAgent) || "";
      var plat = "Web";
      if (/iPhone|iPad|iPod/i.test(ua)) plat = "iOS";
      else if (/Android/i.test(ua)) plat = "Android";
      else if (/Windows/i.test(ua)) plat = "Win";
      else if (/UOS|Deepin|UnionTech|Linux/i.test(ua)) plat = "UOS";
      var name = (window.SHUILI_META && window.SHUILI_META.appName) ? window.SHUILI_META.appName
                 : (typeof APP_NAME !== "undefined" ? APP_NAME : "app");
      var line = "▶ 启动 " + name + " " + APP_VERSION + " (build " + APP_BUILD_DATE + ") platform=" + plat;
      try { console.log(line); } catch (e) {}
      var arr = []; try { arr = JSON.parse(localStorage.getItem("yitu_runtime_log") || "[]"); } catch (e) {}
      arr.push({ ts: Date.now(), v: APP_VERSION, d: APP_BUILD_DATE, p: plat });
      if (arr.length > 20) arr = arr.slice(-20);
      localStorage.setItem("yitu_runtime_log", JSON.stringify(arr));
      window.__LAST_RUNTIME__ = line;
    } catch (e) {}
  }
  try { logRuntime(); } catch (e) {}

  /* ---------- 工具 ---------- */

  function $(id) { return document.getElementById(id); }

  function esc(s) {

    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {

      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];

    });

  }

  function toast(msg) {

    var t = $("toast");

    t.textContent = msg; t.classList.add("show");

    clearTimeout(toast._t);

    toast._t = setTimeout(function () { t.classList.remove("show"); }, 1900);

  }

  /* 自定义确认对话框（P0：离线 WebView 的 confirm() 静默返回 false，提示不弹、数据静默丢失） */

  window.ask = function (title, msg, opts, cb) {

    var box = $("askBox");

    if (!box) return cb && cb(true);

    box.querySelector(".ask-title").textContent = title || "提示";

    box.querySelector(".ask-msg").innerHTML = msg || "";

    var btns = box.querySelector(".ask-btns");

    btns.innerHTML = "";

    (opts || []).forEach(function (o) {

      var b = document.createElement("button");

      b.textContent = o.t;

      b.className = o.cls || "btn-cancel";

      b.onclick = function () { closeAsk(); if (cb) cb(o.v); };

      btns.appendChild(b);

    });

    box.classList.add("show");

  };

  window.closeAsk = function () {

    var box = $("askBox");

    if (box) box.classList.remove("show");

  };

  /* ============ 等待遮罩（长操作请稍后提示，避免误以为卡死）============ */

  var BUSY = { n: 0 };

  function busy(msg) {

    var el = $("busyOverlay");

    if (!el) {

      el = document.createElement("div");

      el.id = "busyOverlay";

      el.innerHTML =

        '<div class="busy-box">' +

        '<div class="busy-spin"></div>' +

        '<div class="busy-msg" id="busyMsg"></div>' +

        '<div class="busy-sub" id="busySub">请稍后，勿重复点击或退出本页…</div>' +

        "</div>";

      document.body.appendChild(el);

    }

    var m = $("busyMsg");

    if (m) m.textContent = msg || "执行中，请稍后…";

    el.classList.add("show");

    BUSY.n++; return el;

  }

  function busyDetail(text) {

    var s = $("busySub");

    if (s) s.textContent = text || "请稍后，勿重复点击或退出本页…";

  }

  function idle() {

    var el = $("busyOverlay");

    if (el) el.classList.remove("show");

    BUSY.n = 0;

  }

  function busyRun(msg, fn) {

    busy(msg);

    setTimeout(function () {

      try { fn(); } catch (e) { toast("操作失败：" + (e && e.message ? e.message : e)); }

      finally { idle(); }

    }, 30);

  }

  function busyIfSlow(msg, ms) {

    clearTimeout(busyIfSlow._t);

    busyIfSlow._t = setTimeout(function () { busy(msg); }, ms == null ? 400 : ms);

  }

  function busyCancelPending() { clearTimeout(busyIfSlow._t); idle(); }

  window.busy = busy; window.idle = idle; window.busyDetail = busyDetail;

  // v3.31.x 作用域桥：ovobj_bridge.js 是独立「全局」<script>，无法访问本 IIFE 内的局部符号。

  // 统一经 window.__shuili 暴露，否则导出 ovobj/obj 会因 ReferenceError 被 window.onerror 捕获成

  // "运行错误：script error"，导入时 $ 未定义被 try/catch 吞掉而"无任何提示"。

  // 注：古建数据数组为 HERITAGE（非 BUILDINGS）；古建无 pickExportScope 对话框，导出退回「全部」。

  window.__shuili = {

    getBuildings: function () { return HERITAGE; },

    APPNAME: APPNAME,

    getTodayStr: getTodayStr,

    save: save,

    render: render,

    buildLegend: buildLegend,

    toast: toast,

    ask: ask,

    $: $

  };

  function photoSrc(p) {

    if (p.file && window.Android && typeof window.Android.ensureThumb === "function") {

      try { return window.Android.ensureThumb(p.file, 320); } catch (e) {}

    }

    if (p.file) {

      try { if (window.Android && typeof window.Android.readPhoto === "function") return window.Android.readPhoto(p.file); } catch (e) {}

      return "";

    }

    return p.data || "";

  }

  // 网格/列表缩略图：优先原生 thumbPhoto 降采样，避免多张大图塞进 WebView 内存导致 OOM（坑#18 同源修复）

  function thumbSrc(p) {

    if (!p) return "";

    if (p.data) return p.data;

    if (p.file) {

      try { if (window.Android && window.Android.ensureThumb) { var e = window.Android.ensureThumb(p.file, 320); if (e) return e; } } catch (e) {}

      try { if (window.Android && window.Android.thumbPhoto) { var t = window.Android.thumbPhoto(p.file, 512); if (t) return t; } } catch (e) {}

      try { if (window.Android && typeof window.Android.readPhoto === "function") return window.Android.readPhoto(p.file); } catch (e) {}

    }

    return p.data || "";

  }



  /* ============ 照片压缩（方案2：>1.5M 大图导入时压缩，默认 500KB，只存压缩版）============ */

  var COMPRESS_THRESHOLD = 1.5 * 1024 * 1024; // 1.5MB

  var __compressPrefs = null;                 // null=未决定；0=不压缩；>0=目标KB

  var __compressQueue = [];                   // [{rel, abs, sz}] 待压缩的已落盘大图

  var __compressRunning = false;

  // base64 dataURL → 估算字节数

  function dataUrlSize(dataUrl) {

    try {

      var idx = dataUrl.indexOf(",");

      var b64 = idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;

      return Math.floor(b64.length * 3 / 4);

    } catch (e) { return 0; }

  }

  function fmtMB(b) { return (b / 1048576).toFixed(1); }

  // JS canvas 压缩（base64 场景：单张添加 / 打卡 / 浏览器回退 ovkmz）

  function canvasCompress(dataUrl, targetKB, cb) {

    var img = new Image();

    img.onload = function () {

      try {

        var w = img.width, h = img.height, longer = Math.max(w, h);

        var scale = Math.min(1, 2048 / longer);

        var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));

        var cv = document.createElement("canvas");

        cv.width = cw; cv.height = ch;

        cv.getContext("2d").drawImage(img, 0, 0, cw, ch);

        var q = 0.82, out = null, limit = targetKB * 1024;

        for (var i = 0; i < 8; i++) {

          var d = cv.toDataURL("image/jpeg", q);

          if (dataUrlSize(d) <= limit) { out = d; break; }

          q -= 0.09;

        }

        if (!out) out = cv.toDataURL("image/jpeg", 0.25);

        cb(out);

      } catch (e) { cb(dataUrl); }

    };

    img.onerror = function () { cb(dataUrl); };

    img.src = dataUrl;

  }

  // 压缩目标选择弹窗（每会话首次遇大图弹一次，之后沿用选择）

  function askCompressTarget(n, totalMB, estMB, cb) {

    var opts = [[200, "200KB（最省空间）"], [500, "500KB（推荐）"], [1024, "1MB（更清晰）"], [0, "不压缩"]].map(function (o) {

      var sel = o[0] === 500 ? " checked" : "";

      return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:14px"><input type="radio" name="cTarget" value="' + o[0] + '"' + sel + '> ' + o[1] + "</label>";

    }).join("");

    ask("检测到大尺寸照片",

      "共 <b>" + n + "</b> 张照片超过 1.5MB（合计约 <b>" + totalMB + "</b> MB）。<br>" +

      "压缩后<b>仅保留压缩版</b>，<b style='color:#c0392b'>原大图将被覆盖删除</b>（原始压缩包请自行备份）。<br><br>" +

      "请选择压缩目标（系统建议 500KB，压缩后约 <b>" + estMB + "</b> MB）：<br>" + opts,

      [{ t: "开始压缩", cls: "btn-confirm2", v: 1 }, { t: "不压缩直接导入", cls: "btn-cancel", v: 0 }],

      function (ok) {

        if (!ok) { __compressPrefs = 0; cb(0); return; }

        var rb = document.querySelector('input[name="cTarget"]:checked');

        __compressPrefs = rb ? parseInt(rb.value, 10) : 500;

        cb(__compressPrefs);

      });

  }

  // 已落盘照片排队压缩（原生并发 + 进度条）；>1.5M 才入队

  function queueCompress(rel) {

    if (!(window.Android && window.Android.photoAbsPath && window.Android.fileSize && window.Android.compressPhoto)) return;

    try {

      var abs = window.Android.photoAbsPath(rel);

      if (!abs) return;

      var sz = window.Android.fileSize(abs);

      if (sz <= COMPRESS_THRESHOLD) return;

      __compressQueue.push({ rel: rel, abs: abs, sz: sz });

    } catch (e) {}

  }

  // 统一压缩触发点：所有照片落盘完成后调用（匹配完成 / 多匹配确认 / ovkmz 导入后）

  function flushCompress() {

    if (__compressRunning || !__compressQueue.length) return;

    if (!(window.Android && window.Android.compressPhoto)) { __compressQueue = []; return; }

    if (__compressPrefs === null) {

      var n = __compressQueue.length, totalB = 0;

      __compressQueue.forEach(function (q) { totalB += q.sz || 0; });

      askCompressTarget(n, fmtMB(totalB), Math.max(1, Math.round(totalB * 500 / 1048576 / 1024)), function (t) {

        __compressPrefs = t;

        if (t > 0) flushCompress(); else __compressQueue = [];

      });

      return;

    }

    if (__compressPrefs === 0) { __compressQueue = []; return; }

    __compressRunning = true;

    var jobs = __compressQueue.slice(); __compressQueue = [];

    var totalB = 0; jobs.forEach(function (q) { totalB += q.sz || 0; });

    openXferProgress("compress", "正在压缩 " + jobs.length + " 张大尺寸照片…");

    setXferTitle("正在压缩 " + jobs.length + " 张大尺寸照片（原图 " + fmtMB(totalB) + " MB → 目标 ≤" + __compressPrefs + "KB），仅保留压缩版…");

    window.__compressJobs = {};

    jobs.forEach(function (q) {

      window.__compressJobs[q.abs] = null;

      try { window.Android.compressPhoto(q.abs, __compressPrefs); }

      catch (e) { window.__compressJobs[q.abs] = { ok: false }; }

    });

    window.__compressDone = function (failedN) {

      __compressRunning = false;

      closeXferProgress();

      if (failedN > 0) toast(failedN + " 张照片压缩失败，已保留原图");

      if (__compressQueue.length && __compressPrefs > 0) flushCompress();

    };

  }

  // 原生压缩逐张回调（并发累积 + 进度）

  window.onCompressPhoto = function (absPath, json) {

    var o = null; try { o = JSON.parse(json); } catch (e) {}

    if (!window.__compressJobs || !(absPath in window.__compressJobs)) return;

    window.__compressJobs[absPath] = o || { ok: false };

    var doneN = 0, total = 0, failed = 0;

    Object.keys(window.__compressJobs).forEach(function (k) {

      total++;

      if (window.__compressJobs[k] !== null) { doneN++; if (!window.__compressJobs[k].ok) failed++; }

    });

    updateXferProgress("compress", doneN, total);

    if (window.__compressDone && doneN >= total) window.__compressDone(failed);

  };

  // base64 场景压缩（单张添加 / 打卡 / 浏览器回退 ovkmz）：>1.5M 走 canvas 压缩

  function compressDataUrlIfBig(data, done) {

    var sz = dataUrlSize(data);

    if (sz <= COMPRESS_THRESHOLD || __compressPrefs === 0) { done(data); return; }

    var cb = function (t) {

      if (t > 0) { busy("正在压缩大尺寸照片…"); canvasCompress(data, t, function (d) { idle(); done(d); }); }

      else done(data);

    };

    if (__compressPrefs !== null) cb(__compressPrefs);

    else askCompressTarget(1, fmtMB(sz), Math.max(1, Math.round(sz * 500 / 1048576 / 1024)), cb);

  }

  function ensureWifi(action, cb) {

    var net = (window.Android && typeof window.Android.netType === "function") ? window.Android.netType() : "wifi";

    if (net !== "wifi") {

      ask("流量提醒", "当前不是 WiFi（" + (net === "cellular" ? "移动网络" : "无网络") + "），" + action + "可能消耗流量，是否继续？",

        [{ t: "取消", cls: "btn-cancel", v: 0 }, { t: "继续", cls: "btn-confirm2", v: 1 }], function (v) { if (v) cb(); });

      return;

    }

    cb();

  }

  /* ============ 传输进度浮层 ============ */

  function openXferProgress(kind, title) {

    closeXferProgress(true);

    var el = document.createElement("div"); el.id = "xferOverlay";

    el.style.cssText = "position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:3px solid var(--primary);padding:14px 16px;z-index:2000;box-shadow:0 -2px 10px rgba(0,0,0,.25);font-size:14px;max-height:46vh;overflow:auto";

    el.innerHTML = '<div id="xferTitle" style="font-weight:600;margin-bottom:8px">' + esc(title) + '</div>' +

      '<div style="height:8px;background:#eee;border-radius:4px;overflow:hidden"><div id="xferBar" style="height:100%;width:0;background:var(--accent);transition:width .2s"></div></div>' +

      '<div id="xferPct" style="margin-top:6px;color:#555;font-size:12px">准备中…</div>' +

      '<button onclick="closeXferProgress()" style="margin-top:10px;width:100%;padding:8px;background:#eee;border:none;border-radius:8px">关闭（传输在后台继续）</button>';

    document.body.appendChild(el);

  }

  function closeXferProgress(silent) { var el = $("xferOverlay"); if (el) el.remove(); }

  function updateXferProgress(phase, done, total) {

    var bar = $("xferBar"), pct = $("xferPct"); if (!bar) return;

    var p = total > 0 ? Math.min(100, Math.round(done * 100 / total)) : 0; bar.style.width = p + "%";

    var label = { copy: "复制照片", zip: "打包", download: "下载", netdisk: "上传网盘", compress: "压缩照片" }[phase] || phase;

    if (pct) pct.textContent = label + "：" + p + "% （" + done + "/" + (total || 0) + "）";

  }

  function setXferTitle(msg) { var t = $("xferTitle"); if (t) t.textContent = msg; }

  window.onXferProgress = function (phase, done, total) { updateXferProgress(phase, done, total); };

  window.onXferError = function (kind, msg) { closeXferProgress(); if (window.idle) window.idle(); toast("传输失败(" + kind + ")：" + msg); };

  window.onXferDone = function (kind, path) {

    var name = (path || "").split("/").pop();

    if (kind === "export") {

      if (XFER.source === "baidu" || XFER.source === "quark") {

        var token = XFER.source === "baidu" ? XFER.baiduToken : XFER.quarkToken;

        setXferTitle("正在上传到" + (XFER.source === "baidu" ? "百度网盘" : "夸克网盘") + "…");

        window.Android.netdiskUpload(XFER.source, token, path, name, XFER.resume); return;

      }

      closeXferProgress(); toast("已导出：" + name);

    } else if (kind === "download") { closeXferProgress(); toast("下载完成：" + name); }

    else if (kind === "netdisk") { closeXferProgress(); toast("已上传到" + (XFER.source === "baidu" ? "百度" : "夸克") + "网盘：" + name); }

  };



  function openXferSettings() {

    var src = XFER.source, resume = XFER.resume ? "checked" : "", ov = XFER.overwriteSame;

    var html =

      '<p style="font-size:13px;color:#555;margin-bottom:8px">导出目标与传输设置。</p>' +

      '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px">' +

      '<div style="font-weight:600;margin-bottom:6px">导出目标</div>' +

      '<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:14px"><input type="radio" name="xfSrc" value="local" ' + (src === "local" ? "checked" : "") + '> 本机（Download/古建景点打卡）</label>' +

      '<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:14px"><input type="radio" name="xfSrc" value="baidu" ' + (src === "baidu" ? "checked" : "") + '> 百度网盘</label>' +

      '<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:14px"><input type="radio" name="xfSrc" value="quark" ' + (src === "quark" ? "checked" : "") + '> 夸克网盘</label>' +

      '</div>' +

      '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-top:10px">' +

      '<label style="display:flex;align-items:center;gap:6px;font-size:14px"><input type="checkbox" id="xfResume" ' + resume + '> 启用断点续传</label>' +

      '<div style="margin-top:8px;font-size:13px;color:#555">内容相同（按 SHA-256）时：</div>' +

      '<select id="xfOver" style="width:100%;margin-top:4px;padding:6px;border-radius:6px;border:1px solid var(--border)">' +

      '<option value="ask" ' + (ov === "ask" ? "selected" : "") + '>询问是否覆盖</option>' +

      '<option value="always" ' + (ov === "always" ? "selected" : "") + '>总是覆盖</option>' +

      '<option value="skip" ' + (ov === "skip" ? "selected" : "") + '>跳过</option></select>' +

      '</div>' +

      '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-top:10px">' +

      '<div style="font-size:13px;color:#555;margin-bottom:4px">百度网盘 Token</div>' +

      '<input id="xfBaidu" value="' + esc(XFER.baiduToken) + '" placeholder="粘贴 Baidu token" style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border)">' +

      '<div style="font-size:13px;color:#555;margin:8px 0 4px">夸克网盘 Token</div>' +

      '<input id="xfQuark" value="' + esc(XFER.quarkToken) + '" placeholder="粘贴 Quark token" style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border)">' +

      '</div>' +

      '<div class="form-actions"><button class="btn-save" onclick="saveXferSettings()">保存设置</button></div>' +

      '<div id="xfMsg" style="margin-top:8px;font-size:12px;color:#b8862f"></div>';

    $("genTitle").textContent = "传输设置"; $("genBody").innerHTML = html;

    openSheet("sheetGen");

  }

  window.saveXferSettings = function () {

    var src = document.querySelector('input[name="xfSrc"]:checked');

    XFER.source = src ? src.value : "local";

    XFER.resume = $("xfResume") ? $("xfResume").checked : true;

    XFER.overwriteSame = $("xfOver") ? $("xfOver").value : "ask";

    XFER.baiduToken = $("xfBaidu") ? $("xfBaidu").value.trim() : "";

    XFER.quarkToken = $("xfQuark") ? $("xfQuark").value.trim() : "";

    saveXfer();

    $("xfMsg").textContent = "已保存。当前导出目标：" + (XFER.source === "local" ? "本机" : (XFER.source === "baidu" ? "百度网盘" : "夸克网盘"));

    toast("传输设置已保存");

  };



  function openPeer() {

    var html =

      '<p style="font-size:13px;color:#555;margin-bottom:8px">两台安装本 APP 的手机接入同一 WiFi，一台开服务端、一台开客户端，可互传数据文件（支持断点续传）。</p>' +

      '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px">' +

      '<div style="font-weight:600;margin-bottom:6px">服务端</div>' +

      '<div id="peerSrvState" style="font-size:12px;color:#888;margin-bottom:6px">未启动</div>' +

      '<button class="tbtn" style="width:100%" onclick="peerStartServer()">▶ 启动服务端</button>' +

      '<button class="tbtn" style="width:100%;margin-top:6px" onclick="peerStopServer()">■ 停止服务端</button>' +

      '</div>' +

      '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px">' +

      '<div style="font-weight:600;margin-bottom:6px">客户端</div>' +

      '<input id="peerUrl" placeholder="服务端地址，如 http://192.168.1.20:8765" style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border)">' +

      '<button class="tbtn" style="width:100%;margin-top:6px" onclick="peerList()">📂 列出服务端文件</button>' +

      '<button class="tbtn" style="width:100%;margin-top:6px" onclick="peerDownload()">⬇ 下载</button>' +

      '<div id="peerList" style="margin-top:8px;font-size:12px;color:#555"></div>' +

      '</div>';

    $("genTitle").textContent = "手机互传"; $("genBody").innerHTML = html; openSheet("sheetGen");

  }

  window.peerStartServer = function () {

    var url = ""; try { url = window.Android.peerStart(8765); } catch (e) {}

    if (!url || url.indexOf("error") === 0) { $("peerSrvState").textContent = "启动失败：" + (url || ""); return; }

    $("peerSrvState").innerHTML = '服务端已启动，地址：<b style="word-break:break-all">' + esc(url) + '</b><br>把该地址填到客户端。';

    toast("服务端已启动");

  };

  window.peerStopServer = function () { try { window.Android.peerStop(); } catch (e) {} $("peerSrvState").textContent = "已停止"; toast("服务端已停止"); };

  window.peerList = function () {

    var base = $("peerUrl").value.trim().replace(/\/$/, "");

    if (!base) { toast("请先填写服务端地址"); return; }

    fetch(base + "/list").then(function (r) { return r.json(); }).then(function (arr) {

      if (!arr.length) { $("peerList").textContent = "服务端没有可下载文件"; return; }

      $("peerList").innerHTML = arr.map(function (f) {

        return '<div style="padding:3px 0;border-bottom:1px solid #eee"><a style="color:#6b2e2e" onclick="document.getElementById(\'peerUrl\').value=\'' + esc(base) + '/' + esc(f.name) + '\'">' + esc(f.name) + '</a> <span style="color:#999">(' + (f.size / 1048576).toFixed(1) + ' MB)</span></div>';

      }).join("");

    }).catch(function () { $("peerList").textContent = "获取列表失败（请确认服务端已启动且同一 WiFi）"; });

  };

  window.peerDownload = function () {

    var url = $("peerUrl").value.trim();

    if (!url) { toast("请填写要下载的文件地址"); return; }

    var name = url.split("/").pop();

    var outPath = window.Android.exportPath(name);

    ensureWifi("从服务端下载", function () {

      openXferProgress("download", "正在从服务端下载 " + name + " …");

      window.Android.download(url, outPath, XFER.resume);

    });

  };



  function colorForType(t) {

    var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;

    return "hsl(" + h + ",55%,48%)";

  }

  function uniq(arr) { return Array.from(new Set(arr)).filter(Boolean); }

  function getTodayStr() {

    var d = new Date();

    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

  }

  function nowLocalDateTime() {

    var d = new Date();

    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") +

      "T" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");

  }

  function normalizePhotoName(s) {

    s = String(s == null ? "" : s).replace(/\.[^.]+$/, "").trim();

    s = s.replace(/[\s_]*[（(]?\d+[)）]?$/, "");

    return s.trim();

  }

  function addPhotoToItem(b, data, caption) {

    b.photos = b.photos || []; b.photos.push({ data: data, caption: caption || "" });

  }



  /* ---------- 存储 ---------- */

  function load() {

    var embedded = window.GUJIAN_DATA || [];

    try { var s = localStorage.getItem(LS_KEY); if (s) { HERITAGE = JSON.parse(s); return; } } catch (e) {}

    HERITAGE = JSON.parse(JSON.stringify(embedded));

  }

  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(HERITAGE)); } catch (e) { toast("本地存储失败（可能已满）"); } }

  function resetData() {

    ask("恢复初始数据", "确定恢复为初始数据？所有新增/修改/删除与打卡记录将被清空。",

      [{ t: "取消", cls: "btn-cancel", v: 0 }, { t: "确定恢复", cls: "btn-confirm2", v: 1 }], function (v) {

        if (!v) return;

        HERITAGE = JSON.parse(JSON.stringify(window.GUJIAN_DATA || []));

        save(); render(); toast("已恢复初始数据");

      });

  }



  /* ---------- 地图 ---------- */

  function initMap() {

    _mapBooting = true;

    map = L.map("map", { zoomControl: true, attributionControl: true }).setView([35.5, 105], 4);

    map.zoomControl.setPosition("bottomright");

    map.attributionControl.setPosition("bottomleft");

    var sub = "01234567";

    baseVec = L.tileLayer("https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=" + TOKEN, { subdomains: sub, maxZoom: 18, attribution: "天地图" });

    labelVec = L.tileLayer("https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=" + TOKEN, { subdomains: sub, maxZoom: 18, pane: "shadowPane" });

    baseImg = L.tileLayer("https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=" + TOKEN, { subdomains: sub, maxZoom: 18, attribution: "天地图影像" });

    labelImg = L.tileLayer("https://t{s}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=" + TOKEN, { subdomains: sub, maxZoom: 18, pane: "shadowPane" });

    baseVec.addTo(map); labelVec.addTo(map);

    // v3.28 视窗裁剪：平移/缩放后防抖增量重渲染（只对视窗内古建建 marker）

    map.on("moveend", scheduleRender);

    map.on("zoomend", scheduleRender);

    map.on("click", function (e) {

      if (coordPickMode) {

        var lat = e.latlng.lat, lon = e.latlng.lng;

        L.popup({ closeButton: true }).setLatLng(e.latlng)

          .setContent('<div style="font-size:14px"><b>坐标信息</b><br>纬度：' + lat.toFixed(6) + '<br>经度：' + lon.toFixed(6) + '<br><button class="tbtn" style="margin-top:6px" onclick="copyCoord(' + lat + ',' + lon + ')">复制坐标</button></div>')

          .addTo(map);

        coordPickMode = false; map._container.style.cursor = ""; $("btnMenu").textContent = "☰ 菜单"; toast("坐标已获取"); return;

      }

      if (measureMode) { onMeasureClick(e); return; }

      if (!addMode) return;

      openEdit({ id: "h" + Date.now(), name: "新古建", province: "", city: "", type: "", dynasty: "", level: "", intro: "", features: "", path: "", photos: [], checkins: [], geom: "Point", lon: e.latlng.lng, lat: e.latlng.lat, _new: true });

    });

    map.on("dblclick", function () { if (measureMode) toggleMeasure(); });

    buildLegend(); buildBaseSwitcher();

  }



  function buildBaseSwitcher() {

    var el = document.getElementById("baseSwitcher");

    if (!el) { el = document.createElement("div"); el.id = "baseSwitcher"; el.className = "base-switcher"; $("app").appendChild(el); }

    el.innerHTML =

      '<div class="bs-title">底图</div>' +

      '<label class="bs-opt"><input type="radio" name="baseOpt" value="vec" checked><span>矢量地图</span></label>' +

      '<label class="bs-opt"><input type="radio" name="baseOpt" value="img"><span>影像地图</span></label>';

    el.querySelectorAll('input[name="baseOpt"]').forEach(function (radio) { radio.onchange = function () { setBase(this.value); }; });

  }

  function setBase(mode) {

    currentBase = mode;

    if (mode === "vec") { map.removeLayer(baseImg); map.removeLayer(labelImg); map.addLayer(baseVec); map.addLayer(labelVec); }

    else { map.removeLayer(baseVec); map.removeLayer(labelVec); map.addLayer(baseImg); map.addLayer(labelImg); }

    var r = document.querySelector('#baseSwitcher input[value="' + mode + '"]'); if (r) r.checked = true;

  }

  function switchBaseMap() { setBase(currentBase === "vec" ? "img" : "vec"); toast("底图已切换为：" + (currentBase === "vec" ? "矢量地图" : "影像地图")); }



  // v3.3：重建天地图图层（密钥切换后即时生效，无须重启）

  function refreshTdtTileLayer() {

    try {

      var sub = "01234567";

      if (baseVec) map.removeLayer(baseVec);

      if (labelVec) map.removeLayer(labelVec);

      if (baseImg) map.removeLayer(baseImg);

      if (labelImg) map.removeLayer(labelImg);

      baseVec = L.tileLayer("https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=" + TOKEN, { subdomains: sub, maxZoom: 18, attribution: "天地图" });

      labelVec = L.tileLayer("https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=" + TOKEN, { subdomains: sub, maxZoom: 18, pane: "shadowPane" });

      baseImg = L.tileLayer("https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=" + TOKEN, { subdomains: sub, maxZoom: 18, attribution: "天地图影像" });

      labelImg = L.tileLayer("https://t{s}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=" + TOKEN, { subdomains: sub, maxZoom: 18, pane: "shadowPane" });

      // 恢复当前底图

      if (currentBase === "vec") { baseVec.addTo(map); labelVec.addTo(map); }

      else { baseImg.addTo(map); labelImg.addTo(map); }

    } catch (e) { console.warn("refresh tdt layers failed:", e); }

  }



  var _iconCache = {};

  function makeIcon(color) {

    if (_iconCache[color]) return _iconCache[color];

    var svg = '<svg width="32" height="44" viewBox="0 0 32 44">' +

      '<path d="M16 2 C8 2 2 8 2 16 C2 26 16 42 16 42 C16 42 30 26 30 16 C30 8 24 2 16 2 Z" fill="' + color + '" stroke="#fff" stroke-width="2.5"/>' +

      '<circle cx="16" cy="16" r="6" fill="#fff"/></svg>';

    var ic = L.divIcon({ className: "drop-pin", html: svg, iconSize: [32, 44], iconAnchor: [16, 42], popupAnchor: [0, -38] });

    _iconCache[color] = ic;

    return ic;

  }



  function passFilter(b) {

    if (filters.provinces.size && !filters.provinces.has(b.province || "")) return false;

    if (filters.cities.size && !filters.cities.has(b.city || "")) return false;

    if (filters.types.size && !filters.types.has(b.type || "")) return false;

    var np = (b.photos || []).length;

    if (filters.photoStatus === "has" && np <= 0) return false;

    if (filters.photoStatus === "many" && np < 3) return false;

    if (filters.photoStatus === "none" && np > 0) return false;

    if (filters.text) {

      var t = filters.text.toLowerCase();

      var hay = (b.name + " " + (b.type || "") + " " + (b.province || "") + " " + (b.city || "") + " " +

        (b.dynasty || "") + " " + (b.level || "") + " " + (b.intro || "") + " " + (b.features || "")).toLowerCase();

      if (hay.indexOf(t) < 0) return false;

    }

    return true;

  }



  function popupHtml(b) {

    var html = '<div class="popup-title">' + esc(b.name) + "</div>";

    if (b.province) html += '<span class="badge">' + esc(b.province) + "</span>";

    if (b.city) html += '<span class="badge b2">' + esc(b.city) + "</span>";

    if (b.type) html += '<span class="badge b3">' + esc(b.type) + "</span>";

    if (b.dynasty) html += '<div style="font-size:13px;margin-top:4px"><b>年代：</b>' + esc(b.dynasty) + (b.level ? '　<b>级别：</b>' + esc(b.level) : "") + "</div>";

    if (b.intro) html += '<div style="font-size:13px;margin-top:4px;line-height:1.5">' + esc(b.intro) + "</div>";

    if (b.features) html += '<div style="font-size:13px;margin-top:4px;color:#9c4a3c"><b>文物特点：</b>' + esc(b.features) + "</div>";

    if ((b.checkins || []).length) html += '<div style="font-size:12px;margin-top:4px;color:#b8862f">已打卡 ' + b.checkins.length + " 次</div>";

    if (b.photos && b.photos.length) {

      html += '<div class="photos">';

      b.photos.forEach(function (p, i) {

        var src = thumbSrc(p); var full = photoSrc(p);

        html += '<img src="' + esc(src) + '" onclick="appLightbox(\'' + esc(b.id) + "'," + i + ')" oncontextmenu="appPhotoAct(\'' + esc(b.id) + "'," + i + ');return false;">';

      });

      html += "</div>";

    }

    html += '<div class="pop-actions"><button class="pop-detail" onclick="appDetail(\'' + esc(b.id) + '\')">详细</button>' +

      '<button class="pop-edit" onclick="appEdit(\'' + esc(b.id) + '\')">修改</button>' +

      '<button class="pop-nav" onclick="appNav(\'' + esc(b.id) + '\')">导航</button>' +

      '<button class="pop-del" onclick="appCheckin(\'' + esc(b.id) + '\')">打卡</button>' +

      '<button class="pop-del" onclick="appDel(\'' + esc(b.id) + '\')">删除</button></div>' +

      '<div style="text-align:center;margin-top:6px"><button class="pop-close" onclick="appClosePopup()">✕ 关闭</button></div>';

    return html;

  }



  // v3.47：建筑「详细」——完整参数（含未填写）可滚动抽屉，避免弹窗参数不全

  window.appDetail = function (id) {

    var b = HERITAGE.filter(function (x) { return x.id === id; })[0];

    if (!b) { toast("未找到该建筑"); return; }

    function row(k, v) {

      var s = (v == null || v === "") ? "（未填写）" : (typeof v === "object" ? JSON.stringify(v) : String(v));

      if (s.length > 400) s = s.slice(0, 400) + " …";

      return "<tr><td class=\"k\">" + esc(k) + "</td><td>" + esc(s) + "</td></tr>";

    }

    var rows = [];

    ["id", "name", "province", "city", "type", "dynasty", "level", "intro", "features", "addr", "note"].forEach(function (k) {

      if (k in b) rows.push(row(k, b[k]));

    });

    if (b.lat != null && b.lon != null) rows.push(row("坐标(纬度,经度)", b.lat + ", " + b.lon));

    if (b.attrs && b.attrs.length) b.attrs.forEach(function (a) { rows.push(row(a[0] || "（无标题）", a[1])); });

    if ((b.photos || []).length) rows.push(row("照片数", b.photos.length));

    if ((b.checkins || []).length) rows.push(row("打卡次数", b.checkins.length));

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

    Object.keys(MARKERS).forEach(function (k) { map.removeLayer(MARKERS[k]); delete MARKERS[k]; });

    Object.keys(LINES).forEach(function (k) { map.removeLayer(LINES[k]); delete LINES[k]; });

    // v3.28 性能：只对落在当前视窗（含 15% 缓冲）内的古建建 marker，避免 1032 个点一次性全建导致卡顿

    var shown = 0, total = 0;

    var bnds = map.getBounds().pad(0.15);

    HERITAGE.forEach(function (b) {

      if (!passFilter(b)) return;

      total++;

      if (b.lat != null) {

        if (!bnds.contains([b.lat, b.lon])) return;

        var m = L.marker([b.lat, b.lon], { icon: makeIcon(colorForType(b.type || "其他")) }).bindPopup(function () { return popupHtml(b); });

        m.addTo(map); MARKERS[b.id] = m;

    if (window.CtxMenu) window.CtxMenu.onMarker(m, b); shown++;

      }

    });

    $("count").textContent = "显示 " + shown + " / " + total + "（筛选）共 " + HERITAGE.length;

    if (listMode) renderList();

  }

  // 视窗裁剪：平移/缩放后防抖增量重渲染

  var _renderTimer = null;

  var _mapBooting = false;

  function scheduleRender() {

    if (_mapBooting) return; // 启动期间忽略 setView 触发的 moveend，避免二次整图重渲染闪动

    clearTimeout(_renderTimer);

    _renderTimer = setTimeout(function () { _renderTimer = null; render(); }, 200);

  }



  /* ---------- 收藏窗口（记录当前地图视窗四角，可收藏多个；放回收藏窗口跳回视窗）---------- */

  var BM_KEY = "gujian_bookmarks";

  function getBookmarks() {

    try { var a = JSON.parse(localStorage.getItem(BM_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; }

  }

  function saveBookmarks(a) { try { localStorage.setItem(BM_KEY, JSON.stringify(a)); } catch (e) {} }

  window.appBookmark = function () {

    if (!map) return;

    var b = map.getBounds(), sw = b.getSouthWest(), ne = b.getNorthEast();

    var list = getBookmarks();

    list.push({ sw: [sw.lat, sw.lng], ne: [ne.lat, ne.lng], t: Date.now() });

    saveBookmarks(list);

    toast("已收藏窗口（共 " + list.length + " 个）");

  };

  window.appGotoBookmark = function () {

    if (!map) return;

    var list = getBookmarks();

    if (!list.length) { toast("尚未收藏窗口，请先点 ☆ 收藏窗口"); return; }

    if (list.length === 1) { gotoBookmark(list[0]); return; }

    openBookmarkChooser(list);

  };

  function gotoBookmark(bm) {

    try {

      map.fitBounds([[bm.sw[0], bm.sw[1]], [bm.ne[0], bm.ne[1]]], { animate: true, padding: [40, 40] });

      toast("已放回收藏窗口");

    } catch (e) { toast("收藏窗口数据无效"); }

  }

  function openBookmarkChooser(list) {

    var rows = list.map(function (bm, i) {

      var d = new Date(bm.t);

      var ts = (d.getMonth() + 1) + "-" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");

      return '<div class="bm-row"><span style="flex:1;font-size:13px">窗口 ' + (i + 1) + ' <span style="color:#888">（' + ts + '）</span></span>' +

        '<button class="btn-save" style="padding:4px 10px;font-size:12px" onclick="gotoBookmarkByIndex(' + i + ')">放回</button>' +

        '<button class="btn-cancel2" style="padding:4px 10px;font-size:12px" onclick="delBookmarkByIndex(' + i + ')">删除</button></div>';

    }).join("");

    $("genTitle").textContent = "选择收藏窗口（共 " + list.length + " 个）";

    $("genBody").innerHTML = rows + '<div class="form-actions"><button class="btn-cancel" onclick="closeSheet(\'sheetGen\')">关闭</button></div>';

    openSheet("sheetGen");

  }

  window.gotoBookmarkByIndex = function (i) { closeSheet("sheetGen"); var l = getBookmarks(); if (l[i]) gotoBookmark(l[i]); };

  window.delBookmarkByIndex = function (i) {

    var l = getBookmarks(); if (!l[i]) return;

    l.splice(i, 1); saveBookmarks(l);

    if (!l.length) { closeSheet("sheetGen"); toast("已清空收藏窗口"); return; }

    openBookmarkChooser(l); toast("已删除该窗口");

  };

  var btnBk = $("btnBookmark"), btnGb = $("btnGotoBookmark");

  if (btnBk) btnBk.onclick = function () { window.appBookmark(); };

  if (btnGb) btnGb.onclick = function () { window.appGotoBookmark(); };



  function buildLegend() {

    var types = uniq(HERITAGE.map(function (b) { return b.type || "其他"; })).slice(0, 8);

    var html = "<b>文物类别</b>";

    types.forEach(function (t) { html += '<div class="lg"><span class="dot" style="background:' + colorForType(t) + '"></span>' + esc(t) + "</div>"; });

    var el = $("legend"); if (!el) { el = document.createElement("div"); el.id = "legend"; $("app").appendChild(el); }

    el.innerHTML = html;

  }



  /* ---------- 弹层 ---------- */

  function openSheet(id) {

    $(id).classList.add("show");

    $(id === "sheetMenu" ? "ovMenu" : (id === "sheetCheckin" ? "ovCheckin" : "ovGen")).classList.add("show");

    ensureSheetFoot(id);

  }

  function ensureSheetFoot(id) {

    var sheet = $(id); if (!sheet) return;

    if (sheet.querySelector(".sheet-foot")) return;

    var foot = document.createElement("div"); foot.className = "sheet-foot";

    foot.innerHTML = '<button onclick="closeSheet(\'' + id + '\')">✕ 退出本页</button>';

    sheet.appendChild(foot);

  }

  function closeSheet(id) {

    $(id).classList.remove("show");

    if (id === "sheetMenu") $("ovMenu").classList.remove("show");

    else if (id === "sheetCheckin") $("ovCheckin").classList.remove("show");

    else $("ovGen").classList.remove("show");

  }

  window.openSheet = openSheet; window.closeSheet = closeSheet;
  // 全局桥接②：尾部注入模块（游记、升级/备份、知识库）裸引用以下闭包函数，不暴露则「运行错误:script error」
  window.$ = $; window.esc = esc; window.toast = toast;
  window.save = save; window.compressDataUrlIfBig = compressDataUrlIfBig;
  // 全局桥接③：尾部注入模块（游记/升级备份/知识库）会裸引用主数据数组 HERITAGE；
  // 该变量会被重新赋值（重载/恢复数据），故桥接为 getter 而非静态值，否则引用过期 → script error
  try { Object.defineProperty(window, "HERITAGE", { get: function () { return HERITAGE; }, configurable: true }); } catch (e) { window.HERITAGE = HERITAGE; }



  /* ---------- 菜单 ---------- */

  function buildMenu() {

    var topItems = [

      { ico: "🔍", t: "查询（名称 / 城市 / 类型）", f: function () { closeSheet("sheetMenu"); setTimeout(function () { var s = $("search"); if (s) { s.focus(); s.select(); } }, 200); } },

      { ico: "🔎", t: "筛选（省 / 市 / 文物类别）", f: openFilter }

    ];

    var groups = [

      { g: "拍照打卡", ico: "📸", items: [

        { ico: "📷", t: "打卡（添加照片/到达时间/体验）", f: function () { closeSheet("sheetMenu"); openCheckin(null); } },

        { ico: "🛤️", t: "我的打卡路线", f: function () { closeSheet("sheetMenu"); openRoutes(); } },

        { ico: "✍️", t: "写游记", f: function () { closeSheet("sheetMenu"); nmGo("travel", "edit"); } },

        { ico: "📒", t: "我的游记", f: function () { closeSheet("sheetMenu"); nmGo("travel", "list"); } },

        { ico: "🗒️", t: "写备忘录", f: function () { closeSheet("sheetMenu"); nmGo("memo", "edit"); } },

        { ico: "📚", t: "我的备忘录", f: function () { closeSheet("sheetMenu"); nmGo("memo", "list"); } }

      ]},

      { g: "数据管理", ico: "🗂️", items: [

        { ico: "🖼️", t: "批量导入照片", f: batchImportPhotos },

        { ico: "📑", t: "导出古建表格", f: exportTable },

        { ico: "🗑️", t: "删除添加的照片", f: deleteImportedPhotos },

      ]},

      { g: "地图和位置", ico: "🗺️", items: [

        { ico: "📍", t: "定位我的位置", f: locateMe },

        { ico: "🎯", t: "获取坐标", f: getCoordinates },

        { ico: "🗺️", t: "底图切换（矢量/影像）", f: switchBaseMap },

        { ico: "📏", t: "测距", f: toggleMeasure },

        { ico: "🔎", t: "周边搜索", f: nearbySearch },

        { ico: "📋", t: "列表视图", f: toggleList },

        { ico: "➕", t: "添加古建（点地图定位）", f: toggleAdd },

        { ico: "☆", t: "收藏窗口", f: function () { closeSheet("sheetMenu"); window.appBookmark(); } },

        { ico: "⌂", t: "放回收藏窗口", f: function () { closeSheet("sheetMenu"); window.appGotoBookmark(); } }

      ]},

      { g: "传输与共享", ico: "🔗", items: [

        { ico: "📦", t: "导出数据(ovkmz/KML)", f: exportOvkmz },

        { ico: "📥", t: "导入数据(ovkmz/KML)", f: importOvkmz },

        { ico: "📍", t: "导入 ovobj（奥维坐标）", f: importOvobj },

        { ico: "📤", t: "导出 ovobj（奥维坐标·实验）", f: exportOvobj },

        { ico: "📍", t: "导入 obj 坐标（文本）", f: importObj },

        { ico: "📤", t: "导出 obj 坐标（文本）", f: exportObj },

        { ico: "📤", t: "导出数据(JSON)", f: exportJson },

        { ico: "⚙️", t: "传输设置（WiFi/网盘/续传）", f: openXferSettings },

        { ico: "📡", t: "手机互传（服务端/客户端）", f: openPeer }

      ]},



    ];

    // 设置：危险操作归入设置子菜单（与智能AI设置合并为同一分组）

    groups.push({ g: "设置", ico: "⚙️", items: [

      { ico: "🚫", t: "删除古建", f: deleteHeritage },

      { ico: "♻️", t: "恢复初始数据", f: resetData },

      { ico: "📤", t: "升级数据导出", f: upOpenExport },

      { ico: "📥", t: "升级数据导入", f: upOpenImport },

      { ico: "🔄", t: "软件升级（检测新版）", f: upOpenUpgrade },

      { ico: "🐙", t: "GitHub 升级（检测新版）", f: ghOpenUpgrade }

    ]});

    // 智能AI（设置 + 智能助手）：参数化模块，注入菜单（同名分组自动合并）

    if (window.AIModule && typeof AIModule.getMenuGroups === "function") {

      AIModule.getMenuGroups().forEach(function (g) {

        var ex = groups.find(function (x) { return x.g === g.g; });

        if (ex) { g.items.forEach(function (it) { ex.items.push(it); }); }

        else groups.push(g);

      });

    }

    // 信息与帮助置底（关于/帮助放在最末）

    groups.push({ g: "信息与帮助", ico: "ℹ️", items: [

      { ico: "📈", t: "统计", f: showStats },

      { ico: "📝", t: "版本变更", f: openChangelog },

      { ico: "📊", t: "四端功能对照单", f: openPlatformCompare },

      { ico: "❓", t: "功能介绍", f: showHelp },

      { ico: "ℹ️", t: "关于", f: showAbout }

    ]});

    var html = "";

    topItems.forEach(function (it, i) {

      html += '<div class="menu-top-item" data-ti="' + i + '"><span class="menu-ico">' + it.ico + "</span><span>" + esc(it.t) + "</span></div>";

    });

    groups.forEach(function (grp, gi) {

      html += '<div class="menu-group collapsed" data-gi="' + gi + '">' +

        '<div class="menu-group-head" data-gi="' + gi + '"><span class="gh-ico">' + grp.ico + '</span><span>' + esc(grp.g) + '</span><span class="plus">＋</span></div>' +

        '<div class="menu-group-body">';

      grp.items.forEach(function (it, ii) {

        html += '<div class="menu-item sub" data-gi="' + gi + '" data-ii="' + ii + '"><span class="menu-ico">' + it.ico + '</span><span>' + esc(it.t) + "</span></div>";

      });

      html += "</div></div>";

    });

    $("menuBody").innerHTML = html;

    // v3.2 古建快捷常用：为每个菜单项加 .menu-fav 星标

    $("menuBody").querySelectorAll(".menu-item.sub").forEach(function (el, gi_ii) {

      var gi = +el.dataset.gi, ii = +el.dataset.ii;

      var it = groups[gi] && groups[gi].items[ii];

      if (!it) return;

      var key = gi + ":" + ii;

      var starred = _v32_favHas(key);

      var fav = document.createElement("span");

      fav.className = "menu-fav";

      fav.dataset.k = key;

      fav.title = "添加/移除快捷常用";

      fav.style.cssText = "float:right;margin-left:8px;padding:0 6px;color:" + (starred ? "#f0a020" : "#c8cdd2") + ";font-size:15px;cursor:pointer;user-select:none";

      fav.textContent = starred ? "★" : "☆";

      el.appendChild(fav);

      fav.onclick = function (ev) {

        ev.stopPropagation(); ev.preventDefault();

        var on = _v32_favToggle(key);

        fav.textContent = on ? "★" : "☆";

        fav.style.color = on ? "#f0a020" : "#c8cdd2";

        toast(on ? "已加入快捷常用：" + it.t : "已移出快捷常用");

        try { buildMenu(); } catch (e) {}

      };

    });

    $("menuBody").querySelectorAll(".menu-top-item").forEach(function (el, i) { el.onclick = function () { closeSheet("sheetMenu"); topItems[i].f(); }; });

    $("menuBody").querySelectorAll(".menu-group-head").forEach(function (el) { el.onclick = function () { el.parentNode.classList.toggle("collapsed"); }; });

    // v3.2：防御性 click 隔离（如果未来 B5 兼容 patch）

    $("menuBody").querySelectorAll(".menu-item.sub").forEach(function (el, gi_ii) {

      el.onclick = function (ev) {

        if (ev && ev.target && ev.target.closest && ev.target.closest(".menu-fav")) return;

        var gi = +el.dataset.gi, ii = +el.dataset.ii;

        closeSheet("sheetMenu");

        var grp = groups[gi]; if (!grp) return;

        var it = grp.items[ii]; if (it && it.f) it.f();

      };

    });

    window._v32_lastBuildMenuGroups = groups;

    // 修复：把 groups 暴露给 _v32_injectFavoritesGroup

    if (typeof _v32_injectFavoritesGroup === "function") try { _v32_injectFavoritesGroup(); } catch(e){}

  }



  /* ---------- v3.2 古建快捷常用：插入到「拍照打卡」之前 ---------- */

  function _v32_injectFavoritesGroup() {

    try {

      var favIds = _v32_favGet();

      if (!favIds.length) return;

      // 复制 menuBody 的对应 item 到新分组

      var srcItems = $("menuBody").querySelectorAll(".menu-item.sub");

      if (!srcItems.length) return;

      var groupsArr = window._v32_lastBuildMenuGroups;

      var html = "";

      favIds.forEach(function (k) {

        var parts = k.split(":"); var gi = +parts[0], ii = +parts[1];

        if (!groupsArr || !groupsArr[gi] || !groupsArr[gi].items[ii]) return;

        var it = groupsArr[gi].items[ii];

        html += '<div class="menu-item sub" data-gi="-1" data-ii="-1" data-favid="' + esc(k) + '"><span class="menu-ico">' + it.ico + '</span><span>' + esc(it.t) + "</span></div>";

      });

      if (!html) return;

      var favDiv = document.createElement("div");

      favDiv.className = "menu-group";

      favDiv.dataset.gi = "-1";

      favDiv.innerHTML = '<div class="menu-group-head" data-gi="-1"><span class="gh-ico">⭐</span><span>快捷常用</span><span class="plus">＋</span></div><div class="menu-group-body">' + html + "</div>";

      // 找到「拍照打卡」分组，插入到它前面

      var groups = $("menuBody").querySelectorAll(".menu-group");

      var photoGroup = null;

      groups.forEach(function (g) {

        var h = g.querySelector(".menu-group-head");

        if (h && h.textContent.indexOf("拍照打卡") >= 0) photoGroup = g;

      });

      var menuBody = $("menuBody");

      // 在第一个 .menu-group 之前插入（相当于排在拍照打卡之前；其它分组顺序不变）

      var firstGroup = groups[0];

      if (firstGroup && firstGroup.parentNode === menuBody) menuBody.insertBefore(favDiv, firstGroup);

      else menuBody.appendChild(favDiv);

      // 绑定「快捷常用」分组的折叠和点击

      favDiv.querySelector(".menu-group-head").onclick = function () { favDiv.classList.toggle("collapsed"); };

      favDiv.querySelectorAll(".menu-item.sub").forEach(function (el) {

        var favId = el.dataset.favid;

        var parts = favId.split(":"); var gi = +parts[0], ii = +parts[1];

        el.onclick = function () {

          closeSheet("sheetMenu");

          var grp = groupsArr[gi]; if (!grp) return;

          var it = grp.items[ii]; if (it && it.f) it.f();

        };

      });

    } catch (e) { try { console.warn("fav inject err", e); } catch (_) {} }

  }



  /* ---------- 筛选（省/市/类别）---------- */

  // v3.51：筛选面板实时显示当前匹配数量
  function updateFilterCount() {
    var n = HERITAGE.filter(passFilter).length;
    var el = $("filterCount");
    if (el) el.innerHTML = "当前匹配 <b>" + n + "</b> 个古建（共 " + HERITAGE.length + "）";
  }
  function openFilter() {

    var provinces = uniq(HERITAGE.map(function (b) { return b.province; }));

    var cities = uniq(HERITAGE.map(function (b) { return b.city || "（未设置）"; }));

    var types = uniq(HERITAGE.map(function (b) { return b.type || "其他"; }));

    function chips(arr, set, key) {

      return arr.map(function (v) {

        var real = v === "（未设置）" ? "" : v;

        return '<span class="chip' + (set.has(real) ? " on" : "") + '" data-k="' + key + '" data-v="' + esc(real) + '">' + esc(v) + "</span>";

      }).join("");

    }

    $("genTitle").textContent = "筛选";

    // v3.2 古建：在最前注入「5 级组织 + 历史关键词」v3.2 智能化区

    var v32_org_html = (typeof _v32_renderOrgSection === "function") ? _v32_renderOrgSection() : "";

    $("genBody").innerHTML = v32_org_html +

      '<div class="filter-sec"><h4>省 / 直辖市 / 自治区</h4><div class="chips" id="cProv">' + chips(provinces, filters.provinces, "province") + "</div></div>" +

      '<div class="filter-sec"><h4>城市</h4><div class="chips" id="cCity">' + chips(cities, filters.cities, "city") + "</div></div>" +

      '<div class="filter-sec"><h4>文物类别</h4><div class="chips" id="cTyp">' + chips(types, filters.types, "type") + "</div></div>" +

      '<div class="filter-sec"><h4>照片状态</h4><div class="chips" id="cPhoto">' +

        [["all", "全部"], ["has", "有照片"], ["many", "多张照片(≥3)"], ["none", "无照片"]].map(function (o) { return '<span class="chip' + (filters.photoStatus === o[0] ? " on" : "") + '" data-k="photoStatus" data-v="' + o[0] + '">' + o[1] + "</span>"; }).join("") +

      '</div></div>' +

      '<div id="filterCount" style="margin:12px 0 4px;padding:9px 11px;background:var(--soft);border-radius:8px;font-size:13px;color:var(--primary);font-weight:600">当前匹配 <b>0</b> 个古建</div>' +
      '<div class="form-actions"><button class="btn-cancel" onclick="appClearFilter()">清空筛选</button>' +

      '<button class="btn-save" onclick="applyFilterAndJump()">确认</button></div>';

    $("genBody").querySelectorAll(".chip").forEach(function (el) {

      el.onclick = function () {

        if (el.dataset.k === "photoStatus") { filters.photoStatus = el.dataset.v; el.parentNode.querySelectorAll(".chip").forEach(function (c) { c.classList.toggle("on", c === el); }); saveDefaultFilter(); render(); updateFilterCount(); return; }

        var set = el.dataset.k === "province" ? filters.provinces : el.dataset.k === "city" ? filters.cities : filters.types;

        var v = el.dataset.v;

        if (set.has(v)) set.delete(v); else set.add(v);

        el.classList.toggle("on"); saveDefaultFilter(); render(); updateFilterCount();

      };

    });

    openSheet("sheetGen");
    updateFilterCount();

  }

  window.appClearFilter = function () {

    clearFilterCircle();
    filters.provinces.clear(); filters.cities.clear(); filters.types.clear();

    $("genBody").querySelectorAll(".chip").forEach(function (c) { c.classList.remove("on"); });

    saveDefaultFilter(); // v3.38：清空筛选写回默认值（全部）

    render(); toast("已清空筛选");

  };


  /* ---------- v3.48 智能查询后续操作 ---------- */
  window.furtherQuery = function (q) {
    filters.text = (q || "").trim();
    var sb = $("search"); if (sb) sb.value = filters.text;
    var ft = $("filterText"); if (ft) ft.value = filters.text;
    saveDefaultFilter();
    if (typeof window.doQueryConfirm === "function") window.doQueryConfirm();
    else if (typeof window.applyFilterAndJump === "function") window.applyFilterAndJump();
  };
  function copyText(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); return true; } } catch (e) {}
    try { var ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select(); var ok = document.execCommand("copy"); document.body.removeChild(ta); return ok; } catch (e) { return false; }
  }
  function renderQueryFurther(matched, kw) {
    var box = $("queryFurther");
    if (!box) {
      var holder = $("search");
      if (!holder || !holder.parentNode) return;
      box = document.createElement("div"); box.id = "queryFurther"; box.className = "qf-box";
      holder.parentNode.insertBefore(box, holder.nextSibling);
    }
    box.innerHTML = "";
    if (!matched || !matched.length) return;
    var dims = {};
    function bump(dim, val) { if (!val) return; val = String(val); if (kw && val.indexOf(kw) >= 0) return; var k = dim + "\u0001" + val; if (!dims[k]) dims[k] = { dim: dim, val: val, n: 0 }; dims[k].n++; }
    matched.forEach(function (b) {
      bump("管理单位", b.office); bump("管理站", b.station); bump("类型", b.btype);
      bump("省份", b.province); bump("城市", b.city); bump("类别", b.type); bump("年代", b.dynasty); bump("级别", b.level);
      (b.attrs || []).forEach(function (a) { if (a && a[0]) bump(a[0], a[1]); });
    });
    var arr = Object.keys(dims).map(function (k) { return dims[k]; }).filter(function (d) { return d.n >= 2; });
    arr.sort(function (a, b) { return b.n - a.n; });
    if (arr.length > 8) arr = arr.slice(0, 8);
    if (!arr.length) return;
    var hint = document.createElement("div"); hint.className = "qf-hint";
    hint.innerHTML = "💡 进一步查询（智能推荐）：<b>单击</b>复制组合关键词，<b>双击</b>直接进一步查询。";
    box.appendChild(hint);
    var wrap = document.createElement("div"); wrap.className = "qf-chips";
    arr.forEach(function (d) {
      var q = (kw ? kw + " " : "") + d.val;
      var c = document.createElement("span"); c.className = "qf-chip";
      c.innerHTML = '<span class="qf-dim">' + esc(d.dim) + "</span>" + esc(d.val) + '<span class="n">' + d.n + "</span>";
      c.title = "单击复制查询「" + q + "」；双击直接进一步查询";
      c.addEventListener("click", function () { copyText(q); toast("已复制查询关键词：「" + q + "」（粘贴到查询框按确定即可查询）"); });
      c.addEventListener("dblclick", function (e) { e.preventDefault(); window.furtherQuery(q); });
      wrap.appendChild(c);
    });
    box.appendChild(wrap);
  }
  /* v3.48 智能查询后续操作：样式运行时注入（幂等） */
  (function () {
    if (document.getElementById("qf-style")) return;
    var s = document.createElement("style"); s.id = "qf-style";
    s.textContent = '.qf-box{margin-top:8px}.qf-hint{font-size:12px;color:#888;margin:4px 0 6px;line-height:1.5}.qf-chips{display:flex;flex-wrap:wrap;gap:6px}.qf-chip{cursor:pointer;user-select:none;padding:5px 10px;border:1px solid var(--border,rgba(0,0,0,.15));border-radius:14px;background:rgba(33,150,243,.08);font-size:13px;transition:background .15s}.qf-chip:hover{background:rgba(33,150,243,.18)}.qf-chip .n{color:#1976d2;font-weight:600;margin-left:4px}.qf-dim{opacity:.7;margin-right:2px}';
    (document.head || document.documentElement).appendChild(s);
  })();
  // v3.51：清除筛选圈选层
  function clearFilterCircle() {
    if (filterCircle) { try { map.removeLayer(filterCircle); } catch (e) {} filterCircle = null; }
  }
  // v3.51：用绿色虚线圈住全部命中古建，并刚好完整显示整圈；点圆圈可清除
  function drawFilterCircle(matched) {
    clearFilterCircle();
    var pts = matched.filter(function (b) { return b.lat != null && b.lon != null; });
    if (!pts.length) return;
    var clat = 0, clon = 0;
    pts.forEach(function (b) { clat += b.lat; clon += b.lon; });
    clat /= pts.length; clon /= pts.length;
    var R = 6371000, maxD = 0;
    pts.forEach(function (b) {
      var dLat = (b.lat - clat) * Math.PI / 180, dLon = (b.lon - clon) * Math.PI / 180;
      var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(clat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      var d = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (d > maxD) maxD = d;
    });
    var radius = Math.max(maxD * 1.08 + 200, 300); // 留 8% 余量，至少 300m
    filterCircle = L.circle([clat, clon], {
      radius: radius, color: "#2e9e3f", weight: 2.5, dashArray: "7,7",
      fillColor: "#2e9e3f", fillOpacity: 0.08
    }).addTo(map);
    filterCircle.on("click", clearFilterCircle);
    listMode = false; $("listView").style.display = "none"; $("map").style.display = "block";
    setTimeout(function () {
      map.invalidateSize();
      try { map.fitBounds(filterCircle.getBounds(), { padding: [50, 50] }); }
      catch (e) { map.setView([clat, clon], 6); }
    }, 160);
  }
  window.applyFilterAndJump = function () {

    saveDefaultFilter(); // v3.38：确认即写回默认值

    var matched = HERITAGE.filter(passFilter);

    if (!matched.length) { clearFilterCircle(); toast("没有符合条件的古建"); closeSheet("sheetGen"); return; }

    closeSheet("sheetGen");

    if (matched.length === 1) {
      clearFilterCircle();
      appFly(matched[0].id);
      toast("已定位唯一匹配：" + matched[0].name);
    } else {
      drawFilterCircle(matched);
      toast("找到 " + matched.length + " 个匹配，已用绿圈标出全部位置（点绿圈可清除）");
    }

    renderQueryFurther(matched, filters.text);  // v3.48：命中多结果时给出进一步查询建议
  };



  /* ---------- 添加模式 ---------- */

  function toggleAdd() {

    if (measureMode) toggleMeasure();

    if (coordPickMode) { coordPickMode = false; map._container.style.cursor = ""; }

    addMode = !addMode;

    $("hintAdd").classList.toggle("show", addMode);

    $("btnMenu").textContent = addMode ? "☰ 取消添加" : "☰ 菜单";

    if (addMode) toast("点击地图放置新古建");

  }



  /* ---------- 增删改表单（古建）---------- */

  function openEdit(b) {

    editing = b;

    var provinces = uniq(HERITAGE.map(function (x) { return x.province; }));

    var types = uniq(HERITAGE.map(function (x) { return x.type; }));

    function opt(arr, cur) { return arr.map(function (v) { return '<option' + (v === cur ? " selected" : "") + ">" + esc(v) + "</option>"; }).join(""); }

    var photosHtml = (b.photos || []).map(function (p, i) {

      var src = photoSrc(p);

      return '<div class="photo-card"><button class="rm" data-pi="' + i + '">×</button><img src="' + esc(src) + '"><input value="' + esc(p.caption || "") + '" placeholder="如正面" data-cap="' + i + '"></div>';

    }).join("");

    $("editTitle").textContent = b._new ? "新增古建" : "修改：" + b.name;

    $("editBody").innerHTML =

      '<label class="f">名称</label><input class="f" id="fName" value="' + esc(b.name) + '">' +

      '<label class="f">省 / 直辖市 / 自治区</label><input class="f" id="fProv" list="dlProv" value="' + esc(b.province) + '"><datalist id="dlProv">' + opt(provinces, b.province) + "</datalist>" +

      '<label class="f">城市</label><input class="f" id="fCity" value="' + esc(b.city) + '">' +

      '<label class="f">文物类别</label><input class="f" id="fType" list="dlType" value="' + esc(b.type) + '"><datalist id="dlType">' + opt(types, b.type) + "</datalist>" +

      '<label class="f">年代</label><input class="f" id="fDyn" value="' + esc(b.dynasty) + '">' +

      '<label class="f">保护级别</label><input class="f" id="fLevel" value="' + esc(b.level) + '">' +

      '<label class="f">经度</label><input class="f" id="fLon" value="' + (b.lon != null ? b.lon : "") + '">' +

      '<label class="f">纬度</label><input class="f" id="fLat" value="' + (b.lat != null ? b.lat : "") + '">' +

      '<label class="f">介绍</label><textarea class="f" id="fIntro" rows="3">' + esc(b.intro) + '</textarea>' +

      '<label class="f">文物特点</label><textarea class="f" id="fFeat" rows="2">' + esc(b.features) + '</textarea>' +

      '<label class="f">照片（可多张）</label><input type="file" id="fPhotos" accept="image/*" multiple>' +

      '<div class="photo-grid" id="phGrid">' + photosHtml + "</div>" +

      '<div class="form-actions">' +

      (b._new ? "" : '<button class="btn-danger" onclick="appDel(\'' + esc(b.id) + '\')">删除</button>') +

      '<button class="btn-cancel" onclick="closeSheet(\'sheetEdit\')">取消</button>' +

      '<button class="btn-save" onclick="appSave()">保存</button></div>';

    $("editBody").querySelectorAll(".photo-card .rm").forEach(function (btn) { btn.onclick = function () { b.photos.splice(+btn.dataset.pi, 1); openEdit(b); }; });

    $("editBody").querySelectorAll("input[data-cap]").forEach(function (inp) { inp.onchange = function () { b.photos[+inp.dataset.cap].caption = inp.value; }; });

    // 照片网格局部刷新（v1.8.3 关键修复）：只更新 phGrid，不重建 input.f 元素，

    // 否则 WebView 自动填充对勾等已识别状态会随 DOM 重建丢失。

    function renderPhotoGrid() {

      var grid = $("phGrid"); if (!grid) { openEdit(b); return; } // 兜底

      grid.innerHTML = buildPhotosHtml(b);

      bindPhotoCardEvents();

    }

    function buildPhotosHtml(b2) {

      var arr = b2.photos || [];

      var out = "";

      for (var i = 0; i < arr.length; i++) {

        var p = arr[i], src = photoSrc(p);

        out += '<div class="photo-card"><button class="rm" data-pi="' + i + '">×</button><img src="' + esc(src) + '"><input value="' + esc(p.caption || "") + '" placeholder="如正面" data-cap="' + i + '"></div>';

      }

      return out;

    }

    function bindPhotoCardEvents() {

      $("editBody").querySelectorAll(".photo-card .rm").forEach(function (btn) { btn.onclick = function () { b.photos.splice(+btn.dataset.pi, 1); renderPhotoGrid(); }; });

      $("editBody").querySelectorAll("input[data-cap]").forEach(function (inp) { inp.onchange = function () { b.photos[+inp.dataset.cap].caption = inp.value; }; });

    }

    bindPhotoCardEvents();

    // v3.31 #281：表单文本实时落盘到 editing，避免重建表单时丢失已填内容

    ["fName", "fOffice", "fStation", "fChan", "fType", "fLon", "fLat"].forEach(function (id) {

      var el = $(id); if (!el) return;

      el.oninput = flushEditFields; el.onchange = flushEditFields;

    });

    $("fPhotos").onchange = function () {

      var files = this.files;

      Array.prototype.forEach.call(files, function (file) {

        var r = new FileReader();

        r.onload = function () {

          // v3.31：>1.5M 的照片先压缩（canvas，按会话偏好）再落盘，只存压缩版

          compressDataUrlIfBig(r.result, function (d) {

            var rel = "";

            try { if (window.Android && typeof window.Android.storePhoto === "function") rel = window.Android.storePhoto(b.id, file.name, d); } catch (e) {}

            if (rel) b.photos.push({ file: rel, caption: "" }); else b.photos.push({ data: d, caption: "" });

            renderPhotoGrid();

          });

        };

        r.readAsDataURL(file);

      });

    };

    openSheet("sheetEdit");

  }

  window.appSave = function () {

    var b = editing;

    b.name = $("fName").value.trim() || "未命名";

    b.province = $("fProv").value.trim();

    b.city = $("fCity").value.trim();

    b.type = $("fType").value.trim() || "其他";

    b.dynasty = $("fDyn").value.trim();

    b.level = $("fLevel").value.trim();

    b.intro = $("fIntro").value.trim();

    b.features = $("fFeat").value.trim();

    var lon = parseFloat($("fLon").value), lat = parseFloat($("fLat").value);

    if (!isNaN(lon) && !isNaN(lat)) { b.lon = lon; b.lat = lat; b.geom = "Point"; }

    if (b._new) { delete b._new; HERITAGE.push(b); }

    save(); render(); closeSheet("sheetEdit"); toast("已保存");

  };

  window.appEdit = function (id) { var b = HERITAGE.find(function (x) { return x.id === id; }); if (b) openEdit(b); };

  window.appDel = function (id) {

    ask("删除古建", "确定删除该古建？",

      [{ t: "取消", cls: "btn-cancel", v: 0 }, { t: "删除", cls: "btn-confirm2", v: 1 }], function (v) {

        if (!v) return;

        HERITAGE = HERITAGE.filter(function (x) { return x.id !== id; });

        save(); render(); closeSheet("sheetEdit"); toast("已删除");

      });

  };



  /* ---------- 拍照打卡 ---------- */

  window.appCheckin = function (id) { openCheckin(id); };

  function openCheckin(id) {

    var b = id ? HERITAGE.find(function (x) { return x.id === id; }) : null;

    editingCheckin = { targetId: id, photo: "", arrivalTime: nowLocalDateTime(), travelTime: "", experience: "" };

    var title = b ? ("打卡：" + b.name) : "拍照打卡";

    $("ciTitle").textContent = title;

    var selHtml = "";

    if (!b) {

      var opts = HERITAGE.filter(function (x) { return x.lat != null; }).map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + "（" + esc(x.city) + "）</option>"; }).join("");

      selHtml = '<label class="f">选择古建</label><select class="f" id="ciTarget">' + opts + "</select>";

    }

    $("ciBody").innerHTML =

      selHtml +

      '<label class="f">打卡照片</label><input type="file" id="ciPhoto" accept="image/*">' +

      '<div id="ciPhotoPrev" style="margin-top:6px"></div>' +

      '<label class="f">到达时间</label><input class="f" type="datetime-local" id="ciArrival" value="' + editingCheckin.arrivalTime + '">' +

      '<label class="f">旅游时间（如 2 小时 / 半天）</label><input class="f" id="ciTravel" placeholder="本次游览时长">' +

      '<label class="f">旅游体验</label><textarea class="f" id="ciExp" rows="4" placeholder="记录你的游览感受、看点、避坑…"></textarea>' +

      '<div class="form-actions"><button class="btn-cancel" onclick="closeSheet(\'sheetCheckin\')">取消</button>' +

      '<button class="btn-save" onclick="appSaveCheckin()">保存打卡</button></div>';

    $("ciPhoto").onchange = function () {

      var file = this.files && this.files[0]; if (!file) return;

      var r = new FileReader();

      r.onload = function () {

        // v3.31：>1.5M 的打卡照片先压缩再落盘

        compressDataUrlIfBig(r.result, function (d) {

          editingCheckin.photo = "";

          try { if (window.Android && typeof window.Android.storePhoto === "function") editingCheckin.photo = window.Android.storePhoto((id || "checkin_" + Date.now()), file.name, d); } catch (e) {}

          if (!editingCheckin.photo) editingCheckin.photo = d;

          $("ciPhotoPrev").innerHTML = '<img src="' + (editingCheckin.photo.indexOf("data:") === 0 ? editingCheckin.photo : (window.Android && window.Android.readPhoto ? window.Android.readPhoto(editingCheckin.photo) : "")) + '" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">';

        });

      };

      r.readAsDataURL(file);

    };

    openSheet("sheetCheckin");

  }

  window.appSaveCheckin = function () {

    var b = editingCheckin.targetId ? HERITAGE.find(function (x) { return x.id === editingCheckin.targetId; }) : HERITAGE.find(function (x) { return x.id === $("ciTarget").value; });

    if (!b) { toast("请选择要打卡的古建"); return; }

    b.checkins = b.checkins || [];

    b.checkins.push({

      id: "c" + Date.now(),

      photo: editingCheckin.photo,

      arrivalTime: $("ciArrival").value || nowLocalDateTime(),

      travelTime: $("ciTravel").value.trim(),

      experience: $("ciExp").value.trim(),

      createdAt: Date.now()

    });

    save(); render();

    if (MARKERS[b.id]) MARKERS[b.id].setPopupContent(popupHtml(b));

    closeSheet("sheetCheckin"); toast("打卡成功：" + b.name);

  }



  /* ---------- 我的打卡路线（按时间排列）---------- */

  function openRoutes() {

    var all = [];

    HERITAGE.forEach(function (b) {

      (b.checkins || []).forEach(function (c) { all.push({ b: b, c: c }); });

    });

    all.sort(function (a, b) {

      var ta = a.c.arrivalTime || "", tb = b.c.arrivalTime || "";

      if (ta !== tb) return tb < ta ? -1 : 1;

      return (b.c.createdAt || 0) - (a.c.createdAt || 0);

    });

    var html = '<p style="font-size:13px;color:#555;margin-bottom:8px">共 ' + all.length + " 次打卡，按到达时间从新到旧排列：</p>";

    if (!all.length) html += '<div class="empty-tip">还没有打卡记录，去「拍照打卡 → 打卡」添加吧。</div>';

    all.forEach(function (it, idx) {

      var photoSrc0 = it.c.photo ? (it.c.photo.indexOf("data:") === 0 ? it.c.photo : (window.Android && window.Android.readPhoto ? window.Android.readPhoto(it.c.photo) : "")) : "";

      html += '<div class="route-item">' +

        '<span class="go" onclick="appFly(\'' + esc(it.b.id) + '\')">定位 ›</span>' +

        '<div class="rt">' + (idx + 1) + ". " + esc(it.b.name) + ' <span style="font-size:12px;color:#8a7c70">（' + esc(it.b.city) + "）</span></div>" +

        '<div class="rm">到达：' + esc(it.c.arrivalTime || "—") + (it.c.travelTime ? "　游览：" + esc(it.c.travelTime) : "") + "</div>" +

        (it.c.experience ? '<div class="rm" style="color:#3a2e28">' + esc(it.c.experience) + "</div>" : "") +

        (photoSrc0 ? '<img src="' + esc(photoSrc0) + '" style="width:72px;height:72px;object-fit:cover;border-radius:6px;margin-top:6px;border:1px solid var(--border)">' : "") +

        '</div>';

    });

    $("genTitle").textContent = "我的打卡路线";

    $("genBody").innerHTML = html;

    openSheet("sheetGen");

  }



  // v3.31 #281：把表单文本实时写回 editing，避免任何重建 editBody 的操作丢失已填内容

  function flushEditFields() {

    if (!editing) return;

    var g = function (id) { var el = $(id); return el ? el.value : undefined; };

    if (g("fName") != null) editing.name = g("fName");

    if (g("fOffice") != null) editing.office = g("fOffice");

    if (g("fStation") != null) editing.station = g("fStation");

    if (g("fChan") != null) editing.chan = g("fChan");

    if (g("fType") != null) editing.btype = g("fType");

    var lon = parseFloat(g("fLon")), lat = parseFloat(g("fLat"));

    if (!isNaN(lon) && !isNaN(lat)) { editing.lon = lon; editing.lat = lat; editing.geom = "Point"; }

  }

  /* ---------- 导航 ---------- */

  window.appNav = function (id) {

    var b = HERITAGE.find(function (x) { return x.id === id; });

    if (!b) return;

    if (b.lat == null || b.lon == null) { toast("该古建无坐标信息"); return; }

    var lat = b.lat, lon = b.lon, name = b.name;

    var geoUrl = "geo:" + lat + "," + lon + "?q=" + lat + "," + lon + "(" + name + ")";

    if (window.Android && typeof window.Android.openExternal === "function") window.Android.openExternal(geoUrl);

    else window.open(geoUrl, "_blank");

    toast("正在打开导航…");

  };

  window.appClosePopup = function () { map.closePopup(); };

  window.copyCoord = function (lat, lon) {

    var text = lat.toFixed(6) + "," + lon.toFixed(6);

    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast("已复制：" + text); });

    else { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("已复制：" + text); } catch (e) {} ta.remove(); }

  };



  /* ---------- 列表视图 ---------- */

  function toggleList() {

    listMode = !listMode;

    $("listView").style.display = listMode ? "block" : "none";

    $("map").style.display = listMode ? "none" : "block";

    var bs = $("baseSwitcher"); if (bs) bs.style.display = listMode ? "none" : "block";

    var lg = $("legend"); if (lg) lg.style.display = listMode ? "none" : "block";

    var hm = $("hintMeasure"); if (hm) hm.style.display = listMode ? "none" : "";

    if (listMode) renderList(); else setTimeout(function () { map.invalidateSize(); }, 100);

  }

  function renderList() {

    var html = "";

    HERITAGE.filter(passFilter).forEach(function (b) {

      html += '<div class="list-card" data-id="' + esc(b.id) + '"><span class="go" onclick="appFly(\'' + esc(b.id) + '\')">快速定位 ›</span>' +

        "<h3>" + esc(b.name) + "</h3>" +

        '<div class="meta">' + esc(b.province) + " · " + esc(b.city) + " · " + esc(b.type) + ((b.checkins || []).length ? " · 已打卡" + b.checkins.length : "") + "</div></div>";

    });

    $("listView").innerHTML = html || "<p style='padding:20px;color:#888'>无匹配结果</p>";

  }

  window.appFly = function (id) {

    var b = HERITAGE.find(function (x) { return x.id === id; });

    if (!b) return;

    if (b.lat == null || b.lon == null) { toast("该古建无坐标信息"); return; }

    listMode = false; $("listView").style.display = "none"; $("map").style.display = "block";

    setTimeout(function () {

      map.invalidateSize(); map.setView([b.lat, b.lon], 15);

      if (MARKERS[b.id]) MARKERS[b.id].openPopup();

    }, 150);

  };



  /* ---------- 定位 ---------- */

  var myLocationMarker = null;

  function locateMe() {

    if (!navigator.geolocation) { toast("设备不支持定位"); return; }

    toast("正在定位…");

    navigator.geolocation.getCurrentPosition(function (p) {

      var lat = p.coords.latitude, lon = p.coords.longitude;

      map.setView([lat, lon], 15);

      if (myLocationMarker) map.removeLayer(myLocationMarker);

      myLocationMarker = L.circleMarker([lat, lon], { radius: 10, color: "#d98723", fillColor: "#d98723", fillOpacity: 0.9, weight: 3 }).addTo(map).bindPopup("我的位置（" + lat.toFixed(6) + ", " + lon.toFixed(6) + "）").openPopup();

      toast("定位成功");

    }, function (err) {

      if (err.code === err.PERMISSION_DENIED) { toast("定位权限未授权，正在跳转设置…"); if (window.Android && typeof window.Android.openLocationSettings === "function") setTimeout(function () { window.Android.openLocationSettings(); }, 1200); }

      else if (err.code === err.TIMEOUT) toast("定位超时，请重试");

      else toast("定位失败：" + (err.message || "未知错误"));

    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });

  }



  /* ---------- 测距 ---------- */

  var measureMode = false, measurePoints = [], measureLayer = null, measureMarkers = [], measureTooltips = [];

  function toggleMeasure() {

    measureMode = !measureMode;

    if (measureMode) {

      measurePoints = []; addMode = false; coordPickMode = false;

      $("hintAdd").classList.remove("show"); $("btnMenu").textContent = "☰ 结束测距";

      toast("测距模式：依次点击地图上的点，双击或点「结束测距」结束");

      $("hintMeasure").classList.add("show"); map._container.style.cursor = "crosshair"; map.doubleClickZoom.disable();

    } else { clearMeasure(); $("btnMenu").textContent = "☰ 菜单"; $("hintMeasure").classList.remove("show"); map._container.style.cursor = ""; map.doubleClickZoom.enable(); }

  }

  function clearMeasure() {

    if (measureLayer) { map.removeLayer(measureLayer); measureLayer = null; }

    measureMarkers.forEach(function (m) { map.removeLayer(m); }); measureMarkers = [];

    measureTooltips.forEach(function (t) { map.removeLayer(t); }); measureTooltips = [];

    measurePoints = [];

  }

  function onMeasureClick(e) {

    if (!measureMode) return;

    measurePoints.push(e.latlng);

    var dot = L.circleMarker(e.latlng, { radius: 5, color: "#d98723", fillColor: "#fff", fillOpacity: 1, weight: 2 }).addTo(map); measureMarkers.push(dot);

    if (measureLayer) map.removeLayer(measureLayer);

    measureTooltips.forEach(function (t) { map.removeLayer(t); }); measureTooltips = [];

    if (measurePoints.length >= 2) {

      measureLayer = L.polyline(measurePoints, { color: "#d98723", weight: 3, dashArray: "6,4" }).addTo(map);

      var total = 0;

      for (var i = 1; i < measurePoints.length; i++) {

        var d = measurePoints[i - 1].distanceTo(measurePoints[i]); total += d;

        var mid = L.latLng((measurePoints[i - 1].lat + measurePoints[i].lat) / 2, (measurePoints[i - 1].lng + measurePoints[i].lng) / 2);

        var segLabel = L.marker(mid, { icon: L.divIcon({ className: "measure-tip", html: '<span style="background:#6b2e2e;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;white-space:nowrap">' + fmtDist(d) + '</span>', iconSize: [60, 16], iconAnchor: [30, 8] }) }).addTo(map);

        measureTooltips.push(segLabel);

      }

      var lastPt = measurePoints[measurePoints.length - 1];

      var totalLabel = L.marker(lastPt, { icon: L.divIcon({ className: "measure-tip", html: '<span style="background:#d98723;color:#fff;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:600;white-space:nowrap">总计 ' + fmtDist(total) + '</span>', iconSize: [100, 20], iconAnchor: [50, -12] }) }).addTo(map);

      measureTooltips.push(totalLabel);

    }

  }

  function fmtDist(d) { if (d < 1000) return Math.round(d) + " m"; return (d / 1000).toFixed(2) + " km"; }

  window.appFinishMeasure = function () { if (measureMode) toggleMeasure(); };



  /* ---------- 周边搜索 ---------- */

  function nearbySearch() {

    var pts = HERITAGE.filter(function (b) { return b.lat != null; });

    var html = '<label class="f">选择中心古建</label>' +

      '<select class="f" id="nearbyCenter" style="margin-bottom:10px">' + pts.map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.name) + "</option>"; }).join("") + "</select>" +

      '<label class="f">搜索半径（米）</label><input class="f" type="number" id="nearbyRadius" value="200000" min="50" max="5000000" style="margin-bottom:10px">' +

      '<div class="form-actions"><button class="btn-save" onclick="appDoNearby()">搜索</button></div>' +

      '<div id="nearbyResult" style="margin-top:12px"></div>';

    $("genTitle").textContent = "周边搜索";

    $("genBody").innerHTML = html; openSheet("sheetGen");

  }

  window.appDoNearby = function () {

    var centerId = $("nearbyCenter").value, radius = parseFloat($("nearbyRadius").value);

    if (!centerId || isNaN(radius) || radius < 50) { toast("请选择古建并输入有效半径"); return; }

    var center = HERITAGE.find(function (b) { return b.id === centerId; });

    if (!center || center.lat == null) { toast("中心古建无坐标"); return; }

    var centerLatLng = L.latLng(center.lat, center.lon), results = [];

    HERITAGE.forEach(function (b) { if (b.id === centerId || b.lat == null) return; var d = centerLatLng.distanceTo(L.latLng(b.lat, b.lon)); if (d <= radius) results.push({ b: b, dist: d }); });

    results.sort(function (a, b) { return a.dist - b.dist; });

    if (window._nearbyCircle) map.removeLayer(window._nearbyCircle);

    window._nearbyCircle = L.circle([center.lat, center.lon], { radius: radius, color: "#b8862f", fillColor: "#b8862f", fillOpacity: 0.08, weight: 2, dashArray: "4,4" }).addTo(map);

    map.fitBounds(window._nearbyCircle.getBounds(), { padding: [30, 30] });

    var html = "<p style='margin:0 0 6px'><b>中心：</b>" + esc(center.name) + " · 半径 " + fmtDist(radius) + "</p>";

    if (!results.length) html += '<p style="color:#888">范围内无其他古建</p>';

    else {

      html += '<p style="color:#b8862f;margin:0 0 6px">找到 ' + results.length + " 个古建：</p>";

      results.forEach(function (r) {

        html += '<div class="list-card" style="margin-bottom:4px;padding:6px 10px"><span class="go" onclick="appFly(\'' + esc(r.b.id) + '\')">定位 ›</span>' +

          '<span style="font-size:14px">' + esc(r.b.name) + '</span><span style="font-size:11px;color:#888;float:right">' + fmtDist(r.dist) + "</span>" +

          '<div class="meta">' + esc(r.b.city) + " · " + esc(r.b.type) + "</div></div>";

      });

    }

    $("nearbyResult").innerHTML = html; toast("找到 " + results.length + " 个古建");

  };



  /* ---------- 获取坐标 ---------- */

  function getCoordinates() {

    var html = '<div style="margin-bottom:12px">' +

      '<button class="tbtn" style="width:100%;margin-bottom:8px;display:block" onclick="coordGetGPS()">📡 获取当前GPS坐标</button>' +

      '<button class="tbtn" style="width:100%;margin-bottom:8px;display:block" onclick="coordPickMap()">👆 点选地图获取坐标</button>' +

      '<button class="tbtn" style="width:100%;margin-bottom:8px;display:block" onclick="coordSearchHeritage()">🔍 搜索古建坐标</button>' +

      '</div><div id="coordResult" style="background:#f7f1e8;border-radius:8px;padding:12px;min-height:60px;font-size:14px;color:#555">请选择获取坐标的方式</div>';

    $("genTitle").textContent = "获取坐标"; $("genBody").innerHTML = html; openSheet("sheetGen");

  }

  window.coordGetGPS = function () {

    if (!navigator.geolocation) { $("coordResult").innerHTML = "<span style='color:#c0392b'>设备不支持定位</span>"; return; }

    $("coordResult").innerHTML = "<span style='color:#888'>正在定位…</span>";

    navigator.geolocation.getCurrentPosition(function (p) {

      var lat = p.coords.latitude, lon = p.coords.longitude, acc = p.coords.accuracy ? p.coords.accuracy.toFixed(0) : "?";

      $("coordResult").innerHTML = '<div style="font-size:16px;color:#6b2e2e;font-weight:600;margin-bottom:8px">当前坐标</div>' +

        '<table style="width:100%;font-size:14px;border-collapse:collapse"><tr><td style="color:#888;padding:3px 0">纬度：</td><td>' + lat.toFixed(6) + '</td></tr>' +

        '<tr><td style="color:#888;padding:3px 0">经度：</td><td>' + lon.toFixed(6) + '</td></tr><tr><td style="color:#888;padding:3px 0">精度：</td><td>±' + acc + ' m</td></tr></table>' +

        '<button class="tbtn" style="margin-top:10px;width:100%" onclick="copyCoord(' + lat + ',' + lon + ')">复制坐标</button>' +

        '<button class="tbtn" style="margin-top:6px;width:100%" onclick="map.setView([' + lat + ',' + lon + '],15);closeSheet(\'sheetGen\')">在地图上查看</button>';

      if (myLocationMarker) map.removeLayer(myLocationMarker);

      myLocationMarker = L.circleMarker([lat, lon], { radius: 10, color: "#d98723", fillColor: "#d98723", fillOpacity: 0.9, weight: 3 }).addTo(map).bindPopup("当前坐标").openPopup();

      map.setView([lat, lon], 15);

    }, function (err) {

      if (err.code === err.PERMISSION_DENIED) $("coordResult").innerHTML = "<span style='color:#c0392b'>定位权限未授权</span><button class='tbtn' style='margin-top:8px;width:100%' onclick='gotoLocSettings()'>去设置开启定位</button>";

      else $("coordResult").innerHTML = "<span style='color:#c0392b'>定位失败：" + (err.message || "未知错误") + "</span>";

    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });

  };

  window.gotoLocSettings = function () { if (window.Android && typeof window.Android.openLocationSettings === "function") window.Android.openLocationSettings(); else toast("请在系统设置中开启定位"); };

  window.coordPickMap = function () { coordPickMode = true; closeSheet("sheetGen"); if (listMode) toggleList(); $("btnMenu").textContent = "☰ 取消拾取"; map._container.style.cursor = "crosshair"; toast("点击地图任意位置获取坐标"); };

  window.coordSearchHeritage = function () {

    var pts = HERITAGE.filter(function (b) { return b.lat != null; });

    $("coordResult").innerHTML = '<input class="f" id="coordSearchInput" placeholder="输入古建名称…" style="margin-bottom:8px" oninput="coordDoSearch()"><div id="coordSearchResult" style="max-height:300px;overflow:auto"></div>';

    window.coordDoSearch = function () {

      var q = (($("coordSearchInput") || {}).value || "").trim().toLowerCase();

      var matched = pts.filter(function (b) { return !q || b.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 30);

      $("coordSearchResult").innerHTML = matched.map(function (b) {

        return '<div class="list-card" style="margin-bottom:4px;padding:6px 10px;cursor:pointer" onclick="copyCoord(' + b.lat + ',' + b.lon + ')"><span style="font-size:14px">' + esc(b.name) + '</span><span style="font-size:11px;color:#888;float:right">' + b.lat.toFixed(6) + ',' + b.lon.toFixed(6) + '</span><div class="meta">' + esc(b.city) + ' · ' + esc(b.type) + "</div></div>";

      }).join("") || "<p style='color:#888;padding:8px'>无匹配</p>";

    };

    coordDoSearch();

  };



  /* ---------- 批量导入照片（智能模糊匹配）---------- */

  function nameNoExt(n) { return String(n).replace(/\.[^.]+$/, "").trim(); }

  function batchImportPhotos() {

    var html = '<div style="font-size:14px;color:#555;margin-bottom:12px"><p>选择照片或照片 ZIP，系统按文件名自动匹配古建（相等/包含/容错错字漏字）。唯一匹配自动保存；多匹配弹窗勾选（可多选）。</p></div>' +

      '<button class="tbtn" style="width:100%" onclick="pickPhotosForImport()">📂 选择照片 / 照片ZIP</button><div id="batchPhotoResult" style="margin-top:12px"></div>';

    $("genTitle").textContent = "批量导入照片"; $("genBody").innerHTML = html; openSheet("sheetGen");

  }

  window.pickPhotosForImport = function () {

    if (!(window.Android && typeof window.Android.pickFiles === "function")) { legacyPickPhotos(); return; }

    $("batchPhotoResult").innerHTML = "<span style='color:#888'>请在系统选择器中选取照片或 ZIP…</span>";

    window.Android.pickFiles("image/*");

  };

  window.onPickFiles = function (json) {

    try {

    var list; try { list = JSON.parse(json); } catch (e) { list = []; }

    if (!list || !list.length) { toast("未选择文件"); window.__kmzImport = false; window.__bldImport = false; window.__ovobjFolderImport = false; window.__objFolderImport = false; return; }

    // KMZ 导入模式：交给原生解压（见 importOvkmz 设置的 __pickMode）

    if (window.__pickMode === "kmz") {

      window.__pickMode = "";

      var kmz = list.filter(function (f) { return /\.(kmz|ovkmz|kml)$/i.test(f.name); })[0];

      if (!kmz) { toast("请选择 .kmz/.ovkmz/.kml 文件"); return; }

      busy("正在解压导入文件…"); busyDetail("正在解压 KML 与照片，请稍后…");

      setTimeout(function () { window.Android.importKmz(kmz.path, XFER.resume); }, 30);

      return;

    }

    // ovobj 导入路由（经 readFileBase64 读二进制 -> JS 解析）

    if (window.__ovobjImport) {

      window.__ovobjImport = false;

      var ovobjF = list.find(function (f) { return /\.ovobj$/i.test(f.name); });

      if (ovobjF) {

        busy("正在导入 " + ovobjF.name + "，请稍后…"); busyDetail("解析奥维坐标中");

        setTimeout(function () {

          try {

            var b64 = window.Android.readFileBase64(ovobjF.path);

            var bytes = b64ToBytes(b64);

            var buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

            var pts = parseOvobj(buf);

            cacheOvobjTemplate(bytes);

            mergeCoordPoints(pts, ovobjF.name);

          } catch (e) { idle(); toast("导入失败：" + e.message); }

        }, 40);

        return;

      }

      toast("未选择 ovobj 文件"); return;

    }

    // obj/txt/csv 坐标文本导入路由

    if (window.__objImport) {

      window.__objImport = false;

      var objF = list.find(function (f) { return /\.(obj|txt|csv)$/i.test(f.name); });

      if (objF) {

        busy("正在导入 " + objF.name + "，请稍后…"); busyDetail("解析坐标文本中");

        setTimeout(function () {

          try {

            var b64b = window.Android.readFileBase64(objF.path);

            var bytes2 = b64ToBytes(b64b);

            var text = new TextDecoder("utf-8").decode(bytes2);

            mergeCoordPoints(parseObjText(text), objF.name);

          } catch (e) { idle(); toast("导入失败：" + e.message); }

        }, 40);

        return;

      }

      toast("未选择 obj / txt / csv 文件"); return;

    }

    // ovobj 文件夹批量导入路由（v3.31 #280：pickFolder 递归枚举后回传）

    if (window.__ovobjFolderImport) {

      window.__ovobjFolderImport = false;

      importOvobjFolder(list); return;

    }

    // obj 文件夹批量导入路由

    if (window.__objFolderImport) {

      window.__objFolderImport = false;

      importObjFolder(list); return;

    }

    var zips = list.filter(function (f) { return /\.zip$/i.test(f.name); });

    var imgs = list.filter(function (f) { return !/\.zip$/i.test(f.name); });

    var items = imgs.map(function (f) { return { fname: nameNoExt(f.name), base: normalizePhotoName(f.name), path: f.path, folder: "" }; });

    zips.forEach(function (z) {

      var arr; try { arr = JSON.parse(window.Android.unzipImages(z.path)); } catch (e) { arr = []; }

      arr.forEach(function (x) { items.push({ fname: nameNoExt(x.name), base: normalizePhotoName(x.name), path: x.path, folder: x.folder || "", zipName: z.name }); });

    });

    runPhotoMatch(items);

    } catch (e) {

      try { toast("文件回调出错：" + (e && (e.stack || e.message || e))); } catch (e2) {}

    }

  };

  function legacyPickPhotos() {

    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*,.zip"; inp.multiple = true;

    inp.onchange = function () {

      var files = Array.prototype.slice.call(this.files);

      if (!files.length) { toast("未选择文件"); return; }

      var items = [], todo = files.length, done = 0, ready = function () { if (++done === todo) runPhotoMatch(items); };

      files.forEach(function (f) {

        if (/\.zip$/i.test(f.name)) {

          JSZip.loadAsync(f).then(function (zip) {

            var names = Object.keys(zip.files).filter(function (n) { return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(n) && !zip.files[n].dir; });

            return Promise.all(names.map(function (n) {

              return zip.file(n).async("base64").then(function (b64) {

                items.push({ fname: nameNoExt(n.split("/").pop()), base: normalizePhotoName(n), data: "data:image/jpeg;base64," + b64, folder: (n.indexOf("/") >= 0 ? n.substring(0, n.indexOf("/")) : "") });

              });

            }));

          }).catch(function () {}).then(ready);

        } else {

          var r = new FileReader();

          r.onload = function () { items.push({ fname: nameNoExt(f.name), base: normalizePhotoName(f.name), data: r.result, folder: "" }); ready(); };

          r.readAsDataURL(f);

        }

      });

    };

    inp.click();

  }

  /* ============ 模糊 / 智能匹配 ============ */

  function longestCommonSubstringLen(a, b) { var m = a.length, n = b.length, best = 0, prev = new Array(n + 1).fill(0), cur; for (var i = 1; i <= m; i++) { cur = new Array(n + 1).fill(0); for (var j = 1; j <= n; j++) { if (a.charAt(i - 1) === b.charAt(j - 1)) { cur[j] = prev[j - 1] + 1; if (cur[j] > best) best = cur[j]; } } prev = cur; } return best; }

  function editDistance(a, b) { var m = a.length, n = b.length, dp = []; for (var i = 0; i <= m; i++) { dp[i] = new Array(n + 1); dp[i][0] = i; } for (var j = 0; j <= n; j++) dp[0][j] = j; for (var i = 1; i <= m; i++) for (var j = 1; j <= n; j++) { var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1; dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost); } return dp[m][n]; }

  function commonBigrams(a, b) { function g(s) { var o = {}; for (var i = 0; i < s.length - 1; i++) { var k = s.substr(i, 2); o[k] = (o[k] || 0) + 1; } return o; } var ga = g(a), gb = g(b), c = 0; for (var k in ga) if (gb[k]) c += Math.min(ga[k], gb[k]); return c; }

  function scoreMatch(a, b) {

    a = (a || "").trim(); b = (b || "").trim(); if (!a || !b) return 0;

    if (a === b) return 1000;

    if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return 900;

    var lcs = longestCommonSubstringLen(a, b);

    if (lcs >= 2) { var r = lcs / Math.max(a.length, b.length), ed = editDistance(a, b); if (r >= 0.5 || (ed <= 2 && Math.min(a.length, b.length) >= 3)) return 700 + lcs * 5 - ed * 30; if (r >= 0.34) return 400 + lcs * 5; }

    var g = commonBigrams(a, b); if (g >= 2) return 200 + g * 20; return 0;

  }

  function smartFuzzyMatches(base, cands) {

    var out = []; (cands || HERITAGE).forEach(function (b) { if (!b.name) return; var s = scoreMatch(base, b.name.trim()); if (s > 0) out.push({ b: b, s: s }); });

    out.sort(function (x, y) { return y.s - x.s; }); return out.slice(0, 12);

  }

  // 匹配置信度文案：分数越高越可信（700+ 已自动落库；200~699 让用户确认）

  function confLabel(s) {

    if (s >= 700) return "高匹配";

    if (s >= 350) return "较可能";

    if (s >= 200) return "待确认";

    return "低";

  }

  function matchScopeForFolder(folder) {

    folder = (folder || "").trim(); if (!folder) return { cands: HERITAGE, label: "" };

    var provs = uniq(HERITAGE.map(function (b) { return b.province || "未设置"; }));

    var best = null, bestS = 0; provs.forEach(function (o) { var s = scoreMatch(folder, o); if (s > bestS) { bestS = s; best = o; } });

    if (best && bestS >= 350) { var c = HERITAGE.filter(function (b) { return (b.province || "未设置") === best; }); if (c.length) return { cands: c, label: "省/市：" + best }; }

    var types = uniq(HERITAGE.map(function (b) { return b.type || "其他"; }));

    var bestT = null, bestTS = 0; types.forEach(function (t) { var s = scoreMatch(folder, t); if (s > bestTS) { bestTS = s; bestT = t; } });

    if (bestT && bestTS >= 350) { var c2 = HERITAGE.filter(function (b) { return (b.type || "其他") === bestT; }); if (c2.length) return { cands: c2, label: "类别：" + bestT }; }

    return { cands: HERITAGE, label: "" };

  }

  /* v3.46（古建版 zip 三级匹配）：匹配顺序 zipName → zip 内文件夹 → 照片文件名，

     按 5 级景区组织 spot/area/sub/point/tag 依次下钻（与水利 ju/guanchu/suo/zhan/duan 同形不同名）。

     例：颐和园.zip 内 佛香阁/IMG-001.jpg → zipName 命中"颐和园"(spot) → folder 从 area 起匹配 → fname 兜底。 */

  function matchScopeForItem(it) {

    try {

      var G_LV = G_ORG_LEVELS.map(function (x) { return x.k; });

      if (it && it.zipName) {

        var s = _v32_matchOrgInToken(String(it.zipName).replace(/\.zip$/i, ""), G_LV);

        if (s && s.level) {

          var keyOf = { spot: "spot", area: "area", sub: "sub", point: "point", tag: "tag" };

          var fk = keyOf[s.level];

          var cands = HERITAGE.filter(function (b) { return (b[fk] || "") === s.value; });

          if (cands.length) return { cands: cands, label: "压缩包：" + s.value + "（" + s.label + "）" };

        }

      }

      if (it && it.folder) {

        var fs = matchScopeForFolder(it.folder);

        if (fs.cands.length !== HERITAGE.length) return fs;

      }

    } catch (e) {}

    return matchScopeForFolder(it && it.folder);

  }

  // 落盘保存一张照片（原生 linkPhoto；浏览器回退 base64）。绑定即按「古建名 #顺序号」归档命名，便于核对来源（v3.14 同源）。

  function linkOrBase64(b, it) {

    function _push(rel, cap) { b.photos = b.photos || []; var seq = b.photos.length + 1; b.photos.push({ file: rel, caption: cap || (b.name || "古建") + " #" + seq, added: Date.now() }); return true; }

    var nm = (b.name || "古建") + " #" + ((b.photos ? b.photos.length : 0) + 1);

    if (window.Android && window.Android.linkPhoto) {

      try { var rel = window.Android.linkPhoto(b.id, it.path, nm + ".jpg"); if (rel) { queueCompress(rel); return _push(rel, nm); } } catch (e) {}

    }

    if (it.data) return _push(it.data, nm);

    return false;

  }

  function dupCheck(it, b) {

    if (!(window.Android && window.Android.fileSha256 && window.Android.photoSha256)) return false;

    try {

      var cSha = window.Android.fileSha256(it.path); var exPhoto = null;

      (b.photos || []).some(function (ep) { if (!ep.file) return false; var eSha = ""; try { eSha = window.Android.photoSha256(ep.file); } catch (e) {} if (eSha && eSha === cSha) { exPhoto = ep; return true; } return false; });

      if (exPhoto) return { b: b, ep: exPhoto };

    } catch (e) {}

    return false;

  }

  // 照片落盘后按内容(SHA-256)比对，重复则记入待确认

  // T-026：zip 导入最佳匹配持久化——按 "zipName|folder|fname" 记住上次选定 heritage，

  // 重导同一压缩包直接复用、免重复确认；随 save() 落地（localStorage 不可达时静默降级）。

  var __MATCH_MEM_KEY = "gujian_match_memory";

  function __loadMatchMem() { try { return JSON.parse(localStorage.getItem(__MATCH_MEM_KEY) || "{}"); } catch (e) { return {}; } }

  function __saveMatchMem(m) { try { localStorage.setItem(__MATCH_MEM_KEY, JSON.stringify(m)); } catch (e) {} }

  var PHOTO_MATCH_MEMORY = __loadMatchMem();

  function __matchMemKey(it) { return [it.zipName || "", it.folder || "", it.fname || ""].join("￿"); }

  function __rememberMatch(it, bid) { PHOTO_MATCH_MEMORY[__matchMemKey(it)] = bid; __saveMatchMem(PHOTO_MATCH_MEMORY); }

  function runPhotoMatch(items) {

    var pending = []; var auto = 0;

    items.forEach(function (it) {

      // v3.46：优先按 zipName → folder → fname 三级锁定范围（替代原先只看 folder）

      var scope = matchScopeForItem(it);

      var ms = smartFuzzyMatches(it.base, scope.cands);

      var top = ms[0];

      // T-026：复用上次匹配记忆——同一 zipName|folder|fname 直接复用，免重复确认

      var memBid = PHOTO_MATCH_MEMORY[__matchMemKey(it)];

      if (memBid === "__skip__") return;

      if (memBid) {

        var mbMem = HERITAGE.find(function (x) { return x.id === memBid; });

        if (mbMem) { if (linkOrBase64(mbMem, it)) { auto++; } else { pending.push({ it: it, b: mbMem, candidates: ms, multi: false }); } return; }

      }

      if (top && top.s >= 700) {

        var b = top.b;

        __rememberMatch(it, b.id);

        if (it.path && (window.Android && window.Android.fileSha256)) {

          var dup = dupCheck(it, b);

          if (dup) { pending.push({ it: it, b: b, ep: dup.ep }); return; }

        }

        if (linkOrBase64(b, it)) { auto++; } else { pending.push({ it: it, b: b, candidates: ms, multi: false }); }

      } else if (ms.length && ms[0].s >= 200) {

        pending.push({ it: it, b: null, candidates: ms, multi: true, scopeLabel: scope.label });

      } else {

        pending.push({ it: it, b: null, candidates: [], multi: true, nomatch: true, scopeLabel: scope.label });

      }

    });

    if (auto || pending.length === 0) { render(); save(); toast("已自动匹配保存 " + auto + " 张照片" + (pending.length ? "，另有 " + pending.length + " 张需确认" : "")); }

    if (pending.length) finishPhotoMatch(pending);

    flushCompress();

  }

  function finishPhotoMatch(pending) {

    var dupBlocks = pending.filter(function (p) { return p.ep; });

    var ambBlocks = pending.filter(function (p) { return !p.ep; });

    var html = "";

    if (dupBlocks.length) {

      html += '<div style="font-weight:600;margin:6px 0;color:#9c4a3c">发现重复照片（内容相同），请选择覆盖或跳过：</div>';

      dupBlocks.forEach(function (p, i) {

        html += '<div class="ci-row"><img src="' + esc(p.ep.file ? (window.Android.readPhoto(p.ep.file) || "") : "") + '"><div class="ct"><b>' + esc(p.b.name) + '</b><br>已有相同照片，是否覆盖？</div>' +

          '<div style="margin-left:auto;display:flex;gap:6px"><button class="btn-confirm2" style="padding:6px 10px;border:none;border-radius:6px;color:#fff" onclick="dupOverwrite(' + i + ')">覆盖</button>' +

          '<button class="btn-cancel2" style="padding:6px 10px;border:none;border-radius:6px;color:#fff" onclick="dupSkip(' + i + ')">跳过</button></div></div>';

      });

    }

    if (ambBlocks.length) {

      html += '<div style="font-weight:600;margin:10px 0 4px;color:#6b2e2e">以下照片需确认归属（已默认勾选最匹配项，可直接点「确认」）：</div>';

      ambBlocks.forEach(function (p, i) {

        var opts = p.candidates.length ? p.candidates.map(function (m, mi) {

          var checked = mi === 0 ? " checked" : "";

          var hl = mi === 0 ? "background:#f7f1e8;border-radius:6px;" : "";

          return '<label style="display:block;padding:4px 4px;' + hl + '"><input type="radio" name="amb' + i + '" value="' + esc(m.b.id) + '"' + checked + '> ' + esc(m.b.name) + '（' + esc(m.b.city) + '） <span style="color:#b8862f">' + confLabel(m.s) + "</span></label>";

        }).join("") : '<div style="margin:4px 0"><select class="umbSel" data-i="' + i + '" style="width:100%;padding:5px;border:1px solid var(--border);border-radius:6px"><option value="">— 选择古建绑定（可选）—</option>' + HERITAGE.map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.name) + '（' + esc(b.city || "") + '）</option>'; }).join("") + '</select></div>';

        var scopeTip = p.scopeLabel ? '<div style="font-size:12px;color:#8a7c70;margin-bottom:3px">推断范围：' + esc(p.scopeLabel) + "</div>" : "";

        html += '<div class="sel-box" data-ai="' + i + '"><div style="font-size:13px;margin-bottom:4px">📷 ' + esc(p.it.fname) + (p.it.folder ? '（' + esc(p.it.folder) + '）' : '') + "</div>" + scopeTip + opts +

          '<label style="display:block;padding:3px 4px;color:#888"><input type="radio" name="amb' + i + '" value=""> 跳过此照片</label></div>';

      });

      html += '<div class="sel-actions">' +

        '<button class="btn-all" onclick="ambSelectAll()">全选第一个</button>' +

        '<button class="btn-clear" onclick="ambClearAll()">全部清除</button>' +

        '<button class="btn-cancel2" onclick="ambCancel()">取消</button>' +

        '<button class="btn-confirm2" onclick="confirmAmbiguous()">确认</button>' +

        '<button class="btn-exit" onclick="closeSheet(\'sheetGen\')">退出</button></div>';

    }

    if (!html) { html = '<p style="color:#888">无待确认项。</p>'; flushCompress(); }

    $("genTitle").textContent = "匹配确认";

    $("genBody").innerHTML = html;

    window.__ambBlocks = ambBlocks; window.__dupBlocks = dupBlocks;

    openSheet("sheetGen");

  }

  // 仅在所有手动匹配框（重复/多选）处理完后才清理解压临时目录；源文件在手动绑定时必须还在（坑#22 同源）。

  function maybeCleanInbox() {

    if (window.Android && typeof window.Android.cleanInbox === "function") { try { window.Android.cleanInbox(); } catch (e) {} }

  }

  window.dupOverwrite = function (i) { var p = window.__dupBlocks[i]; try { if (p.ep.file && window.Android.deletePhoto) window.Android.deletePhoto(p.ep.file); } catch (e) {} p.b.photos = p.b.photos.filter(function (x) { return x !== p.ep; }); __rememberMatch(p.it, p.b.id); linkOrBase64(p.b, p.it); window.__dupBlocks.splice(i, 1); finishPhotoMatch(window.__dupBlocks.concat(window.__ambBlocks)); };

  window.dupSkip = function (i) { var p = window.__dupBlocks[i]; if (p) __rememberMatch(p.it, "__skip__"); window.__dupBlocks.splice(i, 1); if (!window.__dupBlocks.length && !window.__ambBlocks.length) maybeCleanInbox(); finishPhotoMatch(window.__dupBlocks.concat(window.__ambBlocks)); };

  window.ambSelectAll = function () { window.__ambBlocks.forEach(function (p, i) { var f = p.candidates[0]; if (f) { var r = document.querySelector('input[name="amb' + i + '"][value="' + CSS_escape_fix(f.b.id) + '"]'); if (r) r.checked = true; } }); };

  window.ambClearAll = function () { document.querySelectorAll('#genBody input[type="radio"]').forEach(function (r) { r.checked = false; }); };

  window.ambCancel = function () { toast("已取消，未保存的匹配"); maybeCleanInbox(); closeSheet("sheetGen"); };

  window.confirmAmbiguous = function () {

    var saved = 0, failed = 0;

    window.__ambBlocks.forEach(function (p, i) {

      var r = document.querySelector('input[name="amb' + i + '"]:checked');

      var bid = (r && r.value) ? r.value : "";

      if (!bid) { var sel = document.querySelector('.umbSel[data-i="' + i + '"]'); if (sel) bid = sel.value; }

      if (!bid) { __rememberMatch(p.it, "__skip__"); return; }

      var b = HERITAGE.find(function (x) { return x.id === bid; }); if (!b) return;

      __rememberMatch(p.it, bid);

      var ok = linkOrBase64(b, p.it); if (ok) saved++; else failed++;

    });

    render(); save();

    if (!window.__dupBlocks.length && !window.__ambBlocks.length) maybeCleanInbox();

    flushCompress();

    toast("已保存 " + saved + " 张匹配照片" + (failed ? "（" + failed + " 张失败）" : "")); closeSheet("sheetGen");

  };

  function CSS_escape_fix(s) { return String(s).replace(/"/g, '\\"'); }



  // ---------- 删除二级菜单（v3.12 同源：按时间/省过滤，全选/清除/确认，不可逆提示）----------

  function deleteImportedPhotos() {

    var provs = uniq(HERITAGE.map(function (b) { return b.province || ""; })).filter(Boolean);

    var html = '<p style="font-size:13px;color:#555">删除“添加的照片”（按导入时间/省过滤；导入照片带 added 时间戳）。</p>';

    html += '<div class="filter-sec"><h4>导入时间</h4><div class="chips" id="dpTime">' +

      [["all", "全部"], ["7", "近7天"], ["30", "近30天"], ["90", "近90天"]].map(function (o) { return '<span class="chip' + (o[0] === "all" ? " on" : "") + '" data-k="dpTime" data-v="' + o[0] + '">' + o[1] + '</span>'; }).join("") + '</div></div>';

    html += '<div class="filter-sec"><h4>省/直辖市（不选=全部）</h4><div class="chips" id="dpProv">' +

      provs.map(function (o) { return '<span class="chip" data-k="dpProv" data-v="' + esc(o) + '">' + esc(o) + '</span>'; }).join("") + '</div></div>';

    html += '<div id="dpList" style="margin-top:10px"></div>';

    html += '<div class="sel-actions"><button class="btn-all" onclick="dpSelAll()">全选</button><button class="btn-clear" onclick="dpClearAll()">全部清除</button><button class="btn-cancel2" onclick="closeSheet(\'sheetGen\')">取消</button><button class="btn-confirm2" onclick="confirmDeletePhotos()">确认删除</button></div>';

    $("genTitle").textContent = "删除添加的照片";

    $("genBody").innerHTML = html;

    window.__dpTime = "all"; window.__dpProv = new Set();

    renderDpList();

    $("dpTime").querySelectorAll(".chip").forEach(function (c) { c.onclick = function () { window.__dpTime = c.dataset.v; $("dpTime").querySelectorAll(".chip").forEach(function (x) { x.classList.toggle("on", x === c); }); renderDpList(); }; });

    $("dpProv").querySelectorAll(".chip").forEach(function (c) { c.onclick = function () { if (window.__dpProv.has(c.dataset.v)) window.__dpProv.delete(c.dataset.v); else window.__dpProv.add(c.dataset.v); c.classList.toggle("on"); renderDpList(); }; });

    openSheet("sheetGen");

  }

  function renderDpList() {

    var now = Date.now(), cut = window.__dpTime === "all" ? 0 : now - (+window.__dpTime) * 86400000;

    var rows = [];

    HERITAGE.forEach(function (d) {

      (d.photos || []).forEach(function (p) {

        if (!p.added) return;

        if (cut && p.added < cut) return;

        if (window.__dpProv.size && !window.__dpProv.has(d.province || "")) return;

        rows.push({ did: d.id, p: p, name: d.name, cap: p.caption || "照片" });

      });

    });

    var box = $("dpList"); if (!box) return;

    if (!rows.length) { box.innerHTML = '<p style="color:#888;font-size:12px">没有符合条件的导入照片。</p>'; return; }

    box.innerHTML = rows.map(function (r, i) { return '<label class="sel-item" style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:13px"><input type="checkbox" class="dpChk" data-i="' + i + '" checked> ' + esc(r.name) + ' / ' + esc(r.cap) + '</label>'; }).join("");

    window.__dpRows = rows;

  }

  window.dpSelAll = function () { document.querySelectorAll(".dpChk").forEach(function (c) { c.checked = true; }); };

  window.dpClearAll = function () { document.querySelectorAll(".dpChk").forEach(function (c) { c.checked = false; }); };

  window.confirmDeletePhotos = function () {

    var rows = window.__dpRows || []; if (!rows.length) return;

    var sel = {}; document.querySelectorAll(".dpChk").forEach(function (c) { if (c.checked) sel[+c.dataset.i] = true; });

    var n = 0;

    rows.forEach(function (r, i) {

      if (!sel[i]) return;

      var d = HERITAGE.find(function (x) { return x.id === r.did; }); if (!d) return;

      try { if (r.p.file && window.Android && window.Android.deletePhoto) window.Android.deletePhoto(r.p.file); } catch (e) {}

      d.photos = (d.photos || []).filter(function (x) { return x !== r.p; }); n++;

    });

    render(); save(); closeSheet("sheetGen");

    toast("已删除 " + n + " 张导入照片");

  };

  function deleteHeritage() {

    var provs = uniq(HERITAGE.map(function (b) { return b.province || ""; })).filter(Boolean);

    var html = '<p style="color:#c0392b;font-weight:600">⚠ 删除后古建及其照片不可恢复</p>';

    html += '<div class="filter-sec"><h4>省/直辖市（不选=全部）</h4><div class="chips" id="ddProv">' + provs.map(function (o) { return '<span class="chip" data-v="' + esc(o) + '">' + esc(o) + '</span>'; }).join("") + '</div></div>';

    html += '<div id="ddList" style="margin-top:10px"></div>';

    html += '<div class="sel-actions"><button class="btn-all" onclick="ddSelAll()">全选</button><button class="btn-clear" onclick="ddClearAll()">全部清除</button><button class="btn-cancel2" onclick="closeSheet(\'sheetGen\')">取消</button><button class="btn-confirm2" onclick="confirmDeleteHeritage()">确认删除</button></div>';

    $("genTitle").textContent = "删除古建";

    $("genBody").innerHTML = html;

    window.__ddProv = new Set();

    renderDdList();

    $("ddProv").querySelectorAll(".chip").forEach(function (c) { c.onclick = function () { if (window.__ddProv.has(c.dataset.v)) window.__ddProv.delete(c.dataset.v); else window.__ddProv.add(c.dataset.v); c.classList.toggle("on"); renderDdList(); }; });

    openSheet("sheetGen");

  }

  function renderDdList() {

    var rows = HERITAGE.filter(function (d) { return !window.__ddProv.size || window.__ddProv.has(d.province || ""); }).map(function (d) { return { d: d, name: d.name, prov: d.province || "", np: (d.photos || []).length }; });

    var box = $("ddList"); if (!box) return;

    if (!rows.length) { box.innerHTML = '<p style="color:#888;font-size:12px">没有符合条件的古建。</p>'; return; }

    box.innerHTML = rows.map(function (r, i) { return '<label class="sel-item" style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:13px"><input type="checkbox" class="ddChk" data-i="' + i + '" checked> ' + esc(r.name) + ' <span style="color:#888;font-size:11px">(' + esc(r.prov) + ' · ' + r.np + '张照片)</span></label>'; }).join("");

    window.__ddRows = rows;

  }

  window.ddSelAll = function () { document.querySelectorAll(".ddChk").forEach(function (c) { c.checked = true; }); };

  window.ddClearAll = function () { document.querySelectorAll(".ddChk").forEach(function (c) { c.checked = false; }); };

  window.confirmDeleteHeritage = function () {

    var rows = window.__ddRows || []; if (!rows.length) return;

    ask("批量删除", "将永久删除 " + rows.length + " 个古建及共 " + rows.reduce(function (s, r) { return s + r.np; }, 0) + " 张照片，不可恢复，确认？",

      [{ t: "取消", cls: "btn-cancel", v: 0 }, { t: "确认删除", cls: "btn-confirm2", v: 1 }], function (v) {

        if (!v) return;

        var sel = {}; document.querySelectorAll(".ddChk").forEach(function (c) { if (c.checked) sel[+c.dataset.i] = true; });

        var n = 0;

        rows.forEach(function (r, i) {

          if (!sel[i]) return;

          (r.d.photos || []).forEach(function (p) { try { if (p.file && window.Android && window.Android.deletePhoto) window.Android.deletePhoto(p.file); } catch (e) {} });

          HERITAGE = HERITAGE.filter(function (x) { return x !== r.d; }); n++;

        });

        render(); save(); closeSheet("sheetGen");

        toast("已删除 " + n + " 个古建");

      });

  };



  /* ---------- 导出古建表格（CSV）---------- */

  /* ---------- 导出古建表格（CSV）---------- */

  // v3.7.5：通用导出命名弹窗（自定义文件名 + 保存文件夹，参照知识库导出 kbExport 交互）
  function gjExpDialog(title, defName, ext, hintHtml, onGo) {

    try {
      var html = '<p style="font-size:13px;color:#3a2e28;line-height:1.6">' + hintHtml + '</p>' +
        '<label class="f" style="display:block;margin:8px 0 4px">文件名（留空=默认）</label>' +
        '<input class="f" id="gjExpName" style="width:100%;box-sizing:border-box" value="' + esc(defName + "." + ext) + '">' +
        '<label class="f" style="display:block;margin:8px 0 4px">保存文件夹（安卓可填 Download 下子目录，留空=Download 根目录；Win/统信/网页走系统下载目录）</label>' +
        '<input class="f" id="gjExpDir" style="width:100%;box-sizing:border-box" placeholder="如：古建导出（可留空）">' +
        '<div class="form-actions">' +
          '<button class="btn-save" id="gjExpOk" style="flex:1">导出</button>' +
          '<button class="btn-cancel" id="gjExpCancel" style="flex:1">取消</button>' +
        '</div>';
      $("genTitle").textContent = title; $("genBody").innerHTML = html; openSheet("sheetGen");
      $("gjExpOk").onclick = function () {
        var n = ($("gjExpName") && $("gjExpName").value || "").trim() || (defName + "." + ext);
        if (!/\.[a-zA-Z0-9]+$/.test(n)) n = n + "." + ext;
        var dir = ($("gjExpDir") && $("gjExpDir").value || "").trim();
        closeSheet("sheetGen");
        try { onGo(n, dir); } catch (e) { toast("导出失败：" + (e && e.message || e)); }
      };
      $("gjExpCancel").onclick = function () { closeSheet("sheetGen"); };
    } catch (e) { toast("导出失败：" + (e && e.message || e)); }
  }

  // 通用保存：安卓优先 saveBlobTo(指定目录+文件名)；否则 <a download> 系统下载
  function gjSaveOut(dataUrl, textContent, mime, name, folder) {

    var A = window.Android;
    if (A && typeof A.saveBlobTo === "function") {
      A.saveBlobTo(dataUrl, folder || "", name);
      toast("已导出：" + (folder ? "Download/" + folder + "/" : "Download/") + name);
      return;
    }
    var blob = textContent != null ? new Blob([textContent], { type: mime }) : null;
    if (!blob && dataUrl) { try { blob = dataURLtoBlob(dataUrl); } catch (e) {} }
    if (blob) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); toast("已导出：" + name); return; }
    toast("已导出（请查收系统下载目录）：" + name);
  }
  function dataURLtoBlob(d) {
    var p = d.split(","); var m = (p[0].match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
    var bin = atob(p[1]); var u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: m });
  }

  function exportTable() {

    if (!HERITAGE.length) { toast("没有可导出的古建"); return; }
    gjExpDialog("导出古建表格", "古建景点_" + getTodayStr(), "csv", "将导出全部 <b>" + HERITAGE.length + "</b> 条古建为 CSV 表格（Excel/WPS 可直接打开）。", function (name, folder) {
      var rows = [["名称", "省", "市", "类别", "年代", "级别", "经度", "纬度", "介绍", "特点", "打卡次数", "照片数"]];
      HERITAGE.forEach(function (b) {
        rows.push([b.name, b.province, b.city, b.type, b.dynasty, b.level, b.lon, b.lat, b.intro, b.features, (b.checkins || []).length, (b.photos || []).length]);
      });
      var csv = "﻿" + rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
      gjSaveOut("data:text/csv;charset=utf-8;base64," + b64(csv), csv, "text/csv;charset=utf-8", name, folder);
    });
  }

  function b64(s) { try { return btoa(unescape(encodeURIComponent(s))); } catch (e) { return ""; } }



  /* ---------- 导出数据 JSON ---------- */

  function exportJson() {

    if (!HERITAGE.length) { toast("没有可导出的古建"); return; }
    gjExpDialog("导出数据(JSON)", "古建数据_" + getTodayStr(), "json", "将导出全部 <b>" + HERITAGE.length + "</b> 条古建数据为 JSON（可再次导入恢复）。", function (name, folder) {
      var json = JSON.stringify(HERITAGE);
      gjSaveOut("data:application/json;base64," + b64(json), json, "application/json", name, folder);
    });
  }



  /* ============ 奥维 ovkmz 导入导出（移植水利一张图 v3.15 成功经验）============ */

  /* 富解析（兼容奥维/GE/自导出）：照片按 <OvAttaItem> 引用精确绑定、ExtendedData/描述多格式、

     文件夹取最后两级（省/市）、坐标校验、无坐标不写假 0,0。 */

  function buildExportSpec() {

    var root = {};

    HERITAGE.forEach(function (d) {

      if (d.geom !== "Point" || d.lon == null) return;

      var o = d.province || "未设置", fn = d.city || (d.type || "其他");

      root[o] = root[o] || {}; root[o][fn] = root[o][fn] || []; root[o][fn].push(d);

    });

    var photos = [];

    function extOf(f) { var m = /\.([A-Za-z0-9]{2,5})$/.exec(String(f || "")); return m ? "." + m[1].toLowerCase() : ".jpg"; }

    function dataEl(k, v) {

      if (v == null || v === "") return "";

      return '<Data name="' + esc(k) + '"><value>' + esc(v) + "</value></Data>";

    }

    function placemark(d) {

      var desc = [["省份", d.province], ["城市", d.city], ["文物类别", d.type], ["年代", d.dynasty], ["级别", d.level]]

        .filter(function (a) { return a[1]; })

        .map(function (a) { return esc(a[0]) + " : " + esc(a[1]); }).join("|");

      var atta = "";

      (d.photos || []).forEach(function (p) {

        var rel = (p.file && /^(photos\/|file:)/.test(p.file)) ? p.file : null;

        if (!rel && p.data && p.data.indexOf("data:") === 0 && window.Android && window.Android.storePhoto) {

          try { rel = window.Android.storePhoto(d.id, (p.caption || "photo.jpg"), p.data); } catch (e) {}

        }

        if (!rel) return;

        var ovName = "pic_" + photos.length + (rel ? extOf(rel) : ".jpg");

        photos.push({ relPath: rel, ovName: ovName });

        atta += "<OvAttaItem>ovatta/" + ovName + "</OvAttaItem>";

      });

      var ext = dataEl("省份", d.province) + dataEl("城市", d.city) + dataEl("文物类别", d.type) +

        dataEl("年代", d.dynasty) + dataEl("级别", d.level) + dataEl("介绍", d.intro) + dataEl("特点", d.features);

      var geo = (d.lon != null && d.lat != null && !(d.lon === 0 && d.lat === 0))

        ? "<Point><coordinates>" + d.lon + "," + d.lat + ",0</coordinates></Point>" : "";

      return "<Placemark><name>" + esc(d.name) + "</name><description>" + desc + "</description>" +

        (ext ? "<ExtendedData>" + ext + "</ExtendedData>" : "") +

        "<OvAttr><OvIcon>1</OvIcon><OvIconNum>0</OvIconNum>" + (atta ? "<OvAttaList>" + atta + "</OvAttaList>" : "") + "</OvAttr>" +

        (geo ? "<OvCoordType>CGCS2000</OvCoordType>" : "") + geo + "</Placemark>";

    }

    var folders = "";

    Object.keys(root).forEach(function (o) {

      var sub = "";

      Object.keys(root[o]).forEach(function (fn) {

        sub += "<Folder><name>" + esc(fn) + "</name>" + root[o][fn].map(placemark).join("") + "</Folder>";

      });

      folders += "<Folder><name>" + esc(o) + "</name>" + sub + "</Folder>";

    });

    var kml = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>古建景点打卡</name>' + folders + "</Document></kml>";

    return { kml: kml, photos: photos };

  }

  function exportOvkmz() {

    if (!(window.Android && window.Android.exportKmz)) { exportOvkmzLegacy(); return; }

    gjExpDialog("导出 ovkmz", "古建景点_" + getTodayStr(), "ovkmz", "导出奥维 ovkmz（含照片，较大文件走原生流式传输；安卓保存至 Download/古建景点打卡/）。", function (name) {
      window.__gjOvkmzName = String(name || "").replace(/\.ovkmz$/i, "");
      doExport();
    });

    function doExport() {

      busy("正在整理导出数据…");

      busyDetail("正在组装 KML 与照片清单，请稍后…");

      setTimeout(function () {

        var spec;

        try { spec = buildExportSpec(); }

        catch (e) { idle(); toast("导出准备失败：" + e.message); return; }

        idle();

        ensureWifi("导出 ovkmz（可能 >3GB）", function () {

          var outName = (window.__gjOvkmzName || ("古建景点_" + getTodayStr())) + ".ovkmz";

          var out = window.Android.exportPath(outName);

          openXferProgress("export"); window.Android.exportKmz(JSON.stringify(spec), out, false);

        });

      }, 30);

    }

    if (XFER.source === "netdisk") {

      ask("网盘导出", "当前传输设置为『网盘』，导出文件将上传到网盘（需填写 token）。确认？",

        [{ t: "取消", cls: "btn-cancel", v: 0 }, { t: "确认上传", cls: "btn-confirm2", v: 1 }], function (v) { if (v) doExport(); });

      return;

    }

    doExport();

  }

  function exportOvkmzLegacy() {

    toast("正在生成 ovkmz…");

    try {

      var spec = buildExportSpec();

      var zip = new JSZip();

      zip.file("doc.kml", spec.kml);

      var pending = spec.photos.filter(function (p) { return p.relPath; });

      var todo = pending.length, done = 0;

      function finish() {

        zip.generateAsync({ type: "blob" }).then(function (blob) {

          var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "古建景点_" + Date.now() + ".kmz"; a.click();

          toast("已导出：" + a.download);

        });

      }

      if (!todo) return finish();

      pending.forEach(function (p) {

        var data = (window.Android && window.Android.readPhoto) ? window.Android.readPhoto(p.relPath) : "";

        if (data && data.indexOf("data:") === 0) {

          fetch(data).then(function (r) { return r.blob(); }).then(function (b) { zip.file("ovatta/" + p.ovName, b); if (++done === todo) finish(); }).catch(function () { if (++done === todo) finish(); });

        } else { if (++done === todo) finish(); }

      });

    } catch (e) { toast("生成失败：" + e.message); }

  }

  function importOvkmz() {

    if (!(window.Android && window.Android.pickFiles)) { importOvkmzLegacy(); return; }

    window.__pickMode = "kmz";

    window.Android.pickFiles("*/*");

  }

  function importOvkmzLegacy() {

    var inp = document.createElement("input"); inp.type = "file"; inp.accept = ".kmz,.ovkmz,.kml"; inp.onchange = function () {

      var f = this.files[0]; if (!f) return;

      JSZip.loadAsync(f).then(function (zip) {

        var kmlFile = zip.file("doc.kml") || Object.keys(zip.files).map(function (k) { return zip.files[k]; }).filter(function (zf) { return /doc\.kml$/i.test(zf.name) && !zf.dir; })[0];

        if (!kmlFile) throw new Error("kml 不存在");

        return kmlFile.async("string").then(function (txt) {

          var photoEntries = Object.keys(zip.files).filter(function (k) { return !zip.files[k].dir && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(k) && k.indexOf("ovatta/") === 0; });

          return Promise.all(photoEntries.map(function (k) {

            return zip.file(k).async("base64").then(function (b64d) {

              return { ovName: k.split("/").pop(), data: "data:image/" + (/\.png$/i.test(k) ? "png" : "jpeg") + ";base64," + b64d };

            });

          })).then(function (photos) { mergeImported(parseKmzWithPhotos(txt, photos)); });

        });

      }).catch(function (e) { toast("导入失败：" + e); });

    };

    inp.click();

  }

  // 原生导入回调：kml + 照片路径映射 -> 合并（同名+坐标相同更新，否则新增）

  window.onImportData = function (json) {

    var o; try { o = JSON.parse(json); } catch (e) { toast("导入数据解析失败"); return; }

    var added = parseKmzWithPhotos(o.kml, o.photos || []);

    if (!added.length) { toast("未解析到古建"); return; }

    mergeImported(added);

  };

  function mergeImported(added) {

    var nAdd = 0, nUp = 0;

    added.forEach(function (nb) {

      var ex = HERITAGE.find(function (x) { return x.name === nb.name && x.lon != null && nb.lon != null && Math.abs(x.lat - nb.lat) < 1e-4 && Math.abs(x.lon - nb.lon) < 1e-4; });

      if (ex) {

        ex.province = nb.province; ex.city = nb.city; ex.type = nb.type; ex.dynasty = nb.dynasty;

        ex.level = nb.level; ex.intro = nb.intro; ex.features = nb.features; ex.photos = nb.photos;

        ex.geom = nb.geom; ex.lon = nb.lon; ex.lat = nb.lat; nUp++;

      } else { HERITAGE.push(nb); nAdd++; }

    });

    save(); render();

    if (window.idle) window.idle();

    flushCompress();

    toast("导入完成：新增 " + nAdd + "，更新 " + nUp);

  }

  /* ---------- KML 解析工具（命名空间容错 / 直接子节点 / 坐标校验）---------- */

  function els(el, tag) {

    if (!el) return [];

    var r = el.getElementsByTagName(tag);

    if (r && r.length) return r;

    try { r = el.getElementsByTagNameNS("*", tag); } catch (e) { r = null; }

    return r || [];

  }

  function dchild(el, tag) {

    if (!el || !el.childNodes) return null;

    for (var i = 0; i < el.childNodes.length; i++) {

      var c = el.childNodes[i];

      if (c.nodeType !== 1) continue;

      var ln = c.localName || c.nodeName;

      if (ln === tag || c.nodeName === tag) return c;

    }

    return null;

  }

  function dtxt(el, tag) {

    var c = dchild(el, tag);

    return c && c.textContent ? c.textContent.trim() : "";

  }

  function parseCoords(s) {

    if (!s) return [];

    return s.trim().split(/\s+/).map(function (t) {

      var p = t.split(",");

      var lon = parseFloat(p[0]), lat = parseFloat(p[1]);

      if (!isFinite(lon) || !isFinite(lat)) return null;

      if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;

      if (lon === 0 && lat === 0) return null;   // 0,0 典型"无坐标"占位

      return [lon, lat];

    }).filter(Boolean);

  }

  function stripTags(s) {

    return String(s == null ? "" : s).replace(/<[^>]*>/g, "")

      .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")

      .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').trim();

  }

  function parseDescAttrs(desc) {

    if (!desc) return [];

    var out = [];

    if (/<\s*(table|tr|td|br|p|div)/i.test(desc)) {

      var rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi, m;

      while ((m = rowRe.exec(desc))) {

        var tds = m[1].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];

        if (tds.length >= 2) { var k = stripTags(tds[0]), v = stripTags(tds[1]); if (k) out.push([k, v]); }

      }

      if (!out.length) {

        desc.split(/<br\s*\/?>|<\/p>|<\/div>/i).forEach(function (line) {

          var t = stripTags(line); if (!t) return;

          var p = t.split(/[:：]/);

          if (p.length >= 2 && p[0].trim()) out.push([p[0].trim(), p.slice(1).join(":").trim()]);

        });

      }

      return out;

    }

    var parts = desc.indexOf("|") >= 0 ? desc.split("|") : desc.split(/\r?\n/);

    parts.forEach(function (l) {

      var p = l.split(/[:：]/);

      if (p.length >= 2 && p[0].trim()) out.push([p[0].trim(), p.slice(1).join(":").trim()]);

    });

    return out;

  }

  var FIELD_ALIAS = {

    province: ["省份", "省", "province"],

    city: ["城市", "市", "city"],

    type: ["文物类别", "类别", "类型", "文物类型", "type"],

    dynasty: ["年代", "朝代", "dynasty"],

    level: ["级别", "保护级别", "level"],

    intro: ["介绍", "简介", "intro", "description"],

    features: ["特点", "特色", "features"],

    name: ["名称", "古建名称", "name"]

  };

  function matchField(key) {

    var k = String(key || "").trim().toLowerCase();

    for (var f in FIELD_ALIAS) {

      for (var i = 0; i < FIELD_ALIAS[f].length; i++) {

        if (FIELD_ALIAS[f][i].toLowerCase() === k) return f;

      }

    }

    return "";

  }

  /* 富解析（兼容奥维/GE/自导出）：照片按 <OvAttaItem> 引用精确绑定、ExtendedData/描述多格式、

     文件夹取最后两级（省/市）、坐标校验、无坐标不写假 0,0。v3.15 移植自水利一张图。 */

  function parseKmzWithPhotos(xml, photos) {

    photos = photos || [];

    // v3.61：剥奥维 doc.kml 串首 UTF-8 BOM（同水利 v3.61 修复：DOMParser 报 XML 声明不在实体开头）
    xml = String(xml == null ? "" : xml);
    if (xml.charCodeAt(0) === 0xFEFF) xml = xml.slice(1);
    xml = xml.replace(/^(\s+)(?=<\?xml)/i, "");

    var out = [];

    try {

      var doc = new DOMParser().parseFromString(xml || "", "application/xml");

      if (doc.getElementsByTagName("parsererror").length) { toast("KML 格式无法解析"); return out; }

      var pms = doc.getElementsByTagName("Placemark");

      if (!pms.length) pms = els(doc, "Placemark");

      var byRef = {}, used = {}, seq = 0;

      photos.forEach(function (p, i) {

        if (!p) return;

        var keys = [];

        if (p.ovPath) keys.push(String(p.ovPath).replace(/\\/g, "/").toLowerCase());

        if (p.ovName) keys.push(String(p.ovName).toLowerCase());

        if (p.relPath) keys.push(String(p.relPath).split("/").pop().toLowerCase());

        keys.forEach(function (k) { if (k && byRef[k] === undefined) byRef[k] = i; });

      });

      function takeByRef(ref) {

        var r = String(ref || "").replace(/\\/g, "/").trim();

        if (!r) return null;

        var cands = [r.toLowerCase(), r.split("/").pop().toLowerCase()];

        for (var i = 0; i < cands.length; i++) {

          var idx = byRef[cands[i]];

          if (idx !== undefined && !used[idx]) { used[idx] = 1; return photos[idx]; }

        }

        return null;

      }

      function takeNext() {

        while (seq < photos.length && used[seq]) seq++;

        if (seq >= photos.length) return null;

        used[seq] = 1; return photos[seq++];

      }

      for (var pi = 0; pi < pms.length; pi++) {

        var pm = pms[pi];

        var name = dtxt(pm, "name");

        var desc = dtxt(pm, "description");

        var explicit = {};

        var eds = els(pm, "Data");

        for (var di = 0; di < eds.length; di++) {

          var dk = eds[di].getAttribute("name") || dtxt(eds[di], "displayName");

          var dv = dtxt(eds[di], "value");

          if (!dk) continue;

          var f = matchField(dk); if (f) explicit[f] = dv;

        }

        var sds = els(pm, "SimpleData");

        for (var si = 0; si < sds.length; si++) {

          var sk = sds[si].getAttribute("name");

          var sv = sds[si].textContent ? sds[si].textContent.trim() : "";

          if (!sk) continue;

          var sf = matchField(sk); if (sf && !explicit[sf]) explicit[sf] = sv;

        }

        if (desc) {

          var da = parseDescAttrs(desc);

          da.forEach(function (a) { var f2 = matchField(a[0]); if (f2 && !explicit[f2]) explicit[f2] = a[1]; });

        }

        var path = "", par = pm.parentNode;

        while (par && par.nodeType === 1) {

          var pn = par.localName || par.nodeName;

          if (pn === "kml") break;

          if (pn === "Folder") { var fn = dtxt(par, "name"); if (fn) path = "/" + fn + path; }

          par = par.parentNode;

        }

        var segs = path.split("/").filter(Boolean);

        var province = "", city = "", type = "";

        if (segs.length >= 2) {

          province = segs[segs.length - 2];

          var s = segs[segs.length - 1];

          if (s.indexOf("--") >= 0) { city = s.split("--")[0]; type = s.split("--")[1]; }

          else { city = s; }

        } else if (segs.length === 1) { province = segs[0]; }

        if (explicit.province) province = explicit.province;

        if (explicit.city) city = explicit.city;

        if (explicit.type) type = explicit.type;

        if (explicit.name && !name) name = explicit.name;

        var photosArr = [];

        var atta = els(pm, "OvAttaItem");

        for (var k = 0; k < atta.length; k++) {

          var ref = atta[k].textContent ? atta[k].textContent.trim() : "";

          if (!ref) ref = dtxt(atta[k], "OvAttaFile") || dtxt(atta[k], "name");

          var ph = takeByRef(ref) || takeNext();

          if (!ph) continue;

          if (ph.relPath) { photosArr.push({ file: ph.relPath, caption: "" }); queueCompress(ph.relPath); }

          else if (ph.data) photosArr.push({ data: ph.data, caption: "" });

        }

        var rec = {

          id: "h" + Date.now() + "_" + out.length, name: name, province: province, city: city, type: type,

          dynasty: explicit.dynasty || "", level: explicit.level || "", intro: explicit.intro || "", features: explicit.features || "",

          photos: photosArr, checkins: [], geom: "Point", lon: null, lat: null

        };

        var pt = els(pm, "Point")[0];

        if (pt) {

          var c = parseCoords(dtxt(pt, "coordinates"))[0];

          if (c) { rec.lon = c[0]; rec.lat = c[1]; } else { rec.geom = "None"; }

        } else { rec.geom = "None"; }

        if (!rec.name) rec.name = "未命名_" + (pi + 1);

        out.push(rec);

      }

    } catch (e) { toast("解析 kml 出错"); }

    return out;

  }



  /* ---------- 统计 / 帮助 / 变更 / 关于 ---------- */

  function showStats() {

    var provs = new Set(HERITAGE.map(function (b) { return b.province; })), cities = new Set(HERITAGE.map(function (b) { return b.city; }));

    var types = {}, photos = 0, checkins = 0;

    HERITAGE.forEach(function (b) { types[b.type || "其他"] = (types[b.type || "其他"] || 0) + 1; photos += (b.photos || []).length; checkins += (b.checkins || []).length; });

    var typeHtml = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).slice(0, 8).map(function (t) { return '<div class="lg"><span class="dot" style="background:' + colorForType(t) + '"></span>' + esc(t) + "：" + types[t] + " 处</div>"; }).join("");

    var html = '<div class="stat-grid">' +

      '<div class="stat-box"><div class="n">' + HERITAGE.length + '</div><div class="t">古建总数</div></div>' +

      '<div class="stat-box"><div class="n">' + provs.size + '</div><div class="t">省级行政区</div></div>' +

      '<div class="stat-box"><div class="n">' + cities.size + '</div><div class="t">城市</div></div>' +

      '<div class="stat-box"><div class="n">' + photos + '</div><div class="t">照片</div></div>' +

      '<div class="stat-box"><div class="n">' + checkins + '</div><div class="t">打卡次数</div></div>' +

      '<div class="stat-box"><div class="n">' + Object.keys(types).length + '</div><div class="t">文物类别</div></div></div>' +

      '<div style="margin-top:10px"><b style="color:#6b2e2e">类别分布</b>' + typeHtml + "</div>";

    $("genTitle").textContent = "统计"; $("genBody").innerHTML = html; openSheet("sheetGen");

  }

  function showHelp() {

    var html = '<p style="font-size:13px;line-height:1.7;color:#3a2e28">' +

      "1. 顶栏 🔍查询 / 🔎筛选 为最高频操作，置顶显眼。<br>" +

      "2. 菜单为「一级 + 二级」：查询/筛选置顶；<b>拍照打卡</b> / 数据管理 / 地图和位置 / 传输与共享 / 信息与帮助 分组（二级默认隐藏，点标题或 ＋ 展开）。<br>" +

      "3. 每个页面底部都有「✕ 退出本页」，避免卡页。<br>" +

      "4. <b>连按屏幕任意处三下</b>（含空白/地图）可呼出主菜单。<br>" +

      "5. 添加古建：菜单「地图和位置 → 添加古建」，点地图放置；也可手动填写省/市/类别/年代/级别/介绍/特点。<br>" +

      "6. 拍照打卡：菜单「拍照打卡 → 打卡」，选古建、拍照片、填到达时间/游览时长/体验，自动记入路线。<br>" +

      "7. 我的打卡路线：按到达时间从新到旧排列，可一键定位。<br>" +

      "8. 批量导入照片按文件名智能匹配古建（容错错字/漏字）。</p>" +

      "<p><b>⑨ 快捷常用（收藏）</b>：菜单项右侧 ☆ 点选收藏；子菜单内<b>长按 600ms</b>也可添加 / 移除「快捷常用」（与 ☆ 并存，解决手机/平板星标点不准、易误触），长按带振动与 toast 反馈。</p>" +

      "<p><b>⑩ 智能AI</b>：菜单「智能AI」可基于本地古建记录问答 / 补全（公共受众，默认联网核实公开文物，优先引用文物局 / UNESCO / 世界遗产委员会）；「设置 → 智能AI设置」可自定义大模型接口、多模型与自动调用策略。</p>" +

      "<p><b>⑪ 知识库</b>：菜单「设置 → 知识库管理」可读取外部文件（网页 / 公众号 / 文档）入库、导出 / 导入备份。</p>" +

      "<p><b>⑫ 统计 / 版本变更 / ⑬ 错误日志排查</b>：信息与帮助内可看统计、版本变更；异常时「错误日志」可查看并复制最近脚本错误。</p>" +
      "<p><b>⑭ 知识库智能检索（RAG）/ 入库</b>：导入的文档智能切片（保持语句完整）并向量化，支持混合检索（向量+关键词+模糊）、内容反查条目、智能生成提示词与智能回答（引用标注来源）；外部文档 pdf/docx/xlsx/csv/网页 智能转 Markdown 入库（OCR 识别）。</p>" +
      "<p><b>⑯ 知识库导出自定义与写备忘录</b>：知识库管理导出 md/txt/html 可自定义文件名（默认 知识库_YYYYMMDD.md/.txt/.html）与保存文件夹（Android 原生目录选择，Win/UOS/iOS 走系统下载目录并提示）；「拍照打卡 → 写备忘录 / 我的备忘录」记录游览随想（所见即所得编辑器，独立存储）。</p>" +
      "<p><b>⑰ GitHub 升级</b>：「设置 → GitHub 升级（检测新版）」查询最新 Release 并列出四平台安装包下载。</p>" +

      "<p style='color:#888;font-size:12px;margin-top:8px'>提示：app 启动时会记录当前版本 / 构建日期 / 运行平台，便于核对是否为最新版。</p>";

    $("genTitle").textContent = "功能介绍"; $("genBody").innerHTML = html; openSheet("sheetGen");

  }

  function openPlatformCompare() {

    var rows = [
      ["知识库智能切片（语句完整，保存前先切片）", "✅", "✅", "✅", "✅", "v3.7.3 整句打包+签名缓存"],
      ["RAG 混合检索 / 内容反查条目 / 智能问答", "✅", "✅", "✅", "✅", "kb_rag.js 随包，纯本地离线"],
      ["OCR 外部文档入库（pdf/docx/xlsx/csv）", "✅ 本地引擎", "✅ 浏览器", "✅ 本地引擎", "✅ 浏览器 wasm", "智能转 Markdown 入库"],
      ["升级备份导出自定义目录/文件名", "✅ 原生桥", "✅ 浏览器下载", "✅ 浏览器下载", "✅ 浏览器下载", "默认 古建景点打卡备份_日期.bak"],
      ["写游记 / 我的游记（拍照打卡）", "✅", "✅", "✅", "✅", "v3.7.1 新增"],
      ["知识库导出 md/txt/html 自定义文件名 + 自选文件夹", "✅ 原生桥", "✅ 浏览器下载", "✅ 浏览器下载", "✅ 浏览器下载", "v3.7.5 默认 知识库_YYYYMMDD.md/.txt/.html"],
      ["GitHub 升级（检测新版，查本渠道 Release）", "✅", "✅", "✅", "✅", "设置→GitHub 升级 列四平台安装包"],
      ["写备忘录 / 我的备忘录", "✅", "✅", "✅", "✅", "v3.7.5 新增（与写游记同源）"],
      ["5 级景区组织 + 17 类古建类型", "✅", "✅", "✅", "✅", "古建核心"],
      ["每页退出按钮 + 三击空白呼出主菜单", "✅", "✅", "✅", "✅", "全平台一致"]
    ];

    var html = '<p style="margin:6px 0">古建景点打卡在 Android / Win11 / 统信 UOS / iOS PWA 四端的功能对照（平台原生能力允许差异，功能不删不减）：</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
      '<tr style="background:rgba(0,0,0,.06)"><th style="text-align:left;padding:6px;border:1px solid rgba(0,0,0,.12)">功能</th><th style="padding:6px;border:1px solid rgba(0,0,0,.12)">安卓</th><th style="padding:6px;border:1px solid rgba(0,0,0,.12)">Win11</th><th style="padding:6px;border:1px solid rgba(0,0,0,.12)">统信UOS</th><th style="padding:6px;border:1px solid rgba(0,0,0,.12)">iOS PWA</th><th style="text-align:left;padding:6px;border:1px solid rgba(0,0,0,.12)">说明</th></tr>' +
      rows.map(function (r) {
        return "<tr>" + r.map(function (c, i) { return '<td style="padding:6px;border:1px solid rgba(0,0,0,.12)' + (i === 0 ? ";text-align:left" : "") + '">' + esc(c) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</table>";

    $("genTitle").textContent = "四端功能对照单"; $("genBody").innerHTML = html; openSheet("sheetGen");

  }

  function openChangelog() {

    var html = '<div class="changelog-ver"><span class="cv">3.7.5</span><span class="cd">2026-09-07</span></div>' +
      '<ul class="changelog-list">' +
      "<li>与水利 v3.59 / 感知 v1.35 同步：①知识库管理导出 md/txt/html 支持自定义文件名（默认 知识库_YYYYMMDD.md/.txt/.html）+ 自选保存文件夹（Android 原生目录选择落 Download/指定目录；Win/UOS/iOS 回退系统下载目录并提示），共享模块 kbExport 三应用同步，改一处即三端生效；②「写游记」同源新增「写备忘录 / 我的备忘录」（所见即所得编辑器，独立存储 gujian_memos_v1），写游记/写备忘录入口双配置 nmGo 分发 + try/catch 兜底，杜绝「运行错误:script error」；③信息与帮助（功能介绍 / 版本变更 / 四端功能对照单）更新至 3.7.5；④逐导出菜单核查自定义文件夹/文件名 + 各子菜单防 script error 冒烟回归。</li>" +
      '</ul>' +
      '<div class="changelog-ver"><span class="cv">3.7.4</span><span class="cd">2026-09-05</span></div>' +
      '<ul class="changelog-list">' +
      "<li>修复安卓端升级菜单「下载更新包」点击报错：改由系统浏览器/网盘App接管打开。</li>" +
      '</ul>' +
      '<div class="changelog-ver"><span class="cv">3.7.3</span><span class="cd">2026-09-05</span></div>' +
      '<ul class="changelog-list">' +
      "<li>知识库智能化与四平台同步（与水利 v3.55 / 感知 v1.31 同步）：①知识库切片保持语句相对完整（整句打包，绝不在句中断开）+ 保存前先切片再落盘；②RAG 智能检索（混合检索/内容反查条目/智能问答/记忆+Hermes）同步 Win/UOS/iOS PWA；③OCR 外部文档入库同步；④升级备份导出自定义目录/文件名（默认 古建景点打卡备份_YYYYMMDD.bak）+ 导入「请确认这是最新备份，导入会覆盖程序中的全部数据」预检与合并/覆盖双模式；⑤写游记/写备忘录「运行错误:script error」修复；⑥信息与帮助新增「四端功能对照单」，功能介绍/版本变更更新至 3.7.3。</li>" +
      '</ul>';

    html += '<div class="changelog-ver"><span class="cv">3.7</span><span class="cd">2026-09-02</span></div>' +
      '<ul class="changelog-list">' +
      "<li>文档与诊断增强（与水利 v3.49 / 感知 v1.25 同步）：①菜单「帮助」更名为「功能介绍」；②版本变更增补至 v3.7；③新增全平台启动诊断（app 启动即记录版本/构建日期/运行平台，UOS 另写 launch_err.log）；④UOS 保留 no-store 防缓存 + 每次启动写日志；保留古建核心（5 级景区组织 + 17 类古建类型 + 历史关键词可折叠 + 周边搜索 nbtype + AI 文物助手分支）。</li></ul>" +
      '<div class="changelog-ver"><span class="cv">1.8</span><span class="cd">2026-08-24</span></div>' +

      '<ul class="changelog-list">' +

      "<li>优化（卡顿 · 性能）：地图标记弹窗改为「延迟生成」——仅在点开某个古建时拼装弹窗 HTML，不再 render 时给全部 1032 个点预生成，平移/缩放更流畅</li>" +

      "<li>优化（图标缓存）：水滴图标按颜色缓存复用（全国仅约 6 类色），render 不再每个点新建 SVG DivIcon，降低内存与重建耗时</li>" +

      "<li>优化（WebView 渲染）：启用硬件加速图层 + HTTP 缓存复用，地图拖拽与瓦片加载更顺滑（龙芯 3A400 等低配机改善明显）</li>" +

      "<li>未删任何已有功能/菜单；风格色彩字体与 1.7 一致</li></ul>" +

      '<div class="changelog-ver"><span class="cv">1.3</span><span class="cd">2026-08-17</span></div>' +

      '<ul class="changelog-list">' +

      "<li>新增「导出数据(ovkmz/KML)」「导入数据(ovkmz/KML)」：与奥维/水利一张图双向兼容，照片随古建一起导出导入（移植水利一张图 v3.15）</li>" +

      "<li>修复 ovkmz 导入照片按出现顺序盲配、附件数与 KML 引用数不一致时整批照片错位绑到别的古建：改为按 &lt;OvAttaItem&gt; 引用名精确绑定（byRef），全部 miss 才顺序兜底（水利一张图坑#23）</li>" +

      "<li>修复奥维无扩展名附件导入时被静默丢弃：原生 isAttachmentEntry 改用 hasExt 判定，无扩展名的正经附件也纳入（坑#25）</li>" +

      "<li>修复导出照片一律强制 .jpg、丢失原扩展名，导致与奥维/自导出互导时引用对不上：导出保留原扩展名，导入按引用名匹配（坑#26/#27）</li>" +

      "<li>修复导入坐标脏数据（999,888 / 0,0）未校验、全图缩放到大洋中央：parseCoords 过滤越界与 0,0（坑#29）</li>" +

      "<li>修复无坐标古建导出时仍写假 &lt;Point&gt;0,0,0&lt;/Point&gt;，在奥维标到海面：无坐标不再写几何（坑#28）</li>" +

      "<li>修复长导入/导出无「执行中，请稍后」提示、用户误以为卡死：新增 #busyOverlay 等待遮罩并包裹导出/导入（坑#30）</li>" +

      "<li>导出 KML 同时写 &lt;description&gt;（竖线串，奥维可读）与 &lt;ExtendedData&gt;（省份/城市/文物类别/年代/级别/介绍/特点，导回无损）</li>" +

      "<li>未删任何已有功能/菜单；风格色彩字体与 1.2 一致</li></ul>" +

      '<div class="changelog-ver"><span class="cv">1.2</span><span class="cd">2026-08-16</span></div>' +

      '<ul class="changelog-list">' +

      "<li>同步水利一张图 v3.10–v3.14 照片导入健壮性：未匹配照片现可在确认框「选择古建绑定」（不再只能跳过），整包未匹配也能落库</li>" +

      "<li>修复导入后提前清理解压临时目录导致手动绑定失败的致命隐患（cleanInbox 仅在手动匹配全部处理完后执行，坑#22 同源）</li>" +

      "<li>修复确认「假成功计数」：按 linkPhoto 实际返回值计数，落盘失败计入失败</li>" +

      "<li>修复渲染大量高清照片易 OOM：网格/列表缩略图改走原生 thumbPhoto 降采样（≤512 边，坑#18 同源）</li>" +

      "<li>绑定照片按「古建名 #顺序号」归档命名（caption 同步），便于核对来源</li>" +

      "<li>筛选新增「照片状态」：全部 / 有照片 / 多张照片(≥3) / 无照片</li>" +

      "<li>数据管理新增「删除添加的照片」（按时间+省过滤，全选/清除/确认）与「删除古建」（按省过滤，不可逆提示+二次确认）</li>" +

      "<li>未删任何已有功能/菜单；风格色彩字体与 1.1 一致</li></ul>" +

      '<div class="changelog-ver"><span class="cv">1.1</span><span class="cd">2026-08-15</span></div>' +

      '<ul class="changelog-list">' +

      "<li>天地图 Token 改为环境可替换：集中在 index.html 的 window.TIANDITU_TOKENS（浏览器端/服务器端），app.js 不再写死</li>" +

      "<li>菜单智能排序：拍照打卡置为首组，其余分组不变，不删任何功能</li>" +

      "<li>模糊匹配升级为智能匹配：确认弹层默认勾选最匹配项、标注置信度（高匹配/较可能/待确认）与推断范围（省/类别），一键确认</li>" +

      "<li>风格统一：所有颜色由 :root CSS 变量驱动，顶栏/弹层头渐变与遮罩色统一，无写死色值</li>" +

      "<li>查询/筛选保持顶栏最显眼；筛选确认仍 0 提示 / 1 定位 / 多跳首个</li></ul>" +

      '<div class="changelog-ver"><span class="cv">1.0</span><span class="cd">2026-08-15</span></div>' +

      '<ul class="changelog-list">' +

      "<li>新建古建景点打卡 APP：以省/直辖市/自治区 → 城市 → 古建三级管理</li>" +

      "<li>AI 智能检索预置 87 处全国著名古建（覆盖 34 个省级行政区），含名称/介绍/文物特点/位置</li>" +

      "<li>用户可手动添加古建（点地图或填坐标），字段含省/市/类别/年代/级别/介绍/特点</li>" +

      "<li>拍照打卡：照片 + 到达时间 + 游览时长 + 旅游体验；我的打卡路线按时间排列</li>" +

      "<li>两级菜单（查询/筛选置顶）、全页退出、三击任意处呼出主菜单</li>" +

      "<li>智能照片匹配导入、查询/筛选确认跳转（0 提示 / 1 定位 / 多跳首个）</li>" +

      "<li>风格统一（CSS 变量驱动），详见《APP 风格色彩字体搭配》</li></ul>";

    $("genTitle").textContent = "版本变更"; $("genBody").innerHTML = html; openSheet("sheetGen");

  }

  function showAbout() {

    var html = '<div style="text-align:center;padding:14px 0"><div style="font-size:40px">🏯</div>' +

      '<div style="font-size:18px;font-weight:700;color:#6b2e2e;margin-top:6px">古建景点打卡</div>' +

      '<div style="font-size:12px;color:#8a7c70;margin-top:4px">版本 ' + APP_VERSION + " · " + APP_BUILD_DATE + "</div></div>" +

      '<p style="font-size:13px;line-height:1.6;color:#3a2e28">本应用用于记录与打卡全国古建筑/文物景点，支持按省/市检索、地图定位、拍照打卡与路线回顾。离线可用（底图为天地图在线瓦片）。</p>' +

      '<p style="font-size:12px;color:#8a7c70">作者：' + AUTHOR + "</p>";

    $("genTitle").textContent = "关于"; $("genBody").innerHTML = html; openSheet("sheetGen");

  }



  /* ---------- 灯箱 / 长按照片 ---------- */

  window.appLightbox = function (id, i) {

    var b = HERITAGE.find(function (x) { return x.id === id; }); if (!b || !b.photos[i]) return;

    window.__lb = { id: id, i: i };

    $("lbImg").src = photoSrc(b.photos[i]);

    $("lbCap").textContent = (b.photos[i].caption || b.name || "");

    $("lightbox").classList.add("show");

  };

  $("lbX").onclick = function () { $("lightbox").classList.remove("show"); };

  window.appPhotoAct = function (id, i) {

    var b = HERITAGE.find(function (x) { return x.id === id; }); if (!b || !b.photos[i]) return;

    window.__lb = { id: id, i: i }; renderPhotoAct();

  };

  function renderPhotoAct() {

    if (!window.__lb) return;

    var b = HERITAGE.find(function (x) { return x.id === window.__lb.id; }); if (!b) return;

    var p = b.photos[window.__lb.i];

    $("paImg").src = photoSrc(p);

    $("paCap").textContent = (p.caption || b.name || "");

    $("photoAct").classList.add("show");

  }

  function photoActSave() {

    if (!window.__lb) return;

    var b = HERITAGE.find(function (x) { return x.id === window.__lb.id; }); if (!b) return;

    var p = b.photos[window.__lb.i];

    var src = photoSrc(p); if (!src) { toast("无法保存"); return; }

    if (window.Android && typeof window.Android.saveBlob === "function" && src.indexOf("data:") === 0) { window.Android.saveBlob(src, (b.name || "photo") + "_" + window.__lb.i + ".jpg"); toast("已保存图片"); }

    else if (src.indexOf("data:") === 0) { var a = document.createElement("a"); a.href = src; a.download = (b.name || "photo") + ".jpg"; a.click(); toast("已保存图片"); }

    else toast("该图片存于应用私有目录");

  }

  function photoActPrev() { if (!window.__lb) return; var b = HERITAGE.find(function (x) { return x.id === window.__lb.id; }); if (!b) return; window.__lb.i = (window.__lb.i - 1 + b.photos.length) % b.photos.length; renderPhotoAct(); }

  function photoActNext() { if (!window.__lb) return; var b = HERITAGE.find(function (x) { return x.id === window.__lb.id; }); if (!b) return; window.__lb.i = (window.__lb.i + 1) % b.photos.length; renderPhotoAct(); }

  window.photoActSave = photoActSave; window.photoActPrev = photoActPrev; window.photoActNext = photoActNext;

  window.closePhotoAct = function () { $("photoAct").classList.remove("show"); };



  /* ---------- 搜索框实时过滤 ---------- */

  $("search").addEventListener("input", function () { filters.text = this.value.trim(); saveDefaultFilter(); render(); });

  $("search").addEventListener("keydown", function (e) { if (e.key === "Enter") { filters.text = this.value.trim(); render(); applyFilterAndJump(); } });

  $("btnQuery").onclick = function () { filters.text = $("search").value.trim(); render(); applyFilterAndJump(); };

  $("btnFilter").onclick = openFilter;

  $("btnMenu").onclick = function () { if (addMode) { toggleAdd(); return; } if (measureMode) { toggleMeasure(); return; } if (coordPickMode) { coordPickMode = false; map._container.style.cursor = ""; $("btnMenu").textContent = "☰ 菜单"; return; } openSheet("sheetMenu"); };

  // 关闭按钮（含 data-close 的无障碍）

  document.querySelectorAll("[data-close]").forEach(function (x) { x.onclick = function () { closeSheet(x.getAttribute("data-close")); }; });

  // 三击任意处呼出主菜单（弹层内不触发，避免卡页找不到主菜单）

  // T-025 修复：原用 document "click"，地图 canvas 的 click 在部分端被吞/触屏 click 延迟导致 700ms 计数失效，

  // 三击空白常呼不出主菜单；改用 pointerdown（按下即触发，不受地图 pan/click 干扰），并补「菜单已开则不累加」防误计。

  var __tapCount = 0, __tapTimer = null;

  function __resetTap() { __tapCount = 0; }

  function __fireTriple() {

    __resetTap();

    if (addMode) { toggleAdd(); }

    else if (measureMode) { toggleMeasure(); }

    else if (coordPickMode) { coordPickMode = false; map._container.style.cursor = ""; var __bm = $("btnMenu"); if (__bm) __bm.textContent = "☰ 菜单"; }

    openSheet("sheetMenu");

  }

  function __onTap(e) {

    var sm = $("sheetMenu");

    if (sm && sm.classList.contains("show")) { __resetTap(); return; }

    __tapCount++; clearTimeout(__tapTimer);

    __tapTimer = setTimeout(__resetTap, 600);

    if (__tapCount >= 3) { __fireTriple(); }

  }

  document.addEventListener("pointerdown", function (e) {

    if (e.target.closest(".sheet") || e.target.closest(".overlay")) return;

    __onTap(e);

  });

  if (!window.PointerEvent) {

    document.addEventListener("click", function (e) {

      if (e.target.closest(".sheet") || e.target.closest(".overlay")) return;

      __onTap(e);

    });

  }

  // 首次进入提示三击快捷键

  setTimeout(function () { var h = $("tripleHint"); if (h) { h.classList.add("show"); setTimeout(function () { h.classList.remove("show"); }, 4000); } }, 800);



  /* ---------- 智能AI（设置 + 智能助手）初始化 ---------- */

  function initAIModule() {

    if (!window.AIModule) return;

    window.AIModule.init({

      domain: "gujian",

      appName: "古建景点打卡",

      allowOnlineQuery: true,

      fieldSchema: ["province", "city", "type", "dynasty", "level", "intro", "features"],

      getRecord: function (id) { return HERITAGE.find(function (x) { return x.id === id; }); },

      searchRecords: function (q) {

        q = (q || "").trim();

        return HERITAGE.filter(function (b) { return !q || (b.name || "").indexOf(q) >= 0 || (b.city || "").indexOf(q) >= 0 || (b.province || "").indexOf(q) >= 0; });

      },

      listAll: function () { return HERITAGE; },

      applyUpdate: function (rec, patch) {

        ["province", "city", "type", "dynasty", "level", "intro", "features"].forEach(function (k) {

          if (patch[k] != null && String(patch[k]).trim() !== "") rec[k] = patch[k];

        });

        save(); render();

      }

    });

  }



  /* ---------- 启动 ---------- */

  load(); initMap(); initAIModule(); buildMenu(); applyDefaultFilter(); render();

  if (window.CtxMenu) window.CtxMenu.init({ map: map, records: function () { return HERITAGE; }, textFields: ["intro", "features"], getCoordinates: getCoordinates, nearbySearch: nearbySearch });



  // 修复进入页面闪动：布局稳定后刷新地图尺寸并解除 booting 保护

  setTimeout(function () {

    if (map) { try { map.invalidateSize(); } catch (e) {} }

    _mapBooting = false; render();

  }, 300);



  /* ============================ v3.2 古建智能化升级补丁 ============================

     - 快捷常用 ⭐（菜单组 + 顶部分级按钮）

     - 历史关键词切换（filter 面板）

     - 周边搜索 nbtype chip（B4 古建版）

     - 古建 5 级组织（景区→园区→子景点→打卡位→标签）

     - ZIP 三级匹配（古建版：spot→area→sub→point→tag）

     - 星标 vs 点击隔离（B5）

     - AI 系统提示词（古建文物助手，联网核实公开文物）

  ============================================================================== */



  // ---------- 古建专属系统提示词补丁（ai_module.js 已支持古建 placeholder，这里补强 system prompt） ----------

  function _v32_gujianSysPrompt() {

    try {

      if (!window.AIModule || !window.AIModule.config || !window.AIModule.config.appName) return;

      if (window.AIModule.config.appName.indexOf("古建") < 0) return;

      // 注入古建专属系统提示词：联网核实公开文物，但内部参数不编造

      var GU = window.__gujian_ai_extra || (window.__gujian_ai_extra = {});

      GU.onlineSystemPrompt =

        "你是文物/古建知识助手。用户会提供某处古建的名称与现有资料，并可能要求联网核实公开信息。" +

        "回答时优先引用权威来源（文物局/省级文物局/UNESCO/世界遗产委员会官网）；" +

        "若用户提供的数据与公开资料冲突，请明确标注差异，不可妄断。" +

        "结构建议：①年代/级别 ②主要建筑特征 ③历史沿革 ④参考资料。";

      GU.localSystemPrompt =

        "你是古建景点的本地数据助手。用户提供的古建资料为内部/本地数据，公开大模型无准确数据，" +

        "严禁编造或臆测任何朝代/级别/坐标/尺寸。对外只可补充：通俗介绍、参观建议、相似对比。" +

        "若用户明确要求联网核实，可提示用户开启「🌐 联网在线查询」后重试。";

    } catch (e) {}

  }



  // ---------- 古建 5 级组织（景区层级） ----------

  var G_ORG_LEVELS = [

    { k: "spot",  t: "景区",   v: [] },   // 颐和园、故宫、敦煌莫高窟

    { k: "area",  t: "园区",   v: [] },   // 颐和园-佛香阁景区、故宫-外朝

    { k: "sub",   t: "子景点", v: [] },   // 佛香阁、仁寿殿、万寿山

    { k: "point", t: "打卡位", v: [] },   // 主入口、山顶、碑亭

    { k: "tag",   t: "标签",   v: [] }    // UNESCO、5A、皇家园林、世界遗产

  ];

  var G_ORG_DEFAULT_NAMES = { spot: "全国", area: "默认园区", sub: "默认子景点" };

  function _v32_gOrgDefaults() {

    try {

      var d = JSON.parse(localStorage.getItem("gujian_org_defaults") || "{}");

      return {

        spot:  d.spot  || G_ORG_DEFAULT_NAMES.spot,

        area:  d.area  || G_ORG_DEFAULT_NAMES.area,

        sub:   d.sub   || "",

        point: d.point || "",

        tag:   d.tag   || "",

        offices: Array.isArray(d.offices) && d.offices.length ? d.offices : []

      };

    } catch (e) { return { spot: G_ORG_DEFAULT_NAMES.spot, area: G_ORG_DEFAULT_NAMES.area, sub: "", point: "", tag: "", offices: [] }; }

  }

  function _v32_bs(b, k) {

    if (!b) return _v32_gOrgDefaults()[k] || "";

    if (k === "spot")  return b.spot  || _v32_gOrgDefaults().spot  || "";

    if (k === "area")  return b.area  || _v32_gOrgDefaults().area  || "";

    if (k === "sub")   return b.sub   || _v32_gOrgDefaults().sub   || "";

    if (k === "point") return b.point || _v32_gOrgDefaults().point || "";

    if (k === "tag")   return Array.isArray(b.tags) ? b.tags.join("、") : (b.tag || _v32_gOrgDefaults().tag || "");

    return "";

  }

  function _v32_bZ(b)  { return _v32_bs(b, "sub");   }

  function _v32_bD(b)  { return _v32_bs(b, "point"); }

  function _v32_bSpot(b)  { return _v32_bs(b, "spot");  }

  function _v32_bArea(b)  { return _v32_bs(b, "area");  }



  // ---------- 古建专属 CANNONICAL_TYPES（17 类古建） ----------

  var G_CANONICAL_TYPES = "古塔、寺庙、城墙、古桥、园林、陵墓、书院、会馆、故居、古街、楼阁、亭台、坛庙、宫殿、石窟、衙署、其他".split("、");



  // ---------- ZIP 三级匹配古建版（spot→area→sub→point→tag） ----------

  function _v32_matchOrgInToken(token, levels) {

    if (!token) return null;

    var t = String(token).toLowerCase();

    var defs = _v32_gOrgDefaults();

    for (var i = 0; i < (levels || G_ORG_LEVELS.map(function(x){return x.k;})).length; i++) {

      var k = levels[i];

      var arr = [];

      if (k === "spot")  arr = [defs.spot].concat((defs.spot||"").split(/[、,，]/));

      if (k === "area")  arr = [defs.area].concat((defs.area||"").split(/[、,，]/));

      if (k === "sub")   arr = [defs.sub].concat((defs.sub||"").split(/[、,，]/));

      if (k === "point") arr = [defs.point].concat((defs.point||"").split(/[、,，]/));

      if (k === "tag")   arr = (defs.tag||"").split(/[、,，]/);

      for (var j = 0; j < arr.length; j++) {

        var v = String(arr[j] || "").trim();

        if (!v) continue;

        if (t.indexOf(v.toLowerCase()) >= 0) {

          // 返回 {level, value, parentLevel}

          var idx = G_ORG_LEVELS.findIndex(function(x){ return x.k === k; });

          var parent = idx < G_ORG_LEVELS.length - 1 ? G_ORG_LEVELS[idx + 1].k : null;

          return { level: k, value: v, parentLevel: parent };

        }

      }

    }

    return null;

  }

  function _v32_itemOrgScope(it) {

    // 古建：先用照片 zipName/fname 命中 spot→area→sub→point→tag

    // 链式下钻：命中 spot 后，下一匹配应从 area 开始

    if (!it) return null;

    var z = it._zip || it.zipInfo || {};

    var scope = null;

    // 1) zipName 命中（第一匹配级别即锁定）

    if (z.zipName) {

      scope = _v32_matchOrgInToken(z.zipName, G_ORG_LEVELS.map(function(x){return x.k;}));

      if (scope) return scope;

    }

    // 2) fname 命中

    if (z.fname) {

      scope = _v32_matchOrgInToken(z.fname, G_ORG_LEVELS.map(function(x){return x.k;}));

      if (scope) return scope;

    }

    // 3) folder 拆 / 逐段匹配

    if (z.folder) {

      var parts = String(z.folder).split(/[\/\\\\]/).filter(Boolean);

      var startLevels = G_ORG_LEVELS.map(function(x){return x.k;});

      for (var pi = 0; pi < parts.length; pi++) {

        var r = _v32_matchOrgInToken(parts[pi], startLevels);

        if (r) { scope = r; break; }

      }

      if (scope) return scope;

    }

    return null;

  }



  // ---------- 历史关键词 + 快捷常用 持久化 ----------

  var G_KW_HIST_KEY = "gujian_query_history_v32";

  function _v32_kwHistGet() {

    try { return JSON.parse(localStorage.getItem(G_KW_HIST_KEY) || "[]"); } catch (e) { return []; }

  }

  function _v32_kwHistPush(q) {

    q = (q || "").trim();

    if (!q) return;

    var arr = _v32_kwHistGet();

    arr = arr.filter(function (x) { return x !== q; });

    arr.unshift(q);

    if (arr.length > 20) arr = arr.slice(0, 20);

    try { localStorage.setItem(G_KW_HIST_KEY, JSON.stringify(arr)); } catch (e) {}

  }

  function _v32_kwHistClear() {

    try { localStorage.removeItem(G_KW_HIST_KEY); } catch (e) {}

  }

  window._v32_kwHistGet = _v32_kwHistGet;

  window._v32_kwHistPush = _v32_kwHistPush;

  window._v32_kwHistClear = _v32_kwHistClear;



  var G_FAV_KEY = "gujian_favorites_v32";

  function _v32_favGet() {

    try { return JSON.parse(localStorage.getItem(G_FAV_KEY) || "[]"); } catch (e) { return []; }

  }

  function _v32_favToggle(id) {

    var arr = _v32_favGet();

    if (arr.indexOf(id) >= 0) arr = arr.filter(function (x) { return x !== id; });

    else arr.push(id);

    try { localStorage.setItem(G_FAV_KEY, JSON.stringify(arr)); } catch (e) {}

    return arr.indexOf(id) >= 0;

  }

  function _v32_favHas(id) { return _v32_favGet().indexOf(id) >= 0; }

  window._v32_favGet = _v32_favGet;

  window._v32_favToggle = _v32_favToggle;

  window._v32_favHas = _v32_favHas;



  // ---------- 切换历史关键词面板（封装，避免和 shuili 同名冲突，B1） ----------

  window.toggleKwHist_v32 = function () {

    var box = $("kwHistBox_v32");

    var toggle = $("kwHistToggle_v32");

    if (!box) return;

    var list = _v32_kwHistGet();

    if (!list.length) { box.innerHTML = '<div style="font-size:12px;color:#aaa;padding:6px 0">暂无历史关键词</div>'; }

    else {

      var html = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">';

      list.forEach(function (q) {

        html += '<span class="chip kwHist_v32" data-q="' + esc(q) + '" style="cursor:pointer">' + esc(q) + "</span>";

      });

      html += '<span class="chip" onclick="_v32_kwHistClear();buildFilter_v32();toast(\\\"已清空历史关键词\\\")" style="background:#f6e6e6;color:#a55">清空</span>';

      html += "</div>";

      box.innerHTML = html;

      box.querySelectorAll(".kwHist_v32").forEach(function (el) {

        el.onclick = function () {

          var q = el.getAttribute("data-q") || "";

          var s = $("qInput") || $("search");

          if (s) { s.value = q; s.focus(); }

          try { if (typeof doSearch === "function") doSearch(); else if (typeof runSearch === "function") runSearch(); } catch (e) {}

        };

      });

    }

    var show = box.style.display !== "none";

    box.style.display = show ? "none" : "block";

    if (toggle) toggle.textContent = show ? "▸" : "▾";

  };



  // ---------- 古建 filter 面板（B1+B2 patch：历史关键词 + 5 级组织 UI） ----------

  //   注入到 openFilter() 内部的 HTML 渲染路径

  function _v32_renderOrgSection() {

    var def = _v32_gOrgDefaults();

    var html = "";

    html += '<div class="filter-sec"><h4 style="cursor:pointer;user-select:none" onclick="toggleKwHist_v32()">🔖 历史关键词 <span id="kwHistToggle_v32">▸</span></h4><div id="kwHistBox_v32" style="display:none"></div></div>';

    // 5 级组织 UI（默认景区/园区/子景点/打卡位/标签）

    html += '<div class="filter-sec"><h4>🗺️ 5 级组织（古建专属）</h4>';
    html += '<div style="font-size:12px;color:#8a7c70;margin:-2px 0 8px">新增古建时预填的默认层级（景区→园区→子景点→打卡位→标签），便于你自己的打卡归类；它不是地图筛选条件。</div>';

    html += '<label class="f">默认景区</label><input class="f" id="orgDef_spot"  value="' + esc(def.spot)  + '" placeholder="如：颐和园 / 故宫">';

    html += '<label class="f">默认园区</label><input class="f" id="orgDef_area"  value="' + esc(def.area)  + '" placeholder="如：佛香阁景区 / 外朝">';

    html += '<label class="f">默认子景点（可空）</label><input class="f" id="orgDef_sub"   value="' + esc(def.sub)   + '" placeholder="可空，如：佛香阁">';

    html += '<label class="f">默认打卡位（可空）</label><input class="f" id="orgDef_point" value="' + esc(def.point) + '" placeholder="可空，如：主入口">';

    html += '<label class="f">默认标签（逗号分隔）</label><input class="f" id="orgDef_tag"   value="' + esc(def.tag)   + '" placeholder="UNESCO,5A,皇家园林">';

    html += '<button class="btn-save" onclick="_v32_saveOrgDefaults()">保存默认组织</button>';

    html += "</div>";

    // 17 类古建类型 chip

    html += '<div class="filter-sec"><h4>🏯 古建类型筛选</h4><div style="display:flex;flex-wrap:wrap;gap:6px">';

    G_CANONICAL_TYPES.forEach(function (t) {

      html += '<span class="chip gtype' + (filters.types.has(t) ? " on" : "") + '" data-k="type" data-v="' + esc(t) + '" style="cursor:pointer">' + esc(t) + "</span>";

    });

    html += "</div></div>";

    return html;

  }

  window._v32_renderOrgSection = _v32_renderOrgSection;



  function _v32_saveOrgDefaults() {

    var d = {

      spot:  ($("orgDef_spot")  || {}).value || "",

      area:  ($("orgDef_area")  || {}).value || "",

      sub:   ($("orgDef_sub")   || {}).value || "",

      point: ($("orgDef_point") || {}).value || "",

      tag:   ($("orgDef_tag")   || {}).value || ""

    };

    try { localStorage.setItem("gujian_org_defaults", JSON.stringify(d)); } catch (e) {}

    toast("已保存默认组织：景区「" + (d.spot || "(空)") + "」园区「" + (d.area || "(空)") + "」子景点「" + (d.sub || "(空)") + "」打卡位「" + (d.point || "(空)") + "」标签「" + (d.tag || "(空)") + "」");

  }

  window._v32_saveOrgDefaults = _v32_saveOrgDefaults;



  // ---------- B4 古建版：周边搜索 nbtype chip ----------

  //   注入到 openGen 里；并 patch nearbySearch 函数

  var _v32_nbActiveTypes = [];

  window._v32_nbGetActive = function () { return _v32_nbActiveTypes.slice(); };

  window._v32_nbSet = function (types) { _v32_nbActiveTypes = types || []; };

  function _v32_nbTypeHtml() {

    var html = '<div style="margin:6px 0;display:flex;flex-wrap:wrap;gap:6px">';

    G_CANONICAL_TYPES.forEach(function (t) {

      html += '<span class="chip nbtype_v32 ntype" data-t="' + esc(t) + '" style="cursor:pointer;user-select:none">' + esc(t) + "</span>";

    });

    html += "</div>";

    return html;

  }

  window._v32_nbTypeHtml = _v32_nbTypeHtml;



  // ---------- 包装 nearbySearch（B4 古建版：nbtype chip 可点击） ----------

  if (typeof window.nearbySearch === "function" && !window._v32_patchedNearby) {

    var _v32_origNearby = window.nearbySearch;

    window.nearbySearch = function () {

      // 先确保 nbtype chip 渲染并绑定

      _v32_nbSet([]);

      var r = _v32_origNearby.apply(this, arguments);

      // 注入 nbtype chip 到 genBody（如果有）

      setTimeout(function () {

        var gb = $("genBody");

        if (!gb) return;

        if (gb.querySelector(".nbtype_v32")) return;

        var sec = document.createElement("div");

        sec.className = "filter-sec";

        sec.innerHTML = "<h4>🏯 周边古建类型筛选</h4>" + _v32_nbTypeHtml();

        // 插到 genBody 的第一个 filter-sec 之前

        var firstSec = gb.querySelector(".filter-sec");

        if (firstSec && firstSec.parentNode === gb) gb.insertBefore(sec, firstSec);

        else gb.appendChild(sec);

        gb.querySelectorAll(".nbtype_v32").forEach(function (chip) {

          chip.onclick = function (ev) {

            ev.stopPropagation(); ev.preventDefault();

            var t = chip.getAttribute("data-t");

            var arr = _v32_nbActiveTypes.slice();

            var idx = arr.indexOf(t);

            if (idx >= 0) { arr.splice(idx, 1); chip.classList.remove("on"); }

            else { arr.push(t); chip.classList.add("on"); }

            _v32_nbSet(arr);

            toast("周边类型：" + (arr.length ? arr.join("、") : "全部"));

          };

        });

      }, 50);

      return r;

    };

    window._v32_patchedNearby = true;

  }



  /* ============================ v3.3 古建智能化升级补丁 ============================

     1) 设置菜单加「🗝️ 修改/添加天地图密钥」（古建/感知共用天地图底图，与水利同款）；

     2) 古建版 longest-match zip 三级匹配（古建核心：景区名→园区→子景点→打卡位→标签）；

     3) 古建版本号 BUMP 至 3.3，对齐水利 v3.45 / 感知 v1.21。 */

  function _v33_gujianUpgrade() {

    // 1) 设置菜单注入 tdtKey 入口

    if (typeof buildMenu === "function") {

      var origBuildMenu = buildMenu;

      window.buildMenu = function () {

        origBuildMenu();

        try {

          var body = document.getElementById("menuBody");

          if (!body) return;

          // 找到「设置」分组并在其下注入「修改/添加天地图密钥」

          var groups = body.querySelectorAll(".menu-group");

          for (var i = 0; i < groups.length; i++) {

            var head = groups[i].querySelector(".menu-group-head");

            if (head && head.textContent.indexOf("设置") >= 0) {

              var bodyDiv = groups[i].querySelector(".menu-group-body");

              if (bodyDiv && !bodyDiv.querySelector("[data-v33-tdtkey]")) {

                var item = document.createElement("div");

                item.className = "menu-item sub";

                item.setAttribute("data-v33-tdtkey", "1");

                item.innerHTML = '<span class="menu-ico">🗝️</span><span>修改/添加天地图密钥</span>';

                item.onclick = function () { closeSheet("sheetMenu"); openTdtKeySettingsGujian(); };

                // 插到「快捷常用设置」之后

                var favSetItem = bodyDiv.querySelector("[data-k='favSet']");

                if (favSetItem && favSetItem.parentNode === bodyDiv) {

                  bodyDiv.insertBefore(item, favSetItem.nextSibling);

                } else {

                  bodyDiv.appendChild(item);

                }

              }

              break;

            }

          }

        } catch (e) { console.warn("v33 tdtkey menu inject:", e); }

      };

      // 立即重画一次菜单

      try { window.buildMenu(); } catch (e) {}

    }



    // 2) 古建版 zip 长匹配覆盖（如果全局 matchOrgInToken 已存在则强化；否则定义一个）

    if (typeof window.matchOrgInTokenV33 !== "function") {

      window.matchOrgInTokenV33 = function (token, levels) {

        if (!token) return null;

        var lv = window.__gujian_org || (window.__gujian_org = (function () {

          try {

            var raw = JSON.parse(localStorage.getItem("gujian_org_levels") || "null") || {};

            var def = { spot: ["颐和园", "故宫", "天坛", "八达岭长城", "圆明园", "北海", "景山公园"], area: [], sub: [], point: [], tag: [] };

            (window.SCENERY || []).forEach(function (b) {

              if (b.area) def.area.push(b.area);

              if (b.sub) def.sub.push(b.sub);

              if (b.point) def.point.push(b.point);

              if (b.tag) def.tag.push(b.tag);

            });

            ["area", "sub", "point", "tag"].forEach(function (k) { def[k] = uniq(def[k]); });

            for (var kk in raw) if (raw[kk] && raw[kk].length) def[kk] = uniq(def[kk].concat(raw[kk]));

            return def;

          } catch (e) { return { spot: [], area: [], sub: [], point: [], tag: [] }; }

        })());

        var levels = levels || ["spot", "area", "sub", "point", "tag"];

        var labels = { spot: "景区", area: "园区", sub: "子景点", point: "打卡位", tag: "标签" };

        var best = null;

        for (var li = 0; li < levels.length; li++) {

          var k = levels[li];

          var arr = (lv[k] || []).slice();

          arr.sort(function (a, b) { return b.length - a.length; });

          for (var i = 0; i < arr.length; i++) {

            var v = arr[i];

            if (v && token.indexOf(v) >= 0) {

              if (!best || v.length > best.hitLen) {

                best = { level: k, value: v, parentLevel: levels[li + 1] || null, label: labels[k], hitLen: v.length };

              }

              break;

            }

          }

        }

        return best;

      };

    }



    // 3) v3.3 + v3.46 古建版 tdtKey 设置面板（在 sheetGen 容器中打开）

    //    v3.46：当前密钥默认隐藏（type=password），👁 切换显示；复制需输密码 3305（防他人窃取）

    var TDT_PASSWORD = "3305";  // 复制/查看密钥的二次验证密码（4 位数字口令）

    function askPwd(title, cb) {

      var box = document.getElementById("askBox"); if (!box) { cb(""); return; }

      var t = box.querySelector(".ask-title"); if (t) t.textContent = title || "请输入密码";

      var m = box.querySelector(".ask-msg"); if (m) m.innerHTML = '<input id="askPwdInp" type="password" maxlength="20" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;font-size:16px;letter-spacing:4px;text-align:center" autofocus>';

      var btns = box.querySelector(".ask-btns"); if (btns) {

        btns.innerHTML = "";

        var ok = document.createElement("button"); ok.textContent = "确定"; ok.className = "btn-confirm2";

        ok.onclick = function () { var v = (document.getElementById("askPwdInp") || {}).value || ""; if (typeof closeAsk === "function") closeAsk(); cb(v); };

        var cancel = document.createElement("button"); cancel.textContent = "取消"; cancel.className = "btn-cancel2";

        cancel.onclick = function () { if (typeof closeAsk === "function") closeAsk(); cb(""); };

        btns.appendChild(ok); btns.appendChild(cancel);

      }

      box.classList.add("show");

      setTimeout(function () { var i = document.getElementById("askPwdInp"); if (i) i.focus(); }, 100);

    }

    window.askPwd = askPwd;

    window.openTdtKeySettingsGujian = function () {

      var cur = loadToken();

      var isDefault = (cur === TOKEN_BROWSER_DEFAULT);

      var html =

        '<p style="font-size:13px;color:#555;margin-bottom:8px">天地图（<code>tianditu.gov.cn</code>）瓦片密钥用于加载矢量/影像底图。密钥可能被服务器风控或到期失效，自换后下次打开底图即可生效。</p>' +

        '<label class="f" style="font-size:13px;color:#555">当前密钥（隐藏显示，复制需输密码）</label>' +

        '<div style="display:flex;gap:6px;align-items:center">' +

          '<input class="f" id="tdtCurVal" type="password" readonly value="' + (String(cur).replace(/"/g, "&quot;")) + '" style="flex:1;font-family:monospace;font-size:12px">' +

          '<button class="tbtn" id="tdtToggleEye" onclick="tdtToggleVisibleGujian()" title="显示/隐藏当前密钥">👁</button>' +

          '<button class="tbtn" onclick="tdtPasteCurGujian()" title="复制（需输密码 3305）">📋 复制</button>' +

        '</div>' +

        '<div style="font-size:12px;color:#888;margin:6px 0">' + (isDefault ? "⚠️ 当前为内置默认密钥" : "✅ 当前为用户自配密钥") + '</div>' +

        '<label class="f" style="font-size:13px;color:#555">新密钥（32 位十六进制，留空则恢复内置默认）</label>' +

        '<input class="f" id="tdtNewVal" placeholder="32位十六进制密钥（如 a1b2c3…，留空则恢复内置默认）" style="font-family:monospace;font-size:13px">' +

        '<div class="form-actions">' +

        '<button class="btn-cancel" onclick="tdtResetGujian()">恢复内置默认</button>' +

        '<button class="btn-save" onclick="tdtSaveGujian()">保存并立即应用</button>' +

        '</div>';

      var title = document.getElementById("genTitle");

      var body = document.getElementById("genBody");

      if (title) title.textContent = "修改/添加天地图密钥";

      if (body) body.innerHTML = html;

      if (typeof openSheet === "function") openSheet("sheetGen");

    };

    // v3.46：显示/隐藏当前密钥（显示需输密码 3305，30 秒后自动隐藏）

    window.tdtToggleVisibleGujian = function () {

      var inp = document.getElementById("tdtCurVal"); var btn = document.getElementById("tdtToggleEye"); if (!inp) return;

      if (inp.type === "password") {

        askPwd("👁 显示密钥（需输密码）", function (pw) {

          if (pw !== TDT_PASSWORD) { try { toast("密码错误"); } catch (e) {} return; }

          inp.type = "text"; if (btn) btn.textContent = "🙈";

          try { toast("已显示（30 秒后自动隐藏）"); } catch (e) {}

          setTimeout(function () { if (inp && inp.type === "text") { inp.type = "password"; if (btn) btn.textContent = "👁"; try { toast("已自动隐藏"); } catch (e) {} } }, 30000);

        });

      } else { inp.type = "password"; if (btn) btn.textContent = "👁"; try { toast("已隐藏"); } catch (e) {} }

    };

    window.tdtPasteCurGujian = function () {

      var inp = document.getElementById("tdtCurVal"); if (!inp) return;

      var v = inp.value;

      askPwd("📋 复制需输密码（防窃取）", function (pw) {

        if (pw !== TDT_PASSWORD) { try { toast("密码错误"); } catch (e) {} return; }

        try {

          if (navigator.clipboard && navigator.clipboard.writeText) {

            navigator.clipboard.writeText(v).then(function () { toast("已复制"); }, function () { toast("剪贴板不可用"); });

          } else { toast("当前环境不支持剪贴板 API"); }

        } catch (e) { try { toast("复制失败"); } catch (e2) {} }

      });

    };

    window.tdtSaveGujian = function () {

      var raw = (document.getElementById("tdtNewVal").value || "").trim();

      if (!raw) { if (typeof ask === "function") { ask("未填写新密钥", "确定保存空值吗？这将恢复为内置默认密钥。", [{ t: "确定恢复", cls: "btn-confirm2", v: 1 }, { t: "取消", cls: "btn-cancel2", v: 0 }], function (ok) { if (ok) { TOKEN = TOKEN_BROWSER_DEFAULT; clearToken(); refreshTdtTileLayer(); toast("已恢复内置默认密钥"); openTdtKeySettingsGujian(); } }); } return; }

      if (!/^[a-fA-F0-9]{32}$/.test(raw)) { if (typeof ask === "function") { ask("密钥格式校验", "天地图浏览器端密钥为 32 位十六进制字符。当前长度为 " + raw.length + "。\n仍要保存吗？", [{ t: "仍要保存", cls: "btn-confirm2", v: 1 }, { t: "取消", cls: "btn-cancel2", v: 0 }], function (ok) { if (ok) { saveToken(raw); TOKEN = raw; refreshTdtTileLayer(); toast("已保存新密钥，正在切换图层"); openTdtKeySettingsGujian(); } }); } return; }

      saveToken(raw); TOKEN = raw; refreshTdtTileLayer(); toast("已保存新密钥，正在切换图层"); openTdtKeySettingsGujian();

    };

    window.tdtResetGujian = function () { clearToken(); TOKEN = TOKEN_BROWSER_DEFAULT; refreshTdtTileLayer(); toast("已恢复内置默认密钥"); openTdtKeySettingsGujian(); };

  }

  _v33_gujianUpgrade();



  // ---------- 启动 ----------

  _v32_gujianSysPrompt();

  



  /* ---------- v3.48 长按子菜单→快捷常用 ---------- */

  (function () {

    if (window.__favLongPressInstalled) return;

    window.__favLongPressInstalled = true;

    var PRESS_MS = 600, suppressMouseUntil = 0;

    function favToggle(k) {

      if (typeof toggleFavMenu === "function") { toggleFavMenu(k); return true; }

      if (typeof _v32_favToggle === "function") { _v32_favToggle(k); return true; }

      return false;

    }

    function favIsOn(k) {

      try {

        if (typeof _v32_favHas === "function") return _v32_favHas(k);

        return (JSON.parse(localStorage.getItem("favMenus") || "[]")).indexOf(k) >= 0;

      } catch (e) { return false; }

    }

    function bind(el) {

      if (el.__favLP || !el.querySelector) return;

      el.__favLP = true;

      var star = el.querySelector(".menu-fav");

      if (!star || !star.dataset || !star.dataset.k) return;

      var k = star.dataset.k;

      var timer = null, fired = false;

      function fire() {

        fired = true;

        favToggle(k);

        var on = favIsOn(k);

        var s = el.querySelector(".menu-fav");

        if (s) { s.textContent = on ? "\u2605" : "\u2606"; s.style.color = on ? "#f0a020" : "#c8cdd2"; }

        el.style.background = "rgba(240,160,32,.18)";

        setTimeout(function () { try { el.style.background = ""; } catch (e) {} }, 500);

        try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}

        var label = String(el.textContent || "").replace(/[\u2605\u2606]/g, "").trim();

        try { toast(on ? "\u5df2\u52a0\u5165\u5feb\u6377\u5e38\u7528\uff1a" + label : "\u5df2\u79fb\u51fa\u5feb\u6377\u5e38\u7528\uff1a" + label); } catch (e) {}

      }

      function begin() { fired = false; if (timer) clearTimeout(timer); timer = setTimeout(function () { timer = null; fire(); }, PRESS_MS); }

      function cancel() { if (timer) { clearTimeout(timer); timer = null; } }

      el.addEventListener("touchstart", function () { suppressMouseUntil = Date.now() + 2000; begin(); }, { passive: true });

      el.addEventListener("touchend", cancel);

      el.addEventListener("touchmove", cancel);

      el.addEventListener("touchcancel", cancel);

      el.addEventListener("mousedown", function () { if (Date.now() < suppressMouseUntil) return; begin(); });

      el.addEventListener("mouseup", cancel);

      el.addEventListener("mouseleave", cancel);

      /* 长按触发后吞掉随后的 click，避免「加收藏」同时把菜单打开了 */

      el.addEventListener("click", function (ev) {

        if (fired) { fired = false; ev.stopPropagation(); ev.preventDefault(); }

      }, true);

    }

    function bindAll() {

      var mb = document.getElementById("menuBody");

      if (!mb) return;

      var items = mb.querySelectorAll(".menu-item.sub");

      for (var i = 0; i < items.length; i++) { try { bind(items[i]); } catch (e) {} }

    }

    function start() {

      var mb = document.getElementById("menuBody");

      if (!mb) { setTimeout(start, 300); return; }

      if (typeof MutationObserver !== "undefined") {

        try { new MutationObserver(function () { bindAll(); }).observe(mb, { childList: true, subtree: true }); }

        catch (e) { setInterval(bindAll, 800); }

      } else {

        setInterval(bindAll, 800);

      }

      bindAll();

    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);

    else start();

  })();



})();


/* ============================================================================
 * 游记 / 备忘录 模块（所见即所得编辑器 + 关键字筛选 + 智能AI查询 + 导入导出）
 * 三端四平台共享同一份函数，仅通过 nmInstall(cfg) 适配：
 *   cfg = {
 *     kind:      "游记" | "备忘录",
 *     docNoun:   "古建" | "建筑物" | "感知设备",
 *     appName:   "古建景点打卡" | "水利感知平台" | "水利一张图",
 *     lsKey:     "gujian_notes_v1" 等（localStorage 键）,
 *     fileTag:   "gujian" | "perc" | "shuili"（导出文件名用，纯 ASCII）,
 *     bindLabel: "绑定古建" | "绑定建筑物" | "绑定感知设备",
 *     recs:      function(){ return HERITAGE | BUILDINGS; },
 *     recName:   function(r){ return 显示名; }
 *   }
 * 依赖宿主全局：$ / esc / toast / save / compressDataUrlIfBig / appFly / window.AIModule.ask
 * ========================================================================== */
var nmCfg = null;
function nmInstall(cfg) { nmCfg = cfg; }
var nmEditId = null;

/* ---------- 存储 ---------- */
function nmGetAll() { try { return JSON.parse(localStorage.getItem(nmCfg.lsKey) || "[]"); } catch (e) { return []; } }
function nmPersist(arr) { try { localStorage.setItem(nmCfg.lsKey, JSON.stringify(arr)); return true; } catch (e) { try { toast("保存失败：本地存储可能已满"); } catch (_) {} return false; } }
function nmById(id) { return nmGetAll().find(function (n) { return n.id === id; }); }
function nmNow() { return new Date().toLocaleString("zh-CN"); }
function nmStripHtml(html) { var d = document.createElement("div"); d.innerHTML = html || ""; return (d.textContent || "").replace(/\s+/g, " ").trim(); }
function nmFly(id) { try { if (id && window.appFly) window.appFly(id); else if (id && typeof appFly === "function") appFly(id); } catch (e) {} }

/* ---------- 编辑器样式（注入一次）---------- */
function nmEnsureStyle() {
  if (document.getElementById("nmStyle")) return;
  var s = document.createElement("style"); s.id = "nmStyle";
  s.textContent = [
    ".nm-mask{position:fixed;inset:0;background:rgba(40,30,20,.45);z-index:9999;display:flex;align-items:flex-end;justify-content:center}",
    ".nm-sheet{width:100%;max-width:680px;background:#fff;max-height:94vh;display:flex;flex-direction:column;border-radius:16px 16px 0 0;box-shadow:0 -6px 30px rgba(0,0,0,.25)}",
    ".nm-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #eee;font-weight:700;color:#6b2e2e}",
    ".nm-head .nm-title{flex:1;font-size:16px}",
    ".nm-body{padding:12px 14px;overflow:auto;flex:1}",
    ".nm-row{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center}",
    ".nm-row label{font-size:12px;color:#8a7c70}",
    ".nm-f{flex:1;min-width:120px;padding:8px 10px;border:1px solid #e4dccf;border-radius:8px;font-size:14px;background:#fffdf9}",
    ".nm-toolbar{display:flex;flex-wrap:wrap;gap:4px;padding:8px 10px;background:#faf6ef;border-bottom:1px solid #eee;align-items:center}",
    ".nm-tb{height:32px;min-width:32px;padding:0 8px;border:1px solid #e4dccf;background:#fff;border-radius:7px;cursor:pointer;font-size:13px}",
    ".nm-tb:hover{background:#fff3da}",
    ".nm-edit{min-height:200px;max-height:38vh;overflow:auto;border:1px solid #e4dccf;border-radius:10px;padding:10px;font-size:14px;line-height:1.7;background:#fffdf9;outline:none}",
    ".nm-edit:empty:before{content:attr(data-ph);color:#b9ad9c}",
    ".nm-edit img{max-width:100%;border-radius:8px;margin:4px 0}",
    ".nm-edit table{border-collapse:collapse;width:100%;margin:6px 0}",
    ".nm-edit td,.nm-edit th{border:1px solid #d8cdb8;padding:6px 8px;font-size:13px}",
    ".nm-actions{display:flex;gap:8px;padding:10px 14px;border-top:1px solid #eee}",
    ".nm-btn{flex:1;padding:10px;border:none;border-radius:10px;font-size:14px;cursor:pointer;font-weight:600}",
    ".nm-save{background:#b8862f;color:#fff}",
    ".nm-ghost{background:#efe7d8;color:#6b2e2e}",
    ".nm-list-item{border:1px solid #eee;border-radius:10px;padding:10px;margin-bottom:8px;background:#fffdf9}",
    ".nm-list-item .t{font-weight:700;color:#3a2e28}",
    ".nm-list-item .m{font-size:12px;color:#8a7c70;margin:2px 0}",
    ".nm-list-item .s{font-size:13px;color:#5a4d40;margin:4px 0}",
    ".nm-chips{display:flex;gap:6px;flex-wrap:wrap}",
    ".nm-search{flex:1;min-width:140px;padding:8px 10px;border:1px solid #e4dccf;border-radius:8px;font-size:14px}",
    ".nm-emoji-pop{position:absolute;background:#fff;border:1px solid #e4dccf;border-radius:10px;padding:6px;display:flex;flex-wrap:wrap;gap:4px;max-width:240px;z-index:10001;box-shadow:0 4px 16px rgba(0,0,0,.18)}",
    ".nm-emoji-pop span{cursor:pointer;font-size:20px;padding:2px 4px}",
    ".nm-out{margin-top:10px;font-size:13px;line-height:1.7;color:#3a2e28;white-space:pre-wrap;background:#fff7e6;border:1px solid #ffe7a3;border-radius:10px;padding:10px}",
    ".nm-empty{color:#8a7c70;font-size:13px;text-align:center;padding:20px}"
  ].join("\n");
  document.head.appendChild(s);
}

/* ---------- caret 插入辅助 ---------- */
function nmInsertHtml(html) { try { document.execCommand("insertHTML", false, html); } catch (e) {} }
function nmExec(cmd, val) { try { document.execCommand(cmd, false, val || null); } catch (e) {} }

/* ---------- 从编辑器当前字段构造一条记录（用于导出/未保存态）---------- */
function nmCurrentNote() {
  var ed = document.getElementById("nmEdit");
  var bindSel = document.getElementById("nmBind");
  var bindId = bindSel ? bindSel.value : "";
  var recs = nmCfg.recs() || []; var bindName = "";
  if (bindId) { var br = recs.find(function (r) { return String(r.id) === String(bindId); }); if (br) bindName = nmCfg.recName(br); }
  var existing = nmEditId ? nmById(nmEditId) : null;
  return {
    id: (nmEditId || ("n" + Date.now() + "_" + Math.floor(Math.random() * 1e4).toString(36))),
    title: (document.getElementById("nmTitle").value.trim() || (nmCfg.kind + " " + nmNow())),
    summary: (document.getElementById("nmSummary") ? document.getElementById("nmSummary").value.trim() : ""),
    bindId: bindId, bindName: bindName,
    html: ed ? ed.innerHTML : "",
    createdAt: existing ? existing.createdAt : nmNow(),
    updatedAt: nmNow()
  };
}

/* ---------- 导出下载（与导入格式一致，图片以 base64 内嵌）---------- */
function nmDownload(items) {
  var data = { app: nmCfg.appName, kind: nmCfg.kind, version: 1, exportedAt: new Date().toISOString(), items: items };
  var fn = "notes_" + (nmCfg.fileTag || "export") + "_" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + ".json";
  try {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob); var a = document.createElement("a"); a.href = url; a.download = fn;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
    toast("已导出 " + items.length + " 条" + nmCfg.kind);
  } catch (e) { toast("导出失败：" + (e && e.message || e)); }
}

/* ============================================================================
 * 编辑器（所见即所得）
 * ========================================================================== */
function nmOpenEditor(id) {
  if (!nmCfg) { try { toast("模块未初始化"); } catch (_) {} return; }
  nmEnsureStyle();
  nmEditId = id || null;
  var editing = id ? nmById(id) : null;
  var recs = nmCfg.recs() || [];
  var opts = recs.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(nmCfg.recName(r)) + "</option>"; }).join("");
  var sel = editing ? editing.bindId : (recs[0] ? recs[0].id : "");
  var html =
    '<div class="nm-mask" id="nmMask">' +
      '<div class="nm-sheet">' +
        '<div class="nm-head"><span class="nm-title">' + (editing ? ("编辑" + nmCfg.kind) : ("写" + nmCfg.kind)) + '</span>' +
          '<button class="nm-tb" id="nmClose">✕ 关闭</button></div>' +
        '<div class="nm-body">' +
          '<div class="nm-row"><label>' + nmCfg.bindLabel + '</label>' +
            '<select class="nm-f" id="nmBind">' + (opts ? ('<option value="">（不绑定）</option>' + opts) : ('<option value="">（无' + nmCfg.docNoun + '）</option>')) + '</select></div>' +
          '<div class="nm-row"><label>标题</label><input class="nm-f" id="nmTitle" placeholder="' + nmCfg.kind + '标题" value="' + esc(editing ? editing.title : "") + '"></div>' +
          '<div class="nm-row"><label>摘要/关键词</label><input class="nm-f" id="nmSummary" placeholder="一句话摘要，便于筛选（如：周末游、建筑结构）" value="' + esc(editing ? editing.summary : "") + '"></div>' +
          '<div class="nm-toolbar">' +
            '<select class="nm-tb" id="nmFont" title="字体"><option>默认</option><option>宋体</option><option>黑体</option><option>楷体</option><option>微软雅黑</option><option>serif</option><option>sans-serif</option></select>' +
            '<select class="nm-tb" id="nmSize" title="字号"><option value="">字号</option><option value="2">小</option><option value="3">正常</option><option value="4">大</option><option value="5">特大</option><option value="6">超大</option></select>' +
            '<button class="nm-tb" id="nmB" title="粗体"><b>B</b></button>' +
            '<button class="nm-tb" id="nmI" title="斜体"><i>I</i></button>' +
            '<button class="nm-tb" id="nmU" title="下划线"><u>U</u></button>' +
            '<input type="color" id="nmColor" class="nm-tb" title="文字颜色" value="#b8862f" style="width:34px;padding:2px">' +
            '<button class="nm-tb" id="nmEmoji" title="表情符号">😊</button>' +
            '<button class="nm-tb" id="nmImg" title="插入图片">🖼️</button>' +
            '<button class="nm-tb" id="nmTable" title="插入表格">▦</button>' +
            '<button class="nm-tb" id="nmUndo" title="撤销">↶</button>' +
            '<button class="nm-tb" id="nmRedo" title="重做">↷</button>' +
          '</div>' +
          '<div class="nm-edit" id="nmEdit" contenteditable="true" data-ph="在此输入' + nmCfg.kind + '内容，支持复制粘贴、字体/字号/表情/图片/表格…">' + (editing ? editing.html : "") + '</div>' +
          '<input type="file" id="nmImgFile" accept="image/*" style="display:none">' +
        '</div>' +
        '<div class="nm-actions">' +
          (editing ? '<button class="nm-btn nm-ghost" id="nmDel">🗑 删除</button>' : '') +
          '<button class="nm-btn nm-ghost" id="nmAsk">🤖 问AI</button>' +
          '<button class="nm-btn nm-ghost" id="nmExp">⬇ 导出</button>' +
          '<button class="nm-btn nm-save" id="nmSave">💾 保存</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  var old = document.getElementById("nmMask"); if (old) old.remove();
  var box = document.createElement("div"); box.innerHTML = html;
  document.body.appendChild(box.firstElementChild);
  var mask = document.getElementById("nmMask");
  var ed = document.getElementById("nmEdit");
  function focusEd() { ed.focus(); }
  if (sel) { var bs = document.getElementById("nmBind"); if (bs) bs.value = sel; }
  document.getElementById("nmClose").onclick = function () { mask.remove(); };
  mask.onclick = function (e) { if (e.target === mask) mask.remove(); };

  document.getElementById("nmFont").onchange = function () { if (this.value && this.value !== "默认") nmExec("fontName", this.value); };
  document.getElementById("nmSize").onchange = function () { if (this.value) nmExec("fontSize", this.value); };
  document.getElementById("nmB").onclick = function () { nmExec("bold"); };
  document.getElementById("nmI").onclick = function () { nmExec("italic"); };
  document.getElementById("nmU").onclick = function () { nmExec("underline"); };
  document.getElementById("nmColor").onclick = function () { focusEd(); };
  document.getElementById("nmColor").oninput = function () { nmExec("foreColor", this.value); };
  document.getElementById("nmUndo").onclick = function () { nmExec("undo"); };
  document.getElementById("nmRedo").onclick = function () { nmExec("redo"); };
  document.getElementById("nmTable").onclick = function () { focusEd(); nmInsertHtml('<table><tbody><tr><td>表头1</td><td>表头2</td></tr><tr><td>内容</td><td>内容</td></tr></tbody></table><p><br></p>'); };

  var EMO = ["😀", "😄", "😊", "🤔", "👍", "👏", "❤️", "🔥", "⭐", "🌟", "📍", "🏯", "🏞️", "🌊", "💡", "✅", "⚠️", "📷", "📌", "🎉", "😅", "🙏", "💧", "🛠️", "🌿", "🍃"];
  document.getElementById("nmEmoji").onclick = function (e) {
    e.stopPropagation();
    var ex = document.getElementById("nmEmojiPop"); if (ex) { ex.remove(); return; }
    var pop = document.createElement("div"); pop.id = "nmEmojiPop"; pop.className = "nm-emoji-pop";
    pop.innerHTML = EMO.map(function (x) { return '<span>' + x + '</span>'; }).join("");
    document.body.appendChild(pop);
    var r = this.getBoundingClientRect(); pop.style.left = Math.max(6, r.left) + "px"; pop.style.top = (r.top - pop.offsetHeight - 6) + "px";
    pop.querySelectorAll("span").forEach(function (sp) { sp.onclick = function () { focusEd(); nmInsertHtml(sp.textContent); pop.remove(); }; });
  };
  if (!window.__nmEmojiBound) { window.__nmEmojiBound = true; document.addEventListener("click", function (ev) { var p = document.getElementById("nmEmojiPop"); if (p && !p.contains(ev.target) && ev.target.id !== "nmEmoji") p.remove(); }); }

  var imgBtn = document.getElementById("nmImg");
  imgBtn.onclick = function () { document.getElementById("nmImgFile").click(); };
  document.getElementById("nmImgFile").onchange = function () {
    var f = this.files && this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { compressDataUrlIfBig(rd.result, function (d) { focusEd(); nmInsertHtml('<img src="' + d + '" alt="' + esc(f.name) + '">'); }); };
    rd.readAsDataURL(f); this.value = "";
  };

  document.getElementById("nmSave").onclick = function () {
    var note = nmCurrentNote();
    var all = nmGetAll();
    if (editing) { var i = all.findIndex(function (n) { return n.id === editing.id; }); if (i >= 0) all[i] = note; else all.unshift(note); }
    else all.unshift(note);
    if (nmPersist(all)) { toast("已保存" + nmCfg.kind + "：" + note.title); mask.remove(); nmOpenList(); }
  };
  if (editing) document.getElementById("nmDel").onclick = function () {
    if (!confirm("确定删除这条" + nmCfg.kind + "？")) return;
    var all = nmGetAll().filter(function (n) { return n.id !== editing.id; });
    nmPersist(all); toast("已删除"); mask.remove(); nmOpenList();
  };
  document.getElementById("nmExp").onclick = function () { nmDownload([nmCurrentNote()]); };
  document.getElementById("nmAsk").onclick = function () { nmAskAI(); };
}

/* ============================================================================
 * 列表（关键字筛选：绑定名 / 记录时间 / 摘要 / 正文）
 * ========================================================================== */
function nmRenderList(kw) {
  var box = document.getElementById("nmListBox"); if (!box) return;
  var all = nmGetAll();
  if (kw) {
    var t = kw.toLowerCase();
    all = all.filter(function (n) {
      return (n.title || "").toLowerCase().indexOf(t) >= 0
        || (n.bindName || "").toLowerCase().indexOf(t) >= 0
        || (n.summary || "").toLowerCase().indexOf(t) >= 0
        || (n.createdAt || "").toLowerCase().indexOf(t) >= 0
        || (n.updatedAt || "").toLowerCase().indexOf(t) >= 0
        || nmStripHtml(n.html).toLowerCase().indexOf(t) >= 0;
    });
  }
  if (!all.length) { box.innerHTML = '<div class="nm-empty">还没有' + nmCfg.kind + '，点「✍️ 写' + nmCfg.kind + '」开始</div>'; return; }
  box.innerHTML = all.map(function (n) {
    var preview = nmStripHtml(n.html).slice(0, 80);
    return '<div class="nm-list-item">' +
      '<div class="t">' + esc(n.title || "(无标题)") + '</div>' +
      '<div class="m">' + (n.bindName ? ('🔗 ' + esc(n.bindName)) : '未绑定') + '　·　🕒 ' + esc(n.updatedAt || n.createdAt || "") + '</div>' +
      (n.summary ? '<div class="s">📝 ' + esc(n.summary) + '</div>' : '') +
      (preview ? '<div class="s" style="color:#8a7c70">' + esc(preview) + '</div>' : '') +
      '<div class="nm-chips" style="margin-top:6px">' +
        '<button class="nm-tb" data-edit="' + esc(n.id) + '">编辑</button>' +
        (n.bindId ? '<button class="nm-tb" data-fly="' + esc(n.bindId) + '">定位</button>' : '') +
        '<button class="nm-tb" data-del="' + esc(n.id) + '">删除</button>' +
      '</div>' +
    '</div>';
  }).join("");
  box.querySelectorAll("[data-edit]").forEach(function (el) { el.onclick = function () { var m = document.getElementById("nmMask"); if (m) m.remove(); nmOpenEditor(el.getAttribute("data-edit")); }; });
  box.querySelectorAll("[data-fly]").forEach(function (el) { el.onclick = function () { nmFly(el.getAttribute("data-fly")); }; });
  box.querySelectorAll("[data-del]").forEach(function (el) { el.onclick = function () {
    var id = el.getAttribute("data-del"); if (!confirm("确定删除这条" + nmCfg.kind + "？")) return;
    var a = nmGetAll().filter(function (n) { return n.id !== id; }); nmPersist(a); toast("已删除");
    nmRenderList(document.getElementById("nmQ") ? document.getElementById("nmQ").value.trim() : "");
  }; });
}

function nmOpenList() {
  if (!nmCfg) { try { toast("模块未初始化"); } catch (_) {} return; }
  nmEnsureStyle();
  var all = nmGetAll();
  var html =
    '<div class="nm-mask" id="nmMask">' +
      '<div class="nm-sheet">' +
        '<div class="nm-head"><span class="nm-title">我的' + nmCfg.kind + '（' + all.length + '）</span>' +
          '<button class="nm-tb" id="nmClose">✕ 关闭</button></div>' +
        '<div class="nm-body">' +
          '<div class="nm-row"><input class="nm-search" id="nmQ" placeholder="筛选：' + nmCfg.bindLabel.replace("绑定", "") + '名称 / 记录时间 / ' + nmCfg.kind + '摘要">' +
            '<button class="nm-tb" id="nmNew">✍️ 写' + nmCfg.kind + '</button>' +
            '<button class="nm-tb" id="nmImportBtn">⬆ 导入</button>' +
            '<button class="nm-tb" id="nmExpAll">⬇ 导出</button>' +
            '<button class="nm-tb" id="nmAskAll">🤖 问AI</button></div>' +
          '<div id="nmListBox"></div>' +
          '<input type="file" id="nmImpFile" accept=".json,application/json" style="display:none">' +
        '</div>' +
      '</div>' +
    '</div>';
  var old = document.getElementById("nmMask"); if (old) old.remove();
  var box = document.createElement("div"); box.innerHTML = html;
  document.body.appendChild(box.firstElementChild);
  var mask = document.getElementById("nmMask");
  document.getElementById("nmClose").onclick = function () { mask.remove(); };
  mask.onclick = function (e) { if (e.target === mask) mask.remove(); };
  document.getElementById("nmNew").onclick = function () { mask.remove(); nmOpenEditor(null); };
  document.getElementById("nmExpAll").onclick = function () { var a = nmGetAll(); if (!a.length) { toast("还没有" + nmCfg.kind); return; } nmDownload(a); };
  document.getElementById("nmAskAll").onclick = function () { nmAskAI(); };
  document.getElementById("nmImportBtn").onclick = function () { document.getElementById("nmImpFile").click(); };
  document.getElementById("nmImpFile").onchange = function () {
    var f = this.files && this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var d = JSON.parse(rd.result);
        var items = Array.isArray(d) ? d : (d.items || []);
        if (!items.length) { toast("文件中没有" + nmCfg.kind + "数据"); return; }
        var allx = nmGetAll(); var cnt = 0;
        items.forEach(function (it) {
          if (!it || !it.id) return;
          var ex = allx.findIndex(function (n) { return n.id === it.id; });
          if (ex >= 0) allx[ex] = it; else allx.unshift(it);
          cnt++;
        });
        nmPersist(allx); toast("已导入 " + cnt + " 条" + nmCfg.kind); nmRenderList("");
      } catch (e) { toast("导入失败：" + (e && e.message || e)); }
    };
    rd.readAsText(f); this.value = "";
  };
  document.getElementById("nmQ").oninput = function () { nmRenderList(this.value.trim()); };
  nmRenderList("");
}

/* ============================================================================
 * 智能AI 查询（把全部游记/备忘录作为上下文，调用 AIModule.ask）
 * ========================================================================== */
function nmAskAI() {
  if (!nmCfg) { try { toast("模块未初始化"); } catch (_) {} return; }
  nmEnsureStyle();
  var all = nmGetAll();
  if (!all.length) { toast("还没有可查询的" + nmCfg.kind + "，先写几条吧"); return; }
  var ctx = all.map(function (n) {
    return "【" + (n.title || "") + "】" + (n.bindName ? (" 绑定:" + n.bindName) : "") + (n.summary ? (" 摘要:" + n.summary) : "") + "\n" + (nmStripHtml(n.html) || "（空）");
  }).join("\n----------\n");
  var html =
    '<div class="nm-mask" id="nmMask">' +
      '<div class="nm-sheet">' +
        '<div class="nm-head"><span class="nm-title">🤖 用智能AI查询' + nmCfg.kind + '</span>' +
          '<button class="nm-tb" id="nmClose">✕ 关闭</button></div>' +
        '<div class="nm-body">' +
          '<p style="font-size:13px;color:#3a2e28;line-height:1.6">将把你的 ' + all.length + ' 条' + nmCfg.kind + '作为上下文发给智能AI（不外泄）。输入问题即可问答。</p>' +
          '<textarea class="nm-f" id="nmAskQ" rows="3" placeholder="如：哪几条提到了都江堰？/ 帮我总结关于故宫的游览要点"></textarea>' +
          '<div id="nmAskOut"></div>' +
        '</div>' +
        '<div class="nm-actions">' +
          '<button class="nm-btn nm-ghost" id="nmAskBack">返回</button>' +
          '<button class="nm-btn nm-save" id="nmAskRun">查询</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  var old = document.getElementById("nmMask"); if (old) old.remove();
  var box = document.createElement("div"); box.innerHTML = html;
  document.body.appendChild(box.firstElementChild);
  var mask = document.getElementById("nmMask");
  document.getElementById("nmClose").onclick = function () { mask.remove(); };
  mask.onclick = function (e) { if (e.target === mask) mask.remove(); };
  document.getElementById("nmAskBack").onclick = function () { mask.remove(); nmOpenList(); };
  document.getElementById("nmAskRun").onclick = function () {
    var q = document.getElementById("nmAskQ").value.trim(); if (!q) { toast("请输入问题"); return; }
    if (!window.AIModule || typeof AIModule.ask !== "function") { toast("未启用智能AI：请先到「设置→智能AI设置」配置模型"); return; }
    var out = document.getElementById("nmAskOut"); out.innerHTML = '<div class="nm-out">🔒 正在思考…</div>';
    var sys = "你是「" + nmCfg.appName + "」的本地助手。用户写了一些" + nmCfg.kind + "，内容涉及" + nmCfg.docNoun + "的现场记录与心得。请基于下面提供的" + nmCfg.kind + "上下文回答用户问题，不要编造上下文之外的内部数据；引用时尽量注明出自哪条" + nmCfg.kind + "。用中文、条理清晰。";
    var user = "用户问题：" + q + "\n\n【" + nmCfg.kind + "上下文】\n" + ctx;
    AIModule.ask([{ role: "system", content: sys }, { role: "user", content: user }]).then(function (txt) {
      out.innerHTML = '<div class="nm-out">' + (esc(txt) || "（无返回）") + '</div>';
    }).catch(function (e) { out.innerHTML = '<div class="nm-out" style="border-color:#f3c0c0;background:#fff0f0">查询失败：' + esc(e && e.message || e) + '</div>'; });
  };
}

/* 兼容旧浏览器：若无 URL.createObjectURL 则尝试复制文本兜底 */

/* 古建：游记 + 备忘录 双记录模块配置（共用同一套 nm 编辑器，点击菜单时经 nmGo 切换 nmCfg，异常 try/catch 兜底不出现 script error） */
var nmTravelCfg = { kind: "游记", docNoun: "古建", appName: "古建景点打卡", lsKey: "gujian_notes_v1", fileTag: "gujian", bindLabel: "绑定古建", recs: function () { return HERITAGE; }, recName: function (r) { return (r.name || "?") + (r.city ? ("（" + r.city + "）") : ""); } };
var nmMemoCfg = { kind: "备忘录", docNoun: "古建", appName: "古建景点打卡", lsKey: "gujian_memos_v1", fileTag: "gujian", bindLabel: "绑定古建", recs: function () { return HERITAGE; }, recName: function (r) { return (r.name || "?") + (r.city ? ("（" + r.city + "）") : ""); } };
function nmGo(kind, act) {
  try {
    nmCfg = (kind === "memo") ? nmMemoCfg : nmTravelCfg;
    if (act === "edit") nmOpenEditor(null); else nmOpenList();
  } catch (e) { try { toast("打开" + (kind === "memo" ? "备忘录" : "游记") + "失败：" + (e && e.message || e)); } catch (e2) {} }
}
nmInstall(nmTravelCfg);
/* ===== 升级 / 数据备份 模块（古建 / 水利一张图 / 水利感知 三平台共享） =====
 * 注入方式：cat upgrade_funcs.src.js cfg_up_<平台>.js >> app.js
 * 菜单项调用：upOpenExport() / upOpenImport() / upOpenUpgrade() （函数声明 hoist，挂在 buildMenu 前即可用）
 * 配置：文件末尾 upInstall({app, appName, channel, fileTag, manifestUrl})
 *   - channel: "single" 字符串 或 function() 返回 "public"/"internal"（奇偶双通道）
 *   - manifestUrl: 升级清单 JSON 的公开可访问地址（构建流水线注入；为空时提示联系管理员）
 */
var upCfg = null;
function upInstall(cfg) { upCfg = cfg; }

// 收集本机全部用户数据键（排除临时/缓存键，避免把错误日志、增量缓存打进备份）
function upLsKeys() {
  var deny = (upCfg && upCfg.deny) || ["gujian_script_errors", "shuili_script_errors", "yitu_runtime_log", "shuili_lastBldSha", "shuili_lastKmzSha"];
  var out = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && deny.indexOf(k) < 0) out.push(k);
  }
  return out;
}

function upCollect() {
  var keys = upLsKeys();
  var payload = {}, counts = {}, bytes = 0;
  keys.forEach(function (k) {
    var v = localStorage.getItem(k) || "";
    payload[k] = v;
    bytes += v.length;
    try { var a = JSON.parse(v); if (Array.isArray(a)) counts[k] = a.length; } catch (e) {}
  });
  return { payload: payload, counts: counts, bytes: bytes, keys: keys };
}

function upBuildBundle() {
  var c = upCollect();
  return {
    format: "yitu-upgrade-backup",
    schema: 1,
    app: upCfg.app,
    channel: (typeof upCfg.channel === "function") ? upCfg.channel() : (upCfg.channel || "single"),
    exportedAt: new Date().toISOString(),
    appVersion: (typeof APP_VERSION !== "undefined") ? String(APP_VERSION) : "",
    payload: c.payload
  };
}

function upSizeStr(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(2) + " MB";
}

// 版本号比较（去 v 前缀，逐段数字比较）：a<b 返回 -1，a==b 返回 0，a>b 返回 1
function upCmpVer(a, b) {
  a = String(a || "").replace(/^v/i, "").split(".");
  b = String(b || "").replace(/^v/i, "").split(".");
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    var x = parseInt(a[i] || "0", 10) || 0, y = parseInt(b[i] || "0", 10) || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function upChannelLabel(ch) {
  return ch === "single" ? "不分内外" : (ch === "public" ? "公开版" : "内部版");
}

// —— 导出默认目录 / 文件名（cfg 可覆盖：exportDir / exportBase）——
function upDateTag() {
  var d = new Date();
  return d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2);
}
function upDefaultDir() {
  return (upCfg && upCfg.exportDir) || ((upCfg && upCfg.appName ? upCfg.appName : "yitu") + "备份");
}
function upDefaultName() {
  var base = (upCfg && upCfg.exportBase) || (upCfg && upCfg.appName) || "backup";
  return base + "_" + upDateTag() + ".bak";
}
function upSafeName(s, fb) {
  s = String(s || "").trim().replace(/[\/:*?"<>|]/g, "_");
  if (!s) s = fb;
  if (!/\.bak$/i.test(s)) s += ".bak";
  return s;
}
// UTF-8 安全 base64（用于走 Android 桥保存，避免中文乱码）
function upB64(str) {
  try { return btoa(unescape(encodeURIComponent(str))); } catch (e) { try { return btoa(str); } catch (e2) { return null; } }
}

function upStyle() {
  if (document.getElementById("upStyle")) return;
  var s = document.createElement("style");
  s.id = "upStyle";
  s.innerHTML = ".up-row{padding:7px 0;border-bottom:1px solid #eee;font-size:13px}.up-k{color:#888}.up-info{background:#f6f8fa;border-radius:8px;padding:10px 12px;font-size:13px;color:#444;margin:8px 0;line-height:1.6}.up-warn{color:#c0392b}.up-ok{color:#1a8a3c}.up-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}";
  document.head.appendChild(s);
}

function upOpenExport() {
  upStyle();
  var c = upCollect();
  var rows = c.keys.slice(0, 40).map(function (k) {
    var n = (c.counts[k] != null) ? ("（" + c.counts[k] + " 条）") : "";
    return '<div class="up-row"><span class="up-k">' + esc(k) + "</span> " + n + "</div>";
  }).join("");
  if (c.keys.length > 40) rows += '<div class="up-row up-k">…共 ' + c.keys.length + " 项</div>";
  var defDir = upDefaultDir(), defName = upDefaultName();
  var html =
    '<div class="up-info">将导出本机<b>全部用户数据</b>（照片已内嵌在备份中）。请妥善保存备份文件，升级或更换设备后可导入恢复，旧数据不会丢失。<br>数据项：<b>' + c.keys.length + "</b> 项，大小：<b>" + upSizeStr(c.bytes) + "</b></div>" +
    '<div style="max-height:160px;overflow:auto">' + rows + "</div>" +
    '<label class="f" style="display:block;margin:10px 0 4px">保存到文件夹（Download 目录下，可自定义）</label>' +
    '<input class="f" id="upDir" style="width:100%;box-sizing:border-box" value="' + esc(defDir) + '">' +
    '<label class="f" style="display:block;margin:8px 0 4px">备份文件名（默认 .bak）</label>' +
    '<input class="f" id="upName" style="width:100%;box-sizing:border-box" value="' + esc(defName) + '">' +
    '<div style="font-size:12px;color:#8a7c70;margin-top:6px">默认文件名：' + esc(defName) + '；可改成任意名字（自动补 .bak）。</div>' +
    '<div class="up-btns">' +
      '<button class="btn-save" onclick="upDoExport()">⬇️ 下载备份文件</button>' +
      '<button class="btn-cancel" onclick="closeSheet(\'sheetGen\')">关闭</button>' +
    "</div>";
  $("genTitle").textContent = "升级数据导出";
  $("genBody").innerHTML = html;
  openSheet("sheetGen");
}

function upDoExport() {
  var bundle = upBuildBundle();
  var dirEl = document.getElementById("upDir"), nameEl = document.getElementById("upName");
  var folder = (dirEl && dirEl.value) ? dirEl.value.trim() : "";
  var name = upSafeName(nameEl ? nameEl.value : "", upDefaultName());
  var json = JSON.stringify(bundle, null, 2);
  var saved = false, path = "";
  try {
    var A = (typeof window !== "undefined") ? window.Android : null;
    var b64 = upB64(json);
    // 大备份（>700KB）走浏览器下载，避免 Binder 传输上限导致失败
    if (A && b64 && json.length <= 700000 && typeof A.saveBlobTo === "function") {
      A.saveBlobTo("data:application/octet-stream;base64," + b64, folder, name);
      saved = true; path = "Download/" + (folder || upDefaultDir()) + "/" + name;
    } else if (A && b64 && json.length <= 700000 && typeof A.saveBlob === "function") {
      A.saveBlob("data:application/octet-stream;base64," + b64, name);
      saved = true; path = "Download/" + name + "（系统默认目录）";
    }
  } catch (e) { saved = false; }
  if (!saved) {
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1000);
    path = "系统下载目录：" + name;
  }
  toast("已导出备份：" + path);
  try {
    var info = document.getElementById("upInfo2");
    if (info) info.innerHTML = '<span class="up-ok">已导出：' + esc(path) + "</span>";
  } catch (e) {}
}

function upOpenImport() {
  upStyle();
  var html =
    '<div class="up-info up-warn">⚠️ 导入会用备份文件里的数据<b>覆盖</b>程序中的对应数据（覆盖模式将<b>覆盖程序中的全部数据</b>）。请务必确认选择的是<b>最新一次导出</b>的备份，避免用旧备份回退数据。</div>' +
    '<div class="up-info">选择备份文件（<b>.bak</b> 或旧版 .json）。默认<b>合并导入</b>：备份中有、程序中没有的条目追加；两边都有的条目以备份为准（覆盖更新）；程序中独有的条目保留。</div>' +
    '<input type="file" id="upImportFile" accept=".bak,.json,application/json" style="margin:10px 0;width:100%" onchange="upInspectFile()">' +
    '<div id="upFileInfo" style="font-size:12px;color:#8a7c70;min-height:16px"></div>' +
    '<div style="margin:8px 0;font-size:13px"><label><input type="radio" name="upMode" value="merge" checked> 合并导入（推荐，保留程序独有数据）</label><br>' +
    '<label><input type="radio" name="upMode" value="overwrite"> 覆盖导入（清空现有同名数据后完整还原）</label></div>' +
    '<div id="upImportMsg" style="font-size:13px;min-height:18px"></div>' +
    '<div class="up-btns">' +
      '<button class="btn-save" onclick="upDoImport()">⬆️ 开始导入</button>' +
      '<button class="btn-cancel" onclick="closeSheet(\'sheetGen\')">关闭</button>' +
    "</div>";
  $("genTitle").textContent = "升级数据导入";
  $("genBody").innerHTML = html;
  openSheet("sheetGen");
}

// 选中文件后先解析出备份概要（导出时间/版本/条目），让用户确认是否为最新备份
function upInspectFile() {
  var inp = document.getElementById("upImportFile"), info = document.getElementById("upFileInfo");
  if (!inp || !inp.files || !inp.files.length || !info) return;
  var f = inp.files[0];
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var b = JSON.parse(reader.result);
      if (!b || b.format !== "yitu-upgrade-backup" || !b.payload) { info.innerHTML = '<span class="up-warn">不是本应用的备份文件</span>'; return; }
      var keys = Object.keys(b.payload);
      var when = String(b.exportedAt || "").replace("T", " ").slice(0, 16);
      var warn = (b.app && upCfg.app && b.app !== upCfg.app) ? ' <span class="up-warn">（应用不匹配：' + esc(b.app) + "）</span>" : "";
      info.innerHTML = "文件：" + esc(f.name) + " ｜ 导出时间：<b>" + esc(when || "?") + "</b> ｜ 版本：" + esc(b.appVersion || "?") +
        " ｜ 数据项 " + keys.length + " 项" + warn + '<br><span class="up-warn">请确认这是最新备份，导入后同条目数据将以备份为准。</span>';
    } catch (e) { info.innerHTML = '<span class="up-warn">文件解析失败，不是有效备份</span>'; }
  };
  reader.onerror = function () { if (info) info.innerHTML = '<span class="up-warn">读取文件失败</span>'; };
  reader.readAsText(f);
}

function upImportMode() {
  var els = document.getElementsByName("upMode");
  for (var i = 0; i < els.length; i++) if (els[i].checked) return els[i].value;
  return "merge";
}

// 合并策略：数组按 id 合并（旧的优先保留，导入字段补充）；对象深合并；标量以导入为准。保证旧数据不丢。
function upMerge(targetStr, incomingStr) {
  var t, i;
  try { t = JSON.parse(targetStr); } catch (e) { t = undefined; }
  try { i = JSON.parse(incomingStr); } catch (e) { i = undefined; }
  if (Array.isArray(t) && Array.isArray(i)) {
    var map = {};
    t.forEach(function (x) { if (x && x.id != null) map[x.id] = x; });
    i.forEach(function (x) {
      if (x && x.id != null) map[x.id] = map[x.id] ? Object.assign({}, map[x.id], x) : x;
      else t.push(x);
    });
    return JSON.stringify(Object.keys(map).length ? Object.keys(map).map(function (k) { return map[k]; }) : t);
  }
  if (t && typeof t === "object" && i && typeof i === "object" && !Array.isArray(t) && !Array.isArray(i)) {
    return JSON.stringify(Object.assign({}, t, i));
  }
  return JSON.stringify(i);
}

function upDoImport() {
  var inp = document.getElementById("upImportFile");
  var msg = document.getElementById("upImportMsg");
  if (!inp || !inp.files || !inp.files.length) { if (msg) msg.innerHTML = '<span class="up-warn">请先选择备份文件</span>'; return; }
  var mode = upImportMode();
  if (mode === "overwrite") {
    var ok = true;
    try { if (typeof confirm === "function") ok = confirm("覆盖导入将用备份数据覆盖程序中的全部数据，且不可撤销。\n请确认所选备份是最新一次导出的。\n\n确定继续吗？"); } catch (e) {}
    if (!ok) { if (msg) msg.innerHTML = '<span class="up-warn">已取消导入</span>'; return; }
  }
  var reader = new FileReader();
  reader.onload = function () {
    var bundle;
    try { bundle = JSON.parse(reader.result); } catch (e) { if (msg) msg.innerHTML = '<span class="up-warn">文件不是有效备份（JSON 解析失败）</span>'; return; }
    if (!bundle || bundle.format !== "yitu-upgrade-backup" || !bundle.payload) { if (msg) msg.innerHTML = '<span class="up-warn">不是本应用的升级备份文件</span>'; return; }
    if (bundle.app && upCfg.app && bundle.app !== upCfg.app) { if (msg) msg.innerHTML = '<span class="up-warn">应用不匹配（备份为 ' + esc(bundle.app) + '，当前为 ' + esc(upCfg.app) + '）</span>'; return; }
    var keys = Object.keys(bundle.payload), added = 0, merged = 0, errs = 0;
    keys.forEach(function (k) {
      try {
        var cur = localStorage.getItem(k);
        if (mode === "overwrite" || cur == null) { localStorage.setItem(k, bundle.payload[k]); (cur == null ? added++ : merged++); }
        else { localStorage.setItem(k, upMerge(cur, bundle.payload[k])); merged++; }
      } catch (e) { errs++; }
    });
    if (msg) msg.innerHTML = '<span class="up-ok">' + (mode === "overwrite" ? "覆盖导入完成" : "导入完成") +
      "：写入 " + added + " 项、覆盖/合并 " + merged + " 项" + (errs ? "，失败 " + errs + " 项" : "") + "。建议重启应用生效。</span>";
    toast("数据导入完成");
  };
  reader.onerror = function () { if (msg) msg.innerHTML = '<span class="up-warn">读取文件失败</span>'; };
  reader.readAsText(inp.files[0]);
}

function upOpenUpgrade() {
  upStyle();
  var ch = (typeof upCfg.channel === "function") ? upCfg.channel() : (upCfg.channel || "single");
  var html =
    '<div class="up-info">当前：<b>' + esc(upCfg.appName) + "</b> · 版本 <b>" + esc((typeof APP_VERSION !== "undefined") ? APP_VERSION : "?") + "</b> · 通道 <b>" + esc(upChannelLabel(ch)) + "</b></div>" +
    '<div style="font-size:13px;color:#555;margin:6px 0">升级前请先导出数据备份，防止数据丢失。检测只比对当前通道：公开版只检公开新版、内部版只检内部新版，二者<b>不交叉</b>。</div>' +
    '<div class="up-btns">' +
      '<button class="btn-save" onclick="upDoExport()">⬇️ 先导出数据</button>' +
      '<button class="btn-save" onclick="upCheck()">🔄 检测新版</button>' +
      '<button class="btn-cancel" onclick="closeSheet(\'sheetGen\')">关闭</button>' +
    "</div>" +
    '<div id="upCheckMsg" style="font-size:13px;margin-top:10px;min-height:18px"></div>';
  $("genTitle").textContent = "软件升级";
  $("genBody").innerHTML = html;
  openSheet("sheetGen");
}

function upCheck() {
  var msg = document.getElementById("upCheckMsg");
  if (!upCfg || !upCfg.manifestUrl) { if (msg) msg.innerHTML = '<span class="up-warn">未配置升级服务器地址，请联系管理员或到发布页手动下载。</span>'; return; }
  if (msg) msg.innerHTML = "正在检测…";
  var ch = (typeof upCfg.channel === "function") ? upCfg.channel() : (upCfg.channel || "single");
  fetch(upCfg.manifestUrl, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (m) {
    var entry = m && (m.channels ? m.channels[ch] : m[ch]);
    if (!entry) { if (msg) msg.innerHTML = '<span class="up-warn">升级服务器未返回本通道（' + esc(ch) + '）的信息。</span>'; return; }
    var local = (typeof APP_VERSION !== "undefined") ? String(APP_VERSION) : "";
    var cmp = upCmpVer(entry.version, local);
    if (cmp > 0) {
      if (msg) msg.innerHTML = '<span class="up-ok">发现新版本 <b>' + esc(entry.version) + "</b>（" + esc(upChannelLabel(ch)) + "）</span><br>" + (entry.note ? esc(entry.note) + "<br>" : "") + (entry.url ? '<a href="' + esc(entry.url) + '" target="_blank" rel="noopener" onclick="return upOpenUrl(event, this.href)">点击下载更新包</a>' : "安装包未上公开网盘，请从单位内部渠道获取，或联系管理员。");
    } else if (cmp === 0) {
      if (msg) msg.innerHTML = '<span class="up-ok">已是最新版（' + esc(local) + "）</span>";
    } else {
      if (msg) msg.innerHTML = "当前版本（" + esc(local) + "）已是最新，无需更新。";
    }
  }).catch(function (e) {
    if (msg) msg.innerHTML = '<span class="up-warn">检测失败：' + (e && e.message ? e.message : "网络或服务器不可用") + "。请检查网络后重试。</span>";
  });
}
/* 古建 升级/备份 配置（不分内外，无双通道） */
upInstall({
  app: "gujian",
  appName: "古建景点打卡",
  channel: "single",
  fileTag: "gujian",
  exportBase: "古建景点打卡备份",
  exportDir: "古建景点打卡备份",
  manifestUrl: "https://020271252c9a4b9fab19848e25a3f6e3.app.workbuddy.link/manifests/gujian.json"
});

// 外部浏览器打开升级链接：WebView 内直接加载百度网盘页会被 302 到 bdnetdisk:// 深链，
// WebView 不识别该协议报 ERR_UNKNOWN_URL_SCHEME；改走 openExternal 由系统浏览器接管。
function upOpenUrl(ev, url) {
  if (ev && ev.preventDefault) { ev.preventDefault(); if (ev.stopPropagation) ev.stopPropagation(); }
  try { if (window.Android && typeof window.Android.openExternal === "function") { window.Android.openExternal(url); return false; } } catch (e) {}
  try {
    var a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 500);
  } catch (e) { try { window.open(url, "_blank"); } catch (e2) {} }
  return false;
}
window.upOpenUrl = upOpenUrl;

/* ===== GitHub 升级（5090 仓库发布渠道）=====
 * 三应用通用：设置菜单「GitHub 升级（检测新版）」→ 查 GitHub Releases 最新版，
 * 与本地版本比对并列出当前平台安装包下载。古建 single → gujian-travel5090。 */
var upGithubCfg = { single: "g101400/gujian-travel5090" };
function ghChannel() {
  if (typeof getReleaseChannel === "function") { try { return getReleaseChannel(); } catch (e) {} }
  return "single";
}
function ghRepo() {
  var m = (typeof upGithubCfg !== "undefined") ? upGithubCfg : {};
  var ch = ghChannel();
  return m[ch] || m["single"] || "";
}
function ghPlat() {
  var ua = (navigator && navigator.userAgent) || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows/i.test(ua)) return "win";
  if (/Linux|UOS|Deepin|UnionTech/i.test(ua)) return "uos";
  return "web";
}
function ghAssetLabel(name) {
  name = String(name || "");
  if (/\.apk$/i.test(name)) return "📱 Android";
  if (/Setup\.msi$/i.test(name)) return "🪟 Windows MSI";
  if (/Setup\.exe$/i.test(name)) return "🪟 Windows EXE";
  if (/\.deb$/i.test(name)) {
    if (/amd64|loongarch64|arm64|mips64el/.test(name)) return "🐧 统信UOS " + (name.match(/_(amd64|loongarch64|arm64|mips64el)\.deb$/i) || name.match(/\.(amd64|loongarch64|arm64|mips64el)\.deb$/i) || [])[1];
    return "🐧 UOS deb";
  }
  if (/iOS|可托管/i.test(name)) return "🍎 iOS PWA 托管包";
  return name;
}
function ghOpenUpgrade() {
  upStyle();
  var repo = ghRepo();
  var ch = ghChannel();
  var html =
    '<div class="up-info">当前：<b>' + esc((typeof upCfg !== "undefined" && upCfg.appName) ? upCfg.appName : "") + "</b> · 版本 <b>" + esc((typeof APP_VERSION !== "undefined") ? APP_VERSION : "?") + "</b> · 渠道 <b>" + esc(ch === "public" ? "公开版" : (ch === "internal" ? "内部版" : "不分内外")) + "</b><br>GitHub 仓库：<b>" + esc(repo || "未配置") + "</b></div>" +
    '<div style="font-size:13px;color:#555;margin:6px 0">从 GitHub Releases 检测该渠道最新版并下载四平台安装包（公开版免登录；内部版仓库私有，需 GitHub 账号且有该仓库权限）。</div>' +
    '<div class="up-btns">' +
      '<button class="btn-save" onclick="ghCheck()">🔍 检测 GitHub 新版</button>' +
      '<button class="btn-cancel" onclick="closeSheet(\'sheetGen\')">关闭</button>' +
    "</div>" +
    '<div id="ghMsg" style="font-size:13px;margin-top:10px;min-height:18px"></div>';
  $("genTitle").textContent = "GitHub 升级";
  $("genBody").innerHTML = html;
  openSheet("sheetGen");
}
function ghCheck() {
  var msg = document.getElementById("ghMsg");
  var repo = ghRepo();
  if (!repo) { if (msg) msg.innerHTML = '<span class="up-warn">未配置 GitHub 仓库，请联系管理员。</span>'; return; }
  if (msg) msg.innerHTML = "正在连接 GitHub 检测…";
  var plat = ghPlat();
  fetch("https://api.github.com/repos/" + repo + "/releases/latest", { cache: "no-store" })
    .then(function (r) {
      if (r.status === 404 || r.status === 401 || r.status === 403) throw new Error("私有仓库需登录或未发布 Release");
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (rel) {
      var local = (typeof APP_VERSION !== "undefined") ? String(APP_VERSION) : "";
      var remote = String(rel.tag_name || "").replace(/^v/i, "");
      var cmp = upCmpVer(remote, local);
      var head = (cmp > 0) ? '<span class="up-ok">发现新版本 <b>' + esc(remote) + "</b></span>"
             : (cmp === 0) ? '<span class="up-ok">已是最新（' + esc(local) + "）</span>"
             : '当前版本（' + esc(local) + "）高于 GitHub 最新（" + esc(remote) + "）";
      var assets = (rel.assets || []).map(function (a) {
        var on = (ghAssetLabel(a.name).indexOf("Android") >= 0 && plat === "android") ||
                 (ghAssetLabel(a.name).indexOf("Windows") >= 0 && plat === "win") ||
                 (ghAssetLabel(a.name).indexOf("UOS") >= 0 && plat === "uos") ||
                 (ghAssetLabel(a.name).indexOf("iOS") >= 0 && plat === "ios");
        return '<div class="up-row">' + (on ? "<b>▶</b> " : "") + '<span class="up-k">' + esc(ghAssetLabel(a.name)) + '</span>　<a href="' + esc(a.browser_download_url) + '" target="_blank" rel="noopener" onclick="return upOpenUrl(event, this.href)">下载</a>　<small>' + esc(a.name) + " (" + (a.size / 1048576).toFixed(1) + "MB)</small></div>";
      }).join("");
      if (msg) msg.innerHTML = head + (rel.body ? "<br><small style='color:#888'>" + esc(rel.body.slice(0, 200)) + "</small>" : "") + "<div style='margin-top:6px'>" + assets + "</div>";
    })
    .catch(function (e) {
      if (msg) msg.innerHTML = '<span class="up-warn">检测失败：' + esc((e && e.message) ? e.message : "网络不可用") + '。</span><div class="up-btns" style="margin-top:8px"><button class="btn-save" onclick="upOpenUrl(event,\'https://github.com/' + esc(repo) + '/releases/latest\')">在浏览器打开发布页</button></div>';
    });
}
window.ghOpenUpgrade = ghOpenUpgrade; window.ghCheck = ghCheck;
