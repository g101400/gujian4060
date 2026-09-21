  /* ============ 奥维 ovobj / obj 坐标文件 导入导出 ============
     v3.30.2 新增：菜单「传输与共享」支持导入/导出奥维坐标文件。
     - ovobj：奥维私有二进制对象格式（魔数 "OviO"）。本解析器从二进制中
       提取每个对象的 (名称 + 经纬度)，转为建筑标记。
     - obj：奥维 txt/csv 坐标文本（每行 `名称,经度,纬度[,海拔]` 或空格分隔），
       纯文本，100% 可靠。 */

  // ---- ovobj 二进制解析：ArrayBuffer -> [{name,lat,lon}] ----

  // ============ 老 WebKit/WebView 兼容：TextDecoder/TextEncoder polyfill ============
  // UOS WebKitGTK / 旧安卓 WebView 可能没有 TextDecoder/TextEncoder（ES2018+ API），
  // 缺失时手写 UTF-8 编解码，保证 ovobj 名称解析不依赖新 API。
  function fromCp(cp) {
    if (cp < 0x10000) return String.fromCharCode(cp);
    cp -= 0x10000;
    return String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF));
  }
  function utf8Decode(u8) {
    var out = [], i = 0, n = u8.length;
    while (i < n) {
      var b = u8[i++];
      if (b < 0x80) out.push(String.fromCharCode(b));
      else if (b < 0xE0 && i < n) out.push(String.fromCharCode(((b & 0x1F) << 6) | (u8[i++] & 0x3F)));
      else if (b < 0xF0 && i + 1 < n) out.push(String.fromCharCode(((b & 0x0F) << 12) | ((u8[i++] & 0x3F) << 6) | (u8[i++] & 0x3F)));
      else if (i + 2 < n) {
        var cp = ((b & 0x07) << 18) | ((u8[i++] & 0x3F) << 12) | ((u8[i++] & 0x3F) << 6) | (u8[i++] & 0x3F);
        out.push(fromCp(cp));
      }
    }
    return out.join("");
  }
  function utf8Encode(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
      else if (c < 0xD800 || c >= 0xE000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
      else {
        var c2 = s.charCodeAt(++i);
        var cp = 0x10000 + (((c & 0x3FF) << 10) | (c2 & 0x3FF));
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
      }
    }
    return new Uint8Array(out);
  }
  if (typeof window.TextDecoder === "undefined") {
    window.TextDecoder = function () { this.decode = function (u8) { return utf8Decode(u8); }; };
  }
  if (typeof window.TextEncoder === "undefined") {
    window.TextEncoder = function () { this.encode = function (s) { return utf8Encode(s); }; };
  }
  // 老 WebView 兼容：Array.prototype.find/findIndex（ovobj_bridge 在 app.js 之前加载，需自带兜底）
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

  function parseOvobj(buf) {
    var dv = new DataView(buf);
    var bytes = new Uint8Array(buf);
    var n = bytes.length;
    if (n < 16 || !(bytes[0] === 0x4f && bytes[1] === 0x76 && bytes[2] === 0x69 && bytes[3] === 0x4f)) {
      throw new Error("不是有效的 ovobj 文件（缺少 OviO 魔数）");
    }
    // 1) 找所有合理经纬度 double 对（中国区范围，放宽以提高召回）
    var coords = [];
    for (var off = 0; off + 15 < n; off += 1) {
      var lat = dv.getFloat64(off, true);
      var lon = dv.getFloat64(off + 8, true);
      if (lat > 3 && lat < 54 && lon > 73 && lon < 136) coords.push([off, lat, lon]);
    }
    // 去重：同一对象坐标可能被不同起点重复命中（前有 00 填充），间隔 < 32 字节的跳过
    var uniq = []; var last = -100;
    coords.forEach(function (c) { if (c[0] - last >= 32) { uniq.push(c); last = c[0]; } });

    function utf8LenOk(s) {
      for (var i = 0; i < s.length; i++) {
        var cp = s.charCodeAt(i);
        if (!((cp >= 0x4e00 && cp <= 0x9fff) || cp === 0x3001 || cp === 0xff0c ||
              (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) ||
              (cp >= 0x30 && cp <= 0x39) || cp === 0x3001 || cp === 0xff08 || cp === 0xff09 ||
              cp === 0x002d || cp === 0x002f)) return false;
      }
      return true;
    }
    // 2) 对每个坐标：名称可能在其【之后】（坐标后 00 填充 + 1字节长度 + UTF8名称）
    //    也兼容【之前】（名称 UTF8 + 00 + 长度字段），两种布局都尝试。
    var out = [];
    uniq.forEach(function (c) {
      var co = c[0], lat = c[1], lon = c[2], name = null;
      // A) 名称在坐标后
      var i = co + 16; // 跳过 lat(8)+lon(8)
      while (i < Math.min(co + 64, n)) {
        // 跳过 00 填充（4字节对齐）
        if (bytes[i] === 0 && bytes[i + 1] === 0 && bytes[i + 2] === 0 && bytes[i + 3] === 0) { i += 4; continue; }
        var L = bytes[i];
        if (L >= 2 && L <= 60) {
          var bs = bytes.subarray(i + 1, i + 1 + L);
          try {
            var s = new TextDecoder("utf-8").decode(bs);
            if (s.length >= 2 && utf8LenOk(s)) { name = s; break; }
          } catch (e) {}
        }
        i += 1;
      }
      // B) 名称在坐标前：向前找最近的「单字节长度 + 合法UTF8」
      if (!name) {
        var j = co - 1;
        while (j > Math.max(0, co - 400)) {
          var L2 = bytes[j];
          if (L2 >= 2 && L2 <= 60) {
            var bs2 = bytes.subarray(j + 1, j + 1 + L2);
            try {
              var s2 = new TextDecoder("utf-8").decode(bs2);
              if (s2.length >= 2 && utf8LenOk(s2)) { name = s2; break; }
            } catch (e) {}
          }
          j -= 1;
        }
      }
      out.push({ name: name || ("坐标点_" + (out.length + 1)), lat: lat, lon: lon });
    });
    return out;
  }

  // ---- ovobj 二进制生成（实验性）：[{name,lat,lon}] -> ArrayBuffer ----
  // 策略：以样本对象为模板逐对象克隆，仅替换 名称UTF8 + 长度字节 + LAT + LON，
  // 其余奥维私有字段原样保留，最大化真机兼容概率。
  // 注：奥维对象有多种 schema，本实现按"坐标后名称"模板生成；真机导入兼容性待验证。
  var __OVOBJ_TEMPLATE = null; // 由 importOvobj 首次解析时缓存
  function buildOvobj(list) {
    if (!__OVOBJ_TEMPLATE) throw new Error("无 ovobj 模板（请先导入一次 ovobj 以缓存结构）");
    var tpl = __OVOBJ_TEMPLATE;
    // 头部：OviO + 8字节保留 + int32 对象数 + int32 总大小占位
    var head = new Uint8Array(0x18);
    head.set([0x4f, 0x76, 0x69, 0x4f], 0);
    var objs = [];
    list.forEach(function (p) {
      var nameBytes = new TextEncoder().encode(p.name || "点");
      var o = new Uint8Array(tpl.length);
      o.set(tpl, 0);
      // 模板里替换：找到 LAT/LON double 与名称长度字节+UTF8
      // 由于模板是坐标后名称布局，直接在模板基础上 patch：
      // 1) LAT/LON（模板中已知偏移由 import 缓存）
      writeLeDouble(o, tpl._latOff, p.lat);
      writeLeDouble(o, tpl._lonOff, p.lon);
      // 2) 名称长度字节 + UTF8
      o[tpl._nameLenOff] = nameBytes.length;
      o.set(nameBytes, tpl._nameOff);
      // 若名称长度变化，需整体重排——此处仅支持等长或更短（长名截断风险，已标注实验性）
      objs.push({ buf: o, nameLen: nameBytes.length });
    });
    // 简单拼接（等长模板，长度不变时有效）
    var total = head.length + objs.reduce(function (a, x) { return a + x.buf.length; }, 0);
    var out = new Uint8Array(total);
    out.set(head, 0);
    var p = head.length;
    objs.forEach(function (x) { out.set(x.buf, p); p += x.buf.length; });
    // 写对象数(0x10) 与 总大小(0x14)
    var dv = new DataView(out.buffer);
    dv.setInt32(0x10, list.length, true);
    dv.setInt32(0x14, total, true);
    return out.buffer;
  }
  function writeLeDouble(u8, off, v) {
    if (off == null || off < 0) return;
    var dv = new DataView(u8.buffer);
    dv.setFloat64(off, v, true);
  }

  // ---- obj/txt 坐标文本解析：text -> [{name,lat,lon,alt}] ----
  function parseObjText(text) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); })
      .filter(function (l) { return l && !/^[#；;]/.test(l); });
    var out = [];
    lines.forEach(function (line, idx) {
      // 支持分隔符：逗号 / 制表 / 空格（多空格）
      var parts = line.split(/[,，\t]+|\s{1,}/).filter(function (x) { return x.length; });
      if (parts.length < 3) return; // 至少 名称,经度,纬度
      var name = parts[0];
      var lon = parseFloat(parts[1]), lat = parseFloat(parts[2]);
      if (!isFinite(lat) || !isFinite(lon)) return;
      // 兼容「名称 纬度 经度」或「名称 经度 纬度」：奥维txt默认 经度,纬度（GCJ/WM）
      // 若第一个数是纬度范围(3~54)则交换（容错）
      if (lat > 73 || lat < 3) { var t = lat; lat = lon; lon = t; }
      var alt = parts.length >= 4 ? parseFloat(parts[3]) : null;
      out.push({ name: name, lat: lat, lon: lon, alt: alt });
    });
    return out;
  }
  // ---- obj/txt 坐标文本生成：[{name,lat,lon,alt}] -> text ----
  function buildObjText(list) {
    var lines = ["名称,经度,纬度,海拔"];
    list.forEach(function (p) {
      var alt = (p.alt != null && isFinite(p.alt)) ? p.alt : 0;
      lines.push([p.name || "", fmt6(p.lon), fmt6(p.lat), alt].join(","));
    });
    return lines.join("\r\n");
  }
  function fmt6(v) { return (Math.round(v * 1e6) / 1e6).toString(); }

  // ---- 通用：把解析出的坐标点转成建筑并合并 ----
  function mergeCoordPoints(points, srcLabel) {
    if (!points.length) {
      ask("导入结束", "未从「" + srcLabel + "」中解析出任何坐标点。", [{ t: "知道了", cls: "btn-confirm2", v: 1 }]);
      return;
    }
    busy("正在写入数据，请稍后…"); busyDetail("请勿退出");
    setTimeout(function () {
      var added = 0, upd = 0, noGeo = 0;
      points.forEach(function (p) {
        if (p.lat == null || p.lon == null || !isFinite(p.lat) || !isFinite(p.lon)) { noGeo++; return; }
        var ex = BUILDINGS.find(function (x) {
          return x.name === p.name && x.lat != null && Math.abs(x.lat - p.lat) < 1e-4 && Math.abs(x.lon - p.lon) < 1e-4;
        });
        if (ex) { ex.lat = p.lat; ex.lon = p.lon; upd++; }
        else {
          BUILDINGS.push({
            id: "imp" + Date.now() + "_" + added, name: p.name, office: "", station: "",
            chan: "", btype: "奥维坐标", path: "", attrs: [], photos: [], geom: "Point",
            lat: p.lat, lon: p.lon
          });
          added++;
        }
      });
      save(); render(); buildLegend(); idle();
      ask("导入完成", "来源：" + srcLabel + "\n\n新增坐标点：" + added + " 个\n更新坐标点：" + upd + " 个" +
        (noGeo ? "\n\n注意：" + noGeo + " 个点无有效坐标" : ""), [{ t: "知道了", cls: "btn-confirm2", v: 1 }]);
      toast("导入完成：新增 " + added + "，更新 " + upd);
    }, 40);
  }

  // ---- 导入 ovobj（安卓：readFileBase64 / pickFolder；非安卓：file input） ----
  // 关键修复（v3.31 #280 / 用户问题①）：点击菜单先弹「方式选择」对话框，明确告知 ovobj 是什么、
  // 应选中哪类文件；并新增「选择文件夹批量导入」，仿照 ovkmz 的文件夹+文件选择体验。
  function importOvobj() {
    try {
      if (window.Android && typeof window.Android.pickFolder === "function" && typeof window.Android.readFileBase64 === "function") {
        ask("导入 ovobj（奥维坐标）",
          "ovobj 是奥维互动地图导出的「对象」坐标文件（含名称 + 经纬度）。<br>请选择导入方式：",
          [
            { t: "① 选择单个文件", cls: "btn-confirm2", v: "file" },
            { t: "② 选择文件夹（批量导入其中全部 .ovobj）", cls: "btn-confirm2", v: "folder" },
            { t: "取消", cls: "btn-cancel", v: 0 }
          ],
          function (v) {
            if (v === "file") importOvobjFile();
            else if (v === "folder") { window.__ovobjFolderImport = true; window.Android.pickFolder(".ovobj"); }
          });
        return;
      }
      if (window.Android && typeof window.Android.pickFiles === "function" && typeof window.Android.readFileBase64 === "function") {
        importOvobjFile(); return;
      }
      legacyImportOvobj();
    } catch (e) {
      try { toast("导入 ovobj 出错：" + (e && (e.stack || e.message || e))); } catch (e2) {}
    }
  }
  // 单个文件：经原生选择器选 .ovobj，回传后由 onPickFiles 路由到 importOvobjFromPath
  function importOvobjFile() {
    try {
      window.__ovobjImport = true;
      $("toast").textContent = "请选择 .ovobj 文件（奥维对象坐标）…"; $("toast").classList.add("show");
      window.Android.pickFiles("*/*");
    } catch (e) {
      try { toast("导入 ovobj 出错：" + (e && (e.stack || e.message || e))); } catch (e2) {}
    }
  }
  // 文件夹批量：原生 pickFolder 返回该文件夹（递归）内全部 .ovobj，逐个解析后合并
  function importOvobjFolder(list) {
    var files = (list || []).filter(function (f) { return /\.ovobj$/i.test(f.name); });
    if (!files.length) { toast("该文件夹内未找到 .ovobj 文件"); return; }
    busy("正在批量导入 " + files.length + " 个 ovobj 文件…"); busyDetail("请勿退出");
    setTimeout(function () {
      var all = [], err = 0;
      files.forEach(function (f) {
        try {
          var b64 = window.Android.readFileBase64(f.path);
          var bytes = b64ToBytes(b64);
          var buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          var pts = parseOvobj(buf);
          cacheOvobjTemplate(bytes);
          all = all.concat(pts);
        } catch (e) { err++; }
      });
      mergeCoordPoints(all, files.length + " 个 ovobj" + (err ? "（" + err + " 个解析失败）" : ""));
    }, 40);
  }
  function legacyImportOvobj() {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".ovobj";
    inp.onchange = function () {
      var f = this.files[0]; if (!f) return;
      busy("正在导入 " + f.name + "，请稍后…");
      var r = new FileReader();
      r.onload = function () {
        try {
          var pts = parseOvobj(r.result);
          cacheOvobjTemplate(new Uint8Array(r.result)); // 缓存模板供导出
          mergeCoordPoints(pts, f.name);
        } catch (e) { idle(); toast("导入失败：" + e.message); }
      };
      r.onerror = function () { idle(); toast("读取文件失败"); };
      r.readAsArrayBuffer(f);
    };
    inp.click();
  }
  // 从已解析的 ArrayBuffer 缓存模板（定位 LAT/LON/名称偏移）
  function cacheOvobjTemplate(bytes) {
    try {
      var dv = new DataView(bytes.buffer || bytes);
      var n = bytes.length;
      // 找第一个合理坐标对作为模板锚
      for (var off = 0; off + 15 < n; off++) {
        var lat = dv.getFloat64(off, true), lon = dv.getFloat64(off + 8, true);
        if (lat > 3 && lat < 54 && lon > 73 && lon < 136) {
          // 名称在后
          var i = off + 16, nameLenOff = -1, nameOff = -1;
          while (i < Math.min(off + 64, n)) {
            if (bytes[i] === 0 && bytes[i + 1] === 0 && bytes[i + 2] === 0 && bytes[i + 3] === 0) { i += 4; continue; }
            var L = bytes[i];
            if (L >= 2 && L <= 60) { nameLenOff = i; nameOff = i + 1; break; }
            i += 1;
          }
          __OVOBJ_TEMPLATE = {
            buf: bytes.slice(off, off + 300 > n ? n : off + 300), // 取坐标起的300字节作模板（含名称后结构）
            _latOff: 0, _lonOff: 8, _nameLenOff: nameLenOff - off, _nameOff: nameOff - off
          };
          return;
        }
      }
    } catch (e) {}
  }
  // 安卓端 base64 解码辅助
  function b64ToBytes(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  // 安卓端：经 onPickFiles 路由后调用
  function importOvobjFromPath(path) {
    try {
      var b64 = window.Android.readFileBase64(path);
      var bytes = b64ToBytes(b64);
      var buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      var pts = parseOvobj(buf);
      cacheOvobjTemplate(bytes);
      mergeCoordPoints(pts, path.split("/").pop());
    } catch (e) { idle(); toast("导入失败：" + e.message); }
  }
  // 安卓端：readFileBase64 的 ArrayBuffer 构造
  function parseOvobjFromBase64(b64) {
    var bytes = b64ToBytes(b64);
    var buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return parseOvobj(buf);
  }

  // ---- 导出 ovobj（实验性） ----
  function exportOvobj() {
    if (!BUILDINGS.length) { toast("没有可导出的数据"); return; }
    pickExportScope("ovobj", function (list) {
      if (!__OVOBJ_TEMPLATE) {
        ask("需先导入模板", "导出 ovobj 需先导入一次 ovobj 文件以缓存其结构（实验性功能，真机兼容待验证）。<br>建议改用「导出 obj 坐标（文本）」，100% 可靠。",
          [{ t: "改用 obj 导出", cls: "btn-confirm2", v: "obj" }, { t: "取消", cls: "btn-cancel", v: 0 }],
          function (v) { if (v === "obj") exportObj(); });
        return;
      }
      var pts = list.map(function (b) { return { name: b.name, lat: b.lat, lon: b.lon }; });
      try {
        var buf = buildOvobj(pts);
        var blob = new Blob([buf], { type: "application/octet-stream" });
        var fname = APPNAME + "_" + getTodayStr() + ".ovobj";
        saveBlobOrDownload(blob, fname);
        toast("已导出 ovobj（实验性）：" + fname);
      } catch (e) { toast("导出失败：" + e.message); }
    });
  }

  // ---- 导入 obj 坐标文本 ----
  function importObj() {
    try {
      if (window.Android && typeof window.Android.pickFolder === "function" && typeof window.Android.readFileBase64 === "function") {
        ask("导入 obj 坐标（文本）",
          "obj 是坐标文本文件（每行：名称,经度,纬度[,海拔]，支持 .obj / .txt / .csv）。<br>请选择导入方式：",
          [
            { t: "① 选择单个文件", cls: "btn-confirm2", v: "file" },
            { t: "② 选择文件夹（批量导入其中全部坐标文件）", cls: "btn-confirm2", v: "folder" },
            { t: "取消", cls: "btn-cancel", v: 0 }
          ],
          function (v) {
            if (v === "file") importObjFile();
            else if (v === "folder") { window.__objFolderImport = true; window.Android.pickFolder(".obj,.txt,.csv"); }
          });
        return;
      }
      if (window.Android && typeof window.Android.pickFiles === "function" && typeof window.Android.readFileBase64 === "function") {
        importObjFile(); return;
      }
      legacyImportObj();
    } catch (e) {
      try { toast("导入 obj 出错：" + (e && (e.stack || e.message || e))); } catch (e2) {}
    }
  }
  function importObjFile() {
    try {
      window.__objImport = true;
      $("toast").textContent = "请选择 obj / txt / csv 坐标文件…"; $("toast").classList.add("show");
      window.Android.pickFiles("*/*");
    } catch (e) {
      try { toast("导入 obj 出错：" + (e && (e.stack || e.message || e))); } catch (e2) {}
    }
  }
  function importObjFolder(list) {
    var files = (list || []).filter(function (f) { return /\.(obj|txt|csv)$/i.test(f.name); });
    if (!files.length) { toast("该文件夹内未找到 obj / txt / csv 坐标文件"); return; }
    busy("正在批量导入 " + files.length + " 个坐标文件…"); busyDetail("请勿退出");
    setTimeout(function () {
      var all = [], err = 0;
      files.forEach(function (f) {
        try {
          var b64 = window.Android.readFileBase64(f.path);
          var bytes = b64ToBytes(b64);
          var text = "";
          try { text = new TextDecoder("utf-8").decode(bytes); } catch (e) { text = atob(b64); }
          all = all.concat(parseObjText(text));
        } catch (e) { err++; }
      });
      mergeCoordPoints(all, files.length + " 个坐标文件" + (err ? "（" + err + " 个解析失败）" : ""));
    }, 40);
  }
  function legacyImportObj() {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".obj,.txt,.csv";
    inp.onchange = function () {
      var f = this.files[0]; if (!f) return;
      busy("正在导入 " + f.name + "，请稍后…");
      var r = new FileReader();
      r.onload = function () {
        try { mergeCoordPoints(parseObjText(String(r.result || "")), f.name); }
        catch (e) { idle(); toast("导入失败：" + e.message); }
      };
      r.onerror = function () { idle(); toast("读取文件失败"); };
      r.readAsText(f);
    };
    inp.click();
  }
  function importObjFromPath(path) {
    try {
      var b64 = window.Android.readFileBase64(path);
      var bin = atob(b64);
      var text = "";
      // 尝试 UTF-8 解码
      try {
        var bytes = b64ToBytes(b64);
        text = new TextDecoder("utf-8").decode(bytes);
      } catch (e) { text = bin; }
      mergeCoordPoints(parseObjText(text), path.split("/").pop());
    } catch (e) { idle(); toast("导入失败：" + e.message); }
  }

  // ---- 导出 obj 坐标文本 ----
  function exportObj() {
    if (!BUILDINGS.length) { toast("没有可导出的数据"); return; }
    pickExportScope("obj", function (list) {
      busy("正在生成坐标文本…");
      setTimeout(function () {
        var pts = list.map(function (b) { return { name: b.name, lat: b.lat, lon: b.lon, alt: (b.alt != null ? b.alt : 0) }; });
        var text = buildObjText(pts);
        idle();
        var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        var fname = APPNAME + "_" + getTodayStr() + ".obj";
        saveBlobOrDownload(blob, fname);
        toast("已导出 obj 坐标：" + fname);
      }, 20);
    });
  }
  // 安卓：saveBlob(base64, name)；非安卓：blob 下载
  function saveBlobOrDownload(blob, fname) {
    if (window.Android && typeof window.Android.saveBlob === "function") {
      var r = new FileReader();
      r.onload = function () { window.Android.saveBlob(r.result, fname); };
      r.readAsDataURL(blob);
    } else {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = fname;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
  }

