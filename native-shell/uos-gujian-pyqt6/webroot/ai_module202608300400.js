/* =============================================================================
 * ai_module.js — 通用「智能AI设置 + 智能AI助手」模块（三端四平台共享，参数化）
 *
 * 设计目标：
 *   1. 一份代码，九处加载（三产品 × Android/Win/UOS/iOS webroot），通过 AIModule.init(cfg) 适配场景。
 *   2. 复用宿主 app.js 的 .sheet / .sheet-head / .sheet-body / .btn-* 样式，风格与三端一致。
 *   3. 不依赖宿主私有变量（$/toast/save 等均在 IIFE 内），自带最小工具集，老 WebView 亦可用。
 *
 * 接入方式（在宿主 app.js 中）：
 *   (1) index.html 在 <script src="app.js"> 之前引入本文件：
 *         <script src="ai_module.js"></script>
 *   (2) 启动处调用 AIModule.init(cfg)，并在 buildMenu() 内注入：
 *         if (window.AIModule && AIModule.getMenuGroups)
 *           AIModule.getMenuGroups().forEach(function(g){ groups.push(g); });
 *
 * cfg = {
 *   domain: "gujian"|"shuili"|"perc",      // 命名空间隔离（localStorage key 前缀）
 *   appName: "古建景点打卡",
 *   allowOnlineQuery: true | false,        // 古建=true（联网查公开文物）；水利/感知=false（内部资料不编造）
 *   fieldSchema: ["intro","features",...], // 智能更新可改写的字段白名单
 *   getRecord: function(id){ return rec|null; },
 *   searchRecords: function(q){ return [...]; },   // 按名称/城市筛选，用于选择目标
 *   listAll: function(){ return [...]; },          // 本地上下文/纠错清单
 *   applyUpdate: function(rec, patch){ 合并 patch 并 save()+render() }
 * }
 * ========================================================================== */
(function (global) {
  "use strict";

  /* ---------- 自包含基础工具（宿主 $/esc/toast 非全局，这里自备）---------- */
  function q(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(msg) {
    var t = q("toast");
    if (t) { t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2000); }
  }
  function openGen(title, html) {
    var gt = q("genTitle"), gb = q("genBody");
    if (!gt || !gb) { toast("UI 未就绪"); return; }
    gt.textContent = title; gb.innerHTML = html;
    if (global.openSheet) global.openSheet("sheetGen");
  }
  function bindData(attr, fn) {
    var gb = q("genBody"); if (!gb) return;
    gb.querySelectorAll("[" + attr + "]").forEach(function (el) { el.onclick = function () { fn(el.getAttribute(attr), el); }; });
  }
  function busy(on) {
    var el = q("busyOverlay");
    if (!el) {
      el = document.createElement("div"); el.id = "busyOverlay";
      el.innerHTML = '<div class="busy-box"><div class="busy-spin"></div><div class="busy-msg">请稍后…</div></div>';
      (q("app") || document.body).appendChild(el);
    }
    el.classList.toggle("show", !!on);
  }

  /* ---------- 存储（按 domain 命名空间隔离）---------- */
  function kModels(d) { return "ai_models_" + d; }
  function kDef(d) { return "ai_default_" + d; }
  function kStrat(d) { return "ai_strategy_" + d; }
  function kCorr(d) { return "ai_corrections_" + d; }
  function load(key, def) { try { var s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch (e) { return def; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; } }

  var OR_BASE = "https://openrouter.ai/api/v1";
  // v3.35：内置三个 OpenRouter 免费模型预设（均兼容 OpenAI，key 由 ai_seed.js 或用户在设置中填写）
  function defaults() {
    return [
      { id: "minimax-m27-free", name: "MiniMax M2.7 (免费)", baseUrl: OR_BASE, protocol: "openai", modelId: "minimax/minimax-m2.7:free", apiKey: "", local: false },
      { id: "glm-52-free", name: "GLM 5.2 (免费·Z.ai)", baseUrl: OR_BASE, protocol: "openai", modelId: "z-ai/glm-5.2:free", apiKey: "", local: false },
      { id: "nemotron-nano-free", name: "Nemotron 3 Nano Omni (免费·NVIDIA)", baseUrl: OR_BASE, protocol: "openai", modelId: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", apiKey: "", local: false }
    ];
  }

  var CFG = null;
  var RR_INDEX = 0;
  var pendingRecId = null;   // 智能更新/纠错当前选中的记录
  var pendingPatch = null;   // 智能更新待应用补丁

  /* ============================ 初始化 ============================ */
  function init(cfg0) {
    if (!cfg0 || !cfg0.domain) { if (global.console) console.warn("AIModule.init 缺少 domain"); return; }
    CFG = cfg0;
    if (CFG.allowOnlineQuery == null) CFG.allowOnlineQuery = true;
    if (!CFG.fieldSchema || !CFG.fieldSchema.length) CFG.fieldSchema = ["intro", "features"];
    if (!localStorage.getItem(kModels(CFG.domain))) save(kModels(CFG.domain), defaults());
    if (!localStorage.getItem(kDef(CFG.domain))) save(kDef(CFG.domain), "minimax-m27-free");
    if (!localStorage.getItem(kStrat(CFG.domain))) save(kStrat(CFG.domain), { mode: "failover" });
    if (!localStorage.getItem(kKB(CFG.domain))) save(kKB(CFG.domain), { index: [], bodies: {} }); // v3.38：知识库骨架
    applySeed();
    global.AIModule = API;
  }
  // 本地种子：由 ai_seed.js 设置 window.AI_SEED = { apiKey, default?, strategy? }，把密钥/默认填入。
  // 密钥不写进本共享模块源码（避免泄露），仅在本地 webroot 的 ai_seed.js 中提供。
  function applySeed() {
    var s = global.AI_SEED; if (!s || typeof s !== "object") return;
    var models = getModels();
    if (s.apiKey) models.forEach(function (m) { if (!m.apiKey) m.apiKey = s.apiKey; });
    save(kModels(CFG.domain), models);
    if (s.default) save(kDef(CFG.domain), s.default);
    if (s.strategy && s.strategy.mode) save(kStrat(CFG.domain), s.strategy);
  }

  function getModels() { return load(kModels(CFG.domain), defaults()); }
  function getDef() { return load(kDef(CFG.domain), null); }
  function getStrat() { return load(kStrat(CFG.domain), { mode: "manual" }); }

  /* ============================ 模型调用 ============================ */
  // 自动调用策略：manual=仅默认；failover=失败切下一个；roundrobin=多模型轮询
  function resolveOrder() {
    var models = getModels(), def = getDef(), strat = getStrat();
    if (!models.length) return [];
    if (strat.mode === "roundrobin" && models.length > 1) {
      var idx = RR_INDEX % models.length; RR_INDEX++;
      return models.slice(idx).concat(models.slice(0, idx));
    }
    if (strat.mode === "failover") {
      var arr = [], primary = models.find(function (m) { return m.id === def; });
      if (primary) arr.push(primary);
      models.forEach(function (m) { if (m !== primary) arr.push(m); });
      return arr;
    }
    var d = models.find(function (m) { return m.id === def; }) || models[0];
    return d ? [d] : [];
  }

  function toLatin1(s) {
    if (typeof s !== "string") return s == null ? "" : String(s);
    var out = "";
    for (var i = 0; i < s.length; i++) out += s.charCodeAt(i) <= 0xFF ? s[i] : "?";
    return out;
  }

  function chatOne(model, messages) {
    var url = (model.baseUrl || "").replace(/\/+$/, "") + "/chat/completions";
    if (!url) return Promise.reject(new Error("模型「" + model.name + "」引用地址为空"));
    if (typeof fetch !== "function") return Promise.reject(new Error("当前环境不支持 fetch（无法联网）"));
    var body = { model: model.modelId, messages: messages, stream: false };
    if (model.temperature != null) body.temperature = model.temperature;
    // HTTP 头仅允许 ISO-8859-1 字符；appName 含中文会令 fetch 抛 "String contains non ISO-8859-1 code point"
    var ak = toLatin1(model.apiKey || "");
    var headers = { "Content-Type": "application/json", "Authorization": "Bearer " + ak };
    // OpenRouter 推荐头（可选，强制 ASCII）：提升路由排名、避免部分 provider 拒绝匿名请求
    var siteId = (CFG && CFG.domain) ? CFG.domain : "app";
    headers["HTTP-Referer"] = "https://" + siteId + ".local/";
    headers["X-Title"] = "YituMap-" + siteId;
    if (model.extraHeaders) Object.keys(model.extraHeaders).forEach(function (k) { headers[k] = toLatin1(model.extraHeaders[k]); });
    return fetch(url, { method: "POST", headers: headers, body: JSON.stringify(body) })
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) {
          var msg = "HTTP " + r.status;
          if (r.status === 429) msg += "：免费模型上游限流（稍后重试或自动切换下一模型）";
          else if (r.status === 401) msg += "：API Key 无效或未配置";
          if (t) msg += "：" + t.slice(0, 200);
          throw new Error(msg);
        });
        return r.json();
      })
      .then(function (j) {
        var m0 = j && j.choices && j.choices[0] && j.choices[0].message;
        var c = m0 ? (m0.content || "") : "";
        if (!c && m0 && m0.reasoning) c = "（模型仅返回思考过程）" + String(m0.reasoning).slice(0, 200);
        return c;
      });
  }

  function chat(messages) {
    var order = resolveOrder();
    if (!order.length) return Promise.reject(new Error("未配置任何模型，请先到「智能AI设置」添加"));
    var i = 0;
    function attempt() {
      return chatOne(order[i], messages).catch(function (e) {
        if (i < order.length - 1) { i++; toast("模型「" + order[i - 1].name + "」失败，切换：" + order[i].name); return attempt(); }
        throw new Error("全部模型失败：" + e.message);
      });
    }
    return attempt();
  }

  function systemPrompt() {
    if (CFG.allowOnlineQuery) {
      return "你是文物/古建知识助手。用户会提供某处古建的名称与现有资料，并可能要求联网核实公开信息。" +
        "请基于可靠的公开知识作答；如不确定请说明。回答用中文，简明有条理。";
    }
    return "你是「" + (CFG.appName || "本系统") + "」的本地数据辅助助手。" +
      "本系统的建筑物/设备为内部资料，公开大模型没有其准确数据，禁止编造或臆测任何内部参数与坐标。" +
      "你只能基于用户提供的本地记录上下文进行分析、补全缺失字段、指出存疑项，不要声称来自外部网络。" +
      "回答用中文，简明。";
  }

  function buildLocalContext(filter) {
    var recs = CFG.listAll ? CFG.listAll() : [];
    if (filter) recs = recs.filter(function (r) { return (r.name || "").indexOf(filter) >= 0 || (r.city || "").indexOf(filter) >= 0; });
    recs = recs.slice(0, 30);
    return recs.map(function (r) {
      return "- " + (r.name || "?") + "（" + (r.city || "") + (r.type ? "·" + r.type : "") + "）：" + (r.intro || "") + (r.features ? " 特点：" + r.features : "");
    }).join("\n") || "（无本地记录）";
  }

  /* ============================ 菜单注入 ============================ */
  function getMenuGroups() {
    if (!CFG) return [];
    var online = CFG.allowOnlineQuery;
    return [
      { g: "设置", ico: "⚙️", items: [
        { ico: "🤖", t: "智能AI设置", f: function () { if (global.closeSheet) global.closeSheet("sheetMenu"); API._openSettings(); } },
        { ico: "📚", t: "知识库管理", f: function () { if (global.closeSheet) global.closeSheet("sheetMenu"); API._openKB(); } }
      ]},
      { g: online ? "智能AI" : "智能AI（本地辅助）", ico: online ? "✨" : "🔒", items: [
        { ico: "🔍", t: online ? "智能查询（联网）" : "智能问答（本地）", f: function () { if (global.closeSheet) global.closeSheet("sheetMenu"); API._openSmartQuery(); } },
        { ico: "🔄", t: online ? "智能更新（联网补全）" : "智能补全（本地）", f: function () { if (global.closeSheet) global.closeSheet("sheetMenu"); API._openSmartUpdate(); } },
        { ico: "✅", t: online ? "智能纠错（标注差异）" : "存疑标注（复核）", f: function () { if (global.closeSheet) global.closeSheet("sheetMenu"); API._openSmartCorrect(); } }
      ]}
    ];
  }

  /* ============================ 智能AI设置 ============================ */
  function openSettings() {
    var models = getModels(), def = getDef(), strat = getStrat();
    var mlist = models.map(function (m) {
      var tag = m.local ? "🖥️本地" : "☁️云端";
      var isDef = m.id === def;
      return '<div class="bm-row"><div style="flex:1">' +
        '<div style="font-weight:600">' + esc(m.name) + (isDef ? ' <span style="color:#b8862f">★默认</span>' : "") + "</div>" +
        '<div style="font-size:12px;color:#8a7c70">' + tag + " · " + esc(m.protocol) + " · " + esc(m.modelId) + "</div>" +
        '<div style="font-size:11px;color:#aab4be;word-break:break-all">' + esc(m.baseUrl) + "</div></div>" +
        '<button class="tbtn" data-edit="' + esc(m.id) + '">编辑</button> ' +
        '<button class="tbtn" data-del="' + esc(m.id) + '">删除</button> ' +
        '<button class="tbtn" data-test="' + esc(m.id) + '">测连</button></div>';
    }).join("") || '<div class="empty-tip">尚未添加模型</div>';

    var stratLabel = { manual: "仅用默认模型", failover: "失败自动切换下一个", roundrobin: "多模型轮询" }[strat.mode] || strat.mode;

    var html =
      '<p style="font-size:13px;color:#3a2e28;line-height:1.6">管理大模型接入方式。可添加多个模型（含本地部署），设置默认模型与自动调用策略。</p>' +
      '<div style="display:flex;gap:8px;margin:10px 0">' +
        '<button class="btn-save" style="flex:1" id="btnAddModel">＋ 添加模型</button>' +
        '<button class="btn-cancel" style="flex:1" id="btnStrategy">⚙ 调用策略</button></div>' +
      '<h4 style="color:#6b2e2e;margin:12px 0 6px">已配置模型（' + models.length + "）</h4>" +
      '<div id="bmList">' + mlist + "</div>" +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button class="btn-cancel" style="flex:1" id="btnExport">⬇ 导出配置</button>' +
        '<button class="btn-cancel" style="flex:1" id="btnImport">⬆ 导入配置</button></div>' +
      '<div style="margin-top:10px;font-size:12px;color:#8a7c70">当前策略：' + esc(stratLabel) + "</div>";
    openGen("智能AI设置", html);

    q("btnAddModel").onclick = function () { openModelForm(null); };
    q("btnStrategy").onclick = openStrategy;
    q("btnExport").onclick = exportCfg;
    q("btnImport").onclick = importCfg;
    bindData("data-edit", function (id) { var m = getModels().find(function (x) { return x.id === id; }); openModelForm(m); });
    bindData("data-del", function (id) { delModel(id); });
    bindData("data-test", function (id) { testModel(id); });
  }

  function openModelForm(model) {
    var isEdit = !!model;
    var m = model || { id: "", name: "", baseUrl: "https://openrouter.ai/api/v1", protocol: "openai", modelId: "", apiKey: "", local: false };
    var html =
      '<label class="f">模型名称</label><input class="f" id="mName" value="' + esc(m.name) + '" placeholder="如：本地Qwen / OpenRouter-GPT">' +
      '<label class="f">引用地址（API Base）</label><input class="f" id="mUrl" value="' + esc(m.baseUrl) + '" placeholder="https://openrouter.ai/api/v1">' +
      '<label class="f">协议</label><select class="f" id="mProto">' +
        ["openai", "openai-compatible", "anthropic", "custom"].map(function (p) { return '<option' + (p === m.protocol ? " selected" : "") + ">" + p + "</option>"; }).join("") + "</select>" +
      '<label class="f">模型 ID</label><input class="f" id="mId" value="' + esc(m.modelId) + '" placeholder="如 openai/gpt-4o-mini 或本地模型名">' +
      '<label class="f">API Key（本地部署可留空）</label><input class="f" id="mKey" type="password" value="' + esc(m.apiKey) + '" placeholder="Bearer Token，可空">' +
      '<label style="display:flex;align-items:center;gap:8px;margin:12px 0;font-size:14px;color:#3a2e28"><input type="checkbox" id="mLocal"' + (m.local ? " checked" : "") + "> 本地部署模型（不走公网）</label>" +
      '<div class="form-actions">' +
        '<button class="btn-cancel" id="mCancel">取消</button>' +
        '<button class="btn-save" id="mSave">保存</button></div>';
    openGen(isEdit ? "编辑模型" : "添加模型", html);
    q("mCancel").onclick = openSettings;
    q("mSave").onclick = function () { saveModel(isEdit ? m.id : ""); };
  }

  function saveModel(editId) {
    var name = q("mName").value.trim();
    var baseUrl = q("mUrl").value.trim();
    var protocol = q("mProto").value;
    var modelId = q("mId").value.trim();
    var apiKey = q("mKey").value;
    var local = q("mLocal").checked;
    if (!name) { toast("请填模型名称"); return; }
    if (!modelId) { toast("请填模型 ID"); return; }
    var models = getModels();
    if (editId) {
      var m = models.find(function (x) { return x.id === editId; });
      if (m) { m.name = name; m.baseUrl = baseUrl; m.protocol = protocol; m.modelId = modelId; m.apiKey = apiKey; m.local = local; }
    } else {
      models.push({ id: "m_" + Date.now(), name: name, baseUrl: baseUrl, protocol: protocol, modelId: modelId, apiKey: apiKey, local: local });
    }
    save(kModels(CFG.domain), models);
    if (!getDef()) save(kDef(CFG.domain), models[0].id);
    toast("已保存"); openSettings();
  }

  function delModel(id) {
    if (!global.ask) { var models = getModels().filter(function (m) { return m.id !== id; }); commitDel(models, id); return; }
    global.ask("删除模型", "确定删除该模型配置？", [
      { t: "取消", cls: "btn-cancel", v: 0 }, { t: "删除", cls: "btn-confirm2", v: 1 }
    ], function (v) { if (v) { var ms = getModels().filter(function (m) { return m.id !== id; }); commitDel(ms, id); } });
  }
  function commitDel(models, id) {
    save(kModels(CFG.domain), models);
    if (getDef() === id) save(kDef(CFG.domain), models[0] ? models[0].id : null);
    toast("已删除"); openSettings();
  }

  function openStrategy() {
    var strat = getStrat(), models = getModels();
    var opts = ["manual", "failover", "roundrobin"].map(function (mm) {
      var label = { manual: "仅用默认模型", failover: "失败自动切换下一个", roundrobin: "多模型轮询" }[mm];
      return '<div class="bm-row"><label style="flex:1;font-size:14px;color:#3a2e28"><input type="radio" name="strat" value="' + mm + '"' + (strat.mode === mm ? " checked" : "") + "> " + label + "</label></div>";
    }).join("");
    var defOpts = models.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === getDef() ? " selected" : "") + ">" + esc(m.name) + "</option>"; }).join("");
    var html =
      '<p style="font-size:13px;color:#3a2e28;line-height:1.6">自动调用策略：多个模型间如何切换（failover / roundrobin 需≥2 个模型）。</p>' +
      '<h4 style="color:#6b2e2e;margin:12px 0 6px">默认模型</h4>' +
      (models.length ? '<select class="f" id="sDef">' + defOpts + "</select>" : '<div class="empty-tip">请先添加模型</div>') +
      '<h4 style="color:#6b2e2e;margin:14px 0 6px">切换策略</h4>' + opts +
      '<div class="form-actions"><button class="btn-cancel" id="sBack">返回</button>' +
      '<button class="btn-save" id="sSave">保存</button></div>';
    openGen("模型自动调用策略", html);
    q("sBack").onclick = openSettings;
    q("sSave").onclick = saveStrategy;
  }
  function saveStrategy() {
    var checked = q("genBody").querySelector('input[name="strat"]:checked');
    var mode = checked ? checked.value : "manual";
    var def = q("sDef") ? q("sDef").value : getDef();
    save(kStrat(CFG.domain), { mode: mode });
    if (def) save(kDef(CFG.domain), def);
    toast("已保存策略"); openSettings();
  }

  function testModel(id) {
    var m = getModels().find(function (x) { return x.id === id; });
    if (!m) return;
    toast("正在测试连接…"); busy(true);
    chatOne(m, [{ role: "user", content: "ping，只回 pong" }]).then(function (txt) {
      busy(false);
      if (!global.ask) { toast("连接成功：" + txt.slice(0, 40)); return; }
      global.ask("连接测试", "模型「" + m.name + "」返回：<br><pre style='white-space:pre-wrap;font-size:12px'>" + esc(txt.slice(0, 200)) + "</pre>", [
        { t: "确定", cls: "btn-confirm2", v: 1 }
      ], function () {});
    }).catch(function (e) { busy(false); toast("连接失败：" + e.message); });
  }

  function exportCfg() {
    var data = { models: getModels(), default: getDef(), strategy: getStrat() };
    var s = JSON.stringify(data, null, 2);
    var html = '<p style="font-size:13px;color:#3a2e28">配置 JSON（可复制保存，再用「导入配置」恢复）：</p>' +
      '<textarea class="f" id="expText" rows="10" readonly>' + esc(s) + "</textarea>" +
      '<div class="form-actions"><button class="btn-cancel" id="expBack">返回</button>' +
      '<button class="btn-save" id="expCopy">复制</button></div>';
    openGen("导出配置", html);
    q("expBack").onclick = openSettings;
    q("expCopy").onclick = function () { var t = q("expText"); t.select(); try { document.execCommand("copy"); toast("已复制"); } catch (e) { toast("请长按文本框手动复制"); } };
  }
  function importCfg() {
    var html = '<p style="font-size:13px;color:#3a2e28">粘贴导出的配置 JSON，或选择文件：</p>' +
      '<input type="file" id="impFile" accept=".json,application/json">' +
      '<textarea class="f" id="impText" rows="6" placeholder="在此粘贴配置 JSON"></textarea>' +
      '<div class="form-actions"><button class="btn-cancel" id="impBack">取消</button>' +
      '<button class="btn-save" id="impDo">导入</button></div>';
    openGen("导入配置", html);
    q("impBack").onclick = openSettings;
    q("impFile").onchange = function () { var f = this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { q("impText").value = r.result; }; r.readAsText(f); };
    q("impDo").onclick = doImport;
  }
  function doImport() {
    var s = q("impText").value.trim(); if (!s) { toast("请粘贴或选择文件"); return; }
    try {
      var d = JSON.parse(s);
      if (!d.models || !d.models.length) { toast("配置无效：缺少 models"); return; }
      save(kModels(CFG.domain), d.models);
      if (d.default) save(kDef(CFG.domain), d.default);
      if (d.strategy) save(kStrat(CFG.domain), d.strategy);
      toast("导入成功"); openSettings();
    } catch (e) { toast("JSON 解析失败：" + e.message); }
  }

  /* ============================ 智能查询 ============================ */
  function openSmartQuery() {
    var hint = CFG.allowOnlineQuery
      ? "联网查询古建公开资料（名称/历史/特点）。大模型基于公开知识作答。"
      : "本系统为内部资料，无公开数据。以下仅基于本地记录做辅助问答，不会编造外部参数。";
    var html =
      '<p style="font-size:13px;color:#3a2e28;line-height:1.6">' + esc(hint) + "</p>" +
      '<label class="f">查询内容</label><textarea class="f" id="qInput" rows="3" placeholder="如：故宫的建造历史和建筑特点"></textarea>' +
      (CFG.allowOnlineQuery ? "" : '<label class="f">关联本地记录（可选，提供上下文）</label><input class="f" id="qCtx" placeholder="输入名称筛选，留空则用全部本地记录摘要">') +
      '<div class="form-actions"><button class="btn-cancel" onclick="closeSheet(\'sheetGen\')">关闭</button>' +
      '<button class="btn-save" id="qRun">查询</button></div>' +
      '<div id="qOut" style="margin-top:12px"></div>';
    openGen("智能查询", html);
    q("qRun").onclick = runQuery;
  }
  function runQuery() {
    var qtext = q("qInput").value.trim(); if (!qtext) { toast("请输入查询内容"); return; }
    var msgs = [{ role: "system", content: systemPrompt() }];
    if (CFG.allowOnlineQuery) {
      msgs.push({ role: "user", content: qtext });
    } else {
      var ctx = buildLocalContext(q("qCtx") ? q("qCtx").value.trim() : "");
      msgs.push({ role: "user", content: "本地记录上下文：\n" + ctx + "\n\n请针对以下问题，仅基于上述本地记录作答：\n" + qtext });
    }
    busy(true); q("qOut").innerHTML = '<div class="busy-sub">模型思考中…</div>';
    chat(msgs).then(function (txt) {
      busy(false);
      q("qOut").innerHTML = '<div style="background:var(--soft);border-radius:10px;padding:12px;font-size:13px;line-height:1.6;white-space:pre-wrap;color:#3a2e28">' + esc(txt) + "</div>";
      hermesLearn("智能查询", qtext, txt); // v3.38：Hermes 自我学习
    }).catch(function (e) { busy(false); q("qOut").innerHTML = '<div style="color:var(--danger);font-size:13px">查询失败：' + esc(e.message) + "</div>"; });
  }

  /* ============================ 智能更新 ============================ */
  function openSmartUpdate() {
    var html =
      '<p style="font-size:13px;color:#3a2e28;line-height:1.6">' +
      (CFG.allowOnlineQuery ? "选择一处古建，联网检索后自动生成可应用的更新补丁（你确认后才写入）。" : "选择一条本地记录，由模型基于本地上下文补全缺失字段（不引用外部数据）。") +
      "</p>" +
      '<label class="f">选择记录（输入名称筛选）</label><input class="f" id="uFilter" placeholder="输入名称…">' +
      '<div id="uList" style="max-height:30vh;overflow:auto;margin:8px 0"></div>' +
      '<div id="uForm" style="display:none">' +
        '<label class="f">补全/核实主题</label><textarea class="f" id="uTopic" rows="2" placeholder="如：补全保护历史与建筑特点"></textarea>' +
        '<div class="form-actions"><button class="btn-cancel" id="uHide">收起</button>' +
        '<button class="btn-save" id="uRun">生成更新</button></div>' +
        '<div id="uOut" style="margin-top:10px"></div>' +
      "</div>";
    openGen("智能更新", html);
    q("uFilter").oninput = function () { renderUpdateList(this.value.trim()); };
    q("uHide").onclick = function () { q("uForm").style.display = "none"; };
    q("uRun").onclick = runUpdate;
    renderUpdateList("");
  }
  function renderUpdateList(filter) {
    var recs = (CFG.searchRecords ? CFG.searchRecords(filter) : (CFG.listAll ? CFG.listAll() : [])).slice(0, 40);
    var box = q("uList");
    box.innerHTML = recs.map(function (r) {
      return '<div class="sel-item"><span style="flex:1;font-size:13px">' + esc(r.name) + (r.city ? ' <span style="color:#8a7c70">' + esc(r.city) + "</span>" : "") + '</span>' +
        '<button class="tbtn" data-pick="' + esc(r.id) + '">选择</button></div>';
    }).join("") || '<div class="empty-tip">无匹配记录</div>';
    bindData("data-pick", function (id) {
      pendingRecId = id;
      var r = CFG.getRecord(id);
      q("uForm").style.display = "block";
      q("uOut").innerHTML = '<div style="font-size:12px;color:#8a7c70;margin-bottom:6px">当前：' + esc(r ? r.name : "") + "</div>" + currentFieldsHtml(r);
    });
  }
  function currentFieldsHtml(r) {
    if (!r) return "";
    return CFG.fieldSchema.map(function (k) {
      return '<div style="font-size:12px;color:#3a2e28"><b>' + esc(k) + "</b>：" + esc(r[k] || "（空）") + "</div>";
    }).join("");
  }
  function runUpdate() {
    var rec = CFG.getRecord(pendingRecId); if (!rec) { toast("请先选择记录"); return; }
    var topic = q("uTopic").value.trim() || "补全缺失字段";
    var schema = CFG.fieldSchema;
    var sys = systemPrompt() + "\n你是一个数据补全助手。用户给你一条记录现有字段与主题，请返回 JSON 补丁（仅含可更新的字段），格式：\n{\"patch\":{\"字段\":\"新值\"}}\n只返回 JSON，不要解释。可更新的字段仅限：" + schema.join(", ") + "。";
    var userCtx = "现有记录：\n" + schema.map(function (k) { return k + ": " + (rec[k] || "（空）"); }).join("\n");
    userCtx += CFG.allowOnlineQuery ? "\n\n主题：" + topic + "（可联网核实公开信息）" : "\n\n主题：" + topic + "（仅基于本地上下文，禁止外部臆测）";
    busy(true); q("uOut").innerHTML = '<div class="busy-sub">生成中…</div>';
    chat([{ role: "system", content: sys }, { role: "user", content: userCtx }]).then(function (txt) {
      busy(false);
      var patch = parsePatch(txt);
      if (!patch) { q("uOut").innerHTML = '<div style="color:var(--danger);font-size:13px">未能解析补丁，模型返回：<br>' + esc(txt.slice(0, 300)) + "</div>"; return; }
      showPatchPreview(rec, patch);
    }).catch(function (e) { busy(false); q("uOut").innerHTML = '<div style="color:var(--danger);font-size:13px">生成失败：' + esc(e.message) + "</div>"; });
  }
  function parsePatch(txt) {
    try {
      var s = txt.trim(), i = s.indexOf("{"), j = s.lastIndexOf("}");
      if (i >= 0 && j > i) s = s.slice(i, j + 1);
      var o = JSON.parse(s);
      if (o && o.patch && typeof o.patch === "object") return o.patch;
      if (o && typeof o === "object") return o;
    } catch (e) {}
    return null;
  }
  function showPatchPreview(rec, patch) {
    pendingPatch = patch;
    var rows = Object.keys(patch).filter(function (k) { return CFG.fieldSchema.indexOf(k) >= 0; }).map(function (k) {
      return '<div style="display:flex;gap:6px;font-size:13px;margin:4px 0"><span style="flex:0 0 84px;color:#8a7c70">' + esc(k) + "</span>" +
        '<span style="flex:1;color:#3a2e28"><s style="color:#aab4be">' + esc(rec[k] || "（空）") + "</s> → " + esc(patch[k]) + "</span></div>";
    }).join("");
    if (!rows) { q("uOut").innerHTML = '<div style="color:#8a7c70;font-size:13px">模型未给出可更新字段</div>'; return; }
    q("uOut").innerHTML = '<div style="background:var(--soft);border-radius:10px;padding:10px;margin-bottom:8px"><b style="color:#6b2e2e">更新预览</b>' + rows + "</div>" +
      '<div class="form-actions"><button class="btn-cancel" id="uCancel">取消</button>' +
      '<button class="btn-save" id="uApply">应用更新</button></div>';
    q("uCancel").onclick = function () { q("uOut").innerHTML = ""; };
    q("uApply").onclick = applyPatch;
  }
  function applyPatch() {
    var rec = CFG.getRecord(pendingRecId); if (!rec) { toast("记录丢失"); return; }
    if (!pendingPatch) { toast("无补丁"); return; }
    try { CFG.applyUpdate(rec, pendingPatch); toast("已应用更新"); q("uOut").innerHTML = '<div style="color:#6b2e2e;font-size:13px">✅ 已更新「' + esc(rec.name) + "」</div>";
      // v3.38：智能更新写入知识库（operation 条目）+ Hermes 自我学习
      kbAdd({ title: "更新「" + (rec.name || "") + "」", tags: ["operation", "智能更新"], type: "operation", buildingId: rec.id },
        Object.keys(pendingPatch).map(function (k) { return k + "：" + pendingPatch[k]; }).join("\n"));
      hermesLearn("智能更新", (rec.name || "") + " " + JSON.stringify(pendingPatch), "已应用更新");
    }
    catch (e) { toast("应用失败：" + e.message); }
  }

  /* ============================ 智能纠错 ============================ */
  function corrections() { return load(kCorr(CFG.domain), []); }
  function correctionsHtml() {
    var list = corrections();
    if (!list.length) return '<div class="empty-tip">暂无标注</div>';
    return list.map(function (c, i) {
      return '<div class="bm-row"><div style="flex:1"><div style="font-size:13px;font-weight:600">' + esc(c.name) + "</div>" +
        '<div style="font-size:12px;color:#8a7c70">' + esc(c.note) + "</div>" +
        '<div style="font-size:11px;color:#aab4be">' + esc(c.ts || "") + "</div></div>" +
        '<button class="tbtn" data-rm="' + i + '">删除</button></div>';
    }).join("");
  }
  function openSmartCorrect() {
    var html =
      '<p style="font-size:13px;color:#3a2e28;line-height:1.6">' +
      (CFG.allowOnlineQuery ? "选择一处古建，联网核对公开说法；若本 app 信息正确而网上有误，可标注差异留存。" : "选择一条本地记录，标注存疑项交由人工复核（内部数据不联网比对）。") +
      "</p>" +
      '<label class="f">选择记录</label><input class="f" id="cFilter" placeholder="输入名称…">' +
      '<div id="cList" style="max-height:26vh;overflow:auto;margin:8px 0"></div>' +
      '<div id="cForm" style="display:none">' +
        (CFG.allowOnlineQuery
          ? '<label class="f">核对主题</label><textarea class="f" id="cTopic" rows="2" placeholder="如：核对网上关于其年代的记载"></textarea>' +
            '<div class="form-actions"><button class="btn-cancel" id="cHide">收起</button>' +
            '<button class="btn-save" id="cRun">联网核对</button></div>'
          : '<div style="font-size:13px;color:#8a7c70">内部数据无公开来源，请直接填写存疑说明：</div>' +
            '<textarea class="f" id="cNote" rows="3" placeholder="如：该设备型号疑似记录有误，待核实"></textarea>' +
            '<div class="form-actions"><button class="btn-cancel" id="cHide">收起</button>' +
            '<button class="btn-save" id="cSave">保存标注</button></div>') +
        '<div id="cOut" style="margin-top:10px"></div>' +
      "</div>" +
      '<h4 style="color:#6b2e2e;margin:14px 0 6px">已标注（' + corrections().length + "）</h4>" +
      '<div id="cList2">' + correctionsHtml() + "</div>";
    openGen("智能纠错", html);
    q("cFilter").oninput = function () { renderCorrectList(this.value.trim()); };
    q("cHide").onclick = function () { q("cForm").style.display = "none"; };
    if (CFG.allowOnlineQuery) q("cRun").onclick = runCorrect; else q("cSave").onclick = addCorrection;
    bindData("data-rm", function (i) { var list = corrections(); list.splice(+i, 1); save(kCorr(CFG.domain), list); openSmartCorrect(); });
    renderCorrectList("");
  }
  function renderCorrectList(filter) {
    var recs = (CFG.searchRecords ? CFG.searchRecords(filter) : (CFG.listAll ? CFG.listAll() : [])).slice(0, 40);
    var box = q("cList");
    box.innerHTML = recs.map(function (r) {
      return '<div class="sel-item"><span style="flex:1;font-size:13px">' + esc(r.name) + "</span><button class=\"tbtn\" data-cpick=\"" + esc(r.id) + "\">选择</button></div>";
    }).join("") || '<div class="empty-tip">无匹配记录</div>';
    bindData("data-cpick", function (id) {
      pendingRecId = id;
      var r = CFG.getRecord(id);
      q("cForm").style.display = "block";
      q("cOut").innerHTML = '<div style="font-size:12px;color:#8a7c70">当前：' + esc(r ? r.name : "") + "</div>";
    });
  }
  function runCorrect() {
    var rec = CFG.getRecord(pendingRecId); if (!rec) { toast("请先选择记录"); return; }
    var topic = q("cTopic").value.trim() || "核对本记录与公开记载的差异";
    var sys = systemPrompt() + "\n请联网核实公开资料，并与用户提供的本 app 记录逐字段比对。" +
      "若本 app 信息正确而网上有误，请明确指出差异并给出结论。仅返回 JSON：\n" +
      '{"appCorrect":true/false,"diffs":[{"field":"字段","app":"本app值","online":"网上说法"}],"conclusion":"结论"}';
    var userCtx = "本 app 记录：\n" + CFG.fieldSchema.map(function (k) { return k + ": " + (rec[k] || "（空）"); }).join("\n") + "\n\n核对主题：" + topic;
    busy(true); q("cOut").innerHTML = '<div class="busy-sub">核对中…</div>';
    chat([{ role: "system", content: sys }, { role: "user", content: userCtx }]).then(function (txt) {
      busy(false);
      var o = parseCorrect(txt);
      if (!o) { q("cOut").innerHTML = '<div style="color:var(--danger);font-size:13px">未能解析：<br>' + esc(txt.slice(0, 300)) + "</div>"; return; }
      var diffs = (o.diffs || []).map(function (d) { return '<div style="font-size:12px;margin:3px 0"><b>' + esc(d.field) + "</b>：本app「" + esc(d.app) + "」 vs 网上「" + esc(d.online) + "」</div>"; }).join("");
      q("cOut").innerHTML =
        '<div style="background:var(--soft);border-radius:10px;padding:10px;font-size:13px;line-height:1.6">' +
        "<div>结论：" + (o.appCorrect ? "✅ 本app信息正确" : "⚠️ 可能存在差异") + "</div>" + diffs + "</div>" +
        '<div class="form-actions"><button class="btn-cancel" id="cClose">关闭</button>' +
        '<button class="btn-save" id="cMark">标注差异</button></div>';
      q("cClose").onclick = function () { q("cOut").innerHTML = ""; };
      q("cMark").onclick = function () { saveCorrectionNote(typeof o.conclusion === "string" ? o.conclusion : "（联网核对标注）"); };
    }).catch(function (e) { busy(false); q("cOut").innerHTML = '<div style="color:var(--danger);font-size:13px">核对失败：' + esc(e.message) + "</div>"; });
  }
  function parseCorrect(txt) {
    try { var s = txt.trim(), i = s.indexOf("{"), j = s.lastIndexOf("}"); if (i >= 0 && j > i) s = s.slice(i, j + 1); return JSON.parse(s); } catch (e) { return null; }
  }
  function saveCorrectionNote(note) {
    var rec = CFG.getRecord(pendingRecId); if (!rec) { toast("记录丢失"); return; }
    saveCorrection(rec.name, note || "（联网核对标注）");
  }
  function addCorrection() {
    var rec = CFG.getRecord(pendingRecId); if (!rec) { toast("请先选择记录"); return; }
    var note = q("cNote") ? q("cNote").value.trim() : "";
    if (!note) { toast("请填写存疑说明"); return; }
    saveCorrection(rec.name, note);
  }
  function saveCorrection(name, note) {
    var list = corrections();
    list.unshift({ name: name, note: note, ts: new Date().toLocaleString("zh-CN"), domain: CFG.domain });
    save(kCorr(CFG.domain), list);
    hermesLearn("智能纠错", name, note); // v3.38：Hermes 自我学习
    toast("已标注"); openSmartCorrect();
  }

  /* ============================ 知识库（md + json 混合 + Hermes 自我学习）============================ */
  // 架构：每条目 = 元数据(.json: id/title/tags/type/source/ts/buildingId) + 正文(.md)
  //   小数据直喂 md；大数据用轻量评分先查 index 再读 body。导入/导出 zip 打包 .md+.json。
  function kKB(d) { return "kb_" + d; }
  function kbLoad() {
    var o = load(kKB(CFG.domain), null);
    if (!o || !o.index) o = { index: [], bodies: {} };
    if (!o.bodies) o.bodies = {};
    return o;
  }
  function kbSave(o) { save(kKB(CFG.domain), o); }
  function kbAdd(meta, md) {
    var o = kbLoad();
    var id = "kb_" + Date.now() + "_" + Math.floor(Math.random() * 1e4).toString(36);
    meta = meta || {};
    o.index.unshift({
      id: id, title: meta.title || "未命名", tags: meta.tags || [], type: meta.type || "note",
      source: meta.source || "", buildingId: meta.buildingId || null,
      ts: new Date().toLocaleString("zh-CN"), domain: CFG.domain
    });
    o.bodies[id] = md || "";
    kbSave(o);
    return id;
  }
  function kbGet(id) { var o = kbLoad(); return { meta: o.index.find(function (x) { return x.id === id; }) || null, md: o.bodies[id] || "" }; }
  function kbRemove(id) { var o = kbLoad(); o.index = o.index.filter(function (x) { return x.id !== id; }); delete o.bodies[id]; kbSave(o); }
  // BM25-lite：关键词在 title+tags+md 上的命中评分
  function kbScore(rec, q) {
    if (!q) return 1;
    var hay = (rec.title + " " + (rec.tags || []).join(" ") + " " + (kbLoad().bodies[rec.id] || "")).toLowerCase();
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean), s = 0;
    terms.forEach(function (t) { var i = 0; while ((i = hay.indexOf(t, i)) >= 0) { s++; i += t.length; } });
    return s;
  }
  function kbSearch(q) {
    var o = kbLoad();
    var list = o.index.map(function (rec) { return { rec: rec, s: kbScore(rec, q) }; });
    if (q) list = list.filter(function (x) { return x.s > 0; });
    list.sort(function (a, b) { return b.s - a.s; });
    return list.map(function (x) { return x.rec; });
  }
  function kbList() { return kbLoad().index; }
  // 本地知识库上下文字符串（供后续查询注入 Hermes 笔记，实现自我学习）
  function kbContext(limit) {
    var list = kbList().filter(function (r) { return r.type === "hermes" || r.type === "operation"; }).slice(0, limit || 12);
    if (!list.length) return "";
    return list.map(function (r) {
      return "【" + r.type + "】" + r.title + (r.buildingId ? " (#" + r.buildingId + ")" : "") + "：" +
        (kbLoad().bodies[r.id] || "").replace(/\n+/g, " ").slice(0, 240);
    }).join("\n");
  }
  function kbExport() {
    var o = kbLoad();
    var JSZip = global.JSZip;
    if (!JSZip) { downloadText("知识库_" + CFG.domain + ".json", JSON.stringify({ index: o.index, bodies: o.bodies }, null, 2)); return; }
    var zip = new JSZip();
    o.index.forEach(function (m) {
      var fid = m.id.replace(/[^\w.-]/g, "_");
      zip.file(fid + ".json", JSON.stringify({ id: m.id, title: m.title, tags: m.tags, type: m.type, source: m.source, buildingId: m.buildingId, ts: m.ts, domain: m.domain }, null, 2));
      zip.file(fid + ".md", o.bodies[m.id] || "");
    });
    zip.file("kb_index.json", JSON.stringify(o.index.map(function (m) {
      return { id: m.id, title: m.title, tags: m.tags, type: m.type, source: m.source, buildingId: m.buildingId, ts: m.ts };
    }), null, 2));
    zip.generateAsync({ type: "blob" }).then(function (blob) { downloadBlob("知识库_" + CFG.domain + ".zip", blob); })
      .catch(function (e) { toast("导出失败：" + e.message); });
  }
  function kbImportZip(file) {
    var JSZip = global.JSZip;
    if (!JSZip) { toast("未加载 zip 库，无法导入"); return; }
    var reader = new FileReader();
    reader.onload = function () {
      JSZip.loadAsync(reader.result).then(function (zip) {
        var o = kbLoad(), cnt = 0; var proms = [];
        zip.forEach(function (path, entry) {
          if (entry.dir) return;
          if (/kb_index\.json$/i.test(path)) return;
          if (/\.json$/i.test(path)) {
            proms.push(entry.async("string").then(function (txt) {
              try {
                var m = JSON.parse(txt); if (!m || !m.id) return;
                var rec = { id: m.id, title: m.title || "未命名", tags: m.tags || [], type: m.type || "note", source: m.source || "", buildingId: m.buildingId || null, ts: m.ts || new Date().toLocaleString("zh-CN"), domain: CFG.domain };
                var ex = o.index.find(function (x) { return x.id === m.id; }); if (ex) Object.assign(ex, rec); else o.index.unshift(rec);
                if (o.bodies[m.id] == null) o.bodies[m.id] = ""; cnt++;
              } catch (e) {}
            }));
          } else if (/\.md$/i.test(path)) {
            proms.push(entry.async("string").then(function (txt) {
              var fid = path.split("/").pop().replace(/\.md$/i, "").replace(/[^\w.-]/g, "_");
              var m = o.index.find(function (x) { return x.id.replace(/[^\w.-]/g, "_") === fid; });
              if (m) o.bodies[m.id] = txt; else o.bodies["orphan_" + fid] = txt;
            }));
          }
        });
        Promise.all(proms).then(function () { kbSave(o); toast("已导入 " + cnt + " 条知识库条目"); openKB(); });
      }).catch(function (e) { toast("zip 解析失败：" + e.message); });
    };
    reader.readAsArrayBuffer(file);
  }
  // 读取外部文件入库（pdf/xls/doc/csv/txt/md）——离线环境 best-effort 文本抽取
  function kbImportExternal(file) {
    var name = file.name || "外部文件", lower = name.toLowerCase();
    var reader = new FileReader();
    reader.onload = function () {
      var text = "";
      if (/\.(txt|md|csv|json)$/i.test(lower)) {
        text = (typeof reader.result === "string") ? reader.result : "";
      } else {
        try { text = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(reader.result)).replace(/[^\x09\x0A\x0D\x20-\x7E一-龥。，、：；！？（）《》\s]/g, " "); }
        catch (e) { text = String(reader.result); }
        text = "（离线未深度解析，仅为原始文本片段）\n" + text.slice(0, 8000);
      }
      if (!text.trim()) { toast("未能提取文本内容（" + name + "）"); return; }
      var title = name.replace(/\.[^.]+$/, "").slice(0, 40);
      kbAdd({ title: title, tags: ["外部入库", lower.split(".").pop()], type: "external", source: name }, text);
      toast("已入库：" + title); openKB();
    };
    if (/\.(txt|md|csv|json)$/i.test(lower)) reader.readAsText(file); else reader.readAsArrayBuffer(file);
  }
  function downloadText(fn, txt) {
    try { downloadBlob(fn, new Blob([txt], { type: "text/plain;charset=utf-8" })); }
    catch (e) { copyFallback(txt); }
  }
  function downloadBlob(fn, blob) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = fn;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
    } catch (e) {
      var r = new FileReader(); r.onload = function () { copyFallback(String(r.result).replace(/^data:.*;base64,/, "")); }; r.readAsDataURL(blob);
    }
  }
  function copyFallback(b64) {
    var html = '<p style="font-size:13px">当前环境无法直接下载，已生成 base64，请复制保存为 .zip/.json：</p>' +
      '<textarea class="f" id="kbB64" rows="6" readonly>' + esc(b64) + "</textarea>" +
      '<div class="form-actions"><button class="btn-save" id="kbCopy">复制</button></div>';
    openGen("知识库导出（base64）", html);
    q("kbCopy").onclick = function () { var t = q("kbB64"); t.select(); try { document.execCommand("copy"); toast("已复制"); } catch (e) { toast("请手动复制"); } };
  }
  function openKB() {
    var html =
      '<p style="font-size:13px;color:#3a2e28;line-height:1.6">知识库（Markdown 正文 + JSON 元数据）。支持：①读取外部文件入库 ②导出 zip 备份 ③导入备份 zip。' +
      '智能操作会自动沉淀为「operation / hermes」条目，供后续查询自我学习。</p>' +
      '<div style="display:flex;gap:6px;margin:10px 0">' +
        '<button class="btn-cancel" style="flex:1" id="kbInFile">①读外部文件</button>' +
        '<button class="btn-cancel" style="flex:1" id="kbExport">②导出zip</button>' +
        '<button class="btn-cancel" style="flex:1" id="kbImport">③导入zip</button></div>' +
      '<input type="file" id="kbFile" accept=".zip,application/zip,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json" style="display:none">' +
      '<label class="f">搜索知识库</label><input class="f" id="kbQ" placeholder="关键词…">' +
      '<div id="kbList" style="max-height:34vh;overflow:auto;margin:8px 0"></div>';
    openGen("知识库管理", html);
    q("kbInFile").onclick = function () { var f = q("kbFile"); f.setAttribute("accept", ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json"); f.click(); };
    q("kbExport").onclick = kbExport;
    q("kbImport").onclick = function () { var f = q("kbFile"); f.setAttribute("accept", ".zip,application/zip"); f.click(); };
    q("kbFile").onchange = function () {
      var f = this.files[0]; if (!f) return;
      if (/\.zip$/i.test(f.name)) kbImportZip(f); else kbImportExternal(f);
      this.value = "";
    };
    q("kbQ").oninput = function () { renderKBList(this.value.trim()); };
    renderKBList("");
  }
  function renderKBList(q) {
    var list = kbSearch(q);
    var box = q("kbList"); if (!box) return;
    if (!list.length) { box.innerHTML = '<div class="empty-tip">知识库为空，点击「①读外部文件」或智能操作后自动沉淀</div>'; return; }
    box.innerHTML = list.map(function (r) {
      var tag = (r.type === "hermes") ? "🧠" : (r.type === "operation") ? "✏️" : (r.type === "external") ? "📥" : "📄";
      return '<div class="bm-row"><div style="flex:1"><div style="font-size:13px;font-weight:600">' + tag + " " + esc(r.title) + "</div>" +
        '<div style="font-size:11px;color:#aab4be">' + esc((r.tags || []).join(" ")) + " · " + esc(r.ts || "") + "</div></div>" +
        '<button class="tbtn" data-view="' + esc(r.id) + '">查看</button> ' +
        '<button class="tbtn" data-rm="' + esc(r.id) + '">删除</button></div>';
    }).join("");
    bindData("data-view", function (id) {
      var k = kbGet(id);
      openGen("知识库条目", '<h4>' + esc(k.meta ? k.meta.title : "") + "</h4>" +
        '<div style="font-size:12px;color:#8a7c70;margin-bottom:6px">' + esc((k.meta && k.meta.tags || []).join(" ")) + "</div>" +
        '<div style="background:var(--soft);border-radius:10px;padding:12px;font-size:13px;line-height:1.6;white-space:pre-wrap;max-height:50vh;overflow:auto;color:#3a2e28">' + esc(k.md || "") + "</div>" +
        '<div class="form-actions"><button class="btn-cancel" id="kbBack">返回</button></div>');
      q("kbBack").onclick = openKB;
    });
    bindData("data-rm", function (id) { kbRemove(id); renderKBList(q("kbQ") ? q("kbQ").value.trim() : ""); });
  }
  // Hermes 自我学习循环：每次智能操作后异步抽提「关键参数 + 操作偏好」沉淀为 hermes 条目
  function hermesLearn(operation, inputText, outputText) {
    var sys = "你是「" + (CFG.appName || "本系统") + "」的学习助手。用户刚完成一次「" + operation + "」操作。" +
      "请从中抽取对今后有用的「关键参数」与「操作偏好」，用简体中文、要点式输出（不超过 6 条，每条一行，不要解释）。";
    var user = "用户输入：\n" + (inputText || "") + "\n\n" + (CFG.appName ? "系统产出/结果：\n" : "") + (outputText || "").slice(0, 1200);
    chat([{ role: "system", content: sys }, { role: "user", content: user }]).then(function (txt) {
      if (!txt || !txt.trim()) return;
      kbAdd({ title: operation + " · " + new Date().toLocaleDateString("zh-CN"), tags: ["hermes", operation], type: "hermes", source: "Hermes自动学习" }, txt.trim());
    }).catch(function () { /* 无模型/失败则静默，不影响主流程 */ });
  }

  /* ============================ 对外 API ============================ */
  var API = {
    init: init,
    getMenuGroups: getMenuGroups,
    _openSettings: openSettings,
    _openSmartQuery: openSmartQuery,
    _openSmartUpdate: openSmartUpdate,
    _openSmartCorrect: openSmartCorrect,
    _openKB: openKB,
    // 知识库对外接口（宿主建筑增改时可调用，把参数/操作过程沉淀进知识库）
    kbAdd: kbAdd,
    kbList: kbList,
    kbSearch: kbSearch,
    kbContext: kbContext,
    hermesLearn: hermesLearn,
    // 宿主直接调用 LLM（用于智能补全 / 智能描述等地）：messages 为 OpenAI 格式
    ask: function (messages) { return chat(messages); }
  };
  // init 成功后才挂到 window；此处先声明，init 内会再赋值一次
  if (!global.AIModule) global.AIModule = API;

})(typeof window !== "undefined" ? window : this);
