#!/usr/bin/env node
// gen_realistic_demo.js —— 生成「像真的」脱敏演示数据（公开版用）。
// 读取 .strip_backup/<prod>/ 下的真实备份(data.js + kb_building_seed.js)，先跨两文件建一张全局
// 原名->脱敏名映射(管理处/所站/段/建筑)，再统一转换。名称取自著名真实水利工程(都江堰/红旗渠/密云水库…)，
// 坐标取真实坐标并确定性抖动；名称与组织/建筑一致、可筛选、看起来像真的；内部原名绝不出现在产物。真实备份不改。
const fs = require("fs");
const path = require("path");
const ROOT = "D:/Users/Claw";

// 脱敏工程池：均为全国知名真实水利工程/水库（用户示例：都江堰、红旗渠），但与北京本地单位名不重名。
// 关键点：不含任何北京本地水库/河道名（密云/怀柔/京密引水/潮河/白河堡/永定/北运/海河/沾河…），
// 否则脱敏名会“恰为真实单位名”造成泄密。buildPlan 还会按真实单位名做二次排除。
const PROJECTS = [
  ["都江堰水利工程", 103.615, 30.990], ["红旗渠", 113.820, 36.280],
  ["三峡水库", 110.950, 30.830], ["葛洲坝", 111.270, 30.740], ["小浪底水利枢纽", 112.360, 34.920],
  ["龙羊峡水库", 100.520, 36.130], ["刘家峡水库", 103.050, 35.970], ["李家峡水库", 101.800, 36.100],
  ["新安江水库", 119.200, 29.550], ["千岛湖", 119.050, 29.600], ["太湖", 120.200, 31.200],
  ["洪泽湖", 118.850, 33.350], ["骆马湖", 118.250, 34.400], ["微山湖", 117.200, 34.600],
  ["东平湖", 116.200, 35.950], ["丹江口水库", 111.500, 32.540], ["王甫洲", 111.400, 32.380],
  ["隔河岩", 111.250, 30.480], ["高坝洲", 111.350, 30.400], ["水布垭", 110.300, 30.300],
  ["五强溪水库", 110.900, 28.600], ["凤滩水库", 110.600, 28.800], ["柘溪水库", 111.100, 28.300],
  ["江垭水库", 110.700, 29.600], ["皂市水库", 111.300, 29.700], ["株树桥水库", 113.700, 28.300],
  ["万安水库", 114.800, 26.450], ["柘林水库", 115.450, 29.250], ["紧水滩水库", 119.650, 28.200],
  ["湖南镇水库", 118.900, 28.900], ["水口水库", 118.850, 26.300], ["沙溪口", 118.300, 26.650],
  ["棉花滩水库", 116.700, 25.650], ["新丰江水库", 114.650, 23.750], ["枫树坝水库", 115.250, 24.400],
  ["二滩水库", 101.800, 26.850], ["宝珠寺水库", 105.850, 32.450], ["升钟水库", 106.050, 31.350],
  ["漫湾水库", 100.450, 24.700], ["大朝山水库", 100.250, 24.450], ["糯扎渡水库", 100.550, 23.200],
  ["乌江渡水库", 106.800, 27.350], ["东风水库", 105.950, 26.900], ["岩滩水库", 107.450, 24.100],
  ["龙滩水库", 106.900, 25.200], ["百色水库", 106.600, 23.900], ["安康水库", 109.400, 32.550],
  ["青铜峡水库", 105.950, 37.900], ["碧口水库", 104.300, 32.800], ["丰满水库", 126.650, 43.300],
  ["白山水库", 127.200, 43.100], ["红石水库", 127.000, 43.200], ["莲花水库", 128.100, 43.350],
  ["大伙房水库", 124.150, 41.850], ["观音阁水库", 124.300, 41.350], ["碧流河水库", 123.100, 39.900],
  ["桃林口水库", 119.100, 40.250], ["石津灌区", 114.900, 38.100], ["陡河水库", 118.300, 39.800],
  ["邱庄水库", 117.900, 39.600], ["龙门水库", 115.000, 39.100], ["故县水库", 112.100, 34.550],
  ["陆浑水库", 112.100, 34.200], ["白龟山水库", 113.200, 33.800], ["昭平台水库", 113.000, 33.850],
  ["鸭河口水库", 112.700, 33.100], ["宿鸭湖水库", 114.400, 33.400], ["鲇鱼山水库", 115.300, 31.900],
  ["梅山水库", 115.900, 31.400], ["响洪甸水库", 116.200, 31.500], ["佛子岭水库", 116.100, 31.400],
  ["磨子潭水库", 116.250, 31.350], ["龙河口水库", 116.450, 31.300], ["陈村水库", 117.950, 30.300],
  ["天荒坪", 119.650, 30.550], ["天台水库", 121.050, 29.200], ["仙游溪水库", 118.700, 25.400],
];

// 脱敏工程池可在 buildPlan 中按真实单位名二次排除后切换（避免脱敏名恰为真实单位名）
let DECOY_PROJECTS = PROJECTS;

function hash(s) { if (!s) return 0; let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function projOf(orig) { return orig ? DECOY_PROJECTS[hash(orig) % DECOY_PROJECTS.length] : null; }
function jitter(base, seed) { const r = (hash(seed) % 1000) / 1000 - 0.5; return +(base + r * 0.10).toFixed(5); }
function orgName(p) { return p ? p[0] + "管理处" : ""; }
function loadData(file) { const window = {}; new Function("window", fs.readFileSync(file, "utf-8") + "\n;return window;")(window); return window; }
// 去地理前缀（北京市/密云县/…），让"北京市京密引水管理处"与"京密引水管理处"映射到同一脱敏名
function normGeo(S) { return String(S || "").replace(/^(北京市|天津市|河北省|山西省|山东省|河南省|黑龙江省|吉林省|辽宁省|内蒙古自治区|.*?市|.*?县|.*?区|.*?镇)/, ""); }
function unitSuffix(S) { const m = String(S).match(/(管理处|管理所|管理段|管理站|总干渠|段引渠|引渠|水库|闸门|所|站|段|闸|政府|委员会)$/); return m ? m[1] : ""; }
// 权属/产权/管理类字段的值通常是内部单位名（如“京引”“北京市路政局密云公路分局”“怀柔镇”），且往往不带管理处后缀，
// 必须按记录脱敏为对应的脱敏机构名，否则会残留泄密。
const OWNER_RE = /(权属|产权|单位|所属|隶属|主管|业主|名义|管理单位)/;
// 值级兜底：只要属性值含有机构/北京本地特征词（局/分局/公司/公路/铁路/密云/怀柔/京引…），即视为内部信息参与脱敏替换，
// 可覆盖“管理协议”“跌水…维护”等任意键名下的内部机构名。
const INTERNAL_RE = /(局|分局|公司|委员会|公路|铁路|股份|路政局|北京|天津|河北|密云|怀柔|顺义|通州|大兴|房山|门头沟|昌平|平谷|延庆|朝阳|海淀|丰台|石景山|西城|东城|白河堡|潮河|沾河|北运|永定|海河|京密|京引)/;
// 脱敏名：取自著名真实水利工程 + 单位后缀；若出现“脱敏名==原名”碰撞（如真实单位恰为某工程名），自动换一个工程，确保绝不返回原名
function decoyOf(S) {
  const origS = String(S || "");
  const base = projOf(normGeo(origS));
  if (!base) return origS;
  const suf = unitSuffix(origS) || "管理处";
  let name = base[0] + suf;
  if (name === origS) {
    const alt = PROJECTS[(PROJECTS.indexOf(base) + 1) % PROJECTS.length];
    name = alt[0] + suf;
  }
  return name;
}

// 跨文件建全局单位名映射（office/station/chan + attrs 中疑似单位名的子串），再生成每条记录方案
function buildPlan(pairs) {
  const planByVar = {};
  const globalMap = new Map();
  const seqOffice = {}, seqStation = {}, seqChan = {};
  const UNIT_RE = /[一-龥·]{2,}(管理处|管理所|管理段|管理站|总干渠|段引渠|引渠|水库|闸门|所|站|段|闸|政府|委员会)/g;
  // 预扫描：收集全部真实单位名（office/station/chan + 属性自由文本 + META 类型/单位列表），用于排除冲突脱敏工程
  const realUnits = new Set();
  pairs.forEach(({ file, dataVar, metaVar }) => {
    const win = loadData(file);
    (win[dataVar] || []).forEach(r => {
      ["office", "station", "chan"].forEach(f => { if (r[f]) realUnits.add(String(r[f])); });
      if (Array.isArray(r.attrs)) r.attrs.forEach(([k, v]) => { const s = String(v == null ? "" : v); if (INTERNAL_RE.test(s)) realUnits.add(s); let m; UNIT_RE.lastIndex = 0; while ((m = UNIT_RE.exec(s))) realUnits.add(m[0]); });
    });
    if (metaVar && win[metaVar]) {
      const mv = win[metaVar];
      const tk = mv.types || mv.subsystems;
      if (Array.isArray(tk)) tk.forEach(t => { const s = String(t == null ? "" : t); let m; UNIT_RE.lastIndex = 0; while ((m = UNIT_RE.exec(s))) realUnits.add(m[0]); });
      if (Array.isArray(mv.offices)) mv.offices.forEach(o => realUnits.add(String(o)));
    }
  });
  // 安全脱敏工程池：排除任何与真实单位名相互包含的工程，确保脱敏名绝不等于真实单位名
  const SAFE = PROJECTS.filter(p => { const n = p[0]; return [...realUnits].every(u => u.indexOf(n) < 0 && n.indexOf(u) < 0); });
  DECOY_PROJECTS = SAFE.length ? SAFE : PROJECTS;
  function addUnit(S) { S = String(S == null ? "" : S).trim(); if (!S) return; if (!globalMap.has(S)) globalMap.set(S, decoyOf(S)); }
  // 第一遍：收集所有单位名（含属性自由文本 + META 类型列表里出现的单位名子串）
  pairs.forEach(({ file, dataVar, metaVar }) => {
    const win = loadData(file);
    (win[dataVar] || []).forEach(r => {
      ["office", "station", "chan"].forEach(f => { if (r[f]) addUnit(r[f]); });
      if (Array.isArray(r.attrs)) r.attrs.forEach(([k, v]) => {
        const s = String(v == null ? "" : v);
        if (OWNER_RE.test(String(k)) && s) addUnit(s);
        if (INTERNAL_RE.test(s)) addUnit(s);
        let m; UNIT_RE.lastIndex = 0;
        while ((m = UNIT_RE.exec(s))) addUnit(m[0]);
      });
    });
    if (metaVar && win[metaVar]) {
      const tk = win[metaVar].types || win[metaVar].subsystems;
      if (Array.isArray(tk)) tk.forEach(t => {
        const s = String(t == null ? "" : t); let m; UNIT_RE.lastIndex = 0;
        while ((m = UNIT_RE.exec(s))) addUnit(m[0]);
      });
    }
  });
  // 第二遍：生成每条记录方案（office 决定 station/chan 派生命名，保持一致）
  pairs.forEach(({ file, dataVar }) => {
    const arr = loadData(file)[dataVar] || [];
    planByVar[dataVar] = arr.map(r => {
      const oName = r.office ? (globalMap.get(r.office) || decoyOf(r.office)) : "";
      const btype = r.btype || "设施";
      const kb = oName + "|" + btype; seqOffice[kb] = (seqOffice[kb] || 0) + 1;
      const newName = oName + btype + String(seqOffice[kb]).padStart(2, "0");
      const ks = oName; seqStation[ks] = (seqStation[ks] || 0) + 1; seqChan[ks] = (seqChan[ks] || 0) + 1;
      const sName = r.station ? oName + "·第" + seqStation[ks] + "管理站" : "";
      const cName = r.chan ? oName + "·第" + seqChan[ks] + "段" : "";
      const p = projOf(r.office) || projOf(r.station) || projOf(r.chan) || projOf(r.id);
      // 注意：globalMap 只保存「原名→干净脱敏机构名」，修饰名(·第N段)仅用于 emit 的记录字段，
      // 绝不能回写 globalMap，否则同名 office/chan 会被修饰名污染并逐条累积“·第1段”。
      return { oName, newName, sName, cName, btype, lon: jitter(p ? p[1] : 0, r.id + "lon"), lat: jitter(p ? p[2] : 0, r.id + "lat") };
    });
  });
  // 词干表：原名去后缀得词干，覆盖 attrs 中"西田各庄管理所"等变体写法
  const stemMap = new Map();
  globalMap.forEach((fake, orig) => {
    let s = orig.replace(/(管理所|管理处|管理段|总干渠|段引渠|引渠|水库|闸门|所|站|段|闸|政府|委员会)$/, "");
    if (s.length < 2) return;
    if (fake.indexOf(s) >= 0) return; // 防止与脱敏工程名自相残杀
    if (!stemMap.has(s)) stemMap.set(s, fake);
  });
  return { globalMap, stemMap, planByVar };
}

function applyStems(nv, stemMap) {
  stemMap.forEach((fake, stem) => {
    if (nv.indexOf(stem) < 0) return;
    nv = nv.split(stem + "管理所").join(fake).split(stem + "管理处").join(fake)
      .split(stem + "所").join(fake).split(stem + "站").join(fake)
      .split(stem + "段").join(fake).split(stem + "引渠").join(fake)
      .split(stem).join(fake);
  });
  return nv;
}

function emit(pair, plan, globalMap, stemMap, metaVar, titleFallback, outFile) {
  const win = loadData(pair.file);
  const arr = win[pair.dataVar] || [];
  const metaIn = metaVar ? (win[metaVar] || {}) : {};
  const recs = arr.map((r, i) => {
    const it = plan[i];
    const segChan = it.cName ? it.cName : (it.p ? it.p[0] + "·主干渠段" : "干渠");
    const title = metaIn.title || titleFallback;
    const newPath = "/" + title + "/" + (it.oName || "直属") + "/" + segChan + "--" + it.btype + "/" + it.newName;
    let attrs = r.attrs;
    if (Array.isArray(attrs)) attrs = attrs.map(([k, v]) => {
      let val = String(v == null ? "" : v);
      if (OWNER_RE.test(String(k))) val = it.oName || decoyOf(val); // 权属/产权类字段脱敏为对应脱敏机构名
      return [k, val];
    });
    const rec = Object.assign({}, r);
    rec.name = it.newName; rec.office = it.oName; rec.station = it.sName; rec.chan = it.cName;
    if ("lon" in rec) rec.lon = it.lon;
    if ("lat" in rec) rec.lat = it.lat;
    rec.path = newPath; rec.attrs = attrs;
    if (Array.isArray(rec.photos)) rec.photos = [];
    return rec;
  });
  let body = "";
  if (metaVar) {
    const typesKey = metaIn.types ? "types" : (metaIn.subsystems ? "subsystems" : null);
    const officesOut = Array.from(new Set(recs.map(r => r.office).filter(Boolean)));
    const meta = Object.assign({}, metaIn);
    meta.title = metaIn.title || titleFallback;
    meta.author = metaIn.author || "科技推广中心";
    meta.offices = officesOut;
    if (typesKey && Array.isArray(metaIn[typesKey])) {
      meta[typesKey] = metaIn[typesKey].map(t => {
        let s = t;
        globalMap.forEach((fake, orig) => { if (orig && s.indexOf(orig) >= 0) s = s.split(orig).join(fake); });
        s = applyStems(s, stemMap);
        return s.replace(/^[\s·\-]+|[\s·\-]+$/g, "") || "设施";
      });
    }
    meta.counts = { point: recs.length, line: 0, nopos: 0, photo: 0, total: recs.length };
    body += "// 自动生成（脱敏示例数据，供公开测试版使用；名称取自著名真实水利工程、坐标示例，非单位内部资料）。\n";
    body += "window." + metaVar + " = " + JSON.stringify(meta) + ";\n";
  }
  body += "window." + pair.dataVar + " = " + JSON.stringify(recs) + ";\n";
  // 全局兜底擦洗：把所有原名/词干（含 attrs 中的 产权单位/单位管理/所属项目名称 等）按长度降序一次性替换，确保内部名绝不残留
  const finalMap = new Map();
  globalMap.forEach((fake, orig) => { if (orig) finalMap.set(orig, fake); });
  stemMap.forEach((fake, stem) => {
    ["管理所", "管理处", "管理段", "总干渠", "段引渠", "引渠", "水库", "闸门", "所", "站", "段", "闸"].forEach(suf => finalMap.set(stem + suf, fake));
    finalMap.set(stem, fake);
  });
  let out = body.split("演示数据").join("脱敏示例").split("演示").join("示例");
  Array.from(finalMap.keys()).sort((a, b) => b.length - a.length).forEach(orig => {
    if (orig) out = out.split(orig).join(finalMap.get(orig));
  });
  fs.writeFileSync(outFile, out, "utf-8");
  console.log("[ok] " + path.basename(outFile) + "  条数=" + recs.length);
}

const shuiliReal = path.join(ROOT, ".strip_backup/shuili");
const percReal = path.join(ROOT, ".strip_backup/perc");

// 水利一张图：先跨 data + kb 建全局映射
let g = buildPlan([
  { file: path.join(shuiliReal, "data.js.real.bak"), dataVar: "SHUILI_DATA", metaVar: "SHUILI_META" },
  { file: path.join(shuiliReal, "kb_building_seed.js.real.bak"), dataVar: "KB_BUILDING_SEED" },
]);
emit({ file: path.join(shuiliReal, "data.js.real.bak"), dataVar: "SHUILI_DATA" }, g.planByVar.SHUILI_DATA, g.globalMap, g.stemMap, "SHUILI_META", "水利工程基础信息一张图", path.join(ROOT, "android-build/shuili-v329/assets/data.demo.js"));
emit({ file: path.join(shuiliReal, "kb_building_seed.js.real.bak"), dataVar: "KB_BUILDING_SEED" }, g.planByVar.KB_BUILDING_SEED, g.globalMap, g.stemMap, null, "水利工程基础信息一张图", path.join(ROOT, "android-build/shuili-v329/assets/kb_building_seed.demo.js"));

// 水利感知平台
g = buildPlan([
  { file: path.join(percReal, "data.js.real.bak"), dataVar: "PERCEPTION_DATA", metaVar: "PERCEPTION_META" },
  { file: path.join(percReal, "kb_building_seed.js.real.bak"), dataVar: "KB_BUILDING_SEED" },
]);
emit({ file: path.join(percReal, "data.js.real.bak"), dataVar: "PERCEPTION_DATA" }, g.planByVar.PERCEPTION_DATA, g.globalMap, g.stemMap, "PERCEPTION_META", "水利感知项目一张图", path.join(ROOT, "android-build/perc-v13/assets/data.demo.js"));
emit({ file: path.join(percReal, "kb_building_seed.js.real.bak"), dataVar: "KB_BUILDING_SEED" }, g.planByVar.KB_BUILDING_SEED, g.globalMap, g.stemMap, null, "水利感知项目一张图", path.join(ROOT, "android-build/perc-v13/assets/kb_building_seed.demo.js"));

console.log("[done]");
