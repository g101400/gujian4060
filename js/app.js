/* app.js —— 古建景点打卡（增强版：筛选/增删改/多照片/导入导出/定位/导航/测距/周边） */
(function () {
  // ===== v2.4.6 老版本 WebView 兼容垫片（必须在任何业务代码之前执行）=====
  // 缺一个 API 整份 app.js 就初始化中断（表现为「点菜单 → 运行错误:script error.」），
  // 而 app.js 内有数十处 querySelectorAll(...).forEach，逐个改写不现实 → 在此统一补齐。
  (function () {
    try {
      if (typeof NodeList !== "undefined" && NodeList.prototype && !NodeList.prototype.forEach) {
        NodeList.prototype.forEach = Array.prototype.forEach;
      }
      if (typeof HTMLCollection !== "undefined" && HTMLCollection.prototype && !HTMLCollection.prototype.forEach) {
        HTMLCollection.prototype.forEach = Array.prototype.forEach;
      }
      if (!String.prototype.padStart) {
        String.prototype.padStart = function (n, c) {
          c = c == null ? " " : String(c); var s = String(this);
          while (s.length < n) s = c + s; return s;
        };
      }
      if (!String.prototype.padEnd) {
        String.prototype.padEnd = function (n, c) {
          c = c == null ? " " : String(c); var s = String(this);
          while (s.length < n) s = s + c; return s;
        };
      }
      if (!Array.prototype.find) {
        Array.prototype.find = function (pred, thisArg) {
          for (var i = 0; i < this.length; i++) { if (pred.call(thisArg, this[i], i, this)) return this[i]; }
          return undefined;
        };
      }
      if (!Array.prototype.findIndex) {
        Array.prototype.findIndex = function (pred, thisArg) {
          for (var i = 0; i < this.length; i++) { if (pred.call(thisArg, this[i], i, this)) return i; }
          return -1;
        };
      }
      if (typeof Array.from !== "function") {
        Array.from = function (o, mapFn) {
          var a = [], i;
          if (o && typeof o.length === "number") { for (i = 0; i < o.length; i++) a.push(o[i]); }
          else if (o && typeof o.next === "function") { var r = o.next(); while (!r.done) { a.push(r.value); r = o.next(); } }
          return mapFn ? a.map(mapFn) : a;
        };
      }
      if (!Object.assign) {
        Object.assign = function (t) {
          for (var i = 1; i < arguments.length; i++) {
            var s = arguments[i]; if (!s) continue;
            for (var k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; }
          }
          return t;
        };
      }
      if (!String.prototype.includes) {
        String.prototype.includes = function (x, p) { return String(this).indexOf(x, p || 0) >= 0; };
      }
      if (!Array.prototype.includes) {
        Array.prototype.includes = function (x) { return this.indexOf(x) >= 0; };
      }
    } catch (e) { /* 垫片失败不影响主流程 */ }
  })();
  // v2.4.4：全局错误捕获（功能⑯ 错误日志）——window.onerror / unhandledrejection 入环形缓冲 localStorage，供「信息与帮助→错误日志」查看复制
  (function () {
    try {
      var KEY = (window.__APP_ID__ || "app") + "_errlog_v1";
      function push(msg) {
        try {
          var arr = JSON.parse(localStorage.getItem(KEY) || "[]");
          if (!Array.isArray(arr)) arr = [];
          arr.push({ t: new Date().toISOString(), m: String(msg).slice(0, 600) });
          if (arr.length > 300) arr = arr.slice(-300);
          try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
        } catch (_) {}
      }
      window.__ERR_LOG_PUSH__ = push;
      window.addEventListener("error", function (e) {
        var loc = e && e.filename ? (" @ " + String(e.filename).split("/").pop() + ":" + (e.lineno || 0)) : "";
        push((e && e.message ? e.message : "error") + loc);
      });
      window.addEventListener("unhandledrejection", function (e) {
        var r = e && e.reason;
        push("Promise: " + (r && (r.stack || r.message) ? (r.stack || r.message) : String(r)));
      });
    } catch (_) {}
  })();
  // 天地图 Token：优先读取 index.html 中的 window.__CONFIG__（便于不同环境替换）；缺省用内置值
  const CFG = (window.__CONFIG__ && typeof window.__CONFIG__ === "object") ? window.__CONFIG__ : {};
  // v2.4.3：优先级 localStorage(appsettings_key_v1) → __CONFIG__ → 内置默认；保持 let 以便设置面板运行时改
  const TIANDITU_DEFAULT = "";            // 真实 token 见 secrets/config.local.js（本地，不入库）；克隆后请填入再构建
  const TIANDITU_SERVER_DEFAULT = "";     // 服务器端：瓦片下载脚本 download_tiles.py
  let TIANDITU = TIANDITU_DEFAULT, TIANDITU_SERVER = TIANDITU_SERVER_DEFAULT;
  try {
    const _tdtSaved = JSON.parse(localStorage.getItem("appsettings_key_v1") || "null");
    if (_tdtSaved && _tdtSaved.TIANDITU_TOKEN) TIANDITU = _tdtSaved.TIANDITU_TOKEN;
    if (_tdtSaved && _tdtSaved.TIANDITU_SERVER_TOKEN) TIANDITU_SERVER = _tdtSaved.TIANDITU_SERVER_TOKEN;
    if (!localStorage.getItem("appsettings_key_v1") && CFG.TIANDITU_TOKEN) {
      TIANDITU = CFG.TIANDITU_TOKEN;
      if (CFG.TIANDITU_SERVER_TOKEN) TIANDITU_SERVER = CFG.TIANDITU_SERVER_TOKEN;
    }
  } catch (e) {}
  // Leaflet 默认图标走本地文件
  L.Icon.Default.imagePath = "lib/images/";
  L.Icon.Default.mergeOptions({
    iconUrl: "lib/images/marker-icon.png",
    iconRetinaUrl: "lib/images/marker-icon-2x.png",
    shadowUrl: "lib/images/marker-shadow.png"
  });
  // 古建标记：倒立蓝色水滴状（尖端朝上、圆鼓朝下覆盖点位）、中心小白点（内联 SVG，缩放清晰，APK/Web 通用）
  const MARKER = L.divIcon({
    className: "drop-marker",
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 2 C 20 12 26 18 26 26 A 12 12 0 1 1 2 26 C 2 18 8 12 14 2 Z" fill="#3da9fc" stroke="#1b6fb8" stroke-width="1.5"/><circle cx="14" cy="26" r="5" fill="#ffffff"/></svg>`,
    iconSize: [28, 40], iconAnchor: [14, 38], popupAnchor: [0, -30]
  });
  // 筛选命中标记：倒立水滴（尖端朝下、圆鼓朝上），绿色，区别于普通蓝色正水滴
  const FILTER_MARKER = L.divIcon({
    className: "drop-marker-filter",
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 38 C 20 28 26 22 26 14 A 12 12 0 1 1 2 14 C 2 22 8 28 14 38 Z" fill="#2ecc8f" stroke="#1d8f63" stroke-width="1.5"/><circle cx="14" cy="14" r="5" fill="#ffffff"/></svg>`,
    iconSize: [28, 40], iconAnchor: [14, 38], popupAnchor: [0, -30]
  });

  // 全局版本号（单一事实来源：关于 / 版本变更 / 帮助 均引用此处，避免硬编码漂移）
  const APP_VER = "v2.4.8";

  // ---------- 状态 ----------
  let BASE = [], DELTA = { added: [], updated: {}, deleted: [] }, records = [];
  let map, layerGroup, overlayGroup, ckLayer;
  let filterCircle = null; // 筛选命中绿色虚线圆圈（v2.4.3 用户指定）
  const filterActive = () => !!(filter.province.length || filter.city.length || filter.atype.length || (filter.q && filter.q.trim()) || (filter.photo && filter.photo.mode !== "all"));
  let vecLayer = null, cvaLayer = null, imgLayer = null, ciaLayer = null, basemapOn = false, layerType = "vec";
  let lastCenter = null, myLoc = null, myLocMarker = null;
  let measureMode = false, measurePts = [], measureLine = null;
  let nearbyCenter = null, nearbyRadius = null, nearbyCircle = null, nearbyAtypes = [];
  const DEFAULT_CENTER = [39.9163, 116.3972]; // 北京故宫 质心
  const DEFAULT_ZOOM = 12;
  const filter = { province: [], city: [], atype: [], q: "", photo: { mode: "all", min: 0 } };
  let pickMode = false, pendingLatLng = null, editId = null, formPhotos = [];
  let coordResult = null, pickForCoord = false;   // 获取经纬度：地图点选回填
  // 批量导入缓冲（原生逐文件回调）
  let pendingBatch = { photos: [], sheets: [] };
  const BATCH_STATE = { active: false, kind: null };
  function b64ToDataUrl(name, b64) {
    const l = (name || "").toLowerCase();
    let mime = "image/jpeg";
    if (l.endsWith(".png")) mime = "image/png";
    else if (l.endsWith(".gif")) mime = "image/gif";
    else if (l.endsWith(".webp")) mime = "image/webp";
    else if (l.endsWith(".bmp")) mime = "image/bmp";
    return "data:" + mime + ";base64," + b64;
  }

  // ---------- 超大文件 / 网络辅助 ----------
  // 网络信息：是否 WiFi、是否在线、连接类型
  function netInfo() {
    const c = (navigator.connection || navigator.mozConnection || navigator.webkitConnection || {});
    const type = c.type || c.effectiveType || "";
    return {
      online: navigator.onLine !== false,
      type: type,
      wifi: type === "wifi",
      meteredHint: (type && type !== "wifi" && type !== "") // 非 wifi 视为可能走流量
    };
  }
  // 大流量确认：非 WiFi 时警告（items 1/2：可能 >3GB）
  function confirmLargeTransfer(title) {
    const n = netInfo();
    return new Promise((resolve) => {
      if (n.wifi || !n.online) return resolve(true); // WiFi 或离线（离线说明本地操作，无需流量）
      const html = `<div class="hint" style="color:#e67e22">⚠️ 当前<b>未连接 WiFi</b>（连接类型：${esc(n.type || "未知")}），传输超大文件（可能 >3GB）将消耗大量移动流量，可能产生资费。</div>
        <div class="hint">建议：连接 WiFi 后再操作；或确认流量充足后继续。</div>`;
      openModal(title || "大流量提醒", html, `<button class="btn ghost" id="ltCancel">取消</button><button class="btn primary" id="ltGo">仍要继续</button>`);
      el("ltCancel").onclick = () => { closeModal(); resolve(false); };
      el("ltGo").onclick = () => { closeModal(); resolve(true); };
    });
  }
  // 压缩包体积预检（item 1 根因：1.7G 直接 OOM/死机）：移动端 WebView 内存有限，整包加载必崩
  // 返回 true 表示已拦截（弹窗引导分卷），调用方应 return；false 表示可继续
  function zipSizeRefuse(f) {
    const HARD = 1200 * 1048576; // 1.2GB：超过此值手机 WebView 几乎必然崩溃
    if (f.size > HARD) {
      BATCH_STATE.active = false;
      const mb = Math.round(f.size / 1048576), gb = (f.size / 1073741824).toFixed(2);
      openModal("压缩包过大，无法导入",
        `<div class="hint" style="color:#e74c3c">⚠️ 压缩包约 <b>${gb} GB（${mb} MB）</b>，已超过移动端安全上限（建议 ≤500MB）。<br>手机 WebView 内存有限，整包加载会直接崩溃 / 死机。</div>
         <div class="hint">解决方法：<b>在电脑上按城市拆成多个 ≤500MB 的 zip</b> 后逐个导入；或用「手机文件夹」分批选照片。</div>`,
        `<button class="btn primary" id="zOk">我知道了</button>`);
      el("zOk").onclick = closeModal;
      return true;
    }
    return false;
  }
  // 内容哈希（用于内容去重，item 6）：dataUrl(base64) → sha256 十六进制
  async function shaHexOfB64(b64) {
    try { return await IO.sha256Hex(IO.b64ToBytes(b64)); } catch (e) { return "err:" + (b64 || "").length; }
  }

  // 导入续传检查点（item 1/2：中断后可继续，不丢进度）
  const IMPORT_CP = { active: false, kind: null, received: 0, startedAt: 0 };
  function importCpStart(kind) {
    IMPORT_CP.active = true; IMPORT_CP.kind = kind; IMPORT_CP.received = 0; IMPORT_CP.startedAt = Date.now();
  }
  function importCpTouch() { IMPORT_CP.received++; }
  function importCpEnd() { IMPORT_CP.active = false; IMPORT_CP.kind = null; IMPORT_CP.received = 0; }
  // 若上次导入被中断（active 仍为 true 且未超过 24h），提示用户
  function importCpResumePrompt(kind) {
    return new Promise((resolve) => {
      if (!IMPORT_CP.active) return resolve(false);
      const mins = Math.round((Date.now() - IMPORT_CP.startedAt) / 60000);
      if (mins > 1440) { importCpEnd(); return resolve(false); }
      const html = `<div class="hint">检测到上一次「${IMPORT_CP.kind === "photos" ? "照片" : "古建"}」导入可能未正常完成（已接收 ${IMPORT_CP.received} 个文件，约 ${mins} 分钟前）。</div>
        <div class="hint">建议「继续」重新选择来源并按需追加；若已无需，请选择「放弃」。</div>`;
      openModal("导入续传", html, `<button class="btn ghost" id="cpDrop">放弃上次</button><button class="btn primary" id="cpGo">继续</button>`);
      el("cpDrop").onclick = () => { importCpEnd(); closeModal(); resolve(false); };
      el("cpGo").onclick = () => { closeModal(); resolve(true); };
    });
  }

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const el = (id) => document.getElementById(id);
  function toast(msg) {
    const t = el("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function openModal(title, bodyHtml, footHtml) {
    el("modalTitle").textContent = title;
    el("modalBody").innerHTML = bodyHtml;
    el("modalFoot").innerHTML = footHtml || "";
    el("modal").classList.add("open");
    el("modalMask").classList.add("show");
  }
  function closeModal() {
    el("modal").classList.remove("open");
    el("modalMask").classList.remove("show");
  }
  // 全屏"执行中，请稍后"遮罩：导入/导出/压缩/大批量操作时调用，避免误以为卡死
  let _busyEl;
  function busy(msg) {
    if (!_busyEl) {
      _busyEl = document.createElement("div");
      _busyEl.id = "busy";
      _busyEl.innerHTML = `<div class="busy-box"><div class="spinner"></div><div class="busy-msg"></div></div>`;
      document.body.appendChild(_busyEl);
    }
    _busyEl.querySelector(".busy-msg").textContent = msg || "执行中，请稍后…";
    _busyEl.classList.add("show");
  }
  function hideBusy() { if (_busyEl) _busyEl.classList.remove("show"); }
  // 原生返回键 / Esc：逐级关闭 弹窗 > 抽屉 > 测距 > 列表
  function pickFiles(opts) {
    try { if (_pendingFileInput && _pendingFileInput.parentNode) _pendingFileInput.parentNode.removeChild(_pendingFileInput); } catch (e) {}
    const inp = document.createElement("input");
    inp.type = "file";
    if (opts.accept) inp.accept = opts.accept;
    if (opts.multiple) inp.multiple = true;
    if (opts.webkitdirectory) inp.webkitdirectory = true;
    inp.style.position = "fixed"; inp.style.left = "-9999px"; inp.style.top = "0";
    const onPick = opts.onPick;
    // 非静默失败看门狗：选择器若确实没弹出（无失焦且无回调），2.5s 后 toast 引导，绝不"点了没反应"
    let chooserOpened = false;
    const onBlur = () => { chooserOpened = true; };
    const watchdog = setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      if (!chooserOpened) toast("未弹出文件选择器？请检查系统「文件/存储」权限，或改用「批量导入」来源");
    }, 2500);
    window.addEventListener("blur", onBlur);
    inp.onchange = () => {
      clearTimeout(watchdog); window.removeEventListener("blur", onBlur);
      const files = inp.files ? Array.from(inp.files) : [];
      try { if (inp.parentNode) inp.parentNode.removeChild(inp); } catch (e) {}
      _pendingFileInput = null;
      if (onPick) onPick(files);
    };
    // 先挂到 DOM 再点击：部分 WebView 要求 input 在文档中才会弹出系统选择器，且挂 DOM 可防止被 GC
    document.body.appendChild(inp);
    _pendingFileInput = inp;
    inp.click();
  }

function back() {
    if (el("modal").classList.contains("open")) { closeModal(); return true; }
    if (el("drawer").classList.contains("open")) { closeDrawer(); return true; }
    if (measureMode) { exitMeasure(); return true; }
    if (el("listbar").classList.contains("open")) { el("listbar").classList.remove("open"); return true; }
    if (el("drawer").classList.contains("open")) { closeDrawer(); return true; }
    return false;
  }
  // 三击地图任意处：关闭任何卡住的弹窗/列表，并打开主菜单（解决"找不到主菜单"）
  function tripleTapMenu() {
    closeModal();
    if (el("listbar").classList.contains("open")) el("listbar").classList.remove("open");
    el("drawer").classList.add("open"); el("mask").classList.add("show"); applyHiddenMenus();
    toast("已打开主菜单");
  }

  // ---------- 数据 ----------
  async function load() {
    let json;
    if (window.__DATA__ && window.__DATA__.features) {
      json = window.__DATA__;            // 离线/APK 场景：内嵌数据，免 fetch
    } else {
      const res = await fetch("data.json");
      json = await res.json();
    }
    BASE = json.features || [];
    DELTA = await Store.get();
    applyDims();
    merge();
    render();
  }
  function merge() {
    const del = new Set(DELTA.deleted || []);
    records = [];
    for (const r of BASE) {
      if (del.has(r.id)) continue;
      const up = DELTA.updated[r.id];
      records.push(up ? Object.assign({}, r, up) : r);
    }
    for (const a of (DELTA.added || [])) records.push(a);
    applyDims();
  }
  function applyDims() {
    DIMS.provinces = uniq(records.map((r) => r.province).filter(Boolean));
    DIMS.citys = uniq(records.map((r) => r.city).filter(Boolean));
    DIMS.stations = uniq(records.map((r) => r.station).filter(Boolean));
    DIMS.atypes = uniq(records.map((r) => r.atype).filter(Boolean));
  }
  // v2.4.3 补齐古建缺失的全局依赖（orgManager / btypeManager 菜单长期引用但未定义 → 打开即 script error）
  const ORGCFG_KEY = "gujian_orgcfg_v1";
  let ORGCFG = (() => { try { return JSON.parse(localStorage.getItem(ORGCFG_KEY)) || { cityExtra: [], typeExtra: [], defaults: {} }; } catch (e) { return { cityExtra: [], typeExtra: [], defaults: {} }; } })();
  function saveCFG() { try { localStorage.setItem(ORGCFG_KEY, JSON.stringify(ORGCFG)); } catch (e) {} }
  // 规范化城市名：去「市」尾、直辖市去「市」（北京市→北京），统一城市统计/匹配口径
  function normCity(c) { return (c || "").replace(/^(北京|天津|上海|重庆)市$/, "$1").replace(/市$/, "").trim(); }
  function orgDefaultCity() { return (ORGCFG.defaults && ORGCFG.defaults.city) || ""; }
  const DIMS = { provinces: [], citys: [], stations: [], atypes: [] };
  function uniq(a) { return [...new Set(a)].sort(); }

  function passFilter(r) {
    if (filter.province.length && !filter.province.includes(r.province)) return false;
    if (filter.city.length && !filter.city.includes(r.city)) return false;
    if (filter.atype.length && !filter.atype.includes(r.atype)) return false;
    if (filter.photo && filter.photo.mode !== "all") {
      const cnt = (r.photos || []).length;
      if (filter.photo.mode === "has" && cnt <= 0) return false;
      if (filter.photo.mode === "none" && cnt > 0) return false;
      if (filter.photo.mode === "min" && cnt < (filter.photo.min || 0)) return false;
    }
    if (filter.q && !`${r.name}${r.province}${r.city}${r.station}${r.atype}`.toLowerCase().includes(filter.q.toLowerCase())) return false;
    if (nearbyCenter && nearbyRadius != null) {
      if (haversine(nearbyCenter, { lat: r.lat, lon: r.lon }) > nearbyRadius) return false;
    }
    if (nearbyAtypes.length && !nearbyAtypes.includes(r.atype)) return false;
    return true;
  }

  // ---------- UI 状态持久化 ----------
  function loadUI() {
    const s = Store.ui.get();
    if (s) {
      filter.province = Array.isArray(s.province) ? s.province : [];
      filter.city = Array.isArray(s.city) ? s.city : [];
      filter.atype = Array.isArray(s.atype) ? s.atype : [];
      basemapOn = s.basemap === true;
      layerType = (s.layer === "img") ? "img" : "vec";
      lastCenter = s.center || null;
    } else {
      // 首次打开：默认「北京」(数据城市字段值为"北京"非"北京市")，仅载北京古建→开图更快；不加载底图
      filter.province = [];
      filter.city = ["北京"];
      filter.atype = [];
      basemapOn = false;
      layerType = "vec";
      lastCenter = null;
    }
  }
  function saveUI() {
    Store.ui.set({ province: filter.province, city: filter.city, atype: filter.atype, basemap: basemapOn, layer: layerType, center: lastCenter });
  }

  // ---------- 地图 ----------
  // v2.4.3：底图 URL / 参数提升为模块级，initMap 与 refreshBasemap 共用（密钥可运行时热替换）
  const TDT_BASEOPTS = { maxZoom: 18, subdomains: "01234567" };
  const tdtUrl = (lyr) => `https://t{s}.tianditu.gov.cn/${lyr}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${lyr}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU}`;
  function initMap() {
    // attributionControl 去掉默认「Leaflet」外链（https://leafletjs.com）：离线/弱网点该链接会 ERR_CONNECTION_TIMED_OUT；本地资源已离线化
    map = L.map("map", { zoomControl: true, attributionControl: L.control.attribution({ prefix: false }) }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    const baseOpts = TDT_BASEOPTS, tk = tdtUrl;
    vecLayer = L.tileLayer(tk("vec"), baseOpts);
    cvaLayer = L.tileLayer(tk("cva"), baseOpts);
    imgLayer = L.tileLayer(tk("img"), baseOpts);
    ciaLayer = L.tileLayer(tk("cia"), baseOpts);
    layerGroup = L.layerGroup().addTo(map);
    overlayGroup = L.layerGroup().addTo(map); // 测距 / 周边 等叠加层，render() 不清空
    ckLayer = L.layerGroup().addTo(map); // 打卡足迹叠加层（金色 #e0a93c）
    map.on("popupopen", onPopupOpen);
    map.on("click", (e) => {
      if (measureMode) { addMeasurePt(e.latlng); return; }
      if (pickMode) {
        pendingLatLng = e.latlng;
        if (pickForCoord) {
          // 获取经纬度：地图点选 → 回填并重新打开弹窗
          pickForCoord = false; togglePick(false);
          coordResult = { lat: e.latlng.lat, lon: e.latlng.lng };
          getCoord();
          return;
        }
        $("#fLat").value = e.latlng.lat.toFixed(6);
        $("#fLon").value = e.latlng.lng.toFixed(6);
        toast("已选择坐标：" + e.latlng.lat.toFixed(5) + ", " + e.latlng.lng.toFixed(5));
        togglePick(false);
      }
    });
    map.on("contextmenu", (e) => {
      if (measureMode || pickMode) return;
      if (e && e.originalEvent) e.originalEvent.preventDefault();
      openCtxMenu(e.originalEvent.clientX, e.originalEvent.clientY, mapCtxItems(e.latlng));
    });
    map.on("moveend", () => {
      lastCenter = { lat: map.getCenter().lat, lng: map.getCenter().lng, zoom: map.getZoom() };
      saveUI();
    });
  }
  function addBasemap() {
    [vecLayer, cvaLayer, imgLayer, ciaLayer].forEach((L0) => { if (map.hasLayer(L0)) map.removeLayer(L0); });
    if (basemapOn) {
      if (layerType === "img") { imgLayer.addTo(map); ciaLayer.addTo(map); }
      else { vecLayer.addTo(map); cvaLayer.addTo(map); }
    }
    updateBaseBtn(); updateLayerBtn();
  }
  // v2.4.3：密钥更换后重建 4 个瓦片层（无需刷新页面）
  function refreshBasemap() {
    [vecLayer, cvaLayer, imgLayer, ciaLayer].forEach((L0) => { if (L0 && map.hasLayer(L0)) map.removeLayer(L0); });
    vecLayer = L.tileLayer(tdtUrl("vec"), TDT_BASEOPTS);
    cvaLayer = L.tileLayer(tdtUrl("cva"), TDT_BASEOPTS);
    imgLayer = L.tileLayer(tdtUrl("img"), TDT_BASEOPTS);
    ciaLayer = L.tileLayer(tdtUrl("cia"), TDT_BASEOPTS);
    if (basemapOn) { if (layerType === "img") { imgLayer.addTo(map); ciaLayer.addTo(map); } else { vecLayer.addTo(map); cvaLayer.addTo(map); } }
    updateBaseBtn(); updateLayerBtn();
  }
  function setBasemap(on) { basemapOn = on; saveUI(); addBasemap(); toast(on ? "已开启底图" : "已关闭底图"); }
  function setLayer(t) {
    layerType = (t === "img") ? "img" : "vec";
    saveUI();
    if (basemapOn) addBasemap();
    toast(layerType === "img" ? "影像地图" : "矢量地图");
  }
  function updateBaseBtn() {
    const b = el("btnBase"); if (!b) return;
    b.classList.toggle("active", basemapOn);
    b.textContent = basemapOn ? "🗺" : "🚫";
    b.title = basemapOn ? "关闭底图" : "开启底图";
  }
  function updateLayerBtn() {
    const b = el("btnLayer"); if (!b) return;
    b.textContent = layerType === "img" ? "影像" : "矢量";
    b.title = "底图图源（点击打开底图选择）";
    b.classList.toggle("active", basemapOn);
  }
  // 底图选择：矢量 / 影像 / 仅点位，清晰高亮当前选中
  function openBasemap() {
    const opts = [
      { k: "vec", t: "矢量地图", s: "道路 / 注记清晰，适合日常巡查", on: basemapOn && layerType === "vec" },
      { k: "img", t: "影像地图", s: "卫星影像，适合看地形地物", on: basemapOn && layerType === "img" },
      { k: "off", t: "仅点位（省流量）", s: "不加载底图，仅显示采集点", on: !basemapOn }
    ];
    const html = opts.map((o) =>
      `<div class="bm-opt ${o.on ? "on" : ""}" data-k="${o.k}">
        <span class="bm-dot"></span>
        <div class="bm-tx"><div class="bm-t">${o.t}</div><div class="bm-s">${o.s}</div></div>
        <span class="bm-check">✓</span>
      </div>`).join("");
    openModal("底图选择", html, `<button class="btn ghost" onclick="APP.close()">关闭</button>`);
    el("modalBody").querySelectorAll(".bm-opt").forEach((node) => {
      node.onclick = () => {
        const k = node.dataset.k;
        if (k === "off") basemapOn = false;
        else { basemapOn = true; layerType = k; }
        saveUI(); addBasemap(); updateBaseBtn(); updateLayerBtn();
        openBasemap(); // 刷新选中态
      };
    });
  }
  function fitToShown() {
    const b = layerGroup.getBounds();
    if (b.isValid()) map.fitBounds(b.pad(0.12));
    else map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }

  function render() {
    layerGroup.clearLayers();
    if (filterCircle) { overlayGroup.removeLayer(filterCircle); filterCircle = null; }
    const ic = filterActive() ? FILTER_MARKER : MARKER;
    let n = 0;
    for (const r of records) {
      if (!passFilter(r)) continue;
      const lat = +r.lat, lon = +r.lon;
      // 非法坐标（NaN/Infinity，常见于导入的线/面/无坐标要素）直接跳过，避免 Leaflet 抛错
      if (!isFinite(lat) || !isFinite(lon)) continue;
      n++;
      const m = L.marker([lat, lon], { icon: ic }).bindPopup(popupHtml(r));
      m._rid = r.id;
      m.on("click", () => { if (measureMode) addMeasurePt({ lat: lat, lon: lon }); });
      m.on("contextmenu", (e) => { if (e && e.originalEvent) { L.DomEvent.stop(e); e.originalEvent.preventDefault(); } openCtxMenu(e.originalEvent.clientX, e.originalEvent.clientY, ctxItemsFor(r)); });
      layerGroup.addLayer(m);
    }
    // 周边搜索范围圈
    if (nearbyCenter && nearbyRadius != null) {
      if (nearbyCircle) overlayGroup.removeLayer(nearbyCircle);
      nearbyCircle = L.circle([nearbyCenter.lat, nearbyCenter.lon], { radius: nearbyRadius, color: "#3da9fc", weight: 1.5, fillColor: "#3da9fc", fillOpacity: 0.08 }).addTo(overlayGroup);
    }
    el("listCnt") && (el("listCnt").textContent = `${n} / ${records.length}`);
    updateFilterBar();
    renderList();
  }
  // 筛选状态条：实时显示命中古建数，无筛选时隐藏
  function updateFilterBar() {
    const bar = el("filterBar"); if (!bar) return;
    const rs = records.filter(passFilter);
    if (filterActive()) {
      el("fbCnt").textContent = rs.length;
      bar.classList.add("show");
    } else {
      bar.classList.remove("show");
    }
  }
  // v2.4.3 绿色虚线圆圈「刚刚好」圈住全部命中古建，并把视野调到刚好完整显示该圆圈
  // 算法：Ritter 最小包围圆（等距投影到米制平面）→ 比旧的「外接矩形质心 + 最远距离」半径更贴合，
  // 收尾再做一次全点包含性校正，保证一个都不漏在圈外（沉默漏点是不可接受的）。
  const FILTER_CIRCLE_COLOR = "#22c55e";   // 绿色虚线（用户指定）
  function minEnclosingCircle(pts) {
    // 等距圆柱投影：以首点纬度为基准，把经纬度换成米，小/中范围误差可忽略
    const lat0 = pts[0][0] * Math.PI / 180;
    const MPD_LAT = 110540, MPD_LON = 111320 * Math.cos(lat0);
    const P = pts.map(([la, lo]) => [lo * MPD_LON, la * MPD_LAT]);
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    // 1) 找近似直径：任取一点 → 最远点 q → 从 q 找最远点 r
    let q = P[0];
    for (const p of P) if (dist(P[0], p) > dist(P[0], q)) q = p;
    let r = P[0];
    for (const p of P) if (dist(q, p) > dist(q, r)) r = p;
    let cx = (q[0] + r[0]) / 2, cy = (q[1] + r[1]) / 2, rad = dist(q, r) / 2;
    // 2) 逐点扩圆（Ritter）
    for (const p of P) {
      const d = Math.hypot(p[0] - cx, p[1] - cy);
      if (d > rad) {
        const nr = (rad + d) / 2, k = (d - nr) / d;
        cx += (p[0] - cx) * k; cy += (p[1] - cy) * k; rad = nr;
      }
    }
    // 3) 包含性校正：任何漏在圈外的点直接把半径顶上去（宁大不漏）
    for (const p of P) rad = Math.max(rad, Math.hypot(p[0] - cx, p[1] - cy));
    return { lat: cy / MPD_LAT, lon: cx / MPD_LON, radius: rad };
  }
  function drawFilterCircle(rs) {
    if (filterCircle) { overlayGroup.removeLayer(filterCircle); filterCircle = null; }
    const pts = rs.map((r) => [+r.lat, +r.lon]).filter((p) => isFinite(p[0]) && isFinite(p[1]));
    if (pts.length < 1) return;
    const style = { color: FILTER_CIRCLE_COLOR, weight: 2, dashArray: "8 6", fillColor: FILTER_CIRCLE_COLOR, fillOpacity: 0.07 };
    // 只命中 1 个：直接跳到该古建位置（小圈标出所在点）
    if (pts.length === 1) {
      const [lat, lon] = pts[0];
      filterCircle = L.circle([lat, lon], Object.assign({ radius: 220 }, style)).addTo(overlayGroup);
      map.flyTo([lat, lon], Math.max(map.getZoom(), 16), { duration: 0.6 });
      return;
    }
    // 命中多个：最小包围圆 + 极小余量（余量只为避免点压在圈线上，不让圈明显偏大）
    const mec = minEnclosingCircle(pts);
    const radius = Math.max(mec.radius * 1.04 + 30, 120);
    filterCircle = L.circle([mec.lat, mec.lon], Object.assign({ radius }, style)).addTo(overlayGroup);
    // 视野「刚好完全显示这个圆圈」：按圆的外接框收敛，padding 仅留一点边距
    map.flyToBounds(filterCircle.getBounds(), { padding: [24, 24], duration: 0.6, maxZoom: 18 });
  }
  // 清除筛选：清空条件、搜索框与圆圈，恢复正常蓝色正水滴
  function clearFilter() {
    filter.city = []; filter.atype = []; filter.q = ""; filter.photo = { mode: "all", min: 0 };
    const s = el("search"); if (s) s.value = "";
    if (filterCircle) { overlayGroup.removeLayer(filterCircle); filterCircle = null; }
    render(); saveUI();
    toast("已清除筛选");
  }

  // 防御性全局别名：兼容旧构建/外部 HTML 的 onclick 引用，避免 ReferenceError
window.LIDNotifyld = function () {};
function showAllParams(id) {
  const r = (typeof records !== "undefined" ? records : []).find((x) => x && x.id === id);
  if (!r) return toast("未找到该建筑物");
  const rows = Object.keys(r.params || {}).map((k) => `<tr><td class="k">${esc(k)}</td><td>${esc(r.params[k])}</td></tr>`).join("");
  const sub = esc([r.office || r.city, r.station, r.btype || r.atype].filter(Boolean).join(" / "));
  const html = `<div class="hint">${sub}</div><div class="pop-params" style="max-height:60vh;overflow:auto">${rows ? `<table>${rows}</table>` : '<div class="hint">无参数</div>'}</div>`;
  openModal("完整参数 · " + esc(r.name), html, `<button class="btn primary" onclick="APP.close()">关闭</button>`);
}

function popupHtml(r) {
    const tag = [r.city, r.station, r.atype].filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
    const rows = Object.keys(r.params || {}).map((k) => `<tr><td class="k">${esc(k)}</td><td>${esc(r.params[k])}</td></tr>`).join("");
    // 弹窗照片封顶 18 张（超出显示 +N），避免单点照片过多拖慢地图弹窗（item 2）
    const allPh = (r.photos || []);
    const shownPh = allPh.slice(0, 18);
    const extraPh = allPh.length - shownPh.length;
    const ph = shownPh.map((p, i) => `<img src="${p.dataUrl || ""}" data-rid="${r.id}" data-pi="${i}" onclick="APP.viewPhotos('${r.id}')">`).join("") + (extraPh > 0 ? `<div class="th-more">+${extraPh} 张</div>` : "");
    const navBtn = `<button class="btn ok" onclick="APP.navigate('${r.id}')">导航</button>`;
    const detailBtn = `<button class="btn ghost" onclick="APP.showAllParams('${r.id}')">完整参数</button>`;
    const nearBtn = `<button class="btn ghost" onclick="APP.nearCenter('${r.id}')">以此为周边中心</button>`;
    return `<div class="pop"><h3>${esc(r.name)}</h3>${tag}
      <div class="pop-params">${rows ? `<table>${rows}</table>` : '<div class="hint">无参数</div>'}</div>
      ${ph ? `<div class="thumbs">${ph}</div>` : ""}
      <div class="pop-actions">
        ${navBtn}
        ${detailBtn}
        <button class="btn ok" onclick="APP.edit('${r.id}')">编辑</button>
        <button class="btn ghost" onclick="APP.shareBuilding('${r.id}')">分享</button>
        <button class="btn danger" onclick="APP.del('${r.id}')">删除</button>
      </div>
      <div class="pop-actions" style="margin-top:6px">${nearBtn}</div></div>`;
  }

  function esc(s) { return IO.escapeXml(s); }

  function onPopupOpen(e) {
    const id = e.popup._source._rid;
    // 占位（按钮用 APP.edit/del 全局）
  }

  // 列表项 → 快速定位到地图
  function locateInMap(r) {
    const lat = +r.lat, lon = +r.lon;
    if (isFinite(lat) && isFinite(lon)) {
      // 飞行动画跳转，目标更明显；若已放大则不强行缩小
      map.flyTo([lat, lon], Math.max(map.getZoom(), 15), { duration: 0.6 });
      layerGroup.eachLayer((m) => { if (m._rid === r.id) m.openPopup(); });
    } else {
      // 沉默失败→明确提示，不再"点了没反应"
      toast("该古建缺少有效坐标，无法定位");
    }
    el("listbar").classList.remove("open");
  }

  function renderList() {
    const box = el("listScroll"); if (!box) return;
    box.innerHTML = "";
    const rs = records.filter(passFilter);
    for (const r of rs) {
      const div = document.createElement("div");
      div.className = "li";
      div.dataset.id = r.id;
      // 名称后徽标：基础数据→"快速定位"（可点进地图），用户新增→"新增"
      div.innerHTML = `<div><div class="nm">${esc(r.name)}</div><div class="mt">${esc([r.city, r.station, r.atype].filter(Boolean).join(" / "))}</div></div><span class="badge locbtn">${r.base ? "快速定位 →" : "新增"}</span>`;
      div.onclick = () => locateInMap(r);
      div.addEventListener("contextmenu", (e) => { e.preventDefault(); openCtxMenu(e.clientX, e.clientY, ctxItemsFor(r)); });
      box.appendChild(div);
    }
  }

  // ---------- 筛选关键词历史（可展开/收起/复用）----------
  const KW_HIST_KEY = "gujian_kw_hist_v1", KW_HIST_MAX = 12;
  function loadKwHist() {
    try { const a = JSON.parse(localStorage.getItem(KW_HIST_KEY) || "[]"); return Array.isArray(a) ? a.filter(Boolean) : []; } catch (e) { return []; }
  }
  function pushKwHist(kw) {
    kw = (kw || "").trim(); if (!kw) return;
    let a = loadKwHist().filter((x) => x !== kw);
    a.unshift(kw); a = a.slice(0, KW_HIST_MAX);
    try { localStorage.setItem(KW_HIST_KEY, JSON.stringify(a)); } catch (e) {}
  }

  // ---------- 筛选（多选 城市 / 古建类型；选城市自动定位）----------
  function openFilter() {
    const kwHist = loadKwHist();
    const group = (title, arr, sel) =>
      `<div class="fgroup"><div class="ftitle">${title}（<b class="cnt">${sel.length}</b> 已选）</div><div class="chips">` +
      (arr.length ? arr.map((v) => `<span class="chip ${sel.includes(v) ? "on" : ""}" data-grp="${title}" data-v="${esc(v)}">${esc(v)}</span>`).join("") : `<span class="hint">无</span>`) +
      `</div></div>`;
    const html =
      `<div class="hint">可多选：省份 / 城市 / 古建类型（如 寺庙 / 古塔）。选择城市会自动定位到其范围中心；不选则显示全部。</div>` +
      (filter.q && filter.q.trim() ? `<div class="fqhint">🔎 当前查询关键词：<b>${esc(filter.q.trim())}</b><span class="fqsub">（筛选在此基础上叠加，下方命中数已计入）</span></div>` : "") +
      group("省份", DIMS.provinces, filter.province) +
      group("城市", DIMS.citys, filter.city) +
      group("古建类型", DIMS.atypes, filter.atype) +
      (kwHist.length ? `<div class="fgroup"><div class="ftitle collapsible" id="kwHistTog" style="cursor:pointer">🔎 关键词历史（<b class="cnt">${kwHist.length}</b>）<span class="tg">＋</span></div><div class="chips" id="kwHistBox" style="display:none">` + kwHist.map((k) => `<span class="chip kw" data-kw="${esc(k)}">${esc(k)}</span>`).join("") + `</div></div>` : "") +
      `<div class="fgroup"><div class="ftitle">照片</div><div class="chips" id="phFiltChips">` +
        `<span class="chip ${filter.photo.mode === "all" ? "on" : ""}" data-pm="all">全部</span>` +
        `<span class="chip ${filter.photo.mode === "has" ? "on" : ""}" data-pm="has">有照片</span>` +
        `<span class="chip ${filter.photo.mode === "none" ? "on" : ""}" data-pm="none">无照片</span>` +
        `<span class="chip ${filter.photo.mode === "min" ? "on" : ""}" data-pm="min">至少 N 张</span>` +
      `</div><div class="field" style="margin-top:8px"><label>至少张数（选「至少 N 张」时生效）</label><input type="number" id="phFiltMin" min="1" value="${filter.photo.min || 1}" style="width:110px"></div></div>` +
      `<div class="fhit" id="fHit" style="margin-top:12px;padding:9px 12px;border:1px dashed var(--accent);border-radius:10px;color:var(--txt);font-size:13px">当前命中 <b id="fHitB" style="color:var(--accent);font-size:15px">0</b> 个古建 · <b id="fHitP" style="color:var(--accent);font-size:15px">0</b> 张照片</div>`;
    openModal("筛选", html, `<button class="btn ghost" id="fExit">退出</button><button class="btn ghost" id="fReset">重置</button><button class="btn primary" id="fApply">应用</button>`);
    const body = el("modalBody");
    const liveCount = () => {
      const bo = [...body.querySelectorAll('.chip[data-grp="城市"].on')].map((c) => c.dataset.v);
      const bt = [...body.querySelectorAll('.chip[data-grp="古建类型"].on')].map((c) => c.dataset.v);
      const bp = [...body.querySelectorAll('.chip[data-grp="省份"].on')].map((c) => c.dataset.v);
      const q = (el("search") ? el("search").value : "").trim().toLowerCase();
      let b = 0, p = 0; // b=命中古建数，p=命中照片张数
      for (const r of records) {
        if (bp.length && !bp.includes(r.province)) continue;
        if (bo.length && !bo.includes(r.city)) continue;
        if (bt.length && !bt.includes(r.atype)) continue;
        if (q && !`${r.name}${r.city}${r.station}${r.atype}`.toLowerCase().includes(q)) continue;
        if (filter.photo && filter.photo.mode !== "all") {
          const cnt = (r.photos || []).length;
          if (filter.photo.mode === "has" && cnt <= 0) continue;
          if (filter.photo.mode === "none" && cnt > 0) continue;
          if (filter.photo.mode === "min" && cnt < (filter.photo.min || 0)) continue;
        }
        b++; p += (r.photos || []).length;
      }
      return { b, p };
    };
    // 防抖（v2.4：照片 chip/至少 N 张 oninput 高频触发全库循环）
    let _hitT = null;
    const refreshHit = () => { if (_hitT) clearTimeout(_hitT); _hitT = setTimeout(() => { const h = el("fHit"); if (!h) return; const c = liveCount(); h.querySelector("#fHitB").textContent = c.b; h.querySelector("#fHitP").textContent = c.p; }, 200); };
    body.querySelectorAll('.chip[data-grp]').forEach((c) => c.onclick = () => {
      c.classList.toggle("on");
      const grp = c.dataset.grp;
      const sel = [...body.querySelectorAll(`.chip[data-grp="${grp}"].on`)].map((x) => x.dataset.v);
      const cntEl = c.closest(".fgroup").querySelector(".cnt");
      if (cntEl) cntEl.textContent = sel.length;   // 守卫：照片组无 .cnt，不抛错
      refreshHit();
    });
    // 关键词历史：展开/收起 + 点击复用
    const kwTog = el("kwHistTog"), kwBox = el("kwHistBox");
    if (kwTog) kwTog.onclick = () => {
      if (!kwBox) return;
      const open = kwBox.style.display !== "none";
      kwBox.style.display = open ? "none" : "";
      kwTog.querySelector(".tg").textContent = open ? "＋" : "－";
    };
    body.querySelectorAll(".chip.kw").forEach((c) => c.onclick = () => {
      const kw = c.dataset.kw;
      const s = el("search"); if (s) s.value = kw;
      filter.q = kw; saveUI(); refreshHit();
      toast("已套用关键词：" + kw);
    });
    // 照片维度筛选：单选（互斥）
    const phChips = body.querySelectorAll("#phFiltChips .chip");
    phChips.forEach((c) => c.onclick = () => {
      phChips.forEach((x) => x.classList.remove("on"));
      c.classList.add("on");
      filter.photo.mode = c.dataset.pm;
      if (c.dataset.pm !== "min") filter.photo.min = 0;
      refreshHit();
    });
    const phMin = el("phFiltMin");
    if (phMin) phMin.oninput = () => { if (filter.photo.mode === "min") { filter.photo.min = Math.max(1, parseInt(phMin.value) || 1); refreshHit(); } };
    refreshHit();
    el("fExit").onclick = closeModal;
    el("fApply").onclick = () => {
      filter.atype = [...body.querySelectorAll('.chip[data-grp="古建类型"].on')].map((c) => c.dataset.v);
      filter.city = [...body.querySelectorAll('.chip[data-grp="城市"].on')].map((c) => c.dataset.v);
      filter.province = [...body.querySelectorAll('.chip[data-grp="省份"].on')].map((c) => c.dataset.v);
      const pm = body.querySelector("#phFiltChips .chip.on");
      filter.photo.mode = pm ? pm.dataset.pm : "all";
      const mn = el("phFiltMin");
      filter.photo.min = (filter.photo.mode === "min" && mn) ? Math.max(1, parseInt(mn.value) || 1) : 0;
      if (filter.q && filter.q.trim()) pushKwHist(filter.q); // v2.4：套用时持久化关键词
      closeModal(); render(); saveUI();
      // 结果行为：0→提示无符合；1→跳到该点；多→绿色虚线圆圈圈出全部并刚好显示
      const rs = records.filter(passFilter);
      if (!rs.length) toast("没有符合条件的选项");
      else if (rs.length === 1) {
        const r = rs[0], lat = +r.lat, lon = +r.lon;
        if (isFinite(lat) && isFinite(lon)) { map.flyTo([lat, lon], Math.max(map.getZoom(), 16), { duration: 0.6 }); layerGroup.eachLayer((m) => { if (m._rid === r.id) m.openPopup(); }); }
        toast("已定位唯一匹配：" + r.name);
      } else {
        drawFilterCircle(rs);
        toast(`已筛选出 ${rs.length} 个古建，已用绿色虚线圆圈圈出并居中显示`);
      }
    };
    el("fReset").onclick = () => { filter.province = []; filter.city = []; filter.atype = []; filter.photo = { mode: "all", min: 0 }; openFilter(); };
    // v2.4：管理维护入口
    const mgmtBar = document.createElement("div");
    mgmtBar.className = "fgroup";
    mgmtBar.innerHTML = `<div class="ftitle">管理维护</div><div class="chips">
      <button class="chip" id="mOrgMgrGJ" style="cursor:pointer">🏛️ 机构与默认城市管理</button>
      <button class="chip" id="mBtypeMgrGJ" style="cursor:pointer">🏷️ 古建类型管理</button>
    </div>`;
    body.appendChild(mgmtBar);
    el("mOrgMgrGJ").onclick = () => openOrgManager();
    el("mBtypeMgrGJ").onclick = () => openBtypeManager();
  }

  // ---------- 添加 / 编辑 表单 ----------
  function formHtml(r) {
    r = r || {};
    formPhotos = (r.photos || []).map((p) => ({ caption: p.caption || "", dataUrl: p.dataUrl || "" }));
    const citys = DIMS.citys, atypes = DIMS.atypes, provinces = DIMS.provinces;
    const sel = (id, arr, val) => `<select id="${id}">${[""].concat(arr).map((v) => `<option ${v === val ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>`;
    return `<div class="row2">
        <div class="field"><label>省份</label>${sel("fProv", provinces, r.province)}</div>
        <div class="field"><label>城市</label>${sel("fOffice", citys, r.city)}</div>
      </div>
      <div class="row2">
        <div class="field"><label>名称 *</label><input id="fName" value="${esc(r.name || "")}"></div>
        <div class="field"><label>古建类型</label>${sel("fBtype", atypes, r.atype)}</div>
      </div>
      <div class="row2">
        <div class="field"><label>区县 / 片区</label><input id="fStation" value="${esc(r.station || "")}"></div>
        <div class="field"><label>经度</label><input id="fLon" value="${r.lon != null ? r.lon : ""}" inputmode="decimal"></div>
      </div>
      <div class="row2">
        <div class="field"><label>纬度</label><input id="fLat" value="${r.lat != null ? r.lat : ""}" inputmode="decimal"></div>
      </div>
      <button class="btn ghost" id="fPick" style="margin-bottom:12px">📍 在地图上点选坐标</button>
      <div class="field"><label>古建文物特点（每行 字段: 值）</label><textarea id="fParams">${esc((r.params ? Object.entries(r.params).map(([k, v]) => `${k} : ${v}`).join("\n") : ""))}</textarea></div>
      <div class="field"><label>照片（可多张：正面 / 背面 / 侧面…）</label>
        <div class="photo-grid" id="fPhotos"></div>
        <div class="photo-add" id="fAddPhoto">＋ 添加照片</div>
        <input type="file" id="fFile" accept="image/*" multiple style="display:none">
      </div>`;
  }
  function renderPhotos() {
    const box = el("fPhotos"); if (!box) return;
    box.innerHTML = formPhotos.map((p, i) =>
      `<div class="photo-item"><img src="${p.dataUrl}"><div class="pc"><input value="${esc(p.caption)}" data-i="${i}" class="pcap" style="width:100%;border:0;background:transparent;color:#fff;font-size:11px" placeholder="说明"></div><button class="del" data-i="${i}">×</button></div>`
    ).join("");
    box.querySelectorAll(".del").forEach((b) => b.onclick = () => { formPhotos.splice(+b.dataset.i, 1); renderPhotos(); saveAddDraft(); });
    box.querySelectorAll(".pcap").forEach((b) => b.onchange = () => { formPhotos[+b.dataset.i].caption = b.value; saveAddDraft(); });
  }

  // 草稿自动保存（Android WebView 选图/选文件后 JS 状态被重建 → 表单与照片丢失；sessionStorage 跨重建保留）
  const ADD_DRAFT_KEY = "gujian_add_draft_v1";
  function saveAddDraft() {
    try {
      const f = {
        prov: el("fProv") ? el("fProv").value : "",
        city: el("fOffice") ? el("fOffice").value : "",
        name: el("fName") ? el("fName").value : "",
        atype: el("fBtype") ? el("fBtype").value : "",
        station: el("fStation") ? el("fStation").value : "",
        lon: el("fLon") ? el("fLon").value : "",
        lat: el("fLat") ? el("fLat").value : "",
        params: el("fParams") ? el("fParams").value : "",
        photos: formPhotos.map((p) => ({ caption: p.caption || "", dataUrl: p.dataUrl || "" })),
      };
      sessionStorage.setItem(ADD_DRAFT_KEY, JSON.stringify(f));
    } catch (e) {}
  }
  function loadAddDraft() { try { const s = sessionStorage.getItem(ADD_DRAFT_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function clearAddDraft() { try { sessionStorage.removeItem(ADD_DRAFT_KEY); } catch (e) {} }
  function restoreAddDraft() {
    const d = loadAddDraft();
    if (!d) return;
    formPhotos = (d.photos || []).map((p) => ({ caption: p.caption || "", dataUrl: p.dataUrl || "" }));
    if (el("fProv")) el("fProv").value = d.prov || "";
    if (el("fOffice")) el("fOffice").value = d.city || "";
    if (el("fName")) el("fName").value = d.name || "";
    if (el("fBtype")) el("fBtype").value = d.atype || "";
    if (el("fStation")) el("fStation").value = d.station || "";
    if (el("fLon")) el("fLon").value = d.lon || "";
    if (el("fLat")) el("fLat").value = d.lat || "";
    if (el("fParams")) el("fParams").value = d.params || "";
    renderPhotos();
  }
  function openAdd() {
    editId = null;
    openModal("添加古建", formHtml(null), `<button class="btn ghost" id="fCancel">取消</button><button class="btn primary" id="fSave">保存</button>`);
    bindForm();
  }
  function openEdit(id) {
    editId = id;
    const r = records.find((x) => x.id === id); if (!r) return;
    openModal("编辑：" + r.name, formHtml(r), `<button class="btn ghost" id="fCancel">取消</button><button class="btn primary" id="fSave">保存</button>`);
    clearAddDraft(); // 编辑模式不恢复「添加」草稿
    bindForm();
  }
  function bindForm() {
    restoreAddDraft(); // 跨 WebView 重建恢复草稿
    renderPhotos();
    el("fAddPhoto").onclick = () => { saveAddDraft(); el("fFile").click(); };
    el("fFile").onchange = (e) => {
      [...e.target.files].forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = () => {
          const cap = ["正面", "背面", "侧面", "全景", "细部"][formPhotos.length] || ("照片" + (formPhotos.length + 1));
          formPhotos.push({ caption: cap, dataUrl: reader.result });
          renderPhotos(); saveAddDraft();
        };
        reader.readAsDataURL(file);
      });
      e.target.value = "";
    };
    el("fPick").onclick = () => { togglePick(true); toast("请在地图上点击以确定坐标"); };
    el("fCancel").onclick = () => { clearAddDraft(); closeModal(); };
    el("fSave").onclick = saveForm;
    ["fProv", "fOffice", "fName", "fBtype", "fStation", "fLon", "fLat", "fParams"].forEach((id) => { const e = el(id); if (e) e.onchange = e.oninput = saveAddDraft; });
  }
  function togglePick(on) {
    pickMode = on;
    el("pickmode").classList.toggle("show", on);
  }
  function parseParams(txt) {
    const p = {};
    txt.split("\n").forEach((ln) => { if (ln.includes(":")) { const a = ln.split(":"); p[a[0].trim()] = a.slice(1).join(":").trim(); } });
    return p;
  }
  async function saveForm() {
    const name = el("fName").value.trim();
    const lon = parseFloat(el("fLon").value), lat = parseFloat(el("fLat").value);
    if (!name) return toast("请填写名称");
    if (isNaN(lon) || isNaN(lat)) return toast("请填写有效经纬度（可点选）");
    const rec = {
      id: editId || IO.genId(), name, lon, lat, ts: Date.now(),
      province: el("fProv").value, city: el("fOffice").value, station: el("fStation").value, atype: el("fBtype").value,
      type: (el("fStation").value && el("fBtype").value) ? el("fStation").value + "--" + el("fBtype").value : el("fBtype").value,
      params: parseParams(el("fParams").value), photos: formPhotos.map((p) => ({ caption: p.caption || "", dataUrl: p.dataUrl || "", full: p.dataUrl || "", thumb: p.dataUrl || "", hash: "" })),
      base: editId ? (records.find((x) => x.id === editId) || {}).base : false, custom: true,
      description: Object.entries(parseParams(el("fParams").value)).map(([k, v]) => `${k} : ${v}`).join("\n")
    };
    await Store.patch((d) => {
      if (editId) {
        // 若是新增记录（在 added 中），更新它；否则记入 updated
        const i = (d.added || []).findIndex((a) => a.id === editId);
        if (i >= 0) d.added[i] = rec; else d.updated[editId] = rec;
      } else {
        d.added.push(rec);
      }
    });
    DELTA = await Store.get(); merge(); render();
    clearAddDraft(); closeModal(); toast(editId ? "已更新" : "已添加");
    kbLog(editId ? "更新古建" : "新增古建", { name });
  }

  async function del(id) {
    if (!confirm("确认删除该古建？")) return;
    await Store.patch((d) => {
      const i = (d.added || []).findIndex((a) => a.id === id);
      if (i >= 0) d.added.splice(i, 1);
      else { d.deleted = d.deleted || []; d.deleted.push(id); delete d.updated[id]; }
    });
    DELTA = await Store.get(); merge(); render();
    toast("已删除");
    kbLog("删除古建", { id });
  }

  // ---------- 批量导入（原生文件夹/zip 逐文件回调 APP.receivePhoto / receiveSheet）----------
  function receivePhoto(name, b64, folder, mid) { pendingBatch.photos.push({ name, b64, folder: folder || "", mid: mid || "" }); importCpTouch(); }
  // bug③修复：新增 bytes 形参 —— xlsx 等二进制表格必须走字节流。
  // 此前 xlsx 只传空文本给 parseCsvToRecords，解析结果恒为 0 条且不抛错（静默失败）。
  function receiveSheet(name, text, ext, bytes) { pendingBatch.sheets.push({ name, text, ext, bytes: bytes || null }); importCpTouch(); }
  function receiveError(msg) { BATCH_STATE.active = false; importCpEnd(); toast("导入出错：" + msg); }
  function receiveCancel() { if (BATCH_STATE.active) { BATCH_STATE.active = false; importCpEnd(); pendingBatch.photos = []; pendingBatch.sheets = []; toast("已取消导入"); } }
  function receiveDone(kind) {
    importCpEnd();
    if (kind === "photos") finishBatchPhotos();
    else if (kind === "sheets") finishBatchSheets();
  }
  // 原生异步解压回调（item 1 根因修复：解压/缩略图全在原生线程，JS 仅收齐元数据再匹配）
  let zipProgOpen = false;
  window.onUnzipImages = function (ph, cnt, total) {
    if (!BATCH_STATE.active) return;
    if (!zipProgOpen) { openZipProgress(); }
    const prog = el("zipProg"), bar = el("zipBar");
    if (prog) prog.textContent = `已解压并生成缩略图 ${cnt} / ${total} 张…`;
    if (bar) bar.style.width = Math.min(100, Math.round((cnt / Math.max(1, total)) * 100)) + "%";
    // 仅保留轻量元数据：缩略图（小 base64）+ 全图磁盘路径 + 内容哈希；全图按需单张加载
    pendingBatch.photos.push({ name: ph.name, folder: ph.folder || "", b64: ph.thumb, thumb: ph.thumb, fullPath: ph.fullPath || "", hash: ph.hash || "" });
    importCpTouch();
  };
  window.onUnzipImagesEnd = function (total) {
    if (!BATCH_STATE.active) return;
    closeZipProgress();
    if (pendingBatch.photos.length) finishBatchPhotos();
    else { BATCH_STATE.active = false; importCpEnd(); toast("压缩包中未找到照片"); }
  };
  function openZipProgress() {
    openModal("正在导入照片", `<div class="hint" id="zipProg">正在解压压缩包并生成缩略图…</div><div class="bar"><div class="bar-fill" id="zipBar" style="width:0%"></div></div>`, `<button class="btn ghost" id="zipCancel">取消</button>`);
    el("zipCancel").onclick = () => { BATCH_STATE.active = false; closeModal(); toast("已取消导入"); };
    zipProgOpen = true;
  }
  function closeZipProgress() { if (zipProgOpen) { closeModal(); zipProgOpen = false; } }
  // ---------- 智能模糊匹配工具（② 错字/多字/漏字/部分词；⑥ 文件夹上下文）----------
  function norm(s) { return (s || "").trim().toLowerCase().replace(/[\s_\-()（）．.]/g, ""); }
  // 照片名匹配键：去扩展名 + 忽略末尾数字（峰山口1.jpg → 峰山口）
  function photoKey(name) { return norm((name || "").replace(/\.[^.]+$/, "").replace(/\d+$/, "")); }
  function levenshtein(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    const d = Array.from({ length: m + 1 }, (_, i) => [i].concat(Array(n).fill(0)));
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    }
    return d[m][n];
  }
  // ---------- v2.4.1 ZIP 名 → 城市/省 范围匹配（与水利/感知端「zip 名→管理所」同等处理）----------
  let BATCH_ZIP_NAME = ""; // 当前导入 zip 的文件名（不含扩展名）；Android 原生经 window.onZipName 下发，Web 在 webkitZipPhotos 回调用 f.name 设置
  window.onZipName = function (name) { BATCH_ZIP_NAME = String(name || "").split(/[\\/]/).pop().replace(/\.(zip|7z)$/i, ""); };
  // 压缩包名/文本 → 城市（优先）/省（次级）匹配；命中返回限定范围。如 西安.zip → 优先在西安景点范围内匹配
  function matchCityScope(text) {
    if (!text) return null;
    const base = String(text).split(/[\\/]/).pop() || String(text);
    const t = norm(base.replace(/\.(zip|7z|rar|tar|gz|tgz)$/i, ""));
    if (!t) return null;
    const hit = (val) => {
      const v = norm(val); if (!v || v.length < 2) return { ok: false, score: 0 };
      if (v === t) return { ok: true, score: 100 + v.length };
      if (t.includes(v) || v.includes(t)) return { ok: true, score: 80 + Math.min(v.length, t.length) };
      if (levenshtein(t, v) <= 1 && Math.max(t.length, v.length) >= 2) return { ok: true, score: 60 + Math.min(v.length, t.length) };
      return { ok: false, score: 0 };
    };
    const cands = [];
    for (const c of DIMS.citys) { const h = hit(c); if (h.ok) cands.push({ scope: "city", label: "城市：" + c, val: c, ...h }); }
    for (const p of (DIMS.provinces || [])) { const h = hit(p); if (h.ok) cands.push({ scope: "province", label: "省：" + p, val: p, ...h }); }
    if (!cands.length) return null;
    cands.sort((a, b) => (b.score - a.score) || (b.val.length - a.val.length));
    const top = cands[0];
    const recs = records.filter((r) => top.scope === "city" ? r.city === top.val : (r.province || "").indexOf(top.val) >= 0);
    return { label: top.label, recs, city: top.val, scope: top.scope };
  }
  // 文件夹/分类上下文：路径各段（含子文件夹）模糊命中 城市 或 古建类型 → 限定候选范围（item ⑥）
  function folderScope(folder) {
    if (!folder) return null;
    const segs = String(folder).split(/[\\/]/).map((s) => norm(s)).filter(Boolean);
    if (!segs.length) return null;
    for (const f of segs) {
      const off = DIMS.citys.find((o) => { const on = norm(o); return on && (on === f || f.includes(on) || on.includes(f) || levenshtein(f, on) <= 1); });
      if (off) return { label: "城市：" + off, recs: records.filter((r) => r.city === off) };
    }
    for (const f of segs) {
      const bt = DIMS.atypes.find((t) => { const tn = norm(t); return tn && (tn === f || f.includes(tn) || tn.includes(f) || levenshtein(f, tn) <= 1); });
      if (bt) return { label: "类型：" + bt, recs: records.filter((r) => r.atype === bt) };
    }
    return null;
  }
  // 智能候选：评分式模糊匹配，返回按评分降序 [{x,score}]；阈值 45
  function smartCandidates(name, scope) {
    const base = (scope && scope.recs) || records;
    const key = photoKey(name); if (!key) return [];
    const half = key.slice(0, Math.ceil(key.length / 2));
    const out = [];
    for (const x of base) {
      const xn = norm(x.name); if (!xn) continue;
      let score = 0;
      if (xn === key) score = 100;
      else if (key.includes(xn) || xn.includes(key)) score = 85;                        // 包含关系
      else if (half.length >= 2 && xn.includes(half)) score = 72;                        // 部分关键词对应（峰山口 命中 峰山口大大）
      else if (key.length >= 2 && xn.includes(key.slice(0, 2))) score = 50;             // 前2字命中（漏字/多字/错字）
      else { const r = 1 - levenshtein(key, xn) / Math.max(key.length, xn.length, 1); if (r >= 0.6) score = Math.round(40 + r * 40); }
      if (score >= 45) out.push({ x, score });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }
  // 照片内容哈希：原生已算（ph.hash），否则回退到 JS 计算（Web/旧数据）
  async function photoHash(ph) {
    if (ph.hash) return ph.hash;
    if (ph.b64) return await shaHexOfB64(ph.b64);
    return "";
  }
  async function finishBatchPhotos() {
    BATCH_STATE.active = false;
    const photos = pendingBatch.photos; pendingBatch.photos = [];
    // v2.4.1 ZIP 名 → 城市范围：整包收窄到该城市/省，文件夹与照片名匹配都在该范围内继续（与水利/感知端同等处理）
    const zipScope = BATCH_ZIP_NAME ? matchCityScope(BATCH_ZIP_NAME) : null;
    if (zipScope) toast(`压缩包名命中「${zipScope.label}」，优先在该范围内匹配`);
    BATCH_ZIP_NAME = ""; // 一次性消费，防跨批次污染
    const hashCache = {};
    const existingHashes = async (id) => {
      if (hashCache[id]) return hashCache[id];
      const r = records.find((x) => x.id === id);
      const set = new Set();
      for (const ph of (r ? r.photos || [] : [])) {
        const h = ph.hash || (ph.dataUrl && ph.dataUrl.startsWith("data:") && ph.dataUrl.includes(";base64,") ? await shaHexOfB64(ph.dataUrl.split(",")[1]) : null);
        if (h) set.add(h);
      }
      hashCache[id] = set; return set;
    };
    const auto = {}, ambiguous = [], dupes = [];
    // 分块匹配（每批 30 张 + 让出主线程），避免大批量导入时 UI 卡死（item 2）
    const CHUNK = 30;
    for (let i = 0; i < photos.length; i += CHUNK) {
      const slice = photos.slice(i, i + CHUNK);
      for (const ph of slice) {
        const fScope = folderScope(ph.folder);
        // ZIP 名范围优先：与文件夹上下文求交收窄；交集为空则退回文件夹范围（避免误标 zip 导致整批丢失）
        let scope = fScope || zipScope;
        if (zipScope && fScope) {
          const inter = fScope.recs.filter((r) => zipScope.recs.some((z) => z.id === r.id));
          scope = inter.length ? { label: fScope.label + " ∩ " + zipScope.label, recs: inter } : fScope;
        }
        let cands = smartCandidates(ph.name, scope);
        // 全局兜底：当前范围（如文件夹上下文）无候选时，跨全部古建再算一次，避免“名字不完全匹配”直接丢失
        if (!cands.length && !scope) cands = smartCandidates(ph.name, null).slice(0, 8);
        const h = await photoHash(ph);
        const search = cands.length ? cands.map((c) => c.x) : (scope ? scope.recs : records);
        let dupeId = null;
        for (const c of search) { if ((await existingHashes(c.id)).has(h)) { dupeId = c.id; break; } }
        if (dupeId) { dupes.push({ ph, id: dupeId, h }); continue; }
        // 确定性匹配：导出包自带 manifest（filename→建筑 id），直接自动绑定，跳过模糊匹配与人工选择（Bug2 修复：导出 zip 可确定性重新导入）
        if (ph.mid) {
          const rec = records.find((x) => x.id === ph.mid);
          if (rec) { (auto[rec.id] = auto[rec.id] || []).push(ph); continue; }
        }
        // 关键修复：无论是否有名称匹配，都进入人工选择流程（不静默丢弃）；无候选时给“全部古建”作为候选
        if (!cands.length) {
          ambiguous.push({ ph, cs: (scope ? scope.recs : records).map((c) => ({ id: c.id, name: c.name })), scopeLabel: scope ? scope.label : "全部古建", byContent: true });
          continue;
        }
        if (cands.length === 1 || cands[0].score >= 85) (auto[cands[0].x.id] = auto[cands[0].x.id] || []).push(ph); // 强匹配直接保存
        else ambiguous.push({ ph, cs: cands.map((c) => ({ id: c.x.id, name: c.x.name, score: c.score })) });
      }
      if (i + CHUNK < photos.length) await new Promise((r) => setTimeout(r, 0));
    }
    // 内容去重提示（含图片对比）
    if (dupes.length) {
      await new Promise((resolve) => {
        const html = `<div class="hint">以下 ${dupes.length} 张照片<b>内容与已有照片完全相同</b>（不是文件名相同），已展示新图与已有图供对比，请选择处理方式：</div>` +
          dupes.map((d) => {
            const r = records.find((x) => x.id === d.id) || {};
            const phs = (r.photos || []).filter((p) => p.dataUrl && p.dataUrl.startsWith("data:")).slice(0, 3);
            const newThumb = d.ph.thumb || (d.ph.b64 ? b64ToDataUrl(d.ph.name, d.ph.b64) : "");
            return `<div class="dp-row"><div class="dp-col"><img src="${newThumb}"><div class="dp-lbl">新导入：${esc(d.ph.name)}</div></div>` +
              `<div class="dp-col"><img src="${phs[0] || ""}"><div class="dp-lbl">已有：${esc(r.name || "")}</div></div></div>`;
          }).join("");
        openModal("照片内容重复", html, `<button class="btn ghost" id="dpSkip">跳过（不导入）</button><button class="btn primary" id="dpOver">覆盖已有</button>`);
        el("dpSkip").onclick = () => { closeModal(); resolve(); };
        el("dpOver").onclick = async () => {
          closeModal();
          const cache = {};
          for (const du of dupes) {
            if (cache[du.id]) continue;
            const r = records.find((x) => x.id === du.id); const arr = [];
            if (r) for (let i = 0; i < (r.photos || []).length; i++) {
              const p = r.photos[i];
              if (p.dataUrl && p.dataUrl.startsWith("data:") && p.dataUrl.includes(";base64,"))
                arr.push({ idx: i, hash: await shaHexOfB64(p.dataUrl.split(",")[1]) });
            }
            cache[du.id] = arr;
          }
          await Store.patch((d) => {
            d.added = d.added || []; d.updated = d.updated || {};
            for (const du of dupes) {
              const arr = cache[du.id] || []; const hit = arr.find((a) => a.hash === du.h); if (!hit) continue;
              const baseRec = records.find((x) => x.id === du.id) || {};
              const exist = d.added.find((a) => a.id === du.id); const upd = d.updated[du.id];
              const cur = (exist || upd || baseRec).photos || [];
              if (cur[hit.idx]) cur[hit.idx].caption = du.ph.name;
            }
          });
          DELTA = await Store.get(); merge(); render();
          resolve();
        };
      });
    }
    // 直接匹配先保存
    await applyPhotoMatch(auto);
    const autoTotal = Object.values(auto).reduce((a, b) => a + b.length, 0);
    const cleanInboxNow = () => { if (window.AndroidBridge && window.AndroidBridge.cleanInbox) window.AndroidBridge.cleanInbox(); };
    if (ambiguous.length) {
      openPhotoChoice(ambiguous, async (userMap, skipped) => {
        await applyPhotoMatch(userMap);
        const userTotal = Object.values(userMap).reduce((a, b) => a + b.length, 0);
        finalizePhotoImport(Object.keys(auto).length, autoTotal + userTotal, ambiguous.length, skipped, dupes.length);
        cleanInboxNow(); // 导入完成：清理 inbox/uz_* 临时目录（item 2 根因防护之三）
      });
    } else {
      finalizePhotoImport(Object.keys(auto).length, autoTotal, 0, [], dupes.length);
      cleanInboxNow();
    }
  }
  // 将 {古建id:[photo...]} 合并进 Store 增量；caption 统一改为「古建名+照片+序号」，确保古建稳定读到
  async function applyPhotoMatch(map) {
    if (!Object.keys(map).length) return;
    await Store.patch((d) => {
      d.added = d.added || []; d.updated = d.updated || {};
      for (const id in map) {
        const phs = map[id];
        const rec = records.find((x) => x.id === id) || {};
        const recName = rec.name || "古建";
        const exist = d.added.find((a) => a.id === id);
        const upd = d.updated[id];
        const cur = (exist || upd || rec).photos || [];
        let seq = cur.length; // 顺序号从现有张数之后续编
        const newPhotos = phs.map((ph) => {
          seq += 1;
          // 全图从 inbox 临时目录持久化到 app 私有 photos 目录（cleanInbox 不会误删）；dataUrl 仅存缩略图，全图按需单张加载
          let fullPath = "";
          if (ph.fullPath && window.AndroidBridge && window.AndroidBridge.persistImage) {
            const p = window.AndroidBridge.persistImage(ph.fullPath);
            if (p) fullPath = p;
          }
          const dataUrl = ph.thumb || (ph.b64 ? b64ToDataUrl(ph.name, ph.b64) : "");
          // 关键修复（最佳匹配保存）：Web 导入通道经 receivePhoto 传入的是 full 原图 b64，必须据此补 full，
          // 否则仅存缩略图、放大/导出时缺原图，表现为"照片没保存/看不清"
          const full = ph.full || (ph.b64 ? "data:image/jpeg;base64," + ph.b64 : "") || fullPath || "";
          return { caption: `${recName}照片${seq}`, dataUrl, fullPath, full, hash: ph.hash || "" };
        });
        const merged = cur.concat(newPhotos);
        if (exist) { const i = d.added.findIndex((a) => a.id === id); d.added[i] = Object.assign({}, d.added[i], { photos: merged }); }
        else d.updated[id] = Object.assign({}, rec, upd || {}, { photos: merged });
      }
    });
    DELTA = await Store.get(); merge(); render();
  }
  // 多古建/无匹配时让用户<b>单选</b>所属古建（每张照片只能属于一个古建；默认勾选最可能对，可改或跳过）
  function openPhotoChoice(list, onConfirm) {
    const groups = list.map((it, idx) => {
      const scopeNote = it.scopeLabel
        ? `<div class="pc-scope">📁 上下文：${esc(it.scopeLabel)}${it.byContent ? "（未匹配到名称，请按照片内容选择对应古建；不确定可点「跳过」）" : ""}</div>`
        : "";
      const thumb = it.ph.thumb || (it.ph.b64 ? b64ToDataUrl(it.ph.name, it.ph.b64) : "");
      const def = it.cs[0] ? it.cs[0].id : ""; // 默认最可能
      const opts = it.cs.map((c) => {
        const rec = records.find((x) => x.id === c.id) || {};
        const t = (rec.photos || []).find((p) => p.dataUrl && p.dataUrl.startsWith("data:")) || {};
        const checked = c.id === def ? "checked" : "";
        return `<label class="ex-item"><input type="radio" name="pc-${idx}" class="pc-rb" data-pi="${idx}" value="${c.id}" ${checked}><img class="pc-th" src="${t.dataUrl || ""}"><span>${esc(c.name)}${c.score != null ? ` <em class="sc">匹配度 ${c.score}</em>` : ""}</span></label>`;
      }).join("");
      const skipChk = def ? "" : "checked"; // 无任何候选时默认跳过
      return `<div class="phchoice">
        <div class="pc-title">📷 ${esc(it.ph.name)} <small>请选择所属古建（单选）</small></div>
        <div class="pc-thumb"><img src="${thumb}" alt="导入照片"></div>
        ${scopeNote}
        <div class="pc-cands">${opts}
          <label class="ex-item skip"><input type="radio" name="pc-${idx}" class="pc-rb" data-pi="${idx}" value="__skip__" ${skipChk}><span>⏭ 跳过这张（不导入）</span></label>
        </div>
      </div>`;
    }).join("");
    openModal("选择照片所属古建", `<div class="hint">每张照片只能属于一个古建；系统已默认勾选最可能项，请逐张确认或修改。点「确认导入」即按所选绑定；未选「跳过」的照片将被导入到所选古建。</div><div class="filelist" style="max-height:46vh;overflow:auto">${groups}</div>`,
      `<button class="btn ghost" id="pcAllDef">全部按默认</button><button class="btn ghost" id="pcCancel">取消</button><button class="btn primary" id="pcOk">确认导入</button><button class="btn ghost" id="pcExit">退出</button>`);
    const collect = () => {
      const map = {}; const skipped = [];
      list.forEach((it, idx) => {
        const sel = document.querySelector(`input[name="pc-${idx}"]:checked`);
        if (!sel || sel.value === "__skip__") { skipped.push(it.ph.name); return; }
        (map[sel.value] = map[sel.value] || []).push(it.ph);
      });
      return { map, skipped };
    };
    const done = (map, skipped) => { closeModal(); onConfirm(map, skipped); };
    el("pcAllDef").onclick = () => { const { map, skipped } = collect(); done(map, skipped); };
    el("pcCancel").onclick = () => done({}, list.map((it) => it.ph.name));
    el("pcExit").onclick = () => done({}, list.map((it) => it.ph.name));
    el("pcOk").onclick = () => { const { map, skipped } = collect(); done(map, skipped); };
  }
  function finalizePhotoImport(autoCnt, total, ambiguousCnt, skipped, dupCnt) {
    let msg = `照片导入完成：自动匹配 ${autoCnt} 个古建`;
    if (ambiguousCnt) msg += `（另有 ${ambiguousCnt} 张已逐张确认所属）`;
    msg += `，共新增 ${total} 张`;
    if (dupCnt) msg += `；内容重复跳过/覆盖 ${dupCnt} 张`;
    if (skipped && skipped.length) msg += `；已跳过 ${skipped.length} 张（未选古建）`;
    toast(msg);
    if (skipped && skipped.length) {
      openModal("部分照片已跳过", `<div class="hint">以下 ${skipped.length} 张照片未选择所属古建，已跳过未导入：</div><div class="filelist">${skipped.slice(0, 80).map((n) => `<div class="fi">${esc(n)}</div>`).join("")}</div>`, `<button class="btn ghost" onclick="APP.close()">知道了</button>`);
    }
  }
  async function finishBatchSheets() {
    BATCH_STATE.active = false;
    const sheets = pendingBatch.sheets; pendingBatch.sheets = [];
    if (!sheets.length) { toast("未读取到可导入的表格文件"); return; }
    const recs = []; const errors = [];
    for (const s of sheets) {
      try {
        const ext = (s.ext || "").toLowerCase();
        let rs = [];
        if (ext === "csv" || ext === "tsv" || ext === "txt") rs = IO.parseCsvToRecords(s.text);
        else if (ext === "kml") rs = IO.parseKmlToRecords(s.text);
        else if (ext === "gpx") rs = IO.parseGpxToRecords(s.text);
        else if (ext === "json") rs = IO.parseJsonToRecords(s.text);
        // bug③修复：xlsx 走二进制解析器（原先误用 CSV 解析器 + 空文本 -> 静默 0 条）
        else if (ext === "xlsx") {
          if (!s.bytes || !s.bytes.length) throw new Error("xlsx 需以二进制读取，但当前导入通道未提供字节流");
          rs = await IO.parseXlsxToRecords(s.bytes);
        }
        else if (ext === "xls") rs = IO.parseXlsToRecords(s.text || "");
        else throw new Error("不支持的表格扩展名：" + (ext || "(空)"));
        recs.push(...rs);
      } catch (e) { errors.push(s.name + "：" + e.message); }
    }
    if (!recs.length) { toast("未解析到任何古建" + (errors.length ? "；错误：" + errors.join("；") : "")); return; }
    await Store.patch((d) => {
      d.added = d.added || []; d.updated = d.updated || {};
      for (const r of recs) {
        const exist = BASE.find((b) => b.id === r.id) || d.added.find((a) => a.id === r.id);
        if (exist) d.updated[r.id] = r; else d.added.push(r);
      }
    });
    DELTA = await Store.get(); merge(); render();
    toast(`表格导入完成：${recs.length} 个古建` + (errors.length ? `；${errors.length} 个文件解析失败` : ""));
  }
  async function startBatchImport(kind, mode) {
    await importCpResumePrompt(kind); // 若上次导入被中断，提示用户（item 1/2 续传）
    // 大文件流量提醒（items 1/2：文件夹/zip 可能含大量照片 >3GB）
    if (mode === "folder" || mode === "zip") {
      const go = await confirmLargeTransfer("批量导入（可能含大量文件）");
      if (!go) { importCpEnd(); return; }
    }
    pendingBatch[kind === "photos" ? "photos" : "sheets"] = [];
    BATCH_ZIP_NAME = ""; // v2.4.1 每批开始重置压缩包名（zip 通道随后会重新设置）
    BATCH_STATE.active = true; BATCH_STATE.kind = kind;
    importCpStart(kind);
    closeModal();
    if (mode === "folder" && window.AndroidBridge && window.AndroidBridge.pickImportFolder) window.AndroidBridge.pickImportFolder(kind);
    else if (mode === "zip" && window.AndroidBridge && window.AndroidBridge.pickImportZip) window.AndroidBridge.pickImportZip(kind);
    else if (mode === "zip") { if (kind === "photos") webkitZipPhotos(); else webkitZipSheets(); }
    else if (kind === "photos") { if (mode === "files") webkitMultiPhotos(); else webkitDirPhotos(); }
    else { if (mode === "files") webkitMultiSheets(); else webkitDirSheets(); }
    toast(mode === "folder" ? "请在系统选择器中选取文件夹" : (mode === "zip" ? "请在系统选择器中选取 zip 压缩包" : "请在系统选择器中选取文件"));
  }
  function webkitDirPhotos() {
    pickFiles({ webkitdirectory: true, multiple: true, onPick: (files) => {
      const fs = files.filter((f) => /\.(jpe?g|png|gif|bmp|webp)$/i.test(f.name));
      if (!fs.length) { BATCH_STATE.active = false; return toast("未选择照片文件"); }
      let n = 0;
      fs.forEach((file) => {
        const r = new FileReader();
        const rel = file.webkitRelativePath || file.name;
        const folder = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
        r.onload = () => { receivePhoto(file.name, (r.result.split(",")[1]) || "", folder); if (++n === fs.length) receiveDone("photos"); };
        r.readAsDataURL(file);
      });
    }});
  }
  function webkitMultiPhotos() {
    pickFiles({ multiple: true, accept: "image/*", onPick: (files) => {
      if (!files.length) { BATCH_STATE.active = false; return; }
      let n = 0;
      files.forEach((file) => {
        const r = new FileReader();
        r.onload = () => { receivePhoto(file.name, (r.result.split(",")[1]) || ""); if (++n === files.length) receiveDone("photos"); };
        r.readAsDataURL(file);
      });
    }});
  }
  async function webkitZipPhotos() {
    // .7z 无标准 MIME 映射，Android 选择器可能隐藏；*/* 兜底保证可选，zip/7z 由解压端识别
    pickFiles({ accept: ".zip,.7z,application/zip,application/x-7z-compressed,application/x-zip-compressed,*/*", onPick: async (files) => {
      try {
        const f = files[0]; if (!f) return;
        BATCH_ZIP_NAME = String(f.name || "").split(/[\\/]/).pop().replace(/\.(zip|7z)$/i, ""); // v2.4.1 三级匹配：记录压缩包名（→ 城市范围）
        // 7z 浏览器原生无法解压：明确报错降级，不静默
        if (/\.7z$/i.test(f.name)) { BATCH_STATE.active = false; return toast("7z 暂不支持浏览器原生解压，请改用 zip 压缩包（照片匹配逻辑不变）"); }
        // ① 体积预检：超 1.2GB 直接拦截并引导分卷（item 1 根因防护）
        if (zipSizeRefuse(f)) return;
        // ② 较大包二次确认（300MB~1.2GB），告知将流式处理
        if (f.size > 300 * 1048576) {
          const go = await new Promise((res) => {
            openModal("大压缩包导入确认",
              `<div class="hint" style="color:#e67e22">⚠️ 压缩包约 <b>${Math.round(f.size / 1048576)} MB</b>，较大。将流式处理并显示进度，但低端设备仍可能较慢；建议 ≤500MB 分卷更稳。</div>`,
              `<button class="btn ghost" id="zCancel">取消</button><button class="btn primary" id="zGo">仍要继续（流式）</button>`);
            el("zCancel").onclick = () => { closeModal(); res(false); };
            el("zGo").onclick = () => { closeModal(); res(true); };
          });
          if (!go) { BATCH_STATE.active = false; return; }
        }
        // ③ 进度弹窗 + 流式解压：逐张读取、立即转码入队、释放字节、让出主线程，避免卡死/死机
        openModal("正在导入照片",
          `<div class="hint" id="zipProg">正在读取压缩包…</div><div class="bar"><div class="bar-fill" id="zipBar" style="width:0%"></div></div>`,
          `<button class="btn ghost" id="zipCancel">取消</button>`);
        const prog = el("zipProg"), bar = el("zipBar");
        let cancelled = false;
        el("zipCancel").onclick = () => { cancelled = true; closeModal(); BATCH_STATE.active = false; toast("已取消导入"); };
        const buf = await f.arrayBuffer();
        if (cancelled) return;
        // bug②修复：先扫一遍 manifest.json（若存在）—— 导出包自带 filename -> 建筑物 id 映射，导入时确定性自动匹配
        const mMap = {};
        await IO.unzipStream(buf, async (name, bytes) => {
          if (/^manifest\.json$/i.test(name)) {
            try { const obj = JSON.parse(new TextDecoder().decode(bytes)); (obj.items || []).forEach((it) => { if (it && it.file) mMap[it.file] = it; }); } catch (e) {}
          }
        });
        const total = IO.unzipCount(buf);
        let done = 0;
        await IO.unzipStream(buf, async (name, bytes) => {
          if (cancelled) return;
          if (!/\.(jpe?g|png|gif|bmp|webp)$/i.test(name)) return;
          const folder = name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : "";
          const m = mMap[name];
          receivePhoto(name, IO.bytesToB64(bytes), folder, m ? m.id : undefined); // bytes 为当前条目视图，立即转 base64 后本函数返回即被释放
          done++;
          if ((done & 15) === 0 || done === total) {
            prog.textContent = `已处理 ${done} / ${total} 张照片…`;
            bar.style.width = Math.min(100, Math.round(done / Math.max(1, total) * 100)) + "%";
            await new Promise((r) => setTimeout(r, 0)); // 让出主线程，保持 UI 响应（防 ANR 杀进程）
          }
        });
        if (cancelled) return;
        closeModal();
        if (pendingBatch.photos.length) receiveDone("photos");
        else { BATCH_STATE.active = false; importCpEnd(); toast("压缩包中未找到照片"); }
      } catch (e) { BATCH_STATE.active = false; importCpEnd(); closeModal(); toast("压缩包读取失败：" + e.message); }
    }});
  }
  // bug③修复：统一表格读取器 —— xlsx 用 readAsArrayBuffer 走字节流，其余按文本；
  // 读取失败也要推进计数并提示，避免 n 永远到不了 files.length 导致导入状态卡死（静默挂死）。
  function readSheetFile(f, done) {
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const r = new FileReader();
    r.onerror = () => { toast("读取失败：" + f.name); done(); };
    if (ext === "xlsx") {
      r.onload = () => { receiveSheet(f.name, "", ext, new Uint8Array(r.result)); done(); };
      r.readAsArrayBuffer(f);
    } else {
      r.onload = () => { receiveSheet(f.name, r.result, ext); done(); };
      r.readAsText(f);
    }
  }
  function webkitDirSheets() {
    pickFiles({ webkitdirectory: true, multiple: true, onPick: (files) => {
      const fs = files.filter((f) => /\.(csv|tsv|txt|kml|gpx|json|xls|xlsx)$/i.test(f.name));
      if (!fs.length) { BATCH_STATE.active = false; return toast("未选择表格文件"); }
      let n = 0;
      const bump = () => { if (++n === fs.length) receiveDone("sheets"); };
      fs.forEach((file) => readSheetFile(file, bump));
    }});
  }
  function webkitMultiSheets() {
    pickFiles({ multiple: true, onPick: (files) => {
      const fs = files.filter((f) => /\.(csv|tsv|txt|kml|gpx|json|xls|xlsx)$/i.test(f.name));
      if (!fs.length) { BATCH_STATE.active = false; return; }
      let n = 0;
      const bump = () => { if (++n === fs.length) receiveDone("sheets"); };
      fs.forEach((file) => readSheetFile(file, bump));
    }});
  }
  async function webkitZipSheets() {
    pickFiles({ accept: ".zip,.7z,application/zip,application/x-7z-compressed,application/x-zip-compressed,*/*", onPick: async (files) => {
      try {
        const f = files[0]; if (!f) return;
        if (/\.7z$/i.test(f.name)) { BATCH_STATE.active = false; return toast("7z 暂不支持浏览器原生解压，请改用 zip 压缩包"); }
        if (zipSizeRefuse(f)) return; // 超大压缩包预检（与照片一致）
        const buf = await f.arrayBuffer();
        const files = await IO.unzip(new Uint8Array(buf));
        let cnt = 0;
        for (const name of Object.keys(files)) {
          if (!/\.(csv|tsv|txt|kml|gpx|json|xls|xlsx)$/i.test(name)) continue;
          const ext = (name.split(".").pop() || "").toLowerCase();
          // bug③修复：xlsx 传字节流（原先固定传空串 -> 解析 0 条且无任何报错）
          if (ext === "xlsx") receiveSheet(name, "", ext, files[name]);
          else receiveSheet(name, new TextDecoder().decode(files[name]), ext);
          cnt++;
        }
        if (cnt) receiveDone("sheets"); else { BATCH_STATE.active = false; toast("压缩包中未找到表格"); }
      } catch (e) { BATCH_STATE.active = false; toast("压缩包读取失败：" + e.message); }
    }});
  }
  function batchImportMenu(kind) {
    const isPhoto = kind === "photos";
    const html = `<div class="hint">${isPhoto ? "从手机文件夹或压缩包(zip)批量导入照片，导入后自动按「照片文件名→古建名称」智能匹配并保存。" : "从手机文件夹或压缩包批量导入古建信息（支持 csv/tsv/txt/kml/gpx/json/xls/xlsx），导入后按经纬度定位，无经纬度则按名称定位。"}</div>
      <div class="field" style="margin-top:12px"><label>选择来源（本地）</label>
        <div class="src-grid">
          <div class="src-card" id="biFolder"><div class="sc-ico">📁</div><div class="sc-lbl">手机文件夹</div><div class="sc-sub">照片/表格</div></div>
          <div class="src-card" id="biZip"><div class="sc-ico">🗜️</div><div class="sc-lbl">压缩包</div><div class="sc-sub">zip（推荐）</div></div>
          <div class="src-card" id="biFiles"><div class="sc-ico">📄</div><div class="sc-lbl">多个文件</div><div class="sc-sub">浏览器</div></div>
        </div>
      </div>
      <div class="field" style="margin-top:6px"><label>选择来源（网盘）</label>
        <div class="src-grid two">
          <div class="src-card net" id="biBaidu"><div class="sc-ico">☁️</div><div class="sc-lbl">百度网盘</div></div>
          <div class="src-card net" id="biQuark"><div class="sc-ico">☁️</div><div class="sc-lbl">夸克网盘</div></div>
        </div>
      </div>
      <div class="hint">网盘导入需在 Android APP 内已配置网盘凭证；网页版未集成时，请先通过网盘 App 把文件导出到本地，再选「手机文件夹」导入。压缩包仅支持 zip（7z 浏览器无法原生解压，会自动提示改用 zip）。</div>`;
    openModal(isPhoto ? "批量导入照片" : "批量导入古建", html, `<button class="btn ghost" onclick="APP.close()">取消</button>`);
    el("biFolder").onclick = () => startBatchImport(kind, "folder");
    el("biZip").onclick = () => startBatchImport(kind, "zip");
    el("biFiles").onclick = () => startBatchImport(kind, "files");
    el("biBaidu").onclick = () => importFromNetdisk("baidu", kind);
    el("biQuark").onclick = () => importFromNetdisk("quark", kind);
  }
  // 网盘导入（与"网盘导入导出"共用桥接；网页版无桥接时明确降级，不静默失败）
  function importFromNetdisk(prov, kind) {
    if (window.AndroidBridge && window.AndroidBridge.netdiskImport) {
      window.AndroidBridge.netdiskImport(prov, kind || "photos");
      closeModal();
      toast(`已请求从${prov === "baidu" ? "百度" : "夸克"}网盘导入，请在网盘选择器中选择文件`);
    } else {
      toast("当前网页版未集成网盘授权：① 在 Android APP 内使用本功能；或 ② 用网盘 App 把文件导出到本地后选「本地文件夹」导入");
    }
  }
  function exportPhotosMenu() {
    const hasFilter = filter.city.length || filter.atype.length || filter.q;
    const recsAll = records, recsFiltered = records.filter(passFilter);
    const html = `<div class="hint" id="phStat" style="background:#eef4ff;color:#1e40af;border-radius:8px;padding:8px 10px;margin-bottom:10px">正在统计…</div>\n<div class="field"><label>导出范围</label>
        <select id="phScope"><option value="all">全部古建（${recsAll.length}）</option>${hasFilter ? `<option value="filtered" selected>当前筛选（${recsFiltered.length}）</option>` : ""}</select></div>
      <div class="field"><label>压缩格式</label>
        <select id="phFmt"><option value="zip">zip（推荐，通用）</option><option value="7z">7z（当前环境降级为 zip）</option></select></div>
      <div class="field"><label>导出目标</label>
        <select id="phTarget">
          <option value="download">本地下载（zip 文件）</option>
          <option value="folder">本地文件夹（Android 真机）</option>
          <option value="baidu">百度网盘</option>
          <option value="quark">夸克网盘</option>
          <option value="share">分享给微信 / 飞书 / QQ</option>
        </select></div>
      ${DIMS.citys.length ? `<div class="field"><label>按城市（默认全选 · 含 18 个古建重点城市；自动匹配所选范围）</label><div class="ofc-list" id="phOffices" style="max-height:120px;overflow:auto;display:flex;flex-wrap:wrap;gap:6px 14px">${DIMS.citys.map((c) => `<label class="ofc"><input type="checkbox" class="ofc-cb" value="${esc(c)}" checked>${esc(c)}</label>`).join("")}</div></div>` : ""}
      <div class="field"><label>文件名组合段（点选即重生成文件名，可再手改；默认 城市）</label>
        <div class="chips" id="phSegs">
          <span class="chip" data-seg="province">省</span>
          <span class="chip on" data-seg="city">城市</span>
          <span class="chip" data-seg="atype">类型</span>
          <span class="chip" data-seg="name">名称</span>
        </div></div>
      <div class="field"><label>文件夹层次（可选 省/城市/类型，默认 城市；不选则按城市分目录）</label>
        <div class="chips" id="phFold">
          <span class="chip" data-seg="province">省</span>
          <span class="chip on" data-seg="city">城市</span>
          <span class="chip" data-seg="atype">类型</span>
        </div></div>
      <div class="field"><label>压缩包文件名（不含扩展名，系统自动加 .zip；留空则按组合段/城市命名）</label><input id="phFname" class="inp" value="古建照片"></div>
      <div class="hint">照片按所选层次分文件夹（默认「城市 / 古建_序号.扩展名」）；压缩包内含 manifest.json，可<b>确定性重新导入</b>（自动绑定到原古建，无需逐张人工选择）。</div>`;
    openModal("导出照片", html, `<button class="btn ghost" id="phCancel">取消</button><button class="btn primary" id="phGo">导出</button>`);
    el("phCancel").onclick = closeModal;
    // ---------- v2.4.9-A 实时统计：将导出 N 个建筑物 / M 张照片（随范围与管理所勾选联动）----------
    const phHasSrc = (p) => !!(p && (p.full || p.dataUrl || p.thumb || p.b64));
    const phCount = (rs) => rs.reduce((n, r) => n + ((r.photos || []).filter(phHasSrc).length), 0);
    const phStatUpdate = () => {
      const box = document.getElementById("phStat"); if (!box) return;
      const scopeEl = document.getElementById("phScope");
      let rs = (scopeEl && scopeEl.value === "filtered") ? recsFiltered : recsAll;
      const cbs = document.querySelectorAll("#phOffices .ofc-cb");
      if (cbs && cbs.length) {
        const checked = []; for (let i = 0; i < cbs.length; i++) if (cbs[i].checked) checked.push(cbs[i].value);
        if (checked.length && checked.length < cbs.length) {
          const want = checked.map((o) => (typeof normOffice === "function" ? normOffice(o) : o));
          rs = rs.filter((r) => {
            const v = typeof normOffice === "function" ? normOffice((typeof orgVal === "function" ? orgVal(r, "office") : r.office)) : r.office;
            return want.indexOf(v) >= 0;
          });
        }
      }
      box.innerHTML = "将导出：<b>" + rs.length + "</b> 个对象 / <b>" + phCount(rs) + "</b> 张照片" +
        (rs.length ? "" : "（可切换导出范围或勾选更多管理所）");
    };
    const phScopeEl = document.getElementById("phScope"); if (phScopeEl) phScopeEl.onchange = phStatUpdate;
    const phCbs = document.querySelectorAll("#phOffices .ofc-cb");
    for (let i = 0; i < phCbs.length; i++) phCbs[i].onchange = phStatUpdate;
    phStatUpdate();
    // ---------- /v2.4.9-A ----------

    // 组合段（v2.4）
    const segValOf = (r, seg) => seg === "city" ? citySafe(r.city) : seg === "province" ? (r.province || "")
      : seg === "atype" ? (r.atype || "") : (r.name || "");
    const bindSegChips = (boxId, inputId, suffix) => {
      const box = el(boxId); if (!box) return;
      box.querySelectorAll(".chip").forEach((c) => c.onclick = () => {
        c.classList.toggle("on");
        const segs = [...box.querySelectorAll(".chip.on")].map((x) => x.dataset.seg);
        if (!segs.length || !inputId) return;
        const src0 = (el("phScope") && el("phScope").value === "filtered") ? recsFiltered : recsAll;
        const safeSeg = (v) => (v || "").replace(/[\\/:*?"<>|\n\r]+/g, "_").trim();
        const parts = segs.map((sg) => sg === "name" ? (src0.length === 1 ? safeSeg(src0[0].name) : src0.length + "个古建") : safeSeg(segValOf(src0[0], sg))).filter(Boolean);
        if (parts.length) el(inputId).value = parts.join("_") + suffix;
      });
    };
    bindSegChips("phSegs", "phFname", "");
    bindSegChips("phFold", null, null);
    el("phGo").onclick = () => {
      // v2.4：城市选项按所选范围自动匹配（全选时用范围城市子集覆盖）
      const ofcBox = el("phOffices");
      let offices = null;
      if (ofcBox) {
        const all = [...ofcBox.querySelectorAll(".ofc-cb")];
        const checked = all.filter((c) => c.checked).map((c) => c.value);
        if (checked.length === all.length && all.length > 0) {
          const src = el("phScope").value === "filtered" ? recsFiltered : recsAll;
          offices = [...new Set(src.map((r) => normCity(r.city)).filter(Boolean))];
          all.forEach((c) => c.checked = offices.includes(c.value));
        } else { offices = checked; }
      }
      const fsegs = el("phSegs") ? [...el("phSegs").querySelectorAll(".chip.on")].map((c) => c.dataset.seg) : null;
      const dsegs = el("phFold") ? [...el("phFold").querySelectorAll(".chip.on")].map((c) => c.dataset.seg) : null;
      doExportPhotos(el("phScope").value === "filtered" ? recsFiltered : recsAll, { format: el("phFmt").value, target: el("phTarget").value, fname: el("phFname").value.trim(), fnameSegs: fsegs, folderSegs: dsegs, offices });
    };
  }
  async function doExportPhotos(recs, opts) {
    opts = opts || {};
    const files = [];
    const manifestItems = []; // 导出照片压缩包时记录 filename→建筑 id 映射，供确定性重新导入
    const safe = (s) => (s || "古建").replace(/[\\/:*?"<>|\n\r]+/g, "_").slice(0, 40);
    const citySafe = (s) => (s || "未分类城市").replace(/[\\/:*?"<>|\n\r]+/g, "_").slice(0, 30);
    for (const r of recs) {
      // ---------- v2.4.9-B 城市过滤双向归一化 ----------
      if (opts.offices && opts.offices.length) {
        const wantCJ = opts.offices.map((o) => normCity(o));
        const vCJ = normCity(r.city);
        if (wantCJ.indexOf(vCJ) < 0 && !(Array.isArray(r.city) && r.city.some((x) => wantCJ.indexOf(normCity(x)) >= 0))) continue;
      }
      // ---------- /v2.4.9-B ----------
      const phs = r.photos || [];
      for (let i = 0; i < phs.length; i++) {
        const ph = phs[i];
        let b64 = "", ext = "jpg";
        // 优先原生按需加载全图（新导入：dataUrl 仅缩略图）；否则回退 dataUrl（旧数据/Web）
        if (ph.fullPath && window.AndroidBridge && window.AndroidBridge.loadFullImage) {
          const full = window.AndroidBridge.loadFullImage(ph.fullPath);
          if (full && full.startsWith("data:")) {
            const comma = full.indexOf(",");
            b64 = full.substring(comma + 1);
            const mime = full.substring(5, full.indexOf(";")).replace("/", ".");
            ext = mime.includes("png") ? "png" : mime.includes("gif") ? "gif" : mime.includes("webp") ? "webp" : "jpg";
          }
        }
        if (!b64) {
          // ---------- v2.4.9-C 多字段兜底：full / dataUrl / thumb / b64 任一可用即导出 ----------
          const src = [ph.dataUrl, ph.full, ph.thumb].filter((s) => s && String(s).startsWith("data:"))[0] || "";
          if (src) {
            const comma = src.indexOf(",");
            b64 = src.substring(comma + 1);
            const mime = src.substring(5, src.indexOf(";")).replace("/", ".");
            ext = mime.includes("png") ? "png" : mime.includes("gif") ? "gif" : mime.includes("webp") ? "webp" : "jpg";
          } else if (ph.b64) { b64 = ph.b64; ext = "jpg"; }
          else continue;
          // ---------- /v2.4.9-C ----------
        }
        // 按城市分文件夹：城市/古建_序号.ext
        const phName = `${citySafe(r.city)}/${safe(r.name)}_${i + 1}.${ext}`;
        files.push({ name: phName, b64 });
        manifestItems.push({ file: phName, id: r.id, name: r.name, city: r.city, index: i + 1 });
      }
    }
    if (!files.length) {
      closeModal();
      // v2.2 问题①根因防护：Web/PWA/UOS/Win 上"没有可导出照片"通常是导入未成功（照片数据从未落库），而非导出代码缺路径——给可操作指引而非只报一句。
      const plat = (window.AndroidBridge && window.AndroidBridge.exportFilesToTree) ? "安卓" : "当前平台（统信 UOS / Web / PWA / Win11）";
      return openModal("没有可导出照片",
        `<div class="hint">所选范围内没有照片数据（范围内 <b>${recs.length}</b> 个对象，其中 <b>${recs.filter((r) => (r.photos || []).length).length}</b> 个带照片记录）。</div>
         <div class="hint">常见原因：在本平台<b>尚未成功导入照片</b>（照片数据未落库）。</div>
         <div class="hint">🟢 解决路径：<br>
         · 统信 UOS（内存仅 8G）：请用菜单「传输与共享 → 从安卓复制照片」做<b>目录流式导入</b>（免整包入内存，避免崩溃）；<br>
         · 其他平台：菜单「批量导入照片 → 手机文件夹 / zip」导入后再导出；<br>
         · 安卓导出给他端：菜单「传输与共享 → 从安卓平台导出照片」生成按城市命名的 zip，再由他端复制导入。</div>`,
        `<button class="btn primary" onclick="APP.close()">知道了</button>`);
    }
    // 大文件流量提醒
    const go = await confirmLargeTransfer(`导出 ${files.length} 张照片（可能很大）`);
    if (!go) { closeModal(); return; }
    closeModal();
    busy("正在生成照片压缩包，请稍后…");
    // 压缩包名称：优先用用户输入文件名，否则以城市命名（多城市时 首个 + 等 N 所）
    const cities = [...new Set(recs.map((r) => normCity(r.city)).filter(Boolean))];
    const segsBase = (opts.fnameSegs && opts.fnameSegs.length && recs.length)
      ? opts.fnameSegs.map((sg) => sg === "name" ? (recs.length === 1 ? segSafe(recs[0].name) : recs.length + "个古建") : segSafe(segValOf(recs[0], sg))).filter(Boolean).join("_") : "";
    const baseName = (opts.fname && opts.fname.trim()) ? opts.fname.trim().replace(/\.[^.]+$/, "")
      : (segsBase || (cities.length === 1 ? citySafe(cities[0]) + "照片"
      : (cities.length > 1 ? citySafe(cities[0]) + `等${cities.length}城市照片` : "古建照片")));
    const arr = files.map((f) => ({ name: f.name, data: IO.b64ToBytes(f.b64) }));
    // 附带 manifest.json（filename→建筑 id 映射）：导出的压缩包可被本 APP 确定性重新导入，无需逐张人工匹配
    if (manifestItems.length) {
      const manifest = { format: "gujian-photo-zip", version: 1, count: manifestItems.length, items: manifestItems };
      arr.push({ name: "manifest.json", data: IO.utf8(JSON.stringify(manifest)) });
    }
    if (opts.format === "7z") toast("当前环境 7z 引擎不可用，已改用 zip 导出（命名按城市）");
    const zipBytes = new Uint8Array(IO.zipStore(arr));
    // 0 字节防护：压缩包本身为空（极端情况）绝不假装成功
    if (!arr.length || zipBytes.length <= 22) {
      hideBusy();
      return toast("导出失败：压缩包为空（0 字节），可能照片数据未就绪，请重试或检查照片");
    }
    const fname = baseName + ".zip";
    if (opts.target === "share") {
      hideBusy();
      await shareFile(fname, zipBytes, "application/zip");
    } else if (opts.target === "baidu" || opts.target === "quark") {
      hideBusy();
      exportToNetdisk(opts.target, fname, zipBytes);
    } else if (opts.target === "folder") {
      if (window.AndroidBridge && window.AndroidBridge.exportFilesToTree) {
        hideBusy();
        // v2.2 问题③之三：所选文件夹已有同名照片时，原生 exportFilesToTree 会静默覆盖；先提示确认
        const dup = (window.AndroidBridge.exportListExists && window.AndroidBridge.exportListExists(JSON.stringify(files))) || false;
        if (dup) {
          const ok = await new Promise((res) => {
            openModal("目标文件夹已有同名照片",
              `<div class="hint">所选文件夹中已存在同名照片文件，导出将<b>覆盖</b>这些文件。是否继续？</div>
               <div class="hint">文件名形如 <code>城市/古建_序号.jpg</code>，按城市分组。</div>`,
              `<button class="btn ghost" id="foSkip">取消</button><button class="btn danger" id="foOver">覆盖导出</button>`);
            el("foSkip").onclick = () => { closeModal(); res(false); };
            el("foOver").onclick = () => { closeModal(); res(true); };
          });
          if (!ok) return toast("已取消导出（未覆盖同名文件）");
        }
        window.AndroidBridge.exportFilesToTree(JSON.stringify(files));
        toast(`已向系统请求导出 ${files.length} 张照片到所选文件夹（按城市分组）`);
      } else {
        hideBusy();
        IO.downloadBytes(fname, zipBytes, "application/zip");
        toast("当前环境不支持选择文件夹，已改为下载 zip（按城市命名）");
      }
    } else {
      // 本地下载 zip：经原生分块写入 + onExportResult 回调决定成败提示（不再提前报成功）
      IO.downloadBytes(fname, zipBytes, "application/zip");
      // 注意：busy 遮罩在 onExportResult 回调里关闭，避免 SAF 弹窗期间误关
    }
  }
  // 原生导出完成回调：写盘成功才提示成功，失败明确报错（杜绝"假成功 + 0 字节"）
  function onExportResult(ok, msg) {
    hideBusy();
    if (ok) toast("导出成功：" + (msg || "文件已保存"));
    else toast(msg || "导出未完成");
  }
  // 分享给第三方（微信/飞书/QQ）：用系统分享面板；不支持时降级为下载
  async function shareFile(filename, bytes, mime) {
    const file = new File([bytes], filename, { type: mime || "application/octet-stream" });
    const canShare = navigator.share && (navigator.canShare ? navigator.canShare({ files: [file] }) : true);
    if (canShare) {
      try {
        await navigator.share({ files: [file], title: "古建照片", text: "古建景点打卡 · 照片导出" });
        toast("已唤起系统分享，请选择微信 / 飞书 / QQ 等");
        return;
      } catch (e) { if (e && e.name === "AbortError") return; /* 用户取消，不报错 */ }
    }
    IO.downloadBytes(filename, bytes, mime);
    toast("当前环境不支持系统分享，已改为本地下载");
  }

  // 分享单条记录（含照片 + 关键信息）给微信 / QQ / 飞书等：打包 zip 走系统分享面板
  async function shareBuilding(rid) {
    const r = records.find((x) => x.id === rid); if (!r) return;
    const phs = (r.photos || []).filter((p) => p.dataUrl && p.dataUrl.startsWith("data:") && p.dataUrl.includes(";base64,"));
    if (!phs.length) return toast("该记录没有可分享的照片");
    busy("正在准备分享文件，请稍后…");
    try {
      const safe = (s) => (s || "item").replace(/[\\/:*?"<>|\r\n\t]+/g, "_").slice(0, 40);
      const files = [];
      const lines = [
        "名称：" + (r.name || ""),
        "城市：" + (r.city || ""),
        "区县：" + (r.station || ""),
        "古建类型：" + (r.atype || ""),
        "坐标：" + (r.lon != null && r.lat != null ? (r.lon + "," + r.lat) : "—"),
        "",
        "参数：",
        ...Object.keys(r.params || {}).map((k) => "  " + k + " : " + (r.params[k] || "")),
        "",
        "照片张数：" + phs.length,
      ];
      files.push({ name: safe(r.name) + "_信息.txt", data: new TextEncoder().encode(lines.join("\n")) });
      phs.forEach((p, i) => files.push({ name: `photo_${i + 1}.jpg`, data: IO.b64ToBytes(p.dataUrl.split(",")[1]) }));
      const zip = IO.zipStore(files);
      hideBusy();
      if (!zip || zip.length <= 22) return toast("分享失败：打包内容为空");
      await shareFile(safe(r.name) + "_分享.zip", zip, "application/zip");
    } catch (e) { hideBusy(); toast("分享失败：" + (e && e.message ? e.message : e)); }
  }
  function exportToNetdisk(prov, filename, bytes) {
    try {
      if (window.AndroidBridge && window.AndroidBridge.netdiskExport) {
        window.AndroidBridge.netdiskExport(prov, filename, Array.from(bytes));
        toast(`已请求导出到${prov === "baidu" ? "百度" : "夸克"}网盘，请在网盘选择器确认`);
        return;
      }
    } catch (e) { /* 桥接异常→降级 */ }
    IO.downloadBytes(filename, bytes, "application/zip");
    toast(`当前网页版未集成网盘授权，已先下载 ${filename}；可再用网盘 App 上传，或在 Android APP 内操作`);
  }

  // ---------- 网盘导入导出（item 4，凭证门控）----------
  function netdiskMenu() {
    const html = `<div class="hint">百度网盘 / 夸克网盘 导入导出需先在本机配置对应网盘凭证（AppKey/Token），当前为<b>未配置</b>状态。</div>
      <div class="hint">配置后此处可直接浏览网盘目录、拉取 kmz/照片 或上传。详见「帮助 → 网盘与互传」。</div>
      <div class="field" style="margin-top:10px">
        <button class="btn primary block" id="ndBaiduIn">📥 百度网盘导入</button>
        <button class="btn ghost block" id="ndBaiduOut" style="margin-top:8px">📤 百度网盘导出</button>
        <button class="btn ghost block" id="ndQuarkIn" style="margin-top:8px">📥 夸克网盘导入</button>
        <button class="btn ghost block" id="ndQuarkOut" style="margin-top:8px">📤 夸克网盘导出</button>
      </div>`;
    openModal("网盘导入导出", html, `<button class="btn ghost" onclick="APP.close()">关闭</button>`);
    const call = (prov, dir) => {
      if (window.AndroidBridge && window.AndroidBridge.netdiskImport) {
        if (dir === "in") window.AndroidBridge.netdiskImport(prov, pendingBatch.kind || "photos");
        else window.AndroidBridge.netdiskExport(prov, "ovkmz");
      } else {
        toast("当前环境未集成网盘（需 Android APK 且配置凭证）");
      }
    };
    el("ndBaiduIn").onclick = () => call("baidu", "in");
    el("ndBaiduOut").onclick = () => call("baidu", "out");
    el("ndQuarkIn").onclick = () => call("quark", "in");
    el("ndQuarkOut").onclick = () => call("quark", "out");
  }

  // ---------- 手机互传（item 5，P2P / 局域网，需两台设备真机测试）----------
  async function lanGetIp() {
    try { const r = await fetch("https://api.ipify.org?format=json").catch(() => null); return r ? (await r.json()).ip : "未知（不影响局域网互传）"; } catch (e) { return "未知（不影响局域网互传）"; }
  }
  async function lanMenu() {
    const ip = await lanGetIp();
    const html = `<div class="hint">两台手机都打开本 APP：一台做<b>服务端</b>（选择 kmz/照片并开启局域网共享），另一台做<b>客户端</b>（输入服务端地址下载）。需处于同一 WiFi/热点。</div>
      <div class="field"><label>本机外网地址（参考）</label><div class="coord-display"><span class="cd-v" id="lanIp">${ip}</span></div></div>
      <div class="field">
        <button class="btn primary block" id="lanStart">🛰 开启服务端（选择文件共享）</button>
        <button class="btn ghost block" id="lanStop" style="margin-top:8px">⏹ 停止服务端</button>
        <button class="btn ghost block" id="lanClient" style="margin-top:8px">📡 客户端：从服务端下载</button>
      </div>`;
    openModal("手机互传", html, `<button class="btn ghost" onclick="APP.close()">关闭</button>`);
    el("lanStart").onclick = () => { if (window.AndroidBridge && window.AndroidBridge.pickLanShare) window.AndroidBridge.pickLanShare(); else toast("当前环境不支持（需 Android APK）"); closeModal(); };
    el("lanStop").onclick = () => { if (window.AndroidBridge && window.AndroidBridge.stopLanServer) window.AndroidBridge.stopLanServer(); else toast("当前环境不支持"); closeModal(); };
    el("lanClient").onclick = () => { closeModal(); lanClientMenu(); };
  }
  function lanClientMenu() {
    const html = `<div class="field"><label>服务端地址（如 192.168.x.x）</label><input id="lanAddr" class="inp" placeholder="192.168.1.10"></div>
      <div class="field"><label>端口</label><input id="lanPort" class="inp" value="7205"></div>
      <div class="field"><label>下载内容</label><select id="lanKind"><option value="kmz">kmz/ovkmz（古建+照片）</option><option value="photos">照片压缩包(zip)</option></select></div>`;
    openModal("客户端下载", html, `<button class="btn ghost" id="lcCancel">取消</button><button class="btn primary" id="lcGo">下载并导入</button>`);
    el("lcCancel").onclick = closeModal;
    el("lcGo").onclick = async () => {
      const addr = el("lanAddr").value.trim(); const port = el("lanPort").value.trim() || "7205"; const kind = el("lanKind").value;
      if (!addr) return toast("请输入服务端地址");
      closeModal(); toast("正在从 " + addr + " 下载…");
      try {
        const res = await fetch(`http://${addr}:${port}/`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const buf = await res.arrayBuffer();
        if (kind === "kmz") {
          const recs = await IO.importKmzBuffer(buf);
          await Store.patch((d) => { for (const r of recs) { const exist = BASE.find((b) => b.id === r.id) || (d.added || []).find((a) => a.id === r.id); if (exist) d.updated[r.id] = r; else d.added.push(r); } });
          DELTA = await Store.get(); merge(); render(); toast(`互传导入成功：${recs.length} 个古建`);
        } else {
          const files = await IO.unzip(new Uint8Array(buf));
          let cnt = 0; for (const n of Object.keys(files)) { if (/\.(jpe?g|png|gif|bmp|webp)$/i.test(n)) { receivePhoto(n, IO.bytesToB64(files[n])); cnt++; } }
          if (cnt) receiveDone("photos"); else toast("未找到照片");
        }
      } catch (e) { toast("下载失败：" + e.message + "（请确认服务端已开启且同一网络）"); }
    };
  }

  // ---------- 导入 / 导出 ----------
  async function doImport(file) {
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["kml", "csv", "kmz", "ovkmz", "xls", "xlsx", "ovobj", "obj"].includes(ext)) return toast("不支持的格式：" + ext);
    // 大文件流量提醒（items 1/2：kmz/ovkmz 可能含大量照片 >3GB）
    if (ext === "kmz" || ext === "ovkmz") {
      const go = await confirmLargeTransfer("导入 kmz/ovkmz（可能含大量照片）");
      if (!go) return;
    }
    try {
      busy("正在解析导入文件，请稍后…");
      let recs, bufBytes = null;
      if (ext === "kml") { recs = IO.parseKmlToRecords(await file.text()); }
      else if (ext === "csv") { recs = IO.parseCsvToRecords(await file.text()); }
      else if (ext === "xlsx") { const ab = await file.arrayBuffer(); bufBytes = new Uint8Array(ab); recs = await IO.parseXlsxToRecords(bufBytes); }
      else if (ext === "xls") { const txt = await file.text(); bufBytes = IO.utf8(txt); recs = IO.parseXlsToRecords(txt); }
      else if (ext === "ovobj" || ext === "obj") {
        // ① 奥维原生二进制（OviO 魔数）→ 点对象逆向解析；② PK=zip 容器 → kmz 解包兜底；③ 1f=gzip 旧版→提示；④ 否则文本坐标
        const ab = await file.arrayBuffer();
        const head = new Uint8Array(ab).subarray(0, 4);
        if (head[0] === 0x4f && head[1] === 0x76 && head[2] === 0x69 && head[3] === 0x4f) {
          bufBytes = new Uint8Array(ab);
          recs = IO.parseOvobjBinary(bufBytes);
        } else if (head[0] === 0x50 && head[1] === 0x4b) { // ZIP 容器（奥维 .ovobj 常为此类）
          bufBytes = new Uint8Array(ab);
          recs = await IO.importKmzBuffer(bufBytes.buffer);
        } else if (head[0] === 0x1f) { // gzip 容器（旧版奥维）：浏览器无原生解压，提示电脑端
          throw new Error("该 .ovobj 为 gzip 压缩格式，请改用电脑端/PWA 导入，或先在奥维导出为 ovkmz");
        } else {
          const txt = await file.text();
          bufBytes = IO.utf8(txt);
          recs = IO.parseOvobjToRecords(txt);
        }
      }
      else {
        const ab = await file.arrayBuffer();
        bufBytes = new Uint8Array(ab);
        recs = await IO.importKmzBuffer(bufBytes.buffer);
      }
      if (!recs.length) { hideBusy(); throw new Error("未解析到任何古建"); }
      // 内容去重（item 6）：整文件哈希，若与此前导入的相同则提示覆盖/跳过
      if (bufBytes) {
        const h = await IO.sha256Hex(bufBytes);
        const ui = Store.ui.get() || {};
        const srcs = ui.importedSources || [];
        if (srcs.some((s) => s.h === h)) {
          hideBusy(); // 去重弹窗需交互，先收起遮罩
          const ok = await new Promise((resolve) => {
            openModal("文件内容重复", `<div class="hint">该文件（${esc(file.name)}）内容与之前导入的完全相同（按内容校验，非文件名）。是否仍要覆盖导入？</div>`,
              `<button class="btn ghost" id="imSkip">跳过</button><button class="btn primary" id="imOver">覆盖导入</button>`);
            el("imSkip").onclick = () => { closeModal(); resolve(false); };
            el("imOver").onclick = () => { closeModal(); resolve(true); };
          });
          if (!ok) return toast("已跳过重复导入");
        }
        const newsrcs = srcs.filter((s) => s.h !== h).concat([{ h, name: file.name, at: Date.now() }]).slice(-50);
        Store.ui.set(Object.assign({}, ui, { importedSources: newsrcs }));
      }
      await Store.patch((d) => {
        for (const r of recs) {
          const exist = BASE.find((b) => b.id === r.id) || (d.added || []).find((a) => a.id === r.id);
          if (exist) { d.updated[r.id] = r; }
          else { d.added.push(r); }
        }
      });
      DELTA = await Store.get(); merge(); render();
      hideBusy();
      toast(`导入成功：${recs.length} 个古建`);
      kbLog("导入古建", { file: file.name, count: recs.length });
    } catch (e) { hideBusy(); toast("导入失败：" + e.message); }
  }
  function exportMenu() {
    const hasFilter = filter.city.length || filter.atype.length || filter.q;
    const scope = hasFilter ? records.filter(passFilter) : records;
    const scopeLabel = hasFilter ? `筛选结果（${scope.length} 个）` : `全部古建（${scope.length} 个）`;
    const html = `<div class="hint" style="border:1px dashed var(--accent);border-radius:10px;padding:9px 12px;color:var(--txt);line-height:1.7">当前导出范围：<b style="color:var(--accent);font-size:14px">${scopeLabel}</b>${hasFilter ? "（已按当前筛选条件预选，可在下方增删）" : "（未筛选则导出全部；可先「筛选」再导出以只导筛选集）"}</div>
      <div class="field"><label>导出范围（勾选指定古建）</label>
        <div class="ex-selbar"><button class="btn ghost sm" id="exAll">全选</button><button class="btn ghost sm" id="exNone">全不选</button><span class="hint" id="exCnt">已选 ${scope.length}/${scope.length}</span></div>
        <div class="ex-list" id="exList">${scope.map((r) => `<label class="ex-item"><input type="checkbox" class="ex-cb" value="${r.id}" checked><span>${esc(r.name)}</span></label>`).join("")}</div>
      </div>
      ${DIMS.citys.length ? `<div class="field"><label>按城市（默认全选 · 含全部城市）</label><div class="ofc-list" id="exCitys" style="max-height:150px;overflow:auto;display:flex;flex-wrap:wrap;gap:6px 14px">${DIMS.citys.map((o) => `<label class="ofc"><input type="checkbox" class="ofc-cb" value="${esc(o)}" checked>${esc(o)}</label>`).join("")}</div></div>` : ""}
      <div class="field"><label>格式</label>
        <select id="exFmt">
          <option value="ovkmz">ovkmz（奥维可导入，含照片）</option>
          <option value="kmz">kmz（含照片）</option>
          <option value="kml">kml（不含照片，通用）</option>
          <option value="csv">csv（属性表）</option>
          <option value="chaohe">潮河格式（CSV 兼容）</option>
          <option value="xlsx">xlsx（Excel，通用）</option>
          <option value="xls">xls（Excel 2003 兼容）</option>
          <option value="ovobj">ovobj（奥维文本坐标，纯文本）</option>
          <option value="ovobjbin">ovobj（奥维二进制 OviO，兼容奥维）</option>
        </select></div>
      <div class="field" id="exColsField" style="display:none"><label>导出列（可取消勾选不需要的列）</label>
        <div class="ex-selbar"><button class="btn ghost sm" id="colAll">全选</button><button class="btn ghost sm" id="colNone">全不选</button></div>
        <div class="ex-list" id="exCols"></div></div>
      <div class="field"><label>导出位置</label>
        <select id="exWhere"><option value="saf">系统选择器（可自定义文件夹/文件名）</option><option value="folder">指定手机文件夹（Android）</option></select></div>
      <div class="field"><label>文件名组合段（点选即重生成文件名，可再手改；默认 城市+名称）</label>
        <div class="chips" id="exSegs">
          <span class="chip" data-seg="province">省</span>
          <span class="chip on" data-seg="city">城市</span>
          <span class="chip" data-seg="atype">类型</span>
          <span class="chip" data-seg="name">名称</span>
        </div></div>
      <div class="field"><label>文件名（不含扩展名，留空用默认/组合段）</label><input id="exFname" class="inp" placeholder="古建基础信息" value=""></div>
      <div class="hint">ovkmz/kmz 为 zip 包（doc.kml + 照片）；潮河格式为 CSV（列：名称,城市,区县,类型,经度,纬度,说明）。选「指定手机文件夹」将弹出系统文件夹选择器。城市选项会按所选古建自动匹配。</div>`;
    openModal("导出", html, `<button class="btn ghost" id="exCancel">取消</button><button class="btn primary" id="exGo">导出</button>`);
    // v2.4：组合段 → 文件名生成
    const exSegValOf = (r, seg) => seg === "city" ? citySafe(r.city) : seg === "province" ? (r.province || "")
      : seg === "atype" ? (r.atype || "") : (r.name || "");
    const exSafeSeg = (v) => (v || "").replace(/[\\/:*?"<>|\n\r]+/g, "_").trim();
    el("exSegs").querySelectorAll(".chip").forEach((c) => c.onclick = () => {
      c.classList.toggle("on");
      const segs = [...el("exSegs").querySelectorAll(".chip.on")].map((x) => x.dataset.seg);
      if (!segs.length) return;
      const recs = scope;
      const parts = segs.map((sg) => sg === "name" ? (recs.length === 1 ? exSafeSeg(recs[0].name) : recs.length + "个古建") : exSafeSeg(exSegValOf(recs[0], sg))).filter(Boolean);
      if (parts.length) el("exFname").value = parts.join("_");
    });
    const list = el("exList");
    const updateCnt = () => { el("exCnt").textContent = `已选 ${list.querySelectorAll(".ex-cb:checked").length}/${scope.length}`; };
    el("exAll").onclick = () => { list.querySelectorAll(".ex-cb").forEach((c) => c.checked = true); updateCnt(); };
    el("exNone").onclick = () => { list.querySelectorAll(".ex-cb").forEach((c) => c.checked = false); updateCnt(); };
    el("exCancel").onclick = closeModal;
    // 导出可选列（#39）：csv/chaohe 时显示列多选，默认全选
    const EX_COLS = {
      csv: [["folder", "文件夹"], ["name", "名称"], ["lon", "经度"], ["lat", "纬度"], ["comment", "Comment"]],
      chaohe: [["name", "名称"], ["city", "城市"], ["station", "区县"], ["atype", "古建类型"], ["lon", "经度"], ["lat", "纬度"], ["comment", "说明"]],
      xlsx: [["name", "名称"], ["province", "省份"], ["city", "城市"], ["station", "区县"], ["atype", "古建类型"], ["lon", "经度"], ["lat", "纬度"], ["desc", "说明"]],
      xls: [["name", "名称"], ["province", "省份"], ["city", "城市"], ["station", "区县"], ["atype", "古建类型"], ["lon", "经度"], ["lat", "纬度"], ["desc", "说明"]],
      ovobj: [["name", "名称"], ["city", "城市"], ["station", "区县"], ["atype", "古建类型"], ["lon", "经度"], ["lat", "纬度"], ["desc", "说明"]],
    };
    const exColsField = el("exColsField"), exColsBox = el("exCols");
    function renderExCols() {
      const f = el("exFmt").value;
      if (f !== "csv" && f !== "chaohe" && f !== "xlsx" && f !== "xls" && f !== "ovobj") { exColsField.style.display = "none"; return; }
      const def = EX_COLS[f] || [];
      exColsBox.innerHTML = def.map((p) => '<label class="ex-item"><input type="checkbox" class="col-cb" value="' + p[0] + '" checked><span>' + p[1] + '</span></label>').join("");
      exColsField.style.display = "";
    }
    el("exFmt").addEventListener("change", renderExCols);
    el("colAll").onclick = () => { exColsBox.querySelectorAll(".col-cb").forEach((c) => c.checked = true); };
    el("colNone").onclick = () => { exColsBox.querySelectorAll(".col-cb").forEach((c) => c.checked = false); };
    renderExCols();

    el("exGo").onclick = async () => {
      const fmt = el("exFmt").value, where = el("exWhere").value;
      const ids = [...list.querySelectorAll(".ex-cb:checked")].map((c) => c.value);
      let sel = records.filter((r) => ids.includes(r.id));
      // v2.4：城市选项按所选古建自动匹配（全选时用 sel 的城市子集覆盖）
      const ofcBox = el("exCitys");
      let offices = null;
      if (ofcBox) {
        const all = [...ofcBox.querySelectorAll(".ofc-cb")];
        const checked = all.filter((c) => c.checked).map((c) => c.value);
        if (checked.length === all.length && all.length > 0) {
          offices = [...new Set(sel.map((r) => normCity(r.city)).filter(Boolean))];
          all.forEach((c) => c.checked = offices.includes(c.value));
        } else { offices = checked; }
      }
      if (offices && offices.length) sel = sel.filter((r) => offices.includes(normCity(r.city)));
      if (!sel.length) return toast("请至少选择一项");
      const cols = (fmt === "csv" || fmt === "chaohe" || fmt === "xlsx" || fmt === "xls") ? [...exColsBox.querySelectorAll(".col-cb:checked")].map((c) => c.value) : null;
      if ((fmt === "csv" || fmt === "chaohe" || fmt === "xlsx" || fmt === "xls") && (!cols || !cols.length)) return toast("请至少选择一列");
      const fnameRaw = (el("exFname") ? (el("exFname").value || "").trim() : "");
      const extMap = { ovkmz: "ovkmz", kmz: "kmz", kml: "kml", csv: "csv", chaohe: "csv", xlsx: "xlsx", xls: "xls", ovobj: "ovobj", ovobjbin: "ovobj" };
      const ext = extMap[fmt] || "txt";
      const base = fnameRaw ? fnameRaw.replace(/\.[^.]+$/, "") : "古建基础信息";
      // 大文件流量提醒（items 1/2：ovkmz/kmz 含照片可能 >3GB）
      if (fmt === "ovkmz" || fmt === "kmz") {
        const go = await confirmLargeTransfer("导出 " + fmt.toUpperCase() + "（含照片，可能很大）");
        if (!go) return;
      }
      // 导出前先显示「执行中」遮罩：含照片的 kmz/ovkmz 在 JS 端打包 base64 可能较慢，避免"点了没反应"
      busy("正在生成导出文件，请稍后…");
      await new Promise((r) => setTimeout(r, 30)); // 让遮罩先绘制
      try {
      if (where === "folder" && window.AndroidBridge && window.AndroidBridge.exportFilesToTree) {
        let content = "";
        if (fmt === "csv") content = IO.buildCsv(sel, cols);
        else if (fmt === "chaohe") content = IO.buildChaohe(sel, cols);
        else if (fmt === "kml") content = IO.buildKML(sel);
        else if (fmt === "xlsx") content = IO.buildAttrXlsx(sel, cols);
        else if (fmt === "xls") content = IO.buildAttrXls(sel, cols);
        else if (fmt === "ovobj") content = IO.recordsToOvobj(sel, cols);
        else if (fmt === "ovobjbin") content = IO.recordsToOvobjBinary(sel);
        else content = IO.buildCsv(sel, cols);
        const fname = base + "." + ext;
        const b64 = (fmt === "xlsx" || fmt === "xls" || fmt === "ovobjbin") ? IO.bytesToB64(content) : IO.bytesToB64(IO.utf8(content));
        window.AndroidBridge.exportFilesToTree(JSON.stringify([{ name: fname, b64 }]));
        hideBusy();
        closeModal(); toast("已向系统请求导出到所选文件夹：" + fname);
        return;
      }
      if (fmt === "ovkmz") IO.exportOvkmz(sel, base);
      else if (fmt === "kmz") IO.exportKmz(sel, base);
      else if (fmt === "kml") IO.exportKml(sel, base);
      else if (fmt === "csv") IO.exportCsv(sel, base, cols);
      else if (fmt === "chaohe") IO.exportChaoheFile(sel, base, cols);
      else if (fmt === "xlsx") IO.exportXlsx(sel, base, cols);
      else if (fmt === "xls") IO.exportXls(sel, base, cols);
      else if (fmt === "ovobj") IO.exportOvobj(sel, base, cols);
      else if (fmt === "ovobjbin") IO.exportOvobjBin(sel, base);
      hideBusy();
      closeModal(); toast("已开始导出 " + fmt.toUpperCase() + "：" + base + "." + ext);
      } catch (e) { hideBusy(); closeModal(); toast("导出失败：" + (e && e.message ? e.message : e)); }
    };
  }

  // ---------- 其它：统计/定位/同步/重置/帮助/关于 ----------
  function stats() {
    const byOffice = {}, byBtype = {};
    records.forEach((r) => { byOffice[r.city] = (byOffice[r.city] || 0) + 1; byBtype[r.atype] = (byBtype[r.atype] || 0) + 1; });
    const grid = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="stat"><div class="n">${v}</div><div class="t">${esc(k) || "未分类"}</div></div>`).join("");
    const custom = (DELTA.added || []).length + Object.keys(DELTA.updated || {}).length;
    const html = `<div class="stat-grid">
        <div class="stat"><div class="n">${records.length}</div><div class="t">古建总数</div></div>
        <div class="stat"><div class="n">${custom}</div><div class="t">我的改动</div></div>
      </div>
      <h4 style="margin:14px 0 6px">按城市</h4><div class="stat-grid">${grid(byOffice)}</div>
      <h4 style="margin:14px 0 6px">按古建类型</h4><div class="stat-grid">${grid(byBtype)}</div>`;
    openModal("统计概览", html, `<button class="btn ghost" onclick="APP.close()">关闭</button>`);
  }
  function locate() {
    if (!navigator.geolocation) return toast("当前环境不支持定位");
    toast("正在定位…");
    navigator.geolocation.getCurrentPosition((p) => {
      myLoc = { lat: p.coords.latitude, lon: p.coords.longitude };
      if (myLocMarker) map.removeLayer(myLocMarker);
      myLocMarker = L.circleMarker([myLoc.lat, myLoc.lon], { radius: 9, color: "#2ecc8f", fillColor: "#2ecc8f", fillOpacity: .65, weight: 3 }).addTo(map).bindPopup("我的位置").openPopup();
      map.setView([myLoc.lat, myLoc.lon], 15);
      toast("已定位到我的位置");
    }, (err) => {
      const denied = (err && err.code === 1); // PERMISSION_DENIED
      if (window.AndroidBridge && window.AndroidBridge.openLocationSettings) {
        // APK(WebView)：直接跳转系统定位设置页
        window.AndroidBridge.openLocationSettings();
      } else if (denied) {
        toast("定位被拒绝，请在浏览器站点设置中允许定位");
      } else {
        toast("无法获取位置：请确认已开启定位服务后重试");
      }
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }
  // ---------- 导航 / 周边 / 测距 ----------
  function navigate(id) {
    const r = records.find((x) => x.id === id); if (!r) return;
    const name = r.name || "目标";
    let url;
    if (myLoc) {
      url = `https://uri.amap.com/navigation?from=${myLoc.lon},${myLoc.lat},我的位置&to=${r.lon},${r.lat},${encodeURIComponent(name)}&mode=car&policy=1&src=gujian&coordinate=wgs84&callnative=1`;
    } else {
      url = `https://uri.amap.com/marker?position=${r.lon},${r.lat}&name=${encodeURIComponent(name)}&src=gujian&coordinate=wgs84&callnative=1`;
    }
    if (window.AndroidBridge && window.AndroidBridge.openNav) window.AndroidBridge.openNav(url);
    else window.open(url, "_blank");
    toast(myLoc ? "已用我的位置发起导航" : "已打开目标位置");
  }
  function nearCenter(id) {
    const r = records.find((x) => x.id === id); if (!r) return;
    nearbyCenter = { lat: r.lat, lon: r.lon };
    openNearby();
  }
  function openNearby() {
    const centerOpts = `<option value="map">当前地图中心</option>` +
      (myLoc ? `<option value="me">我的位置</option>` : ``) +
      `<option value="pick">在地图上点选</option>` +
      records.slice(0, 200).map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");
    const html = `<div class="field"><label>中心</label><select id="nbCenter">${centerOpts}</select></div>
      <div class="field"><label>半径（米）</label>
        <select id="nbRadius"><option value="200">200</option><option value="500" selected>500</option><option value="1000">1000</option><option value="3000">3000</option><option value="5000">5000</option><option value="10000">10000</option></select></div>
      <div class="field"><label>周边古建类型（可多选，不选=全部）</label><div class="chips" id="nbAtypes">${DIMS.atypes.map((t) => `<span class="chip" data-at="${esc(t)}">${esc(t)}</span>`).join("")}</div></div>
      <div class="hint">将显示与「中心」距离不超过半径、且符合所选类型的全部古建，并在地图上画范围圈。</div>`;
    openModal("周边搜索", html, `<button class="btn ghost" id="nbExit">退出</button><button class="btn ghost" id="nbClear">清除周边</button><button class="btn primary" id="nbGo">搜索</button>`);
    el("nbExit").onclick = closeModal;
    const nbAt = document.querySelectorAll("#nbAtypes .chip");
    nbAt.forEach((c) => c.onclick = () => c.classList.toggle("on"));
    el("nbGo").onclick = () => {
      const cval = el("nbCenter").value, rad = parseInt(el("nbRadius").value, 10);
      if (cval === "map") nearbyCenter = { lat: map.getCenter().lat, lon: map.getCenter().lng };
      else if (cval === "me") { if (!myLoc) return toast("尚未定位，请先「定位我的位置」"); nearbyCenter = myLoc; }
      else if (cval === "pick") { closeModal(); pickNearbyCenter(rad); return; }
      else { const rr = records.find((x) => x.id === cval); if (!rr) return; nearbyCenter = { lat: rr.lat, lon: rr.lon }; }
      nearbyRadius = rad;
      nearbyAtypes = [...document.querySelectorAll("#nbAtypes .chip.on")].map((c) => c.dataset.at);
      closeModal(); render(); fitToShown();
      const atSuffix = nearbyAtypes.length ? `（类型：${nearbyAtypes.join("/")}）` : "";
      toast(`周边 ${rad}m 内共 ${records.filter(passFilter).length} 个古建${atSuffix}`);
    };
    el("nbClear").onclick = () => {
      nearbyCenter = null; nearbyRadius = null; nearbyAtypes = [];
      if (nearbyCircle) { overlayGroup.removeLayer(nearbyCircle); nearbyCircle = null; }
      closeModal(); render(); toast("已清除周边筛选");
    };
  }
  function pickNearbyCenter(rad) {
    toast("请在地图上点选周边中心");
    map.once("click", (e) => { nearbyCenter = { lat: e.latlng.lat, lon: e.latlng.lng }; nearbyRadius = rad; render(); fitToShown(); toast(`周边 ${rad}m 内共 ${records.filter(passFilter).length} 个古建`); });
  }
  function haversine(a, b) {
    const R = 6371000, toRad = (x) => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m"; }
  function enterMeasure() {
    measureMode = true; measurePts = [];
    if (measureLine) overlayGroup.removeLayer(measureLine);
    measureLine = L.polyline([], { color: "#ffb454", weight: 3, dashArray: "6 6" }).addTo(overlayGroup);
    el("measurebar").classList.add("show");
    el("measureInfo").textContent = "点击地图或古建添加测量点";
    el("map").style.cursor = "crosshair";
    toast("测距：依次点击两点或古建");
  }
  function exitMeasure() {
    measureMode = false;
    if (measureLine) { overlayGroup.removeLayer(measureLine); measureLine = null; }
    overlayGroup.eachLayer((l) => { if (l._mpt) overlayGroup.removeLayer(l); });
    measurePts = [];
    el("measurebar").classList.remove("show");
    el("map").style.cursor = "";
  }
  function addMeasurePt(ll) {
    const latlng = L.latLng(ll.lat, ll.lon);
    measurePts.push(latlng);
    const idx = measurePts.length;
    const mk = L.circleMarker(latlng, { radius: 5, color: "#ffb454", fillColor: "#fff", fillOpacity: 1, weight: 2 });
    mk._mpt = true; mk.bindTooltip("点" + idx, { direction: "top" });
    overlayGroup.addLayer(mk);
    measureLine.addLatLng(latlng);
    let total = 0;
    for (let i = 1; i < measurePts.length; i++) total += haversine({ lat: measurePts[i - 1].lat, lon: measurePts[i - 1].lng }, { lat: measurePts[i].lat, lon: measurePts[i].lng });
    const seg = measurePts.length >= 2 ? haversine({ lat: measurePts[measurePts.length - 2].lat, lon: measurePts[measurePts.length - 2].lng }, { lat: measurePts[measurePts.length - 1].lat, lon: measurePts[measurePts.length - 1].lng }) : 0;
    el("measureInfo").textContent = `共 ${measurePts.length} 点，总长 ${fmtDist(total)}` + (measurePts.length >= 2 ? `（末段 ${fmtDist(seg)}）` : "");
  }

  async function syncExport() {
    const txt = await Store.exportJSON();
    IO.downloadText("古建景点打卡-我的改动.json", txt, "application/json");
    toast("已导出我的改动");
  }
  function syncImport() {
    pickFiles({ accept: ".json", onPick: async (files) => {
      const f = files[0]; if (!f) return;
      try { await Store.importJSON(await f.text()); DELTA = await Store.get(); merge(); render(); toast("已导入改动"); }
      catch (e) { toast("导入失败：" + e.message); }
    }});
  }
  async function reset() {
    if (!confirm("重置将清除全部「我的改动」，恢复到基础数据。确认？")) return;
    await Store.clear(); DELTA = await Store.get(); merge(); render(); toast("已重置为基础数据");
    kbLog("重置为基础数据", {});
  }
  function help() {
    const html = `<div class="hint" style="line-height:1.9">
      <b>浏览</b>：拖动地图、缩放查看古建；点击标记看详情与照片。<br>
      <b>搜索</b>：顶部输入框按名称实时筛选。<br>
      <b>筛选</b>：菜单→筛选，可多选古建类型（如 节制闸 / 跌水）与城市（如 温泉所）；选城市会自动定位到其范围中心。<br>
      <b>添加</b>：菜单→添加，点「在地图上点选坐标」或手填经纬度，可上传多张照片（正面/背面/侧面…）。<br>
      <b>编辑/删除</b>：点开标记 → 编辑 / 删除。<br>
      <b>导入</b>：支持 ovkmz / kmz / kml / csv / ovobj / obj（奥维导出格式；ovobj/obj 为文本坐标，可含中文表头，纯文本无照片）。<br>
      <b>导出</b>：ovkmz/kmz 含照片，可被奥维「导入」识别；csv 为属性表；ovobj 为纯文本坐标文件，可被本 App 原样再导入。<br>
      <b>我的改动</b>：所有增删改存在本机（IndexedDB），离线可用；菜单→导出/导入我的改动 可备份或迁移。<br>
      <b>底图</b>：右上角 🚫/🗺 按钮开关天地图底图；默认关闭（仅显示点位，省流量），开启需联网。顶栏「矢量/影像」按钮可在<b>矢量地图</b>与<b>影像地图</b>间切换。<br>
      <b>定位</b>：菜单→定位我的位置；若未授权，App(安卓)会自动跳转系统定位设置，浏览器请手动开启站点定位权限。<br>
      <b>获取经纬度</b>：菜单→获取经纬度，可获取「我的位置」坐标、在地图上点选坐标、或搜索古建列出其坐标；支持一键复制（格式「纬度, 经度」）。<br>
      <b>导航</b>：点开古建 → 导航，优先用「我的位置」为起点，跳转高德等第三方导航软件（坐标为 WGS84 自动转换）。<br>
      <b>测距</b>：菜单→测距，依次点击地图或古建，自动绘制折线并显示累计距离；退出可点浮条"退出"、再点一次菜单"测距"、或按返回键/Esc。<br>
      <b>周边</b>：菜单→周边搜索，选中心（我的位置 / 地图中心 / 某古建 / 地图点选）+ 半径，列出并高亮范围內古建。<br>
      <b>列表快速定位</b>：顶部 ☰ 打开古建列表，每项右侧「快速定位 →」点一下即飞到该古建地图位置并关闭列表。<br>
      <b>找不到主菜单？</b>：在地图任意处<b>快速连点三下</b>，即可关闭卡住的弹窗/列表并重新打开主菜单（顶部 ≡ 也始终可用）。<br>
      <b>关闭弹窗</b>：点右上角 ×（圆形按钮）、点弹窗外灰色遮罩、或按返回键/Esc，三种方式皆可；列表与抽屉也有各自的关闭 ×。<br>
      <b>离线</b>：App 与数据可离线使用；底图需联网（大范围离线瓦片体积过大）。<br>
      <b>安卓</b>：Chrome 打开 → 右上角 ≡ → 添加到主屏幕，即成为 App。<br>
      <b>关于</b>：菜单→关于，含「建议使用环境」与「制作环境（本机运行环境）」；更完整说明见应用文档《用户使用文档》。
      <hr style="border:none;border-top:1px dashed var(--line);margin:10px 0">
      <b>📚 知识库（智能框架）</b>：菜单→知识库查询 可对话式检索本机知识库（不依赖联网）；<b>导入知识库文件</b>支持 md / txt / html 多选（主流知识库 Obsidian/语雀/Notion 兼容，元数据自动还原）；<b>导入外部文件存入知识库</b>把 pdf / docx / xlsx / html / csv / 图片 在<b>应用内零依赖</b>智能转为 Markdown 入库，扫描件 PDF 与图片自动<b>内置 OCR</b>识别文字，全程进度条；保存即<b>切片+向量化</b>（句子级切片，尽量保持语句完整），支持<b>混合检索（关键词+向量）、反向/模糊/语义查询</b>；导出支持 md / txt / html / zip。<br>
      <b>🧠 记忆管理</b>：知识库内置 Hermes 自我学习机制，AI 查询/更新/纠错会自动沉淀记忆，下次交互更贴合你的业务；与已接入大模型有机融合（提示词自动拼装知识库精准片段 + 自学习记忆）。<br>
      <b>⬆️ 升级与备份</b>：菜单→设置→软件升级，公开版/内部版均经<b>百度网盘自动升级</b>（填入 latest.json 直读地址即可，下载填网盘分享链接）；升级前先「升级数据导出」（可自定义文件夹/文件名，默认「古建一张图备份+日期.bak」），该包可回灌「升级数据导入」（会覆盖本机全部数据，已明确提示风险）。<br>
      <b>📝 游记</b>：古建「写游记」——所见即所得（字体/字号/表情/图片/表格），默认绑定古建，关键词筛选，导出 MD+JSON，内容镜像知识库供 AI 查询。<br>
      <b>🤖 智能 AI</b>：智能查询/智能问询/AI 更新/纠错/对话，均基于已接入的大模型（设置→大模型 AI 设置 配置密钥与地址）；联网开启时本地无果可联网兜底，答案标注来源。<br>
      <b>🐞 错误日志</b>：菜单→信息与帮助→错误日志，全局捕获运行错误（环形缓冲），可查看/复制/清空，便于反馈排查。
    </div>`;
    openModal("帮助", html, `<button class="btn ghost" onclick="APP.close()">知道了</button>`);
  }
  function getEnvInfo() {
    const ua = navigator.userAgent || "";
    let os = "未知", osVer = "";
    if (/Windows NT 10/.test(ua)) { os = "Windows"; osVer = "10 / 11"; }
    else if (/Windows NT 6\.3/.test(ua)) { os = "Windows"; osVer = "8.1"; }
    else if (/Windows NT 6\.1/.test(ua)) { os = "Windows"; osVer = "7"; }
    else if (/Windows/.test(ua)) { os = "Windows"; }
    else if (/Android (\d+(?:\.\d+)?)/.test(ua)) { os = "Android"; osVer = RegExp.$1; }
    else if (/iPhone|iPad/.test(ua)) { os = "iOS"; }
    else if (/Mac OS X/.test(ua)) { os = "macOS"; }
    else if (/Linux/.test(ua)) { os = "Linux"; }
    let device = "";
    const dm = ua.match(/;\s*([^;()]+?)\s+Build\//);
    if (dm) device = dm[1].trim();
    if (!device) {
      if (/iPhone/.test(ua)) device = "iPhone";
      else if (/iPad/.test(ua)) device = "iPad";
      else if (/Android/.test(ua)) device = "Android 设备";
      else if (/Windows/.test(ua)) device = "PC";
      else device = "未知设备";
    }
    let engine = "浏览器";
    if (/Edg\//.test(ua)) engine = "Edge";
    else if (/Chrome\//.test(ua)) engine = "Chrome";
    else if (/Firefox\//.test(ua)) engine = "Firefox";
    else if (/Safari\//.test(ua)) engine = "Safari";
    if (window.AndroidBridge) engine += "（App WebView）";
    const cpu = navigator.hardwareConcurrency ? navigator.hardwareConcurrency + " 核" : "未知";
    const mem = navigator.deviceMemory ? navigator.deviceMemory + " GB" : "未知";
    let gpu = "未知";
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (gl) {
        const dbg = gl.getExtension("WEBGL_debug_renderer_info");
        if (dbg) gpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "未知";
      }
    } catch (e) {}
    const sw = window.screen ? window.screen.width : 0, sh = window.screen ? window.screen.height : 0;
    const dpr = window.devicePixelRatio || 1;
    const screen = (sw && sh) ? `${sw}×${sh} @${dpr}x` : "未知";
    return { os, osVer, device, engine, cpu, mem, gpu, screen };
  }
  // 版本变更：单一来源 APP_VER + 内置变更摘要（与文档同步维护）
  const CHANGELOG = [
    ["v2.4.8", "2026-09-07", ["知识库智能化：新增「知识库模糊检索」——错字/缺字/语序不同也能命中（如「跌水闸」可命中「跌水节制闸」），结果带相关度百分比，可对任一条目直接反向查询或标为存疑", "新增「提示词生成」：问题 + 知识库最相关片段 + 长期记忆自动拼装成完整提示词，可复制自用或直接投喂大模型；AI 查询结果新增「查看提示词」按钮", "新增「AI 记忆（Hermes）」：查询/纠错/存疑自动沉淀为记忆并在提示词中引用，支持查看、按关键词检索、一键清空（不影响知识条目）", "新增「存疑与反向查询」：不确定的内容可打存疑标记（标签：存疑/待核实），系统用其内容反向检索知识库给出最相关条目辅助核实；AI 查询结果可一键「标为存疑」", "修复重要缺陷：AI 调用时已生成知识库上下文却仍把原始问题发给模型（知识库等于没接上），现已真正随请求发送", "设置新增「通过 GitHub 升级」子菜单（内部版查 *-internal-4060、公开版查 *-public-4060，与网盘双通道隔离一致；私有库支持填 GitHub 只读 Token）", "菜单可隐藏：长按任意菜单项选择隐藏，设置中「恢复隐藏子菜单 / 隐藏子菜单列表」随时恢复，恢复入口受保护不会被自己锁死", "导出位置可自定义：设置「导出文件位置」预配置默认文件夹，导出前可询问（批量导出只问一次），知识库导出默认名改为「知识库YYYY-MM-DD」", "奥维 ovkmz 互通修复：导入剥除 UTF-8 BOM（原装文件不再报 xml 语法错误）、附件路径归一（照片不再只显示占位符）；导出照片目录对齐原装 ovatta/、参数分隔符对齐「键 : 值|」"]],
    ["v2.4.7", "2026-09-05", ["升级按钮与自动升级：设置菜单新增「检查新版本」一键检测（百度网盘）；发现新版自动下载安装包（直链走 fetch 分块下载+进度；百度网盘分享页自动打开并备好提取码），可在升级对话框关闭自动下载", "古建改单通道：数据本身公开、两端全功能，取消内部分版——构建只出一套包，升级走 public 通道", "发版自动上传百度网盘：构建收尾自动上传安装包 + latest.json 到网盘发布目录（未登录时优雅跳过）"]],
    ["v2.4.6", "2026-09-05", ["知识库智能框架：保存即「切片+向量化」——句子级切片（尽量保持语句完整，长段按句切且重叠衔接），离线哈希向量（中英文混排，零外部依赖）+ 关键词命中 = 混合检索；支持反向查询（内容→条目）、模糊/语义查询、智能生成提示词", "引入记忆管理（MEMORY）与 Hermes 自我学习机制，并与已接入大模型有机融合（AI 提示词自动拼装 KB 精准片段 + 自学习记忆），统一上下文检索入口", "升级体系升级：古建内部版与公开版均可经百度网盘自动升级（latest.json 直读清单 + download 填网盘分享链接）；升级数据导出支持自定义文件夹/文件名（默认「古建一张图备份+日期.bak」），导出文件可回灌导入并提示覆盖全部数据风险", "修复「写游记」菜单 script error：journal.js 全面 ES5 兼容 + 全局 helper 缺失时 fail-loud；app.js 顶部注入 NodeList.forEach 等老 WebView 兼容垫片，杜绝白屏与裸 script error", "内置轻量 OCR（tesseract.js 本地资产 chi_sim/eng，离线）：扫描件 PDF 与 jpg/png/bmp/webp 图片自动识别文字入库，懒加载不拖启动", "新增「信息与帮助→四端功能对照单/版本变更/功能介绍」全部同步到最新（含 v2.4.4~v2.4.6 新增能力）"]],
    ["v2.4.5", "2026-09-05", ["知识库格式改造（主流知识库兼容）：「导出知识库」由 zip 改为单文件 md / txt / html——md 为 YAML front matter 格式（title/tags/type/updated/id），Obsidian / Joplin / 语雀 / Notion 等主流知识库可直接导入；zip 完整备份在导出对话框保留兼容", "「导入知识库文件」支持 md / txt / html 多选导入，front matter 元数据自动还原（标题/标签/类型）；旧 .zip 备份仍可导入", "新增「导入外部文件存入知识库」智能转换：pdf / docx / xlsx / html / csv / json 等非 md 格式，应用内零依赖智能转为 Markdown 后入库——pdf 提取文本流（扫描件/加密件明确报错引导，不静默）、docx 保留标题/列表/表格、xlsx/csv 转标准 md 表格；转换全程进度条指示，支持多文件批量", "知识库查询效率优化：检索索引（标题+标签+正文小写串）按条目缓存、写入/删除自动失效；导出正文剔除可再生成的操作日志，降低 token 与文件体积"]],
    ["v2.4.4", "2026-09-04", ["三端新增升级体系：设置菜单「软件升级/升级数据导出/升级数据导入」——升级前提醒备份、导出包旧版可导入（跨版本数据兼容含照片）、公开/内部通道隔离不交叉、无新版明确提示", "图文笔记引擎 journal.js：古建「写游记」、水利/感知「写备忘录/导出备忘录」——所见即所得（字体/字号/表情/图片/表格），默认绑定对象，关键词筛选（名称/时间/摘要），导出 MD+JSON，内容镜像知识库供智能AI查询", "修复地图气泡「分享」按钮 script error（APP.shareBuilding 未导出，即用户报「点详细→运行错误」根因）；古建筛选多命中改绿色虚线最小包围圆", "新增「信息与帮助→错误日志」：全局错误捕获（onerror/unhandledrejection 环形缓冲300条）可查看/复制/清空，便于反馈排查",     "公开版策略落地：双通道构建——公开版（脱敏拟真数据「清源灌区」+ 公开通道）/ 内部版（完整数据 + 内部通道），升级通道隔离互不交叉；公开版智能AI装后即用（大模型接口内置）", 
    "筛选多命中圈选三端统一：绿色虚线最小包围圆（Ritter 算法，刚好圈住+视野刚好完整显示），单命中直接定位", 
"长按菜单收藏补振动反馈（navigator.vibrate）"]],
    ["v2.4.1", "2026-08-30", ["古建 AI 智能查询输入框友好化：pickRecord placeholder 由「搜索APP条目…」改为具体场景示例（「输入名称/省份/城市/类型模糊搜」），并新增「试试搜」5 枚条目快捷 chip 让用户一眼看到使用方式", "修复「龚庄子进水闸设计流量与结构特点」类不伦不类占位符（实际是历史 pickRecord 列表中错误条目的位置错觉问题）", "城市配置默认值可多选（设置 → 默认城市可勾选多个）", "快捷常用视觉区分：⭐ 前缀 + 金边（同水利端）", "zip 名称弹性层次匹配（matchCityScope 加权：城市名优先）", "三端四平台同步更新"]],
    ["v2.4.0", "2026-08-28", ["组织配置持久化（v2.4）：古建端机构简化为省/城市两级，可增删改城市名与默认城市，级联同步筛选/导出/添加；类型管理（增删改 · 级联同步）", "设置新增三个管理入口：①机构与默认城市管理 ②古建类型管理 ③快捷常用设置", "导出文件名与文件夹层次可选项：导出照片支持文件名组合段（省/城市/类型/名称）与文件夹层次组合段（默认 城市/），安卓端多级目录导出原生支持", "zip 三级匹配导入：压缩包文件名 → zip 内文件夹 → 照片文件名；zip 名命中城市（如 西安.zip → 优先在西安景点范围内匹配）后整包收窄匹配范围；安卓原生桥接 zip 文件名", "新增「快捷常用」主菜单：置于查询/筛选之下首位，右键/长按任意菜单项快速添加，或到设置勾选；原子菜单全部保留", "菜单调序：查询 筛选 快捷常用 拍照打卡 地图与位置 数据管理 传输与共享 旅游打卡 智能AI 设置 信息与帮助；「大模型 AI 设置」并入智能AI组、「关于/帮助」并入信息与帮助组（功能全保留）", "修复筛选弹窗照片卡顿：refreshHit 加 200ms 防抖", "修复文件夹上下文城市匹配 bug：旧代码用 r.city 原文比对（北京市）导致范围限定失效，改为 normCity 规范化比对（北京）"]],
    ["v2.3.0", "2026-08-29", ["本地优先·AI 与知识库高度融合：智能查询答案自动标注来源——本地知识库命中标「📖 本地知识库已参考」，联网兜底标「🌐 联网」，离线纯本地标「📖 本地」；知识库检索升级，无网环境可用", "新增「知识库查询」菜单：对话式检索本地知识库（不依赖联网 AI），命中片段按相关度排序展示", "AI 智能更新可人工把关：生成的简介与参数表在应用前可逐项编辑修正，改动高亮对比，确认后才写入", "周边搜索按类型筛选：周边 N 米内可勾选古建类型，只看关心的类型", "导出文件名自定义：古建信息与照片导出均可自定义文件名（留空按城市命名）", "关键词历史：筛选弹窗收纳最近搜索关键词，点击即用、可清空", "修复筛选弹窗「照片」分组点击异常"]],
    ["v2.2.1", "2026-08-23", ["新增「退出当前页面」常驻按钮（约束5）：顶栏✕按钮调用 APP.back() 逐级关闭弹窗>抽屉>测距>列表，无物理返回键的 Win/统信/苹果端也能随时退出当前页面；并增强 back() 主页兜底（已在主页则点✕关闭抽屉/提示三击空白唤主菜单），与既有三击空白弹主菜单并存", "四端同步（2026-08-23）：将含 P5（旅游打卡/旅游打卡/智能分析）+ 退出按钮的最新前端同步至 Win11(exe·msi)、统信UOS龙芯(mips64el deb)、苹果PWA(静态源)；统信端纠正架构——龙芯3A4000为 mips64el，弃用此前误打的 amd64 deb，改用浏览器壳方案打 mips64el deb（Electron 无 mips 二进制），功能与其余端一致且离线可用", "四端功能对照表产出（约束3）：逐能力列出安卓/Win/统信/苹果差异，不强行一致"]],
    ["v2.2", "2026-08-21", ["照片导出「没有可导出照片」根因防护：Web/PWA/UOS/Win 上该提示通常是导入未成功（照片数据未落库），改为给出可操作指引（UOS 8G 用目录流式导入、其他平台批量导入、安卓导出 zip 复制），而非只报一句", "照片导出覆盖提示：目标文件夹已有同名照片时，原生 exportFilesToTree 会静默覆盖，改为先弹确认（覆盖导出/取消），避免误覆盖", "删除 6 张孤立内置样张（images/ 下无引用占位图），减小体积"]],
    ["v2.01", "2026-08-20", ["局域网互传端口 8888→7205 统一（与水利/视频一致）", "注：水利源工程的「添加古建坐标优先两步式」为交互层优化，古建线沿用单步表单（数据模型一致、坐标字段完整），两步式交互改造待专项迭代"]],
    ["v2.0", "2026-08-19", ["地图右侧新增悬浮控件组：收藏当前窗口（⭐）/ 返回收藏窗口（📍），收藏范围持久化（Store.ui.favs），多窗口可列表选择返回", "zip 照片导入卡死根治（中央目录解析 + 超时保护 + 老浏览器降级）", "zip 多层目录支持（完整相对路径 + 逐层匹配）", "标记颜色/形状自定义 + 左下角图例"]],
    ["v1.99", "2026-08-20", ["级联同步（三端统一品牌）：继承水利工程一张图 v1.99 全部修复——①导入 ovkmz/zip/7z 选不了文件根治：accept 改「扩展名+MIME+*/*」兜底 + 原生 onShowFileChooser 改 ACTION_OPEN_DOCUMENT（系统选择器必然可打开、所有文件可见可选，格式由前端校验）；②导入「点了没反应」：pickFiles 统一 8 入口持有引用挂 DOM（根治 WebView GC）+ 2.5s 非静默失败看门狗；③导入报「IO.sha256Hex is not a function」根治：io.js 导出表补 sha256Hex + sha256:{hex} 别名；④奥维 ovkmz 真实结构兼容：OvAttaItem 文本路径照片/description「键 : 值|」参数/Folder 层级映射城市·区县·古建类型/ovatta/ 目录；导出改奥维原生 OvAttr/OvAttaList/OvAttaItem 文本路径 + OvCoordType=CGCS2000，本 APP 与奥维双向可导入、往返一致；⑤导出弹窗新增「当前导出范围」提示条 + busy 遮罩覆盖导出打包", "桌面版回灌增强（2026-08-19）：奥维导入时 Folder 名含「段--类型」自动补全 station/atype（如 西田各庄段--进水闸 → station=西田各庄段、atype=进水闸、type=西田各庄段--进水闸），三端解析结果一致"]],
    ["v1.9.9", "2026-08-17", ["修复批量导入 xlsx 静默失败（bug③，本轮新发现）：文件夹/多选/zip 三条批量通道此前都把 xlsx 当纯文本喂给 CSV 解析器（且 zip 通道固定传空串），结果「解析 0 条、界面无任何报错」；改为 xlsx 走 readAsArrayBuffer 字节流 + parseXlsxToRecords，xls 走 BIFF 检测解析器，未知扩展名显式抛错，读取失败也提示并推进计数（不再卡住导入状态）", "修复导出列勾选失效 + 文件名错位（bug③，本轮新发现）：IO.exportCsv/exportChaoheFile/exportXlsx/exportXls 签名为 (records, root, cols)，调用侧误按 (records, cols) 传参，导致导出文件名变成「name,province,city…」列名串、且用户勾选的导出列被完全忽略；现按正确位置传参", "修复导入文件选择器挡掉 Excel（bug④，本轮新发现）：单文件导入入口 accept 仅 .ovkmz/.kmz/.kml/.csv，虽然 doImport 已支持 xls/xlsx 但用户在选择器里根本看不到这两类文件；已补 .xls/.xlsx", "修复建筑物导入/导出（已知 bug①）：新增 xls / xlsx 格式支持，与 csv / kmz / kml 并列；导出统一属性表（含省份/城市/区县/古建类型/经纬度/自定义参数/说明），导入端 superset 解析器兼容旧奥维/潮河字段与 BIFF8 旧版 Excel（旧格式明确拒绝并提示），导出文件可原样再导入（往返一致，Node 实证全部 PASS）", "修复照片导入/导出 zip（已知 bug②）：导出压缩包内嵌 manifest.json（文件名→古建 id 映射），重新导入时确定性自动绑定、零人工确认；无 manifest 的旧包仍走智能模糊匹配兜底，无回归", "查询/筛选置顶、实时命中计数、蓝色虚线圆圈圈选、单/多/无结果跳转、退出按钮/三击空白进主菜单、智能匹配确认、长操作「执行中，请稍后」遮罩等既有能力逐模块复核，确认无回归", "风格统一（浅蓝）复核，并导出《APP 风格色彩字体搭配文档》"]],
    ["v1.9.7", "2026-08-17", ["彻底修复导出>30张照片 0 字节：原生 exportCommit 分片增量解码，JS 侧补空包拦截；三套 APP 真编译验证", "修复导入照片丢失：照片查表前缀不匹配改 fallback 取回，Node 实证 0→1 张", "导入过程新增「正在解析导入文件，请稍后…」遮罩", "新增古建详情「分享」按钮：照片+信息打包 zip 走系统分享面板选微信/QQ/飞书", "灯箱照片支持「放大」：双击/双指 + 拖拽平移", "水利工程一张图（shuili）v1.9.7 同步本版所有修复"]],
    ["v1.9.6", "2026-08-16", ["紧急修复「导出照片压缩包 0 字节」：根因①zip 中文文件名未置 UTF-8 标志位（local+central 双置位），部分解压工具按 CP437 解析→文件名乱码、照片「看不见」；②整包 base64 经 JSInterface 单次传给原生，超 Binder 1MB 事务上限→写入 0 字节。改为分块导出（exportStart/Append/Commit，每片≤512KB）+ zip UTF-8 标志 + 原生写盘后回调 APP.onExportResult 才提示成功（杜绝「假成功」）。已 Node 实证 UTF-8 文件名正确、压缩包非空", "新增「执行中，请稍后」全屏遮罩（busy）：导出照片时显式提示，避免等候误以为卡死", "菜单/抽屉/弹窗面板色（--panel）再调浅一档（#1d4a7a→#2a6098），缓解「菜单背景偏深」；筛选弹窗新增「当前查询关键词」提示区", "筛选实时计数、蓝色虚线圆圈圈选、单/多/无结果跳转、查询/筛选置顶、退出按钮/三击主菜单、智能匹配确认等既有能力保持不变"]],
    ["v1.9.5", "2026-08-16", ["照片压缩包崩溃根因彻底修复：崩溃不是「照片太大」，而是①主线程同步解压数 GB 压缩包阻塞 UI ②全分辨率图 base64 撑爆 WebView OOM ③临时目录从不清理。改为原生线程池异步解压 + 流式写盘 + 原生缩略图（RGB_565 ≤720px JPEG q72）+ 内容哈希，JS 仅收齐轻量元数据再匹配；全图仅在灯箱/保存/导出时按需单张加载", "新增原生持久化（persistImage）与按需加载（loadFullImage）桥接：导入完成自动把全图从临时目录迁入 app 私有 photos 目录，清理缓存不会误删已绑定照片", "新增「清理导入缓存」菜单：在导入完成 / App 启动 / 菜单手动三处调用，删除 inbox/uz_* 临时目录，杜绝残留累积", "导入匹配分块（每批 30 张 + 让出主线程）+ 弹窗照片封顶 18 张，超大批量不再卡死", "筛选实时计数、查询/筛选置顶、退出按钮/三击主菜单、智能匹配确认等既有能力保持不变"]],
    ["v1.9.4", "2026-08-16", ["照片压缩包导入防崩：新增体积预检（>1.2GB 直接拒绝并引导分卷；>300MB 二次确认），改为流式解压（逐张释放内存）+ 进度提示 + 让出主线程，彻底解决 1.7G 压缩包导致 APP 崩溃/死机", "修复 Leaflet 版权署名外链（https://leafletjs.com）在离线/弱网下点击超时的报错：去掉地图外部署名链接，仅保留本地资源", "筛选实时计数升级：提示区同时显示命中「古建数 + 照片张数」，随条件变化实时刷新", "既有功能与菜单（查询/筛选置顶、单选改名、版本变更、删除照片/古建等）保持不变，仅智能优化"]],
    ["v1.9.3", "2026-08-16", ["照片导入绑定修复：杜绝“手动匹配照片未绑上”的静默丢失——无名称匹配的照片也进入人工选择", "人工选择改为单选（每张照片只属一个古建），默认勾选最可能对，可改或跳过", "确认后照片 caption 统一改为「古建名+照片+序号」，古建稳定读到", "新增「版本变更」菜单；「关于」版本号改用全局单一来源，避免漂移", "新增「删除照片 / 删除古建」按城市/时间条件批量删除（删除前提示不可恢复）", "筛选新增「照片」维度：有照片 / 无照片 / 至少 N 张"]],
    ["v1.9.2", "2026-08-15", ["批量导入弹窗来源图标方块化醒目", "修复 zip 压缩包导入兜底错接（mode=zip 真正调用 webkitZipPhotos）"]],
    ["v1.9.1", "2026-08-15", ["菜单图标方块化醒目 + 筛选图标与查询区分(🎛️)", "筛选实时命中计数 + 蓝色虚线圆圈圈出全部命中并居中", "批量导入支持 zip/7z + 百度/夸克网盘", "导出照片 zip/7z 按城市命名 + 本地/网盘/分享微信·飞书·QQ"]],
    ["v1.9.0", "2026-08-14", ["菜单折叠分组 + 智能模糊匹配（错字/多字/漏字/部分词）+ 文件夹上下文", "查询/筛选置顶；筛选 0→提示、1→飞到、多→圈出居中", "照片大图浏览/删除/顺序调整"]],
    ["v1.8.0", "2026-08-12", ["照片匹配优化（文件名↔古建名智能对应）"]]
  ];
  function changelog() {
    const html = CHANGELOG.map(([v, d, items]) => `<div class="cl-block">
      <div class="cl-ver">${esc(v)} <span class="cl-date">${esc(d)}</span></div>
      <ul class="cl-list">${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    </div>`).join("");
    openModal("版本变更（" + APP_VER + "）", `<div class="filelist" style="max-height:60vh;overflow:auto">${html}</div>`, `<button class="btn ghost" onclick="APP.close()">关闭</button>`);
  }
  // 条件选择弹窗（城市 / 时间 + 列表勾选 + 全选/取消/确认），供删除照片、删除古建复用
  function conditionPicker(cfg) {
    const html = `<div class="hint">${cfg.hint}</div>
      <div class="field"><label>按城市（可多选，不选 = 全部）</label><div class="chips" id="cpOff">${DIMS.citys.map((o) => `<span class="chip" data-off="${esc(o)}">${esc(o)}</span>`).join("") || '<span class="hint">无城市</span>'}</div></div>
      <div class="field"><label>按时间（导入/修改日期，留空 = 不限）</label><div style="display:flex;gap:8px"><input type="date" id="cpFrom" style="flex:1"><span style="align-self:center">至</span><input type="date" id="cpTo" style="flex:1"></div></div>
      <div class="field"><label>待处理项（勾选后删除）</label><div class="filelist" id="cpList" style="max-height:42vh;overflow:auto"></div></div>
      <div class="hint" id="cpCount" style="margin-top:4px">已选 0 项</div>`;
    openModal(cfg.title, html, `<button class="btn ghost" id="cpAll">全选</button><button class="btn ghost" id="cpClear">取消选择</button><button class="btn ghost" id="cpExit">退出</button><button class="btn ${cfg.danger ? "danger" : "primary"}" id="cpOk">${cfg.confirmLabel || "确认"}</button>`);
    const body = el("modalBody");
    const matchSet = new Set(), selSet = new Set();
    const cntText = () => "已选 " + [...selSet].filter((id) => matchSet.has(id)).length + " 项";
    const refresh = () => {
      const offs = [...body.querySelectorAll("#cpOff .chip.on")].map((c) => c.dataset.off);
      const from = el("cpFrom").value, to = el("cpTo").value;
      const fromT = from ? new Date(from + "T00:00:00").getTime() : null;
      const toT = to ? new Date(to + "T23:59:59").getTime() : null;
      matchSet.clear();
      const list = body.querySelector("#cpList"); list.innerHTML = "";
      const rows = cfg.items.filter((it) => {
        if (offs.length && !offs.includes(it.city)) return false;
        if (fromT != null || toT != null) {
          const t = it.ts ? new Date(it.ts).getTime() : NaN;
          if (isNaN(t)) return false; // 开启了时间条件但记录无时间，则排除
          if (fromT != null && t < fromT) return false;
          if (toT != null && t > toT) return false;
        }
        return true;
      });
      if (!rows.length) { list.innerHTML = `<div class="hint">当前条件下没有可处理项。</div>`; el("cpCount").textContent = cntText(); return; }
      rows.forEach((it) => {
        matchSet.add(it.id);
        const checked = selSet.has(it.id) ? "checked" : "";
        const div = document.createElement("label");
        div.className = "ex-item";
        div.innerHTML = `<input type="checkbox" class="cp-cb" data-id="${esc(it.id)}" ${checked}><span>${esc(it.label)}${it.sub ? ` <em class="sc">${esc(it.sub)}</em>` : ""}</span>`;
        list.appendChild(div);
      });
      body.querySelectorAll(".cp-cb").forEach((cb) => cb.onchange = () => {
        if (cb.checked) selSet.add(cb.dataset.id); else selSet.delete(cb.dataset.id);
        el("cpCount").textContent = cntText();
      });
      el("cpCount").textContent = cntText();
    };
    body.querySelectorAll("#cpOff .chip").forEach((c) => c.onclick = () => { c.classList.toggle("on"); refresh(); });
    el("cpFrom").onchange = refresh; el("cpTo").onchange = refresh;
    el("cpAll").onclick = () => { body.querySelectorAll(".cp-cb").forEach((cb) => { cb.checked = true; selSet.add(cb.dataset.id); }); el("cpCount").textContent = cntText(); };
    el("cpClear").onclick = () => { body.querySelectorAll(".cp-cb").forEach((cb) => { cb.checked = false; }); selSet.clear(); el("cpCount").textContent = "已选 0 项"; };
    el("cpExit").onclick = closeModal;
    el("cpOk").onclick = () => {
      const ids = [...selSet].filter((id) => matchSet.has(id));
      if (!ids.length) { toast("请先勾选要处理的项目"); return; }
      closeModal(); cfg.onConfirm(ids);
    };
    refresh();
  }
  // 删除照片：按城市/时间筛选，勾选后从对应古建移除
  function delPhotos() {
    const items = [];
    records.forEach((r) => (r.photos || []).forEach((p, i) => {
      items.push({ id: r.id + "::" + i, label: (r.name || "古建") + " · " + (p.caption || ("照片" + (i + 1))), sub: r.city || "", city: r.city || "", ts: r.ts });
    }));
    if (!items.length) { toast("当前没有照片可删除"); return; }
    conditionPicker({
      title: "删除照片",
      hint: "按城市 / 时间筛选后，勾选要删除的照片（可全选/取消），确认即从对应古建移除。",
      items, confirmLabel: "删除选中照片", danger: true,
      onConfirm: async (ids) => {
        const idxMap = {};
        ids.forEach((id) => { const [rid, pi] = id.split("::"); (idxMap[rid] = idxMap[rid] || new Set()).add(parseInt(pi, 10)); });
        await Store.patch((d) => {
          d.added = d.added || []; d.updated = d.updated || {};
          for (const rid in idxMap) {
            const exist = d.added.find((a) => a.id === rid);
            const upd = d.updated[rid];
            const base = records.find((x) => x.id === rid) || {};
            const cur = (exist || upd || base).photos || [];
            const kept = cur.filter((_, i) => !idxMap[rid].has(i));
            if (exist) { const i = d.added.findIndex((a) => a.id === rid); d.added[i] = Object.assign({}, d.added[i], { photos: kept }); }
            else d.updated[rid] = Object.assign({}, base, upd || {}, { photos: kept });
          }
        });
        DELTA = await Store.get(); merge(); render();
        toast("已删除 " + ids.length + " 张照片");
      }
    });
  }
  // 删除古建：按城市/时间筛选，勾选后永久删除（删除前提示不可恢复）
  function delBuildings() {
    const items = records.map((r) => ({ id: r.id, label: r.name || "(无名)", sub: r.city || "", city: r.city || "", ts: r.ts }));
    if (!items.length) { toast("当前没有古建可删除"); return; }
    conditionPicker({
      title: "删除古建",
      hint: "按城市 / 时间筛选后，勾选要删除的古建（可全选/取消），确认后将从本机永久删除。",
      items, confirmLabel: "删除选中古建", danger: true,
      onConfirm: (ids) => {
        const n = ids.length;
        openModal("确认删除", `<div class="hint" style="color:var(--danger)">⚠️ 即将删除 <b>${n}</b> 个古建，删除后数据<b>不可恢复</b>。确定继续吗？</div>`,
          `<button class="btn ghost" id="dbCancel">再想想</button><button class="btn danger" id="dbOk">确认删除（不可恢复）</button>`);
        el("dbCancel").onclick = closeModal;
        el("dbOk").onclick = async () => {
          closeModal();
          await Store.patch((d) => {
            d.added = d.added || []; d.updated = d.updated || {};
            for (const id of ids) {
              const i = d.added.findIndex((a) => a.id === id);
              if (i >= 0) d.added.splice(i, 1);
              else { d.deleted = d.deleted || []; if (!d.deleted.includes(id)) d.deleted.push(id); delete d.updated[id]; }
            }
          });
          DELTA = await Store.get(); merge(); render();
          toast("已删除 " + n + " 个古建");
        };
      }
    });
  }
  // 四端功能对照单（数据在 platform_matrix.js：PLAT_FEATURES / PLAT_DIFF，由 gen_feature_matrix.py 生成）
  // 注意：必须定义在 IIFE 内才能访问局部 openModal/esc；早期版本全局定义导致点击时 ReferenceError（空白）
  function platMatrix() {
    const SYM = { full: "✅", partial: "⚠️", none: "❌" };
    const COLS = [["android", "安卓 APK"], ["ios", "苹果 PWA"], ["uos", "统信 UOS"], ["win", "Win11"]];
    const FEATURES = (typeof PLAT_FEATURES !== "undefined") ? PLAT_FEATURES : [];
    const DIFF = (typeof PLAT_DIFF !== "undefined") ? PLAT_DIFF : [];
    if (!FEATURES.length) return toast("四端功能对照单数据未加载（platform_matrix.js 缺失）");
    let html = '<div class="hint">✅ 完整　⚠️ 受限(接入方式不同)　❌ 无</div>';
    html += '<div style="max-height:56vh;overflow:auto;margin-top:6px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
    html += '<thead><tr style="position:sticky;top:0;background:var(--panel2,#2a6098);color:#fff">'
      + '<th style="padding:6px 4px;text-align:left">功能</th>'
      + COLS.map((c) => '<th style="padding:6px 4px">' + c[1] + '</th>').join("") + '</tr></thead><tbody>';
    let curGroup = "";
    for (const r of FEATURES) {
      if (r.g !== curGroup) { curGroup = r.g; html += '<tr><td colspan="5" style="padding:6px 4px;background:var(--accent,#1d4a7a);color:#fff;font-weight:700">' + esc(curGroup) + '</td></tr>'; }
      html += '<tr style="border-bottom:1px solid var(--line)">';
      html += '<td style="padding:5px 4px;vertical-align:top"><div>' + esc(r.f) + '</div>'
        + (r.note ? '<div style="color:var(--muted);font-size:11px;margin-top:2px">' + esc(r.note) + '</div>' : '') + '</td>';
      for (const c of COLS) html += '<td style="padding:5px 4px;text-align:center">' + (SYM[r[c[0]]] || "—") + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    html += '<div class="env-title" style="margin-top:12px">各版本四端功能差异</div>';
    html += '<div class="filelist" style="max-height:30vh;overflow:auto">';
    for (const e of DIFF) {
      html += '<div class="cl-block"><div class="cl-ver">' + esc(e.v) + ' <span class="cl-date">' + esc(e.d) + '</span></div>'
        + '<ul class="cl-list">' + e.items.map((t) => '<li>' + esc(t) + '</li>').join("") + '</ul></div>';
    }
    html += '</div>';
    openModal("四端功能对照单（" + APP_VER + "）", html, '<button class="btn ghost" onclick="APP.close()">关闭</button>');
  }
  function about() {
    const env = getEnvInfo();
    const row = (k, v) => `<div class="env-row"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`;
    // 建议使用环境：用户运行本应用所推荐的环境（静态指导）
    const rec = [
      ["操作系统", "安卓 8.0+ / iOS 14+ / Windows 10·11 / macOS"],
      ["浏览器", "Chrome / Edge / Safari 最新版（桌面与手机均可）"],
      ["网络", "底图与在线功能需联网；离线可浏览已载入数据"],
      ["权限", "建议授予「定位」与「文件/存储」权限（导出/导入、定位所需）"],
      ["屏幕", "建议 ≥ 5 英寸；竖屏/横屏自适应"]
    ];
    const html = `<div style="text-align:center;padding:6px 4px 10px">
      <div style="font-size:46px">📐</div>
      <h3 style="margin:8px 0">古建景点打卡</h3>
      <p class="hint">奥维采集数据 → 天地图一张图<br>支持浏览 / 筛选 / 增删改 / 多照片 / ovkmz 导入导出</p>
      <p style="margin-top:14px;color:var(--accent);font-weight:700">制作：科技推广中心</p>
      <p class="hint" style="margin-top:4px">版本 ${APP_VER}</p>
    </div>
    <div class="env-box">
      <div class="env-title">建议使用环境</div>
      ${rec.map(([k, v]) => row(k, v)).join("")}
    </div>
    <div class="env-box">
      <div class="env-title">制作环境（本机运行环境）</div>
      ${row("操作系统", env.os + (env.osVer ? " " + env.osVer : ""))}
      ${row("设备型号", env.device)}
      ${row("运行环境", env.engine)}
      ${row("CPU", env.cpu)}
      ${row("内存", env.mem)}
      ${row("GPU", env.gpu)}
      ${row("屏幕", env.screen)}
    </div>`;
    openModal("关于", html, `<button class="btn ghost" onclick="APP.close()">关闭</button>`);
  }

  // ---------- 获取经纬度（我的位置 / 地图点选 / 搜索）----------
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).catch(() => fallbackCopy(t));
    } else fallbackCopy(t);
  }
  function fallbackCopy(t) {
    const ta = document.createElement("textarea");
    ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
  function getCoord() {
    const html = `
      <div class="field"><label>经纬度（WGS84 十进制）</label>
        <div class="coord-display">
          <div class="cd-row"><span class="cd-k">纬度 Lat</span><span class="cd-v" id="cdLat">—</span></div>
          <div class="cd-row"><span class="cd-k">经度 Lng</span><span class="cd-v" id="cdLon">—</span></div>
        </div>
      </div>
      <div class="coord-actions">
        <button class="btn ghost" id="cdMe">📍 我的位置</button>
        <button class="btn ghost" id="cdPick">🗺 地图点选</button>
        <button class="btn ghost" id="cdCopy">📋 复制</button>
      </div>
      <div class="field" style="margin-top:14px"><label>搜索古建获取其坐标</label>
        <input id="cdSearch" placeholder="输入名称…" autocomplete="off">
        <div class="cd-results" id="cdResults"></div>
      </div>
      <div class="hint">我的位置需授权定位；地图点选请关闭本弹窗后在地图上点击；复制格式为「纬度, 经度」。</div>`;
    openModal("获取经纬度", html, `<button class="btn ghost" onclick="APP.close()">关闭</button>`);
    const cur = coordResult ? { lat: coordResult.lat, lon: coordResult.lon } : { lat: null, lon: null };
    coordResult = null;
    const setDisp = () => {
      el("cdLat").textContent = cur.lat != null ? cur.lat.toFixed(6) : "—";
      el("cdLon").textContent = cur.lon != null ? cur.lon.toFixed(6) : "—";
    };
    setDisp();
    el("cdMe").onclick = () => {
      if (!navigator.geolocation) return toast("当前环境不支持定位");
      toast("正在定位…");
      navigator.geolocation.getCurrentPosition((p) => {
        cur.lat = p.coords.latitude; cur.lon = p.coords.longitude; setDisp();
        if (myLocMarker) map.removeLayer(myLocMarker);
        myLocMarker = L.circleMarker([cur.lat, cur.lon], { radius: 9, color: "#2ecc8f", fillColor: "#2ecc8f", fillOpacity: .65, weight: 3 }).addTo(map).bindPopup("我的位置").openPopup();
        map.setView([cur.lat, cur.lon], 15);
        toast("已获取我的位置坐标");
      }, (err) => {
        if (window.AndroidBridge && window.AndroidBridge.openLocationSettings) window.AndroidBridge.openLocationSettings();
        else toast("定位失败，请检查定位权限");
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    };
    el("cdPick").onclick = () => {
      closeModal(); pickForCoord = true; togglePick(true);
      toast("请在地图上点选位置（再次点此取消）");
    };
    el("cdCopy").onclick = () => {
      if (cur.lat == null) return toast("请先获取坐标");
      const t = `${cur.lat.toFixed(6)}, ${cur.lon.toFixed(6)}`;
      copyText(t); toast("已复制：" + t);
    };
    el("cdSearch").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      const box = el("cdResults");
      if (!q) { box.innerHTML = ""; return; }
      const rs = records.filter((r) => `${r.name}${r.city}${r.station}`.toLowerCase().includes(q)).slice(0, 30);
      box.innerHTML = rs.map((r) =>
        `<div class="cd-item" data-id="${r.id}"><span>${esc(r.name)}</span><span class="cd-xy">${(+r.lat).toFixed(5)} , ${(+r.lon).toFixed(5)}</span></div>`).join("");
      box.querySelectorAll(".cd-item").forEach((it) => it.onclick = () => {
        const rr = records.find((x) => x.id === it.dataset.id); if (!rr) return;
        cur.lat = +rr.lat; cur.lon = +rr.lon; setDisp();
        map.flyTo([cur.lat, cur.lon], Math.max(map.getZoom(), 15), { duration: 0.6 });
        toast("已定位：" + rr.name);
      });
    });
  }

  // ---------- 照片大图（长按保存 + 多图切换，item ⑧）----------
  let lbRid = null, lbPi = 0;
  // 按需加载照片：有全图磁盘路径则原生单张加载全图，否则回退到 dataUrl（旧数据/Web）
  function loadPhotoFull(ph) {
    return new Promise((resolve) => {
      if (ph && ph.fullPath && window.AndroidBridge && window.AndroidBridge.loadFullImage) {
        try { const full = window.AndroidBridge.loadFullImage(ph.fullPath); if (full && full.startsWith("data:")) return resolve(full); } catch (e) {}
      }
      // v2.4.9：兜底链 full → dataUrl → thumb；三者皆空时明确提示 + 入错误日志，不再白屏
      const src = (ph && (ph.full || ph.dataUrl || ph.thumb)) || "";
      if (!src) {
        try { if (window.__ERR_LOG_PUSH__) window.__ERR_LOG_PUSH__("照片数据缺失（无可用图像源）：" + JSON.stringify({ cap: ph && ph.caption, keys: ph ? Object.keys(ph) : [] })); } catch (e) {}
        try { if (typeof toast === "function") toast("该照片数据缺失（原始图像未随文件导入）"); } catch (e) {}
      }
      resolve(src);
    });
  }
  async function openPhoto(rid, pi) {
    const r = records.find((x) => x.id === rid); if (!r || !r.photos[pi]) return;
    lbRid = rid; lbPi = pi;
    const ph = r.photos[pi];
    el("lbImg").src = await loadPhotoFull(ph);
    el("lbImg").style.transform = ""; // 复位上一张的放大状态
    el("lbCap").textContent = ph.caption || "";
    el("lightbox").classList.add("show");
    // 控制条（保存 / 切换）默认隐藏，长按图片后弹出
    el("lbBar").style.display = "none";
    el("lbPrev").style.display = "none";
    el("lbNext").style.display = "none";
    el("lbIdx").style.display = "none";
  }
  async function switchPhoto(d) {
    const r = records.find((x) => x.id === lbRid); if (!r) return;
    const n = (r.photos || []).length; if (n < 2) return;
    lbPi = (lbPi + d + n) % n;
    const ph = r.photos[lbPi];
    el("lbImg").src = await loadPhotoFull(ph);
    el("lbImg").style.transform = ""; // 复位放大状态
    el("lbCap").textContent = ph.caption || "";
    el("lbIdx").textContent = (lbPi + 1) + " / " + n;
  }
  async function saveCurrentPhoto() {
    const r = records.find((x) => x.id === lbRid); if (!r) return;
    const ph = r.photos[lbPi]; if (!ph) return;
    const src = await loadPhotoFull(ph);
    if (!src) return;
    const ext = (src.split(";")[0].split("/")[1] || "png").replace("+xml", "");
    const a = document.createElement("a");
    a.href = src;
    a.download = (ph.caption || r.name || "photo") + "." + ext;
    document.body.appendChild(a); a.click(); a.remove();
    toast("已保存图片到下载目录");
  }
  function bindLightbox() {
    const img = el("lbImg");
    let lpTimer = null;
    // ---------- 放大：双击/双指 + 拖拽平移 ----------
    let scale = 1, tx = 0, ty = 0;
    const applyT = () => { img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; img.style.transition = scale === 1 ? "transform .2s" : "none"; el("lbZoom").textContent = scale > 1 ? "还原" : "放大"; };
    const resetT = () => { scale = 1; tx = 0; ty = 0; applyT(); };
    const clampT = () => { const max = (scale - 1) * 220; tx = Math.max(-max, Math.min(max, tx)); ty = Math.max(-max, Math.min(max, ty)); };
    const toggleZoom = (cx, cy) => { if (scale > 1) { resetT(); return; } scale = 2.2; tx = 0; ty = 0; applyT(); };
    let lastTouch = 0, startX = 0, startY = 0, pinned = false, pinch0 = 0, scale0 = 1;
    img.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) { pinned = true; pinch0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); scale0 = scale; }
      else if (e.touches.length === 1) { lastTouch = Date.now(); startX = e.touches[0].clientX - tx; startY = e.touches[0].clientY - ty; }
    }, { passive: true });
    img.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && pinned) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); scale = Math.max(1, Math.min(5, scale0 * (d / (pinch0 || d)))); clampT(); applyT(); }
      else if (e.touches.length === 1 && scale > 1) { tx = e.touches[0].clientX - startX; ty = e.touches[0].clientY - startY; clampT(); applyT(); }
    }, { passive: true });
    img.addEventListener("touchend", (e) => {
      if (e.changedTouches.length === 1) { const dt = Date.now() - lastTouch; if (dt < 300 && !pinned) { const t = e.changedTouches[0]; toggleZoom(t.clientX, t.clientY); } }
      if (e.touches.length < 2) pinned = false;
    });
    img.addEventListener("dblclick", (e) => { e.preventDefault(); toggleZoom(e.clientX, e.clientY); });
    el("lbZoom").onclick = () => toggleZoom();
    // 长按弹出控制条（保存/分享/切换）
    const startLP = () => { clearTimeout(lpTimer); lpTimer = setTimeout(() => {
      el("lbBar").style.display = "flex";
      const r = records.find((x) => x.id === lbRid);
      if (r && (r.photos || []).length > 1) {
        el("lbPrev").style.display = "flex"; el("lbNext").style.display = "flex"; el("lbIdx").style.display = "block";
        el("lbIdx").textContent = (lbPi + 1) + " / " + r.photos.length;
      }
    }, 500); };
    const cancelLP = () => { clearTimeout(lpTimer); };
    img.addEventListener("mousedown", startLP);
    img.addEventListener("mouseup", cancelLP);
    img.addEventListener("mouseleave", cancelLP);
    el("lbPrev").onclick = () => switchPhoto(-1);
    el("lbNext").onclick = () => switchPhoto(1);
    el("lbSave").onclick = saveCurrentPhoto;
    el("lbShare").onclick = () => { const r = lbRid; if (r) shareBuilding(r); };
    el("lbClose").onclick = () => { el("lightbox").classList.remove("show"); resetT(); };
  }

  // ---------- 事件绑定 ----------
  function bindUI() {
    // 版本变更菜单副标题随全局版本号同步（避免硬编码漂移）
    if (el("changelogSub")) el("changelogSub").textContent = "v1.8.0 → " + APP_VER;
    el("btnMenu").onclick = () => { el("drawer").classList.add("open"); el("mask").classList.add("show"); applyHiddenMenus(); };
    el("btnExit").onclick = () => {
      const closed = APP.back();
      if (!closed) { toast("已是最外层页面 · 三击地图空白处可唤起主菜单"); }
    };

    el("fabMenu").onclick = () => { el("drawer").classList.add("open"); el("mask").classList.add("show"); applyHiddenMenus(); };
    el("drawerClose").onclick = closeDrawer; el("mask").onclick = closeDrawer;
    el("listClose").onclick = () => el("listbar").classList.remove("open");
    el("btnList").onclick = () => el("listbar").classList.toggle("open");
    el("btnBase").onclick = () => openBasemap();
    el("btnLayer").onclick = () => openBasemap();
    el("btnFilter").onclick = openFilter; // 顶栏筛选按钮（与查询并列置顶）
    // v2.0 收藏窗口/返回收藏（item 7）：右侧悬浮控件组（收藏当前窗口 ⭐ / 返回收藏窗口 📍）
    if (el("mcFav")) el("mcFav").onclick = saveFavWindow;
    if (el("mcFavGo")) el("mcFavGo").onclick = goFavWindow;
    el("modalClose").onclick = closeModal;
    el("modalMask").onclick = closeModal;
    el("fbClear").onclick = clearFilter; // 筛选状态条：一键清除
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") back(); });
    el("lbClose").onclick = () => { el("lightbox").classList.remove("show"); el("lbImg").style.transform = ""; };
    el("lightbox").onclick = (e) => { if (e.target.id === "lightbox") { el("lightbox").classList.remove("show"); el("lbImg").style.transform = ""; } };
    $("#search").addEventListener("input", (e) => { filter.q = e.target.value; if (filter.q.trim()) pushKwHist(filter.q); render(); });
    el("measureClear").onclick = () => {
      measurePts = [];
      if (measureLine) measureLine.setLatLngs([]);
      overlayGroup.eachLayer((l) => { if (l._mpt) overlayGroup.removeLayer(l); });
      el("measureInfo").textContent = "点击地图或古建添加测量点";
    };
    el("measureExit").onclick = exitMeasure;
    // 折叠分组：点分组标题或"＋"展开/收起二级菜单（默认隐藏）
    document.querySelectorAll(".mgroup.collapsible").forEach((g) => {
      g.onclick = () => {
        const sub = g.nextElementSibling;
        if (sub && sub.classList.contains("msub")) {
          const open = sub.classList.toggle("open");
          g.classList.toggle("open", open);
          g.querySelector(".tg").textContent = open ? "－" : "＋";
        }
      };
    });
    document.querySelectorAll(".menu-btn").forEach(bindMenuBtn); // v2.4：绑定提取（快捷常用动态按钮复用）
    renderQuickFavs(); // v2.4：渲染快捷常用
    applyHiddenMenus(); // v2.4.8：应用菜单隐藏设置
    // v2.0 收藏当前地图「窗口」（视图四角范围 + 缩放）/ 返回收藏窗口
    // Store.ui.favs = [{id,name,bounds:[[swLat,swLng],[neLat,neLng]],center:[lat,lng],zoom}]
    function getFavs() { const s = Store.ui.get() || {}; return Array.isArray(s.favs) ? s.favs : []; }
    function setFavs(favs) { const s = Store.ui.get() || {}; Store.ui.set(Object.assign({}, s, { favs })); }
    function flyToFav(f) {
      if (f && f.bounds && f.bounds.length === 2 && f.bounds[0] && f.bounds[1]) {
        try { map.flyToBounds([[f.bounds[0][0], f.bounds[0][1]], [f.bounds[1][0], f.bounds[1][1]]], { duration: 0.6, maxZoom: f.zoom }); return; } catch (e) {}
      }
      if (f && f.center) map.flyTo([f.center[0], f.center[1]], f.zoom || 15, { duration: 0.6 });
    }
    function saveFavWindow() {
      const b = map.getBounds();
      const bounds = [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]];
      const center = [map.getCenter().lat, map.getCenter().lng];
      const zoom = map.getZoom();
      const favs = getFavs();
      const def = "窗口" + (favs.length + 1);
      openModal("收藏当前窗口",
        `<div class="hint">将收藏当前地图视图范围（四角坐标 + 缩放），可随时返回，便于快速回到关注区域（如「某城市古建窗口」）。</div>
         <div class="field"><label>窗口名称</label><input id="favName" class="inp" value="${esc(def)}" placeholder="如：北京古建窗口"></div>`,
        `<button class="btn ghost" id="favCancel">取消</button><button class="btn primary" id="favOk">收藏</button>`);
      el("favCancel").onclick = closeModal;
      el("favOk").onclick = () => {
        const name = (el("favName").value || def).trim() || def;
        const entry = { id: "w" + Date.now().toString(36), name, bounds, center, zoom };
        setFavs(favs.concat([entry]));
        closeModal();
        toast("已收藏窗口：" + name + "（点 📍 返回）");
      };
    }
    function goFavWindow() {
      const favs = getFavs();
      if (!favs.length) {
        const s = Store.ui.get() || {};
        if (s.fav && s.fav.lat != null) { return flyToFav({ center: [s.fav.lat, s.fav.lng], zoom: s.fav.zoom }); } // 兼容旧版单点收藏
        return toast("尚未收藏窗口，请先点 ⭐ 收藏当前窗口");
      }
      if (favs.length === 1) { flyToFav(favs[0]); return toast("已返回收藏窗口：" + favs[0].name); }
      const html = favs.map((f, i) => `<div class="fav-item" data-i="${i}"><span class="fi-ico">🪟</span><span class="fi-name">${esc(f.name)}</span><span class="fi-meta">缩放 ${f.zoom}</span></div>`).join("");
      openModal("返回收藏窗口", `<div class="hint">选择一个窗口返回（按记录范围 + 缩放居中）：</div><div class="filelist">${html}</div>`, `<button class="btn ghost" id="favClose">关闭</button>`);
      el("favClose").onclick = closeModal;
      document.querySelectorAll(".fav-item").forEach((it) => {
        it.onclick = () => { const i = +it.dataset.i; closeModal(); flyToFav(favs[i]); toast("已返回收藏窗口：" + favs[i].name); };
      });
    }
    // 三击地图任意处 → 强制恢复主菜单（测距/选点模式不触发，避免误操）
    let _taps = 0, _tapT = 0;
    $("#map").addEventListener("click", () => {
      if (measureMode || pickMode) return;
      const now = Date.now();
      if (now - _tapT > 600) _taps = 0;
      _taps++; _tapT = now;
      if (_taps >= 3) { _taps = 0; tripleTapMenu(); }
    });
    bindLightbox();
  }
  // 查询置顶：聚焦顶栏搜索框并提示
  // ---------- 菜单按钮统一绑定（v2.4 提取：静态菜单 + 快捷常用动态按钮共用）----------
  function bindMenuBtn(b) {
    b.onclick = () => {
      const act = b.dataset.act; closeDrawer();
      // 大模型 AI 领域配置（古建：公开信息可联网查询）
      AI.domain = {
        appName: "古建景点打卡",
        internal: false,
        recName: (r) => r.name || "(未命名)",
        recMeta: (r) => [r.province, r.city, r.atype].filter(Boolean).join(" / "),
        recSearch: (r) => [r.name, r.province, r.city, r.atype].filter(Boolean).join(" "),
        // #7 智能问询：注入古建台账统计（按省份/城市/类型汇总），让大模型能回答汇总类问题
        orgContext: (q) => {
          const byProv = {};
          records.forEach((r) => {
            const p = r.province || "(未填省份)";
            const c = r.city || "(未填城市)";
            const b = byProv[p] || (byProv[p] = { cities: {}, atypes: {}, count: 0 });
            b.cities[c] = (b.cities[c] || 0) + 1;
            if (r.atype) b.atypes[r.atype] = (b.atypes[r.atype] || 0) + 1;
            b.count++;
          });
          const lines = Object.keys(byProv).sort().map((p) => {
            const b = byProv[p];
            const cs = Object.keys(b.cities).sort();
            return `· ${p}：共 ${b.count} 处古建，覆盖 ${cs.length} 个城市（${cs.join("、")}），类型 ${Object.keys(b.atypes).length} 种。`;
          });
          return `【本地古建台账统计】\n总古建数：${records.length}。\n` + (lines.join("\n") || "（暂无数据）");
        },
        // #8 从 AI 结果文本中提取可下钻关键词（省/市/类型/名称），供 followup 按钮使用
        suggestFrom: (txt) => {
          const text = txt || "";
          const set = new Set();
          records.forEach((r) => { [r.province, r.city, r.atype, r.name].forEach((v) => { if (v && text.indexOf(String(v)) >= 0) set.add(String(v)); }); });
          return [...set].slice(0, 10);
        },
        // #8 双击 followup 关键词 → 填入查询框并立即检索
        runSearch: (kw) => {
          const s = el("search"); if (s) s.value = kw || "";
          if (typeof filter !== "undefined") filter.q = (kw || "").trim();
          if (typeof render === "function") render();
          closeModal();
          toast("已在查询框填入：" + (kw || ""));
        },
        queryPrompt: (r) => `请详细介绍古建「${r.name}」，位于${r.province || ""}${r.city || ""}。已知信息：${JSON.stringify(r.params || {})}${r.description ? "；简介：" + r.description : ""}。请补充其历史背景、建筑特色、文化价值、游览看点、最佳游览时间、交通与门票等。`,
        updatePrompt: (r) => `已知古建条目：${JSON.stringify({ name: r.name, province: r.province, city: r.city, atype: r.atype, params: r.params || {}, description: r.description || "" })}。请基于权威资料补全/校正其参数(params)与一句话简介(description)。只返回 JSON。`
      };
      const acts = { search: focusSearch, filter: openFilter, add: openAdd, import: triggerImport, export: exportMenu,
        batchPhotos: () => batchImportMenu("photos"), batchSheets: () => batchImportMenu("sheets"), exportPhotos: exportPhotosMenu,
        netdisk: netdiskMenu, lan: lanMenu,
        stats, locate, coord: getCoord, nearby: openNearby, measure: () => { measureMode ? exitMeasure() : enterMeasure(); }, layer: openBasemap,
        addbasemap: openBasemap, sync: openSync, reset, help, about, changelog, platmatrix: platMatrix, delPhotos, delBuildings, checkin: openCheckinList,
        cleanInbox: cleanImportCache,
        opsDefaultLoc: openOpsDefaultLoc, opsPlan: openOpsPlan, opsInspect: openOpsInspect, opsRoute: openOpsRoute,
        aiSettings: () => AI.openSettings(), aiQuery: () => AI.openQuery(), aiUpdate: () => AI.openUpdate(), aiCorrect: () => AI.openCorrect(), aiChat: () => AI.openChat(), aiFreeQuery: () => AI.openFreeQuery(), kbImportFile, kbExport, kbImportBackup, kbQuery: openKBQuery, aiHistory: () => AI.openHistory(),
        // v2.4 三个新增入口
        orgManager: () => openOrgManager(), btypeManager: () => openBtypeManager(), quickFavSettings: openQuickFavSettings, tiandituKey: openTiandituKeySettings, errlog: openErrLog, menuRestoreHidden: openMenuRestoreHidden, menuHiddenList: openHiddenList };
      function cleanImportCache() {
        if (window.AndroidBridge && window.AndroidBridge.cleanInbox) { window.AndroidBridge.cleanInbox(); toast("已清理导入临时缓存"); }
        else toast("当前环境（网页版）无导入缓存可清理");
      }
      // v2.4.3：扩展模块（升级/游记/备忘录）通过 window.__EXT_ACTS__ 自注册，避免每加一个功能都改 acts
      const __ext = (window.__EXT_ACTS__ || {});
      const __fn = acts[act] || __ext[act];
      if (typeof __fn === "function") __fn();
      else toast("该功能未装载（" + act + "），请检查安装包是否完整");   // fail-loud：不再静默无反应
    };
    // 方式1：右键/长按 → 加入/移出快捷常用
    b.oncontextmenu = (e) => { e.preventDefault(); openMenuLongPress(b); };
  }
  // ---------- v2.4.8：菜单隐藏（不常用菜单可隐藏，界面更简洁；设置中可恢复）----------
  const HM_KEY = (window.__APP_ID__ || "app") + "_hiddenmenus_v1";
  // 保护项：恢复入口与常用设置不允许隐藏，避免用户把自己锁死
  const HM_PROTECT = ["menuRestoreHidden", "menuHiddenList", "quickFavSettings", "errlog", "help", "about", "changelog"];
  function loadHiddenMenus() {
    try {
      const a = JSON.parse(localStorage.getItem(HM_KEY) || "[]");
      return Array.isArray(a) ? a.filter((x) => typeof x === "string" && HM_PROTECT.indexOf(x) < 0) : [];
    } catch (e) { return []; }
  }
  function saveHiddenMenus(a) { try { localStorage.setItem(HM_KEY, JSON.stringify(a)); } catch (e) {} }

  // ---------- v2.4.9：子菜单「隐藏 / 收藏」按钮（带二次确认，防误点）----------
  var MACT_PREF = HM_KEY + "_macts";
  function mactsEnabled() { try { return localStorage.getItem(MACT_PREF) !== "0"; } catch (e) { return true; } }
  function setMactsEnabled(on) { try { localStorage.setItem(MACT_PREF, on ? "1" : "0"); } catch (e) {} }
  function isFavAct(a) { try { return loadQuickFavs().indexOf(a) >= 0; } catch (e) { return false; } }
  function clearMenuActs(root) {
    var as = (root || document).querySelectorAll(".macts");
    for (var i = 0; i < as.length; i++) { if (as[i].parentNode) as[i].parentNode.removeChild(as[i]); }
  }
  // 同步已注入按钮的显示状态（收藏星标 / 保护项置灰）
  function syncMacts(wrap, act) {
    if (!wrap) return;
    var cs = wrap.children || [];
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      if (!c.classList) continue;
      if (c.classList.contains("hide")) {
        var prot = HM_PROTECT.indexOf(act) >= 0;
        if (prot) { c.classList.add("disabled"); c.setAttribute("title", "该菜单是恢复入口，不允许隐藏"); }
      } else {
        var on = isFavAct(act);
        if (on) c.classList.add("on"); else c.classList.remove("on");
        c.setAttribute("title", on ? "移出快捷常用" : "加入快捷常用");
        c.textContent = on ? "\u2605" : "\u2606";
      }
    }
  }
  // 给抽屉内每个子菜单注入「收藏 / 隐藏」按钮
  function decorateMenuButtons() {
    var root = (document.getElementById && document.getElementById("drawer")) || document;
    if (!root || !root.querySelectorAll) return;
    if (!mactsEnabled()) { clearMenuActs(root); return; }
    var btns = root.querySelectorAll(".menu-btn");
    for (var i = 0; i < btns.length; i++) (function (b) {
      var act = b.dataset ? (b.dataset.act || "") : "";
      if (!act) return;
      if (b.classList && (b.classList.contains("pin") || b.classList.contains("qf-btn"))) return;
      if (loadHiddenMenus().indexOf(act) >= 0) return;
      var ex = b.querySelector ? b.querySelector(".macts") : null;
      if (ex) { syncMacts(ex, act); return; }   // 已装饰过：只同步状态（收藏星标实时反映）
      var prot = HM_PROTECT.indexOf(act) >= 0;
      var wrap = document.createElement("span");
      wrap.className = "macts";
      var fav = document.createElement("span");
      var on = isFavAct(act);
      fav.className = "mact" + (on ? " on" : "");
      fav.setAttribute("role", "button");
      fav.setAttribute("title", on ? "移出快捷常用" : "加入快捷常用");
      fav.textContent = on ? "\u2605" : "\u2606";
      var hid = document.createElement("span");
      hid.className = "mact hide" + (prot ? " disabled" : "");
      hid.setAttribute("role", "button");
      hid.setAttribute("title", prot ? "该菜单是恢复入口，不允许隐藏" : "隐藏此菜单");
      hid.textContent = "\uD83D\uDEAB";
      function stopProp(e) { if (e && e.stopPropagation) e.stopPropagation(); }
      function onClick(e) { if (e && e.stopPropagation) e.stopPropagation(); if (e && e.preventDefault) e.preventDefault(); }
      fav.addEventListener("click", function (e) { onClick(e); confirmFavMenu(act, b); });
      fav.addEventListener("touchend", stopProp);
      hid.addEventListener("click", function (e) { onClick(e); confirmHideMenu(act, b); });
      hid.addEventListener("touchend", stopProp);
      wrap.appendChild(fav); wrap.appendChild(hid);
      b.appendChild(wrap);
    })(btns[i]);
    ensureMenuActToggle(root);
  }
  // 抽屉头部 ⚙ 开关：一键收起/显示这些按钮
  function ensureMenuActToggle(root) {
    try {
      var head = root.querySelector ? root.querySelector(".head") : null;
      if (!head) return;
      var t = document.getElementById("mactToggle");
      if (!t) {
        t = document.createElement("span");
        t.id = "mactToggle";
        t.className = "macttg";
        t.setAttribute("title", "显示/隐藏 菜单上的收藏与隐藏按钮");
        t.addEventListener("click", function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          var on = !mactsEnabled();
          setMactsEnabled(on);
          clearMenuActs(root);
          if (on) decorateMenuButtons();
          else if (typeof toast === "function") toast("已收起菜单上的收藏/隐藏按钮（长按菜单项仍可操作）");
        });
        if (head.firstChild) head.insertBefore(t, head.firstChild); else head.appendChild(t);
      }
      t.textContent = mactsEnabled() ? "\u2699\uFE0F" : "\u2699";
    } catch (e) {}
  }
  // 二次确认：收藏 / 移出快捷常用
  function confirmFavMenu(act, b) {
    var title = (typeof btnMenuTitle === "function" ? btnMenuTitle(b) : "") || act;
    var on = isFavAct(act);
    openModal(on ? "确认移出快捷常用？" : "确认加入快捷常用？",
      '<div class="hint">' + (on ? '将把「<b>' + esc(title) + '</b>」从「快捷常用」中移出。' : '将把「<b>' + esc(title) + '</b>」加入「快捷常用」，显示在查询 / 筛选下方。') + '原菜单位置的功能<b>仍然保留</b>。</div>',
      '<button class="btn ghost" id="cfCancel">取消</button><button class="btn primary" id="cfOk">' + (on ? "确认移出" : "确认收藏") + '</button>');
    var c = el("cfCancel"); if (c) c.onclick = closeModal;
    var o = el("cfOk");
    if (o) o.onclick = function () { closeModal(); try { toggleQuickFav(act); } catch (e) { toast("操作失败：" + (e && e.message ? e.message : e)); } };
  }
  // 二次确认：隐藏菜单
  function confirmHideMenu(act, b) {
    var title = (typeof btnMenuTitle === "function" ? btnMenuTitle(b) : "") || act;
    if (HM_PROTECT.indexOf(act) >= 0) { toast("该菜单是恢复入口，不允许隐藏"); return; }
    openModal("确认隐藏此菜单？",
      '<div class="hint">即将隐藏「<b>' + esc(title) + '</b>」。<br/>隐藏<b>不会删除</b>任何功能，可随时在「设置 → 恢复隐藏子菜单 / 隐藏子菜单列表」中恢复显示。</div>',
      '<button class="btn ghost" id="cfCancel">取消</button><button class="btn primary" id="cfOk">确认隐藏</button>');
    var c = el("cfCancel"); if (c) c.onclick = closeModal;
    var o = el("cfOk");
    if (o) o.onclick = function () { closeModal(); try { hideMenuAct(act); } catch (e) { toast("操作失败：" + (e && e.message ? e.message : e)); } };
  }
  // ---------- /v2.4.9 子菜单「隐藏 / 收藏」按钮 ----------
  function applyHiddenMenus() {
    const hm = loadHiddenMenus();
    const root = (document.getElementById && document.getElementById("drawer")) || document;
    const btns = root.querySelectorAll(".menu-btn");
    for (let i = 0; i < btns.length; i++) {
      const act = btns[i].dataset.act;
      btns[i].style.display = (act && hm.indexOf(act) >= 0) ? "none" : "";
    }
    // 整组被隐藏完时连分组标题一起收起，避免留下空标题
    const subs = root.querySelectorAll(".msub");
    for (let i = 0; i < subs.length; i++) {
      const vis = Array.prototype.filter.call(subs[i].querySelectorAll(".menu-btn"), (b) => b.style.display !== "none");
      const grp = subs[i].previousElementSibling;
      if (grp && grp.classList && grp.classList.contains("mgroup")) grp.style.display = vis.length ? "" : "none";
    }
    try { decorateMenuButtons(); } catch (e) {}
  }
  function hideMenuAct(act) {
    if (!act) return;
    if (HM_PROTECT.indexOf(act) >= 0) { toast("该菜单是恢复入口，不允许隐藏"); return; }
    const cur = loadHiddenMenus();
    if (cur.indexOf(act) < 0) cur.push(act);
    try { saveQuickFavs(loadQuickFavs().filter((x) => x !== act)); } catch (e) {}   // 同步移出快捷常用，避免残留入口
    saveHiddenMenus(cur); applyHiddenMenus();
    try { renderQuickFavs(); } catch (e) {}
    toast("已隐藏该菜单，可在「设置 → 恢复隐藏子菜单」中恢复");
  }
  function restoreMenuAct(act) {
    saveHiddenMenus(loadHiddenMenus().filter((x) => x !== act));
    applyHiddenMenus(); toast("已恢复显示该菜单");
  }
  // 长按/右键菜单项：保留原有「加入/移出快捷常用」，新增「隐藏此菜单」
  function openMenuLongPress(b) {
    const act = b ? b.dataset.act : "";
    if (!act) return;
    if (HM_PROTECT.indexOf(act) >= 0) { toggleQuickFav(act); return; }
    const isFav = loadQuickFavs().indexOf(act) >= 0;
    const title = btnMenuTitle(b) || act;
    openModal("菜单操作：" + title,
      '<div class="hint">选择对该菜单的操作。<b>隐藏不会删除功能</b>，随时可在「设置」中恢复显示。</div>',
      '<button class="btn ghost" id="hmFav">' + (isFav ? "\u2b50 \u79fb\u51fa\u5feb\u6377\u5e38\u7528" : "\u2b50 \u52a0\u5165\u5feb\u6377\u5e38\u7528") + '</button>'
      + '<button class="btn ghost" id="hmHide">\U0001f6ab \u9690\u85cf\u6b64\u83dc\u5355</button>'
      + '<button class="btn primary" id="hmCancel">\u53d6\u6d88</button>');
    const f = el("hmFav"); if (f) f.onclick = () => { closeModal(); toggleQuickFav(act); };
    const h = el("hmHide"); if (h) h.onclick = () => { closeModal(); hideMenuAct(act); };
    const c = el("hmCancel"); if (c) c.onclick = closeModal;
  }
  // 设置子菜单①：恢复隐藏子菜单（一键全部显示）
  function openMenuRestoreHidden() {
    const hm = loadHiddenMenus();
    if (!hm.length) { toast("当前没有被隐藏的菜单"); return; }
    saveHiddenMenus([]); applyHiddenMenus(); toast("已恢复全部 " + hm.length + " 个隐藏菜单");
  }
  // 设置子菜单②：隐藏子菜单列表（点击任意一项即恢复）
  function openHiddenList() {
    const hm = loadHiddenMenus();
    if (!hm.length) {
      openModal("\u9690\u85cf\u5b50\u83dc\u5355\u5217\u8868", '<div class="hint">\u5f53\u524d\u6ca1\u6709\u88ab\u9690\u85cf\u7684\u83dc\u5355\u3002</div>',
        '<button class="btn primary" onclick="APP.close()">\u5173\u95ed</button>');
      return;
    }
    const rows = hm.map((act) => {
      const src = document.querySelector('.drawer .menu-btn[data-act="' + act + '"]');
      const ico = src && src.querySelector(".ico") ? src.querySelector(".ico").textContent : "\U0001f6ab";
      return '<button class="menu-btn" data-hm="' + esc(act) + '"><span class="ico">' + ico + '</span><span>'
        + esc(btnMenuTitle(src) || act) + '<span class="sub">\u70b9\u51fb\u6062\u590d\u663e\u793a</span></span></button>';
    }).join("");
    openModal("\u9690\u85cf\u5b50\u83dc\u5355\uff08" + hm.length + " \u4e2a\uff09",
      '<div class="hint">\u70b9\u51fb\u4efb\u610f\u4e00\u9879\u5373\u53ef\u6062\u590d\u663e\u793a\uff1b\u4e5f\u53ef\u4e00\u952e\u5168\u90e8\u6062\u590d\u3002</div>'
      + '<div style="margin-top:8px">' + rows + '</div>',
      '<button class="btn ghost" id="hmAll">\u5168\u90e8\u6062\u590d</button>'
      + '<button class="btn primary" onclick="APP.close()">\u5173\u95ed</button>');
    const items = document.querySelectorAll("#modalBody [data-hm]");
    for (let i = 0; i < items.length; i++) {
      items[i].onclick = (function (a) { return function () { closeModal(); restoreMenuAct(a); openHiddenList(); }; })(items[i].getAttribute("data-hm"));
    }
    const a = el("hmAll"); if (a) a.onclick = () => { closeModal(); openMenuRestoreHidden(); };
  }

  // ---------- 快捷常用（v2.4）----------
  const QF_KEY = "gujian_quickfavs_v1";
  const QF_EXCLUDE = ["search", "filter"];
  function loadQuickFavs() { try { const a = JSON.parse(localStorage.getItem(QF_KEY) || "[]"); return Array.isArray(a) ? a.filter((x) => typeof x === "string" && !QF_EXCLUDE.includes(x)) : []; } catch (e) { return []; } }
  function saveQuickFavs(a) { try { localStorage.setItem(QF_KEY, JSON.stringify(a)); } catch (e) {} }
  // ---------- 错误日志查看器（功能⑯：信息与帮助 → 错误日志）----------
  function openErrLog() {
    var KEY = (window.__APP_ID__ || "app") + "_errlog_v1";
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem(KEY) || "[]"); if (!Array.isArray(arr)) arr = []; } catch (e) { arr = []; }
    arr = arr.slice().reverse(); // 最新在前
    var body;
    if (!arr.length) {
      body = '<div class="hint">暂无错误记录。运行中的脚本错误会在此自动收集，便于反馈排查。</div>';
    } else {
      body = '<div style="max-height:62vh;overflow:auto;font-size:12px">' + arr.map(function (e) {
        return '<div style="border-bottom:1px solid rgba(255,255,255,.08);padding:8px 2px">' +
          '<div style="color:#8fb7e8;font-size:11px">' + esc(e.t || "") + '</div>' +
          '<div style="color:#e8eef6;white-space:pre-wrap;word-break:break-all;margin-top:3px">' + esc(e.m || "") + '</div></div>';
      }).join("") + '</div>';
    }
    openModal("错误日志（最近 " + arr.length + " 条）", body,
      '<button class="btn ghost" id="elCopy">复制全部</button><button class="btn ghost" id="elClear">清空</button><button class="btn primary" id="elClose">关闭</button>');
    var c = el("elCopy"); if (c) c.onclick = function () {
      var txt = arr.map(function (e) { return (e.t || "") + "\n" + (e.m || ""); }).join("\n\n");
      copyText(txt); toast("已复制 " + arr.length + " 条错误日志");
    };
    var cl = el("elClear"); if (cl) cl.onclick = function () { localStorage.removeItem(KEY); closeModal(); toast("已清空错误日志"); };
    var x = el("elClose"); if (x) x.onclick = closeModal;
  }

  function toggleQuickFav(act) {
    if (act && navigator.vibrate) { try { navigator.vibrate(30); } catch (_) {} } // ⑨ 长按反馈：振动（不支持的环境静默忽略）
    if (!act || QF_EXCLUDE.includes(act)) return;
    const cur = loadQuickFavs();
    const i = cur.indexOf(act);
    if (i >= 0) { cur.splice(i, 1); toast("已从快捷常用移出"); }
    else { cur.push(act); toast("已加入快捷常用"); }
    saveQuickFavs(cur); renderQuickFavs();
  }
  function btnMenuTitle(b) {
    const sp = b ? b.querySelector("span:nth-child(2)") : null;
    if (!sp) return "";
    const n = sp.childNodes[0];
    return ((n && n.nodeType === 3 ? n.textContent : sp.textContent) || "").trim();
  }
  function renderQuickFavs() {
    const box = el("quickFavGroup"); if (!box) return;
    const favs = loadQuickFavs();
    if (!favs.length) { box.innerHTML = `<div class="hint" style="padding:6px 10px">尚未设置常用功能：右键/长按任意菜单项，或到「设置 → 快捷常用设置」勾选</div>`; return; }
    box.innerHTML = favs.map((act) => {
      const src = document.querySelector(`.drawer .menu-btn[data-act="${act}"]`);
      const ico = src && src.querySelector(".ico") ? src.querySelector(".ico").textContent : "⭐";
      const title = btnMenuTitle(src) || act;
      return `<button class="menu-btn qf-btn" data-act="${act}"><span class="ico">${ico}</span><span>${esc(title)}<span class="sub">快捷常用 · 长按移出</span></span></button>`;
    }).join("");
    box.querySelectorAll(".menu-btn").forEach(bindMenuBtn);
    try { decorateMenuButtons(); } catch (e) {}
  }
  function openQuickFavSettings() {
    const all = [...document.querySelectorAll(".drawer .menu-btn:not(.qf-btn)")].filter((b) => !QF_EXCLUDE.includes(b.dataset.act));
    const favs = loadQuickFavs();
    const html = `<div class="hint">勾选常用功能，保存后显示在「快捷常用」菜单（置于查询/筛选之下首位）。原子菜单全部保留。</div>
      <div style="max-height:46vh;overflow:auto">` +
      all.map((b) => {
        const act = b.dataset.act;
        const ico = b.querySelector(".ico") ? b.querySelector(".ico").textContent : "";
        const on = favs.includes(act);
        return `<label style="display:flex;align-items:center;gap:8px;padding:7px 4px;cursor:pointer;border-bottom:1px solid rgba(127,127,127,.15)"><input type="checkbox" class="qfcb" value="${act}" ${on ? "checked" : ""}/><span>${ico} ${esc(btnMenuTitle(b) || act)}</span></label>`;
      }).join("") + `</div>`;
    openModal("快捷常用设置", html, `<button class="btn ghost" id="qfCancel">取消</button><button class="btn primary" id="qfSave">保存</button>`);
    el("qfCancel").onclick = closeModal;
    el("qfSave").onclick = () => {
      const sel = [...document.querySelectorAll(".qfcb:checked")].map((c) => c.value);
      saveQuickFavs(sel); closeModal(); renderQuickFavs(); toast(`已保存快捷常用（${sel.length} 项）`);
    };
  }
  // ---------- 组织/类型管理（v2.4 简化版：管理省/城市/古建类型）----------
  function openOrgManager() {
    const draw = () => {
      const html = `<div class="hint">古建端机构简化为 <b>省 / 城市</b> 两级。此处可增删改城市名与默认城市；类型管理请用<b>分类维度管理</b>。</div>` +
        `<div class="fgroup"><div class="ftitle">省份（<b class="cnt">${DIMS.provinces.length}</b>）</div>` +
          `<div class="cfg-list">${DIMS.provinces.map((p) => `<div class="cfg-row"><span class="cfg-name">${esc(p)}</span><span class="cfg-sub">${records.filter((r) => r.province === p).length} 个古建</span></div>`).join("")}</div></div>` +
        `<div class="fgroup"><div class="ftitle">城市（<b class="cnt">${DIMS.citys.length}</b>）</div>` +
          `<div class="cfg-list">${DIMS.citys.map((c) => `<div class="cfg-row"><span class="cfg-name">${esc(c)}</span><span class="cfg-sub">${records.filter((r) => normCity(r.city) === c).length} 个古建${orgDefaultCity() === c ? ' · ⭐ 默认' : ''}</span></div>`).join("")}</div>` +
          `<div class="cfg-add"><input id="add_city" placeholder="新增城市名"><button class="btn primary" id="add_city_btn">➕ 添加</button></div>` +
        `</div>` +
        `<div class="fgroup"><div class="ftitle">默认城市（新增古建预填）</div><input class="cfg-definp" id="def_city" value="${esc(orgDefaultCity())}" placeholder="默认城市名称"></div>` +
        `<div class="hint">修改即时保存。城市重命名级联请直接编辑已导入数据。</div>`;
      openModal("机构与默认城市管理", html, `<button class="btn ghost" id="omClose">关闭</button><button class="btn primary" id="omSync">💾 保存并全量同步</button>`);
      el("add_city_btn").onclick = () => {
        const v = (el("add_city").value || "").trim(); if (!v) return toast("名称不能为空");
        ORGCFG.cityExtra = [...(ORGCFG.cityExtra || []), v]; saveCFG(); applyDims(); toast("已添加：" + v); draw();
      };
      el("def_city").onchange = () => { ORGCFG.defaults.city = el("def_city").value.trim(); saveCFG(); applyDims(); toast("默认城市已更新：" + (ORGCFG.defaults.city || "（空）")); };
      el("omClose").onclick = closeModal;
      el("omSync").onclick = () => { saveCFG(); applyDims(); merge(); render(); toast("已全量同步"); };
    };
    draw();
  }
  function openBtypeManager() {
    const draw = () => {
      const html = `<div class="hint">古建类型共 <b>${DIMS.atypes.length}</b> 个；数据派生类型可重命名（级联更新古建），自定义类型可重命名/删除。</div>` +
        `<div class="cfg-list">${DIMS.atypes.map((t) => {
          const cnt = records.filter((r) => r.atype === t).length;
          const isExtra = (ORGCFG.typeExtra || []).includes(t);
          return `<div class="cfg-row"><span class="cfg-name">${esc(t)}</span><span class="cfg-sub">${cnt} 个古建 · ${isExtra ? "自定义" : "数据派生"}</span><span class="cfg-acts">` +
            `<button class="btn tiny" data-act="ren" data-v="${esc(t)}">重命名</button>` +
            (isExtra ? `<button class="btn tiny danger" data-act="del" data-v="${esc(t)}">删除</button>` : "") +
            `</span></div>`;
        }).join("")}</div>` +
        `<div class="cfg-add"><input id="atAdd" placeholder="新增古建类型"><button class="btn primary" id="atAddBtn">➕ 添加</button></div>`;
      openModal("古建类型管理", html, `<button class="btn ghost" id="atClose">关闭</button><button class="btn primary" id="atSync">💾 保存并全量同步</button>`);
      const body = el("modalBody");
      body.querySelectorAll('button[data-act="ren"]').forEach((b) => b.onclick = () => {
        const old = b.dataset.v, nv = (prompt("重命名「" + old + "」为：", old) || "").trim();
        if (!nv || nv === old || DIMS.atypes.includes(nv)) return;
        const aff = records.filter((r) => r.atype === old);
        const cascade = aff.length ? confirm(`将把 ${aff.length} 个古建的类型「${old}」改为「${nv}」，是否一并更新？`) : false;
        (async () => {
          if (cascade) { await Store.patch((d) => { aff.forEach((r) => { const o = Object.assign({}, r); o.atype = nv; d.updated[r.id] = o; }); }); DELTA = await Store.get(); }
          ORGCFG.typeExtra = [...(ORGCFG.typeExtra || []).filter((x) => x !== old), nv];
          saveCFG(); merge(); applyDims(); render(); draw(); toast("已重命名：" + old + " → " + nv);
        })();
      });
      body.querySelectorAll('button[data-act="del"]').forEach((b) => b.onclick = () => {
        const t = b.dataset.v; const aff = records.filter((r) => r.atype === t).length;
        if (!confirm(`确认删除类型「${t}」？${aff ? "（" + aff + " 个古建仍保留该类型名，仅从下拉选项移除）" : ""}`)) return;
        ORGCFG.typeExtra = (ORGCFG.typeExtra || []).filter((x) => x !== t); saveCFG(); applyDims(); draw(); toast("已删除：" + t);
      });
      el("atAddBtn").onclick = () => {
        const v = (el("atAdd").value || "").trim(); if (!v || DIMS.atypes.includes(v)) return toast("已存在同名或为空");
        ORGCFG.typeExtra = [...(ORGCFG.typeExtra || []), v]; saveCFG(); applyDims(); draw(); toast("已添加：" + v);
      };
      el("atClose").onclick = closeModal;
      el("atSync").onclick = () => { saveCFG(); merge(); applyDims(); render(); toast("已全量同步"); };
    };
    draw();
  }
  function focusSearch() {
    const s = el("search"); if (!s) return;
    s.focus(); s.scrollIntoView({ block: "center" });
    toast("请输入名称 / 城市关键字进行查询");
  }
  function closeDrawer() { el("drawer").classList.remove("open"); el("mask").classList.remove("show"); }

  // ---------- 右键上下文菜单（显示界面智能挂载 AI / 常规功能）----------
  function _ctxClose() { closeCtxMenu(); }
  function _ctxEsc(e) { if (e.key === "Escape") closeCtxMenu(); }
  function closeCtxMenu() {
    const m = el("ctxMenu"); if (m) m.remove();
    document.removeEventListener("click", _ctxClose, true);
    document.removeEventListener("keydown", _ctxEsc);
  }
  function openCtxMenu(x, y, items) {
    closeCtxMenu();
    const m = document.createElement("div");
    m.id = "ctxMenu"; m.className = "ctx-menu";
    m.innerHTML = items.map((it, i) =>
      it.sep ? '<div class="ctx-sep"></div>'
      : `<div class="ctx-item" data-i="${i}">${it.icon ? '<span class="ctx-ico">' + it.icon + "</span>" : ""}${esc(it.label)}</div>`
    ).join("");
    document.body.appendChild(m);
    const w = m.offsetWidth, h = m.offsetHeight;
    if (x + w > window.innerWidth) x = Math.max(4, window.innerWidth - w - 4);
    if (y + h > window.innerHeight) y = Math.max(4, window.innerHeight - h - 4);
    m.style.left = x + "px"; m.style.top = y + "px";
    m.querySelectorAll(".ctx-item").forEach((node) => (node.onclick = () => {
      const it = items[+node.dataset.i]; closeCtxMenu(); if (it && it.fn) it.fn();
    }));
    setTimeout(() => document.addEventListener("click", _ctxClose, false), 0);
    document.addEventListener("keydown", _ctxEsc);
  }
  function ctxItemsFor(r) {
    return [
      { label: "智能查询", icon: "🔍", fn: () => AI.query(r) },
      { label: "智能更新", icon: "🤖", fn: () => AI.update(r) },
      { label: "智能纠错", icon: "✏️", fn: () => AI.correct(r) },
      { label: "AI 对话", icon: "💬", fn: () => AI.openChat() },
      { sep: true },
      { label: "定位到地图", icon: "📍", fn: () => locateInMap(r) },
      { label: "编辑", icon: "📝", fn: () => openEdit(r.id) },
      { label: "导出此条", icon: "📤", fn: () => exportOne(r) },
      { label: "删除", icon: "🗑️", fn: () => deleteRecord(r.id) },
    ];
  }
  function mapCtxItems(latlng) {
    return [
      { label: "🤖 AI 智能建卡", fn: () => aiAddAt(latlng) },
      { label: "📍 在此添加建筑物", fn: () => openAddForm({ lat: latlng.lat, lon: latlng.lng }) },
      { sep: true },
      { label: "⭐ 收藏当前窗口", fn: () => saveFavWindow() },
      { label: "🏠 回到主菜单", fn: () => tripleTapMenu() },
    ];
  }
  async function deleteRecord(id) {
    const r = records.find((x) => x.id === id); if (!r) return;
    if (!confirm("确认删除「" + (r.name || "未命名") + "」？此操作不可恢复。")) return;
    await Store.patch((d) => {
      d.added = d.added || []; d.updated = d.updated || {};
      const i = d.added.findIndex((a) => a.id === id);
      if (i >= 0) d.added.splice(i, 1);
      else { d.deleted = d.deleted || []; if (!d.deleted.includes(id)) d.deleted.push(id); delete d.updated[id]; }
    });
    DELTA = await Store.get(); merge(); render();
    toast("已删除：" + (r.name || "未命名"));
  }
  function exportOne(r) {
    try {
      const name = (r.name || "record").replace(/[\\/:*?"<>|]/g, "_");
      IO.downloadText(name + ".csv", IO.buildCsv([r]));
      toast("已导出：" + (r.name || "记录"));
    } catch (e) { toast("导出失败：" + e.message); }
  }
  function safeJson(s) {
    if (!s) return null;
    s = String(s).trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "");
    const a = s.indexOf("{"); const b = s.lastIndexOf("}");
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
    try { return JSON.parse(s); } catch (e) { return null; }
  }
  async function aiAddAt(latlng) {
    openModal("AI 智能建卡",
      `<div class="hint">描述这个建筑物（如"温泉所管理段的一座节制闸，3 孔，闸宽 6 米"），AI 将自动提取名称/管理所/类型/参数并预填表单。</div>
       <div class="field" style="margin-top:10px"><textarea id="aiAddDesc" class="inp" rows="4" placeholder="在此输入描述…"></textarea></div>`,
      `<button class="btn ghost" id="aiAddCancel">取消</button><button class="btn primary" id="aiAddGo">AI 提取并建卡</button>`);
    el("aiAddCancel").onclick = closeModal;
    el("aiAddGo").onclick = async () => {
      const desc = el("aiAddDesc").value.trim(); if (!desc) return toast("请先输入描述");
      busy("AI 提取中…");
      try {
        const sys = (AI.domain && AI.domain.internal)
          ? '你是水利工程内部台账录入助手。依据用户描述提取结构化字段。返回严格 JSON：{"name":"名称","office":"管理所","station":"管理站/段","btype":"建筑物类型","params":{"键":"值"},"description":"一句话"}。只返回 JSON。'
          : '你是古建/地点信息录入助手。依据描述提取结构化字段。返回严格 JSON：{"name":"名称","office":"管理所/地区","station":"管理站/段","btype":"类型","params":{"键":"值"},"description":"一句话"}。只返回 JSON。';
        const raw = await AI.strategyCall(desc, { system: sys, json: true });
        const o = safeJson(raw);
        if (!o || !o.name) throw new Error("AI 未返回可解析的 JSON");
        closeModal();
        editId = null;
        openAddForm({ lat: latlng.lat, lon: latlng.lng });
        const setV = (id, v) => { const e = el(id); if (e && v != null && v !== "") e.value = v; };
        setV("fName", o.name); setV("fOffice", o.office); setV("fBtype", o.btype); setV("fStation", o.station);
        if (o.params) setV("fParams", Object.keys(o.params).map((k) => k + " : " + o.params[k]).join("\n"));
        toast("已用 AI 提取结果预填，请核对后保存");
      } catch (e) { toast("AI 建卡失败：" + e.message); }
    };
  }
  function openSync() {
    const html = `<div class="hint">把当前「我的改动」备份为文件，或导入他人/他机的改动。</div>`;
    openModal("我的改动备份", html, `<button class="btn ghost" id="syExp">导出备份</button><button class="btn primary" id="syImp">导入备份</button><button class="btn ghost" onclick="APP.close()">关闭</button>`);
    el("syExp").onclick = syncExport; el("syImp").onclick = syncImport;
  }
  function triggerImport() {
    // 修复：WebView 下局部 input 被 GC → onchange 不触发 → 点击 csv 等"无反应"
    // Android 系统选择器按 MIME 过滤：.ovkmz/.7z 等无 MIME 映射会被隐藏导致「选不了」，故加 */* 兜底，格式由 doImport 校验
    pickFiles({ accept: ".ovkmz,.kmz,.kml,.csv,.xls,.xlsx,.ovobj,.obj,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,*/*", onPick: (files) => files[0] && doImport(files[0]) });
  }

  // 通用二次确认（破坏性操作前使用，避免原生 confirm 卡 UI）
  function confirmModal(msg) {
    return new Promise((resolve) => {
      openModal("请确认", `<div class="hint">${esc(msg)}</div>`, `<button class="btn ghost" id="cfNo">取消</button><button class="btn danger" id="cfYes">确定</button>`);
      el("cfNo").onclick = () => { closeModal(); resolve(false); };
      el("cfYes").onclick = () => { closeModal(); resolve(true); };
    });
  }

  // ---------- 拍照打卡（古建打卡 APP 核心差异能力）----------
  function fmtTs(ts) {
    const d = new Date(ts), p = (n) => (n < 10 ? "0" : "") + n;
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function getLoc(fallback) {
    return new Promise((res) => {
      if (!navigator.geolocation) return res(fallback || null);
      navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => res(fallback || null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }
  function renderCheckinMarkers() {
    if (!ckLayer) return Promise.resolve();
    ckLayer.clearLayers();
    return Store.checkins.get().then((cks) => {
      for (const c of cks) {
        if (!isFinite(+c.lat) || !isFinite(+c.lon)) continue;
        const m = L.circleMarker([+c.lat, +c.lon], { radius: 7, color: "#e0a93c", weight: 2, fillColor: "#e0a93c", fillOpacity: 0.85 });
        const ph = c.photo ? `<img src="${c.photo}" style="max-width:160px;border-radius:8px;margin-top:6px">` : "";
        m.bindPopup(`<div style="min-width:160px"><b>✓ ${esc(c.name)}</b><div class="mt" style="font-size:12px;color:#888">${esc(fmtTs(c.ts))}</div>${ph}<div style="margin-top:4px">${esc(c.note || "")}</div></div>`);
        ckLayer.addLayer(m);
      }
    });
  }
  function drawCheckinRoute() {
    return Store.checkins.get().then((cks) => {
      const pts = cks.filter((c) => isFinite(+c.lat) && isFinite(+c.lon)).sort((a, b) => a.ts - b.ts).map((c) => [+c.lat, +c.lon]);
      if (pts.length < 2) { toast(pts.length ? "仅 1 个打卡点，暂无法连线" : "还没有打卡记录"); return; }
      const line = L.polyline(pts, { color: "#e0a93c", weight: 3, dashArray: "6 6" }).addTo(overlayGroup);
      map.fitBounds(line.getBounds(), { padding: [40, 40] });
      toast(`已连线 ${pts.length} 个打卡点`);
    });
  }
  async function openCheckinList() {
    const cks = (await Store.checkins.get()).sort((a, b) => b.ts - a.ts);
    const item = (c) => `<div class="li"><div><div class="nm">✓ ${esc(c.name)}</div><div class="mt">${esc(fmtTs(c.ts))}${c.note ? (" · " + esc(c.note)) : ""}</div></div><span class="badge delbtn" data-id="${c.id}">删除</span></div>`;
    const html = cks.length
      ? `<div class="hint">已打卡 ${cks.length} 处，金色标记显示在地图上。点「查看足迹」可连成路线。</div><div class="list-scroll" style="max-height:50vh;overflow:auto">${cks.map(item).join("")}</div>`
      : `<div class="hint">还没有打卡记录。点「＋ 新增打卡」去现场标记你到过的古建吧。</div>`;
    openModal("我的打卡", html, `<button class="btn ghost" id="ckAdd">＋ 新增打卡</button><button class="btn ghost" id="ckRoute">查看足迹</button><button class="btn danger" id="ckClear">清除全部</button><button class="btn primary" onclick="APP.close()">关闭</button>`);
    el("ckAdd").onclick = () => openCheckin();
    el("ckRoute").onclick = () => { drawCheckinRoute(); closeModal(); };
    const clr = el("ckClear");
    if (clr) clr.onclick = async () => { if (await confirmModal("确定清除全部打卡记录？此操作不可恢复。")) { await Store.checkins.clear(); await renderCheckinMarkers(); openCheckinList(); } };
    el("modalBody").querySelectorAll(".delbtn").forEach((b) => b.onclick = async () => { await Store.checkins.del(b.dataset.id); await renderCheckinMarkers(); openCheckinList(); });
  }
  async function openCheckin(rid) {
    const recs = records;
    const sel = rid
      ? `<input id="ckRid" type="hidden" value="${rid}"><div class="field"><label>古建</label><input value="${esc((recs.find((x) => x.id === rid) || {}).name || "")}" disabled></div>`
      : `<div class="field"><label>古建 *</label><select id="ckRid">${[""].concat(recs).map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("")}</select></div>`;
    const html = sel +
      `<div class="field"><label>备注</label><textarea id="ckNote" placeholder="例如：2026-08-16 实地走访，主殿保存完好"></textarea></div>` +
      `<div class="photo-grid" id="ckPhotos"></div><div class="photo-add" id="ckAddPhoto">＋ 添加打卡照片</div><input type="file" id="ckFile" accept="image/*" style="display:none">` +
      `<div class="hint" id="ckLoc" style="margin-top:8px">正在获取当前位置…</div>`;
    openModal("新增打卡", html, `<button class="btn ghost" onclick="APP.close()">取消</button><button class="btn primary" id="ckSave">保存打卡</button>`);
    let ckPhoto = "";
    el("ckAddPhoto").onclick = () => el("ckFile").click();
    el("ckFile").onchange = (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { ckPhoto = rd.result; el("ckPhotos").innerHTML = `<div class="photo-item"><img src="${ckPhoto}"></div>`; }; rd.readAsDataURL(f); };
    const loc = await getLoc();
    el("ckLoc").textContent = loc ? `当前位置：${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)}（将以此保存）` : "无法获取位置，将使用所选古建坐标";
    el("ckSave").onclick = async () => {
      const id = el("ckRid").value;
      if (!id) return toast("请选择古建");
      const r = recs.find((x) => x.id === id);
      const useLoc = loc || (r ? { lat: +r.lat, lon: +r.lon } : null);
      if (!useLoc) return toast("无有效坐标，无法打卡");
      const c = { id: IO.genId(), rid: id, name: r ? r.name : id, province: r ? r.province : "", city: r ? r.city : "", lat: useLoc.lat, lon: useLoc.lon, ts: Date.now(), note: el("ckNote").value.trim(), photo: ckPhoto };
      await Store.checkins.add(c);
      await renderCheckinMarkers();
      map.flyTo([useLoc.lat, useLoc.lon], Math.max(map.getZoom(), 15), { duration: 0.6 });
      closeModal(); toast("打卡成功：" + c.name);
    };
  }

  // ================= 运行维护 / 旅游打卡 / 智能分析（P5 · 2026-08-23） =================
  // 数据层：Store.ops（localStorage），与建筑物 delta 分离
  const OPS_TYPES = ["日常检查", "例行维护", "故障处理", "应急响应", "其他"];
  const INSPECT_TYPES = ["日常巡视", "例行维护", "故障处置", "应急响应", "其他"];
  function getOps() {
    const s = (window.Store && Store.ops) ? Store.ops.get() : {};
    s.defaultLoc = s.defaultLoc || null;
    s.plans = s.plans || [];
    s.inspects = s.inspects || [];
    s.routes = s.routes || [];
    return s;
  }
  function setOps(s) { if (window.Store && Store.ops) Store.ops.set(s); }

  // 估算路上时长（小时）：直线距离 / 假设车速（默认 30km/h，UI 可调）
  function estDriveHours(lat1, lon1, lat2, lon2, speedKmh) {
    const R = 6371, toR = Math.PI / 180;
    const d = R * 2 * Math.asin(Math.sqrt(
      Math.pow(Math.sin((lat2 - lat1) * toR / 2), 2) +
      Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.pow(Math.sin((lon2 - lon1) * toR / 2), 2)));
    return d / (speedKmh || 30);
  }
  function fmtHours(h) {
    const m = Math.round(h * 60);
    if (m < 60) return m + " 分钟";
    const hh = Math.floor(m / 60), mm = m % 60;
    return hh + " 小时" + (mm ? " " + mm + " 分" : "");
  }

  // ① 设置默认出发位置
  function openOpsDefaultLoc() {
    const s = getOps();
    const dl = s.defaultLoc;
    const opts = records.map((r) => `<option value="${r.id}">${esc(r.name)}（${esc(r.office || "")}）</option>`).join("");
    const html = `
      <div class="hint">设置默认出发位置：巡视 / 路线从该点开始计算时长。</div>
      <div class="field"><label>从已有建筑物选择</label><select id="dlSel" class="inp"><option value="">— 自定义 —</option>${opts}</select></div>
      <div class="field"><label>名称（自定义时填）</label><input id="dlName" class="inp" value="${dl && dl.custom ? esc(dl.name || "") : ""}" placeholder="如：管理所大院"></div>
      <div class="field"><label>纬度</label><input id="dlLat" class="inp" inputmode="decimal" value="${dl ? dl.lat : ""}" placeholder="如 40.37"></div>
      <div class="field"><label>经度</label><input id="dlLng" class="inp" inputmode="decimal" value="${dl ? dl.lon : ""}" placeholder="如 116.63"></div>
      <div class="field"><label>当前已设</label><div class="hint" id="dlCur">${dl ? esc(dl.name + " (" + dl.lat + ", " + dl.lon + ")") : "（未设置）"}</div></div>`;
    openModal("设置默认出发位置", html, `<button class="btn ghost" id="dlClear">清除</button><button class="btn ghost" id="dlCancel">取消</button><button class="btn primary" id="dlOk">保存</button>`);
    el("dlSel").onchange = () => {
      const r = records.find((x) => x.id === el("dlSel").value);
      if (r) { el("dlLat").value = r.lat; el("dlLng").value = r.lon; el("dlName").value = r.name; }
    };
    el("dlCancel").onclick = closeModal;
    el("dlClear").onclick = () => { const s = getOps(); s.defaultLoc = null; setOps(s); closeModal(); toast("已清除默认出发位置"); };
    el("dlOk").onclick = () => {
      const id = el("dlSel").value;
      const r = id ? records.find((x) => x.id === id) : null;
      const lat = parseFloat(el("dlLat").value), lon = parseFloat(el("dlLng").value);
      if (!isFinite(lat) || !isFinite(lon)) return toast("请先选择建筑物或填写有效经纬度");
      const s = getOps();
      s.defaultLoc = r ? { id: r.id, name: r.name, lat: +r.lat, lon: +r.lon, custom: false }
                      : { name: el("dlName").value.trim() || "自定义点", lat, lon, custom: true };
      setOps(s); closeModal();
      toast("已保存默认出发位置：" + s.defaultLoc.name);
    };
  }

  // ② 旅游打卡计划
  function openOpsPlan() {
    const s = getOps();
    const rows = s.plans.map((p, i) => `<div class="ops-row"><span class="ops-tag">${esc(p.type)}</span>
      <span class="ops-main"><b>${esc(p.time || "未填时间")}</b> · 范围：${esc(p.scope || "—")} · 计划处理：${esc(p.planHandle || "—")}</span>
      <button class="ops-del" data-i="${i}">删</button></div>`).join("") || `<div class="hint">暂无计划，下方添加。</div>`;
    const typeOpts = OPS_TYPES.map((t) => `<option>${t}</option>`).join("");
    const html = `<div class="hint">旅游打卡计划：日常检查 / 例行维护 / 故障处理 / 应急响应 / 其他。</div>
      <div class="ops-list">${rows}</div>
      <div class="ops-form">
        <div class="field"><label>类型</label><select id="plType" class="inp">${typeOpts}</select></div>
        <div class="field"><label>时间</label><input id="plTime" class="inp" type="datetime-local" class="inp"></div>
        <div class="field"><label>范围</label><input id="plScope" class="inp" placeholder="如：温泉所全段"></div>
        <div class="field"><label>计划处理时间</label><input id="plHandle" class="inp" type="datetime-local"></div>
        <div class="field"><label>备注</label><input id="plNote" class="inp" placeholder="可选"></div>
        <button class="btn primary" id="plAdd">添加计划</button>
      </div>`;
    openModal("旅游打卡计划", html, `<button class="btn ghost" id="plClose">关闭</button>`);
    el("plClose").onclick = closeModal;
    el("plAdd").onclick = () => {
      const s = getOps();
      s.plans.push({ id: "p" + Date.now().toString(36), type: el("plType").value, time: el("plTime").value, scope: el("plScope").value.trim(), planHandle: el("plHandle").value, note: el("plNote").value.trim() });
      setOps(s); openOpsPlan(); // 刷新
    };
    document.querySelectorAll(".ops-del").forEach((b) => b.onclick = () => {
      const s = getOps(); s.plans.splice(+b.dataset.i, 1); setOps(s); openOpsPlan();
    });
  }

  // ③ 巡视打卡（含巡视类型 / 显示坐标只读 / 是否计划内）
  function openOpsInspect() {
    const s = getOps();
    const rows = s.inspects.map((it, i) => `<div class="ops-row"><span class="ops-tag">${esc(it.type)}</span>
      <span class="ops-main"><b>${esc(it.bname || "未选建筑物")}</b> · ${it.planned ? "计划内" : "计划外"} · 坐标：${it.coord ? it.coord.lat.toFixed(5) + "," + it.coord.lon.toFixed(5) : "—"}</span>
      <button class="ops-del" data-i="${i}">删</button></div>`).join("") || `<div class="hint">暂无巡视记录，下方新增（自动获取当前位置坐标，只读）。</div>`;
    const typeOpts = INSPECT_TYPES.map((t) => `<option>${t}</option>`).join("");
    const bOpts = records.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("");
    const html = `<div class="hint">巡视打卡（打卡）：选择打卡类型、关联景点（自动获取当前坐标只读）、标记是否计划内。</div>
      <div class="ops-list">${rows}</div>
      <div class="ops-form">
        <div class="field"><label>巡视类型</label><select id="insType" class="inp">${typeOpts}</select></div>
        <div class="field"><label>关联建筑物</label><select id="insBid" class="inp"><option value="">— 选建筑物 —</option>${bOpts}</select></div>
        <div class="field"><label>坐标（自动获取，只读）</label><input id="insCoord" class="inp" readonly placeholder="点「获取当前坐标」"></div>
        <div class="field"><label><input type="checkbox" id="insPlanned"> 是否计划内维护</label></div>
        <button class="btn primary" id="insGet">获取当前坐标</button>
        <button class="btn primary" id="insAdd" style="margin-left:8px">记录巡视</button>
      </div>`;
    openModal("巡视打卡", html, `<button class="btn ghost" id="insClose">关闭</button>`);
    el("insClose").onclick = closeModal;
    el("insGet").onclick = () => {
      if (window.AndroidBridge && window.AndroidBridge.getLoc) {
        window.AndroidBridge.getLoc((lat, lon) => { el("insCoord").value = lat + "," + lon; });
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => { el("insCoord").value = pos.coords.latitude + "," + pos.coords.longitude; }, () => toast("定位失败，请重试"));
      } else toast("当前环境不支持定位");
    };
    el("insAdd").onclick = () => {
      const bid = el("insBid").value;
      const b = bid ? records.find((x) => x.id === bid) : null;
      const coord = (el("insCoord").value || "").split(",").map(Number);
      if (!b) return toast("请先关联建筑物");
      if (!(coord.length === 2 && isFinite(coord[0]) && isFinite(coord[1]))) return toast("请先获取当前坐标");
      const s = getOps();
      s.inspects.push({ id: "i" + Date.now().toString(36), type: el("insType").value, bid, bname: b.name, coord: { lat: coord[0], lon: coord[1] }, planned: el("insPlanned").checked, at: new Date().toISOString() });
      setOps(s); openOpsInspect();
    };
    document.querySelectorAll(".ops-del").forEach((b) => b.onclick = () => {
      const s = getOps(); s.inspects.splice(+b.dataset.i, 1); setOps(s); openOpsInspect();
    });
  }

  // ④ 我的巡视路线（含时长估算）
  function openOpsRoute() {
    const s = getOps();
    const dl = s.defaultLoc;
    const rows = s.routes.map((rt, i) => {
      const pts = rt.points.map((pid) => records.find((r) => r.id === pid)).filter(Boolean);
      let drive = 0, stay = 0;
      const speed = rt.speed || 30, stayMin = rt.stayMin || 10;
      let prev = dl ? { lat: +dl.lat, lon: +dl.lon } : (pts[0] ? { lat: +pts[0].lat, lon: +pts[0].lon } : null);
      for (const p of pts) {
        if (prev) drive += estDriveHours(prev.lat, prev.lon, +p.lat, +p.lon, speed);
        stay += stayMin / 60; prev = { lat: +p.lat, lon: +p.lon };
      }
      const total = drive + stay;
      return `<div class="ops-row"><span class="ops-tag">${esc(rt.name || "路线")}</span>
        <span class="ops-main">${pts.length} 点 · 路上 ${fmtHours(drive)} · 停留 ${fmtHours(stay)} · <b>总 ${fmtHours(total)}</b> · 车速${speed} 停留${stayMin}分/点</span>
        <button class="ops-del" data-i="${i}">删</button></div>`;
    }).join("") || `<div class="hint">暂无路线。添加路线并选择途经建筑物，自动估算巡视时长（从默认出发位置起算）。</div>`;
    const bOpts = records.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("");
    const html = `<div class="hint">我的巡视路线：选择途经建筑物，从默认出发位置起算总时长（路上 + 停留）。</div>
      <div class="ops-list">${rows}</div>
      <div class="ops-form">
        <div class="field"><label>路线名称</label><input id="rtName" class="inp" placeholder="如：温泉所周巡"></div>
        <div class="field"><label>途经建筑物（按顺序，Ctrl/⌘ 多选）</label><select id="rtPts" class="inp" multiple size="6">${bOpts}</select></div>
        <div class="field"><label>假设车速(km/h)</label><input id="rtSpeed" class="inp" inputmode="numeric" value="30"></div>
        <div class="field"><label>每点停留(分钟)</label><input id="rtStay" class="inp" inputmode="numeric" value="10"></div>
        <button class="btn primary" id="rtAdd">添加路线</button>
      </div>`;
    openModal("我的巡视路线", html, `<button class="btn ghost" id="rtClose">关闭</button>`);
    el("rtClose").onclick = closeModal;
    el("rtAdd").onclick = () => {
      const pts = [...el("rtPts").selectedOptions].map((o) => o.value);
      if (!pts.length) return toast("请至少选择 1 个途经建筑物");
      const s = getOps();
      s.routes.push({ id: "r" + Date.now().toString(36), name: el("rtName").value.trim() || "路线" + (s.routes.length + 1), points: pts, speed: +el("rtSpeed").value || 30, stayMin: +el("rtStay").value || 10 });
      setOps(s); openOpsRoute();
    };
    document.querySelectorAll(".ops-del").forEach((b) => b.onclick = () => {
      const s = getOps(); s.routes.splice(+b.dataset.i, 1); setOps(s); openOpsRoute();
    });
  }

  // 照片轮播：多照片时点击进入自动循环
  let _lbTimer = null;
  function startLbCycle(photos, idx) {
    stopLbCycle();
    if (photos.length <= 1) return;
    _lbTimer = setInterval(() => {
      idx = (idx + 1) % photos.length;
      openPhotoAt(photos, idx);
    }, 2500);
  }
  function stopLbCycle() { if (_lbTimer) { clearInterval(_lbTimer); _lbTimer = null; } }
  // 新入口：接收某建筑物的多照片数组，支持自动轮播
  async function openPhotoCycle(rid) {
    const r = records.find((x) => x.id === rid); if (!r || !r.photos || !r.photos.length) return;
    const photos = r.photos;
    window.__CUR_PHOTOS__ = photos;
    lbRid = rid; lbPi = 0;
    await openPhotoAt(photos, 0);
    // 控制条：多照片时显示切换 + 自动轮播按钮
    const multi = photos.length > 1;
    el("lbBar").style.display = multi ? "" : "none";
    el("lbPrev").style.display = multi ? "" : "none";
    el("lbNext").style.display = multi ? "" : "none";
    el("lbIdx").style.display = multi ? "" : "none";
    ensureLbCycleBtn();
  }
  async function openPhotoAt(photos, idx) {
    const ph = photos[idx];
    el("lbImg").src = await loadPhotoFull(ph);
    el("lbImg").style.transform = "";
    el("lbCap").textContent = (ph.caption || "") + (photos.length > 1 ? `（${idx + 1}/${photos.length}）` : "");
    el("lbIdx").textContent = photos.length > 1 ? `${idx + 1}/${photos.length}` : "";
    el("lightbox").classList.add("show");
  }
  function ensureLbCycleBtn() {
    if (el("lbCycle")) return;
    const bar = el("lbBar"); if (!bar) return;
    const btn = document.createElement("button");
    btn.id = "lbCycle"; btn.className = "lb-btn"; btn.textContent = "自动";
    btn.onclick = () => {
      const photos = window.__CUR_PHOTOS__ || [];
      if (_lbTimer) { stopLbCycle(); btn.textContent = "自动"; btn.classList.remove("on"); }
      else if (photos.length > 1) {
        const cur = (parseInt((el("lbIdx").textContent || "1").split("/")[0]) || 1) - 1;
        startLbCycle(photos, cur); btn.textContent = "停止"; btn.classList.add("on");
      }
    };
    bar.appendChild(btn);
  }


  // ================= 知识库（KB）集成 · 需求③ =================
  // 让 AI 融入应用：KB 承载建筑物骨架 + 操作日志 + Hermes 自我学习记忆。
  // 所有钩子对 KB 缺失/异常均优雅降级，不影响主流程。
  function kbReady() { return !!(window.KB && KB.all); }
  function kbLog(desc, params) { if (kbReady()) { try { KB.logOp(desc, params); } catch (e) {} } }

  async function initKB() {
    if (!kbReady()) return;
    try {
      const es = await KB.all();
      if (es.length) return;                       // 已有骨架/数据，不覆盖
      const recs = (records || []).filter((r) => r && r.lat != null && r.lon != null);
      if (recs.length) {
        const n = await KB.rebuildSkeleton(recs);
        kbLog("初始化知识库骨架", { buildings: n });
      }
    } catch (e) { console.warn("KB init skip:", e); }
  }

  // KB 导入进度弹窗（.bar/.bar-fill 复用批量导入照片的进度条样式）
  function kbProgress(title) {
    openModal(title,
      `<div class="hint" id="kbPMsg">准备中…</div><div class="bar"><div class="bar-fill" id="kbPBar" style="width:0%"></div></div>`);
    return {
      set(p, msg) {
        const m = el("kbPMsg"), b = el("kbPBar");
        if (m && msg != null) m.textContent = msg;
        if (b) b.style.width = Math.max(0, Math.min(100, Math.round(p))) + "%";
      },
      close() { closeModal(); },
    };
  }

  // 子菜单①：导入外部文件 → 智能转 md（进度条）→ 入库（v2.4.5：pdf/docx/xlsx/html 等全支持）
  function kbImportFile() {
    if (!kbReady()) return toast("知识库未加载");
    pickFiles({ multiple: true, accept: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.markdown,.html,.htm,.json,.jpg,.jpeg,.png,.bmp,.webp,application/pdf,image/*,text/*,*/*", onPick: async (files) => {
      if (!files.length) return;
      const p = kbProgress("外部文件智能转换入库");
      let ok = 0, fail = 0, msg = "";
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        p.set((i / files.length) * 100, `（${i + 1}/${files.length}）正在转换：${f.name}`);
        try {
          const entry = await KB.convertExternalAuto(f, (pp, m2) =>
            p.set(((i + pp / 100) / files.length) * 100, `（${i + 1}/${files.length}）${f.name}：${m2 || ""}`));
          ok++;
          kbLog("外部文件智能转换入库", { file: f.name, title: entry.title });
        } catch (e) { fail++; msg += `【${f.name}】${e.message} `; }
        await new Promise((r) => setTimeout(r, 0)); // 让出主线程，进度条不卡死
      }
      p.close();
      toast(`已入库 ${ok} 个文件` + (fail ? `，失败 ${fail} 个：${msg}` : ""));
    }});
  }

  // 子菜单②：导出知识库（v2.4.5：md / txt / html 主流知识库兼容格式；zip 完整备份保留兼容）
  async function kbExport() {
    if (!kbReady()) return toast("知识库未加载");
    const n = (await KB.all()).length;
    const opt = (v, label, i) => `<label style="display:flex;gap:8px;align-items:center;padding:6px 0"><input type="radio" name="kbFmt" value="${v}" ${i === 0 ? "checked" : ""}> ${label}</label>`;
    const html = `<div class="hint">共 <b>${n}</b> 条知识。md 为 YAML front matter 格式，Obsidian / Joplin / 语雀 / Notion 等主流知识库可直接导入：</div>` +
      opt("md", "Markdown（.md · 推荐，主流知识库兼容）") +
      opt("txt", "纯文本（.txt）") +
      opt("html", "网页（.html · 双击可直接打开）") +
      opt("zip", "完整备份（.zip · 旧格式，含 json 索引）");
    openModal("导出知识库", html, `<button class="btn ghost" id="kbExClose">关闭</button><button class="btn primary" id="kbExGo">导出</button>`);
    el("kbExClose").onclick = closeModal;
    el("kbExGo").onclick = async () => {
      const fmt = (document.querySelector('input[name="kbFmt"]:checked') || {}).value || "md";
      closeModal();
      busy("正在导出知识库…");
      try {
        const out = await KB.exportAs(fmt);
        // v2.4.8：默认文件名「知识库+日期.md/.txt/.html/.zip」，并走统一导出路径（可自定义文件夹/文件名）
        const d = new Date();
        const stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        const defName = "知识库" + stamp + "." + fmt;
        if (typeof out.data === "string") IO.downloadText(defName, out.data, out.mime);
        else IO.downloadBytes(defName, out.data, out.mime);
        kbLog("导出知识库", { fmt, size: out.data.length || out.data.byteLength, entries: n });
        toast("知识库已导出：" + defName);
      } catch (e) { toast("导出失败：" + e.message); }
      finally { busy(false); }
    };
  }

  // 子菜单③：导入知识库文件（v2.4.5：md / txt / html 可多选，front matter 自动还原；旧 .zip 备份仍兼容）
  async function kbImportBackup() {
    if (!kbReady()) return toast("知识库未加载");
    pickFiles({ multiple: true, accept: ".md,.markdown,.txt,.html,.htm,.zip,text/markdown,text/plain,text/html,application/zip,*/*", onPick: async (files) => {
      if (!files.length) return;
      const p = kbProgress("导入知识库文件");
      let ok = 0, fail = 0, msg = "";
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          p.set((i / files.length) * 100, `（${i + 1}/${files.length}）正在导入：${f.name}`);
          try {
            if (/\.zip$/i.test(f.name)) {
              ok += await KB.importZip(await f.arrayBuffer());
            } else {
              ok += await KB.importDocuments([f], (pp, m2) =>
                p.set(((i + pp / 100) / files.length) * 100, `（${i + 1}/${files.length}）${m2 || f.name}`));
            }
          } catch (e) { fail++; msg += `【${f.name}】${e.message} `; }
        }
        kbLog("导入知识库文件", { files: files.length, ok, fail });
        p.close();
        toast(`已导入 ${ok} 条知识` + (fail ? `，失败 ${fail} 个：${msg}` : ""));
      } catch (e) { p.close(); toast("导入失败：" + e.message); }
    }});
  }

  // 子菜单④：知识库查询（本地优先 + 联网兜底 + 来源标注 + 确认按钮）
  async function openKBQuery() {
  window.openKB = openKBQuery; // 兼容旧 onclick="openKB()" 引用
    if (!kbReady()) return toast("知识库未加载");
    const online = localStorage.getItem("ai_online_v1") === "1";
    const html =
      `<div class="hint">本地优先：先在本机知识库检索；本地无结果且已开启「联网」（AI设置）时可点「联网查询」获取在线结果。结果标注来源 [本地]/[在线]。</div>` +
      `<div class="field"><label>查询内容</label><input id="kbqInput" placeholder="如：寺庙 古塔 建筑参数"></div>` +
      `<div id="kbqOut" class="ai-out"></div>`;
    openModal("知识库查询", html, `<button class="btn ghost" id="kbqClose">关闭</button><button class="btn ghost" id="kbqOnline">联网查询</button><button class="btn primary" id="kbqConfirm">确认查询</button>`);
    el("kbqClose").onclick = closeModal;
    const out = el("kbqOut");
    const md = (txt) => (AI && AI.mdLite ? AI.mdLite(txt) : '<pre style="white-space:pre-wrap">' + esc(txt) + '</pre>');
    const renderLocal = async (q) => {
      out.innerHTML = '<div class="hint">正在检索本地知识库…</div>';
      const txt = await KB.retrieve(q, 20);
      if (!txt || !txt.trim()) {
        out.innerHTML = '<div class="hint">本地知识库无匹配结果。' + (online ? '可点「联网查询」在线检索。' : '（联网未开启）') + '</div>';
        return false;
      }
      out.innerHTML = '<div class="src-badge">[本地]</div>' + md(txt);
      return true;
    };
    const renderOnline = async (q) => {
      if (!online) return toast("联网未开启（请到「AI设置」开启）");
      if (!window.AI || !AI.kbOnlineQuery) return toast("AI 未初始化，无法联网查询");
      out.innerHTML = '<div class="hint">正在联网查询（大模型）…</div>';
      try {
        const txt = await AI.kbOnlineQuery(q);
        out.innerHTML = '<div class="src-badge online">[在线]</div>' + md(txt);
      } catch (e) { out.innerHTML = '<div class="err">联网查询失败：' + esc(e.message) + '</div>'; }
    };
    el("kbqOnline").onclick = () => { const q = (el("kbqInput") ? el("kbqInput").value : "").trim(); if (!q) return toast("请输入查询内容"); renderOnline(q); };
    el("kbqConfirm").onclick = async () => {
      const q = (el("kbqInput") ? el("kbqInput").value : "").trim();
      if (!q) return toast("请输入查询内容");
      const found = await renderLocal(q);
      if (!found) await renderOnline(q);   // 本地无 → 联网兜底（若开启）
    };
  }

  // 供 ai.js 注入 KB 上下文（让模型可读知识库）+ Hermes 学习钩子（v2.4.6：切片级智能检索，段落更精准）
  window.__kbContext = async (q) => {
    if (!kbReady()) return "";
    try {
      const r = await (KB.fuzzyQuery ? KB.fuzzyQuery(q, 8) : KB.smartQuery(q, 8));   // v2.4.8：优先模糊检索（错字/缺字可召回）
      window.__kbLocalHit = !!r.length;
      return r.map((x) => "# " + (x.title || "") + (x.tags && x.tags.length ? "（" + x.tags.join("、") + "）" : "") + "\n" + (x.chunk || "")).join("\n\n---\n\n");
    } catch (e) { return ""; }
  };
  window.__kbMemoryContext = async () => { if (!kbReady() || !KB.memory) return ""; try { const m = await KB.memory(); return m ? "# 自我学习记忆（Hermes）\n" + m.slice(-2000) : ""; } catch (e) { return ""; } };
  window.__hermesNote = (kind, text) => { if (kbReady() && KB.hermes) { KB.hermes("[" + kind + "] " + String(text || "").slice(0, 200)).catch(() => {}); } };


  // ---------- v2.4.8 知识库智能化：模糊检索 / 提示词生成 / AI记忆 / 存疑与反向查询 ----------
  (function () {
    if (!window.__EXT_ACTS__) window.__EXT_ACTS__ = {};
    function kbOk() { return (typeof kbReady === "function" && kbReady() && window.KB); }
    function escT(s) { return (typeof esc === "function") ? esc(s) : String(s == null ? "" : s); }
    function pct(s) { return (Math.round((s || 0) * 100)) + "%"; }
    function rowsHtml(list) {
      if (!list || !list.length) return '<div class="hint">无匹配结果</div>';
      return list.map(function (r, i) {
        return '<div class="hist-item" data-kbi="' + i + '">' +
          '<div class="hist-top"><b>' + escT(r.title || r.id) + '</b><span class="hist-badge off">' + pct(r.score) + '</span></div>' +
          (r.tags && r.tags.length ? '<div class="hint">#' + escT(r.tags.join(" #")) + '</div>' : "") +
          '<div class="hist-q" style="white-space:pre-wrap">' + escT(String(r.chunk || "").slice(0, 240)) + '</div>' +
          '<div class="hist-acts"><button class="btn ghost sm" data-kbact="rev" data-kbi="' + i + '">反向查询</button>' +
          '<button class="btn ghost sm" data-kbact="doubt" data-kbi="' + i + '">标为存疑</button></div></div>';
      }).join("");
    }
    function bindKbRows(box, list) {
      if (!box) return;
      box.querySelectorAll("[data-kbact]").forEach(function (b) {
        const r = list[+b.getAttribute("data-kbi")];
        if (!r) return;
        b.onclick = function () {
          const act = b.getAttribute("data-kbact");
          if (act === "doubt") {
            if (!window.KB || !KB.markDoubt) return toast("知识库未启用");
            KB.markDoubt(r.title || r.id, r.chunk || "", { from: "kb_fuzzy" }).then(function () { toast("已标记为存疑"); });
          } else {
            if (!window.KB || !KB.reverseQuery) return toast("知识库未启用");
            KB.reverseQuery(r.chunk || "", 5).then(function (rel) {
              openModal("反向查询 · " + (r.title || r.id), rowsHtml(rel), '<button class="btn primary" id="rvClose">关闭</button>');
              el("rvClose").onclick = closeModal;
            });
          }
        };
      });
    }
    // ① 模糊检索（错字/缺字也能命中，带相关度）
    function openKbFuzzy() {
      if (!kbOk()) return toast("知识库未加载");
      openModal("知识库模糊检索",
        '<div class="hint">支持错字、缺字、语序不同：如"跌水闸"也能命中"跌水节制闸"。结果按相关度排序。</div>' +
        '<div class="field"><label>检索内容</label><input id="kbfIn" class="inp" placeholder="输入关键词或一句话"></div>' +
        '<div id="kbfOut" class="ai-out"></div>',
        '<button class="btn ghost" id="kbfClose">关闭</button><button class="btn primary" id="kbfGo">模糊检索</button>');
      el("kbfClose").onclick = closeModal;
      const out = el("kbfOut");
      const go = function () {
        const q = (el("kbfIn") ? el("kbfIn").value : "").trim();
        if (!q) return toast("请输入检索内容");
        out.innerHTML = '<div class="hint">检索中…</div>';
        (KB.fuzzyQuery ? KB.fuzzyQuery(q, 12) : KB.smartQuery(q, 12)).then(function (list) {
          out.innerHTML = rowsHtml(list);
          bindKbRows(out, list);
        }).catch(function (e) { out.innerHTML = '<div class="err">检索失败：' + escT(e.message) + '</div>'; });
      };
      el("kbfGo").onclick = go;
      if (el("kbfIn")) el("kbfIn").addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    }
    // ② 提示词生成（问题 + 知识库片段 + 记忆 → 完整提示词，可复制 / 直投模型）
    function openKbPrompt() {
      if (!kbOk() || !KB.promptGen) return toast("知识库未加载");
      openModal("提示词生成",
        '<div class="hint">输入问题 → 自动拼接「长期记忆 + 知识库最相关片段 + 输出要求」生成完整提示词，可复制或直投大模型。</div>' +
        '<div class="field"><label>你的问题</label><textarea id="kbpIn" class="inp" rows="3" placeholder="如：这座闸的建成年代与管理所归属？"></textarea></div>' +
        '<div id="kbpOut" class="ai-out"></div>',
        '<button class="btn ghost" id="kbpClose">关闭</button><button class="btn ghost" id="kbpCopy">复制</button><button class="btn ghost" id="kbpSend">投喂模型</button><button class="btn primary" id="kbpGo">生成提示词</button>');
      el("kbpClose").onclick = closeModal;
      const out = el("kbpOut");
      const gen = function () {
        const q = (el("kbpIn") ? el("kbpIn").value : "").trim();
        if (!q) return toast("请输入问题");
        out.innerHTML = '<div class="hint">正在检索知识库并生成…</div>';
        KB.promptGen(q, { k: 6, maxChars: 4000 }).then(function (p) {
          window.__lastKbPrompt = p;
          out.innerHTML = '<textarea id="kbpTxt" class="inp" rows="14" style="width:100%">' + escT(p) + '</textarea>';
        }).catch(function (e) { out.innerHTML = '<div class="err">生成失败：' + escT(e.message) + '</div>'; });
      };
      el("kbpGo").onclick = gen;
      el("kbpCopy").onclick = function () {
        const t = document.getElementById("kbpTxt");
        const s = t ? t.value : (window.__lastKbPrompt || "");
        if (!s) return toast("请先生成提示词");
        try { if (navigator.clipboard) navigator.clipboard.writeText(s); } catch (e) {}
        toast("已复制提示词");
      };
      const send = function () {
        const s = (document.getElementById("kbpTxt") || {}).value || window.__lastKbPrompt || "";
        if (!s) return toast("请先生成提示词");
        if (!window.AI || !AI.strategyCall) return toast("AI 未初始化");
        out.insertAdjacentHTML("beforeend", '<div class="hint">已投喂大模型，等待回答…</div>');
        AI.strategyCall(s, {}).then(function (t) {
          out.insertAdjacentHTML("beforeend", '<div class="src-badge">[模型回答]</div><div>' + (AI.mdLite ? AI.mdLite(t) : escT(t)) + '</div>');
        }).catch(function (e) { out.insertAdjacentHTML("beforeend", '<div class="err">调用失败：' + escT(e.message) + '</div>'); });
      };
      const senb = document.getElementById("kbpSend");
      if (senb) senb.onclick = send;
    }
    // ③ AI 记忆（Hermes 自我学习）：查看 / 检索 / 清空
    function openKbMemory() {
      if (!kbOk() || !KB.memoryText) return toast("知识库未加载");
      const show = function (list) {
        const body = (list && list.length)
          ? list.map(function (x) { return '<div class="hist-q">' + escT(typeof x === "string" ? x : x.line) + '</div>'; }).join("")
          : '<div class="hint">暂无记忆</div>';
        openModal("AI 记忆 · Hermes 自我学习",
          '<div class="hint">系统会把每次查询/纠错/存疑自动沉淀为记忆，供后续提示词引用（可在提示词中看到「长期记忆」段）。</div>' +
          '<div class="field"><label>检索记忆</label><input id="kbmQ" class="inp" placeholder="留空显示全部（最多 200 条）"></div>' +
          '<div id="kbmOut" class="ai-out">' + body + '</div>',
          '<button class="btn ghost" id="kbmClose">关闭</button><button class="btn ghost" id="kbmGo">检索</button><button class="btn ghost" id="kbmClear">清空记忆</button>');
        el("kbmClose").onclick = closeModal;
        el("kbmGo").onclick = function () {
          const q = (el("kbmQ") ? el("kbmQ").value : "").trim();
          const run = q ? KB.memorySearch(q, 50) : KB.memoryText().then(function (m) {
            return m.split(/\r?\n/).filter(function (s) { return s.trim(); }).slice(-200).map(function (s) { return { line: s }; });
          });
          run.then(function (l) { el("kbmOut").innerHTML = (l && l.length) ? l.map(function (x) { return '<div class="hist-q">' + escT(typeof x === "string" ? x : x.line) + '</div>'; }).join("") : '<div class="hint">无匹配记忆</div>'; });
        };
        el("kbmClear").onclick = function () {
          if (!window.confirm("确认清空全部 AI 记忆？（知识条目不受影响）")) return;
          KB.memoryClear().then(function () { closeModal(); toast("已清空 AI 记忆"); });
        };
      };
      KB.memoryText().then(function (m) {
        const lines = m.split(/\r?\n/).filter(function (s) { return s.trim(); }).slice(-200).map(function (s) { return { line: s }; });
        show(lines);
      });
    }
    // ④ 存疑与反向查询：列出存疑条目，新增存疑后自动反向查证
    function openKbDoubt() {
      if (!kbOk() || !KB.listDoubts) return toast("知识库未加载");
      const render = function () {
        KB.listDoubts().then(function (list) {
          const rows = list.length ? list.map(function (d, i) {
            return '<div class="hist-item"><div class="hist-top"><b>' + escT(d.title || d.id) + '</b><span class="hist-badge off">待核实</span></div>' +
              '<div class="hist-q" style="white-space:pre-wrap">' + escT(String(d.md || "").slice(0, 200)) + '</div>' +
              '<div class="hist-acts"><button class="btn ghost sm" data-doubt="rev" data-i="' + i + '">反向查询</button>' +
              '<button class="btn ghost sm" data-doubt="del" data-i="' + i + '">删除</button></div></div>';
          }).join("") : '<div class="hint">暂无存疑条目</div>';
          openModal("存疑与反向查询",
            '<div class="hint">对不确定的内容打上存疑标记，系统会用其内容反向检索知识库，找出最相关的条目辅助核实。</div>' +
            '<div class="field"><label>新增存疑 · 标题</label><input id="kbdT" class="inp" placeholder="如：某闸建成年代存疑"></div>' +
            '<div class="field"><label>存疑内容</label><textarea id="kbdM" class="inp" rows="3" placeholder="粘贴不确定的原文或 AI 回答…"></textarea></div>' +
            '<div class="hist-list">' + rows + '</div><div id="kbdOut" class="ai-out"></div>',
            '<button class="btn ghost" id="kbdClose">关闭</button><button class="btn primary" id="kbdAdd">保存存疑并反向查询</button>');
          el("kbdClose").onclick = closeModal;
          document.querySelectorAll("[data-doubt]").forEach(function (b) {
            const d = list[+b.getAttribute("data-i")];
            if (!d) return;
            b.onclick = function () {
              if (b.getAttribute("data-doubt") === "del") {
                if (!window.confirm("删除该存疑条目？")) return;
                KB.del(d.id).then(render);
                return;
              }
              KB.reverseQuery(d.md || "", 5).then(function (rel) {
                openModal("反向查询 · " + (d.title || d.id), rowsHtml(rel), '<button class="btn primary" id="rv2Close">关闭</button>');
                el("rv2Close").onclick = closeModal;
              });
            };
          });
          el("kbdAdd").onclick = function () {
            const t = (el("kbdT") ? el("kbdT").value : "").trim();
            const m = (el("kbdM") ? el("kbdM").value : "").trim();
            if (!t && !m) return toast("请填写标题或存疑内容");
            KB.markDoubt(t || "未命名存疑", m, { from: "kb_doubt" }).then(function (e) {
              return KB.reverseQuery(m || t, 5).then(function (rel) {
                openModal("已保存 · 反向查询结果", '<div class="hint">「' + escT(e.title) + '」已存入知识库，以下为最相关条目：</div>' + rowsHtml(rel),
                  '<button class="btn primary" id="kbdOk">关闭</button>');
                el("kbdOk").onclick = function () { closeModal(); render(); };
              });
            }).catch(function (er) { toast("保存失败：" + er.message); });
          };
        });
      };
      render();
    }
    window.__EXT_ACTS__.kbFuzzy = openKbFuzzy;
    window.__EXT_ACTS__.kbPrompt = openKbPrompt;
    window.__EXT_ACTS__.kbMemory = openKbMemory;
    window.__EXT_ACTS__.kbDoubt = openKbDoubt;
  })();

  // ---------- 启动 ----------
  window.APP = { showAllParams, edit: openEdit, shareBuilding,   /* v2.4.3 修复：气泡「分享」按钮 onclick=\"APP.shareBuilding()\" 长期未导出 → 点击即 script error */ del, openPhoto, viewPhotos: openPhotoCycle, navigate, nearCenter, close: closeModal, back,
    openCheckin, openCheckinList, receivePhoto, receiveSheet, receiveDone, receiveError, receiveCancel, onExportResult };
  // v2.4.3：暴露 ai.js 依赖的全局 helper（三端一致），否则 AI 菜单 openModal is not defined → script error
  window.el = el;
  window.__getRecords = function () { return records; };  // v2.4.3：journal.js 绑定建筑物/设备列表用
  window.__APP_VER__ = APP_VER;   // v2.4.3：upgrade.js 版本兼容检查的唯一版本来源
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.toast = toast;
  window.esc = esc;
  window.busy = busy;
  // v2.4.2 启动完整性检查（智能同步优化）：古建端关键函数/引擎检测
  (function initIntegrityCheck() {
    const required = [
      ["openOrgManager", typeof openOrgManager === "function", "机构（城市）层级管理"],
      ["openBtypeManager", typeof openBtypeManager === "function", "古建类型管理"],
      ["openQuickFavSettings", typeof openQuickFavSettings === "function", "快捷常用设置"],
      ["openFilter", typeof openFilter === "function", "筛选菜单"],
      ["openNearby", typeof openNearby === "function", "周边搜索"],
      ["matchCityScope", typeof matchCityScope === "function", "ZIP 三级匹配（城市）"],
      ["doExportPhotos", typeof doExportPhotos === "function", "导出照片"],
      ["openCheckin", typeof openCheckin === "function", "拍照打卡（公共受众）"],
      ["KF", !!window.KB && typeof window.KB.retrieve === "function", "知识库引擎"],
      ["AI", !!window.AI && typeof window.AI.openQuery === "function", "AI 引擎（可联网）"]
    ];
    const missing = required.filter((x) => !x[1]).map((x) => x[0]);
    window.__integrity = { missing, ok: !missing.length, ts: Date.now() };
    if (missing.length) console.warn("[integrity] missing:", missing.map((n) => required.find((r) => r[0] === n)[2]).join("\u3001"));
  })();
  initMap();
  bindUI();
  loadUI();
  load().then(() => {
    addBasemap();
    updateLayerBtn();
    render();
    initKB();
    renderCheckinMarkers();
    if (lastCenter) map.setView([lastCenter.lat, lastCenter.lng], lastCenter.zoom);
    else fitToShown();
  }).catch((e) => toast("加载失败：" + e.message));
  if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
    navigator.serviceWorker.register("sw.js").catch(() => {});

  // ---------- v2.4.3 天地图密钥管理（#9：隐藏当前密钥 + 复制需密码 3305）----------
  function openTiandituKeySettings() {
    const cur = (() => { try { return JSON.parse(localStorage.getItem("appsettings_key_v1") || "{}"); } catch (e) { return {}; } })();
    const html = `<div class="hint">天地图密钥可能过期。本页可重置浏览器端与服务端 token；保存后<b>立即生效</b>（无需刷新页面）。默认 token 用于开箱即用，重设后写到 localStorage appsettings_key_v1，原 __CONFIG__ 配置不再被读取。</div>
      <div class="field"><label>浏览器端 TIANDITU_TOKEN（前端在线底图加载）</label><input id="tdtClient" class="inp" value="" placeholder="留空则保持当前密钥 · 32位 16 进制字符串"></div>
      <div class="field"><label>服务端 TIANDITU_SERVER_TOKEN（瓦片下载脚本）</label><input id="tdtServer" class="inp" value="" placeholder="留空则保持当前密钥 · 32位 16 进制字符串"></div>
      <div class="field"><label>当前生效的 token（已隐藏，防窃取）</label><input class="inp" readonly value="客户端：••••••••••••••••    服务端：••••••••••••••••"></div>
      <div class="field"><label>复制当前密钥（需验证访问密码）</label><input id="tdtPwd" type="password" class="inp" placeholder="输入访问密码" autocomplete="off"></div>
      <div class="hint">密钥不再明文展示；点「复制当前密钥」并在上方输入正确密码后才可复制。恢复默认：点「恢复默认」回到内置 token；点「清空保存」清空 localStorage（恢复用 __CONFIG__ 注入）。</div>`;
    openModal("天地图密钥管理", html, `<button class="btn ghost" id="tdtReset">恢复默认</button><button class="btn ghost" id="tdtClear">清空保存</button><button class="btn ghost" id="tdtCopy">复制当前密钥</button><button class="btn ghost" id="tdtCancel">取消</button><button class="btn primary" id="tdtSave">💾 保存并立即生效</button>`);
    el("tdtCancel").onclick = closeModal;
    el("tdtReset").onclick = () => {
      el("tdtClient").value = TIANDITU_DEFAULT; el("tdtServer").value = TIANDITU_SERVER_DEFAULT;
      toast("已恢复为内置默认 token");
    };
    el("tdtClear").onclick = () => {
      try { localStorage.removeItem("appsettings_key_v1"); } catch (e) {}
      TIANDITU = (window.__CONFIG__ && window.__CONFIG__.TIANDITU_TOKEN) || TIANDITU_DEFAULT;
      TIANDITU_SERVER = (window.__CONFIG__ && window.__CONFIG__.TIANDITU_SERVER_TOKEN) || TIANDITU_SERVER_DEFAULT;
      try { refreshBasemap(); } catch (e) {}
      toast("已清空 localStorage，使用 __CONFIG__ 或内置 token；底图刷新中…");
      closeModal();
    };
    el("tdtSave").onclick = () => {
      const c = (el("tdtClient").value || "").trim();
      const s = (el("tdtServer").value || "").trim();
      if (c && !/^[0-9a-fA-F]{16,}$/.test(c)) return toast("客户端 token 格式不对（应为 16 进制字符串）");
      if (s && !/^[0-9a-fA-F]{16,}$/.test(s)) return toast("服务端 token 格式不对（应为 16 进制字符串）");
      const cfg = { TIANDITU_TOKEN: c || TIANDITU_DEFAULT, TIANDITU_SERVER_TOKEN: s || TIANDITU_SERVER_DEFAULT };
      try { localStorage.setItem("appsettings_key_v1", JSON.stringify(cfg)); } catch (e) {}
      TIANDITU = cfg.TIANDITU_TOKEN; TIANDITU_SERVER = cfg.TIANDITU_SERVER_TOKEN;
      try { refreshBasemap(); } catch (e) {}
      toast("已保存并生效。底图无需刷新。" + (basemapOn ? "" : "（开启底图后生效）"));
      closeModal();
    };
    el("tdtCopy").onclick = () => {
      const pwd = (el("tdtPwd") || {}).value || "";
      if (pwd !== "3305") { toast("访问密码错误，无法复制密钥"); return; }
      const txt = "TIANDITU_TOKEN=" + (TIANDITU || "") + "\nTIANDITU_SERVER_TOKEN=" + (TIANDITU_SERVER || "");
      try { if (navigator.clipboard) navigator.clipboard.writeText(txt); } catch (e) {}
      toast("已复制当前密钥到剪贴板");
    };
  }
})();
