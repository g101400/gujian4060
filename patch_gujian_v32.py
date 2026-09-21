# -*- coding: utf-8 -*-
"""
v3.2 古建智能化升级 — 注入到 android-build/gujian-v31/assets/app.js
"""
import os, re, json, sys, shutil

GUJIAN_APP = "D:/Users/Claw/android-build/gujian-v31/assets/app.js"

def patch():
    with open(GUJIAN_APP, "r", encoding="utf-8") as f:
        src = f.read()
    backup = GUJIAN_APP + ".pre-v32.bak"
    if not os.path.exists(backup):
        shutil.copy2(GUJIAN_APP, backup)
        print("backup ->", backup)

    # 1) 在 initAIModule 块之后追加「AI 提示词（古建文物助手）」
    #   古建已在 initAIModule 设置 appName="古建景点打卡"。
    #   ai_module.js 已自动按 appName.indexOf("古建") 适配 placeholder
    #   这里我们只补强系统提示词，让古建走"联网文物助手"分支。
    extra_sysprompt = r'''
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
      html += '<span class="chip gtype" data-t="' + esc(t) + '" style="cursor:pointer">' + esc(t) + "</span>";
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

  // ---------- 启动 ----------
  _v32_gujianSysPrompt();

'''.rstrip()

    # 在 "})();" 之前插入补丁
    closed = "})();"
    if closed in src:
        idx = src.rfind(closed)
        new_src = src[:idx] + extra_sysprompt + "\n  " + closed + src[idx+len(closed):]
        with open(GUJIAN_APP, "w", encoding="utf-8") as f:
            f.write(new_src)
        print("✅ 注入 v3.2 古建智能化升级补丁 OK")
        print("   src size before:", len(src))
        print("   src size after:", len(new_src))
        return True
    else:
        print("❌ 找不到关闭标记 })();")
        return False

if __name__ == "__main__":
    patch()
