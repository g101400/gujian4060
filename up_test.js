// 升级备份：导出 → 导入 往返测试（含自定义文件夹/文件名、合并模式、覆盖模式、文件概要）
const fs = require("fs"), vm = require("vm");
let pass = 0, fail = 0;
const T = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); cond ? pass++ : fail++; };

function mkSandbox() {
  const ls = {};
  const order = [];
  const sb = {};
  const saved = [];
  const els = {};
  const mkEl = (id) => ({
    id, style: {}, value: "", files: null, checked: false,
    set textContent(v) { this._t = v; }, get textContent() { return this._t || ""; },
    set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h || ""; }
  });
  sb.console = console;
  sb.localStorage = {
    getItem: k => (k in ls ? ls[k] : null),
    setItem: (k, v) => { if (!(k in ls)) order.push(k); ls[k] = String(v); },
    removeItem: k => { delete ls[k]; },
    key: i => order[i] || null,
    get length() { return order.length; }
  };
  sb.document = {
    getElementById: id => (els[id] = els[id] || mkEl(id)),
    getElementsByName: n => (n === "upMode" ? [els.upMode || (els.upMode = mkEl("upMode"))] : []),
    createElement: () => ({ style: {}, setAttribute() {}, click() {}, appendChild() {}, removeChild() {} }),
    body: { appendChild() {}, removeChild() {} },
    head: { appendChild() {} }
  };
  sb.__els = els; sb.__saved = saved; sb.__ls = ls;
  sb.Android = {
    saveBlobTo(dataUrl, folder, name) { saved.push({ dataUrl, folder, name }); },
    saveBlob(dataUrl, name) { saved.push({ dataUrl, folder: null, name }); }
  };
  sb.FileReader = function () {
    this.readAsText = (f) => { const self = this; setTimeout(() => { self.result = f && f.__text; self.onload && self.onload(); }, 0); };
  };
  sb.Blob = function () {}; sb.URL = { createObjectURL: () => "blob:x", revokeObjectURL() {} };
  sb.toast = () => {}; sb.esc = s => String(s); sb.APP_VERSION = "v3.53";
  sb.confirm = () => true;
  sb.btoa = s => Buffer.from(s, "binary").toString("base64");
  sb.unescape = global.unescape; sb.encodeURIComponent = encodeURIComponent;
  sb.setTimeout = setTimeout;
  sb.window = sb; sb.self = sb;
  return sb;
}

function loadApp(sb, cfgFile) {
  const ctx = vm.createContext(sb);
  vm.runInContext("var getReleaseChannel = function(){ return 'public'; };", ctx);
  vm.runInContext(fs.readFileSync(".workbuddy/upgrade_funcs.src.js", "utf8"), ctx, { filename: "upgrade_funcs.src.js" });
  vm.runInContext(fs.readFileSync(".workbuddy/" + cfgFile, "utf8"), ctx, { filename: cfgFile });
  return ctx;
}

(async () => {
  // ---- 场景：水利 ----
  const sb = mkSandbox();
  const ctx = loadApp(sb, "cfg_up_shuili.js");
  const ls = sb.__ls;
  // 1) 原始数据
  const recs0 = [{ id: "b1", name: "一号闸" }, { id: "b2", name: "二号闸" }, { id: "b3", name: "三号闸" }];
  vm.runInContext('localStorage.setItem("shuili_map_v2", ' + JSON.stringify(JSON.stringify(recs0)) + ')', ctx);
  vm.runInContext('localStorage.setItem("shuili_memos_v1", ' + JSON.stringify(JSON.stringify([{ id: "m1", title: "巡检记录" }])) + ')', ctx);
  vm.runInContext('localStorage.setItem("shuili_settings", ' + JSON.stringify(JSON.stringify({ theme: "dark" })) + ')', ctx);

  // 2) 默认文件名 / 目录
  const defName = vm.runInContext("upDefaultName()", ctx);
  const defDir = vm.runInContext("upDefaultDir()", ctx);
  T("水利默认文件名 = 水利一张图备份_日期.bak", /^水利一张图备份_\d{8}\.bak$/.test(defName));
  T("水利默认文件夹 = 水利一张图备份", defDir === "水利一张图备份");

  // 3) 自定义文件夹 + 文件名导出
  sb.__els.upDir = { value: "我的备份/2026" };
  sb.__els.upName = { value: "汛前检查备份" };
  vm.runInContext("upDoExport()", ctx);
  const s = sb.__saved[0];
  T("导出走 Android 桥并带自定义文件夹", !!s && s.folder === "我的备份/2026");
  T("自定义文件名自动补 .bak", !!s && s.name === "汛前检查备份.bak");
  const json = Buffer.from(s.dataUrl.split(",")[1], "base64").toString("utf8");
  const bundle = JSON.parse(json);
  T("备份内容格式正确（含全部数据键）", bundle.format === "yitu-upgrade-backup" &&
    Object.keys(bundle.payload).sort().join(",") === "shuili_map_v2,shuili_memos_v1,shuili_settings");
  T("备份中文未乱码（UTF-8 base64 正确）", json.includes("一号闸"));

  // 4) 换机/重装：清空后导入（合并模式，本机有一条备份里没有的条目）
  vm.runInContext('localStorage.setItem("shuili_map_v2", ' + JSON.stringify(JSON.stringify([{ id: "b9", name: "九号闸（本机独有）" }])) + ')', ctx);
  vm.runInContext('localStorage.removeItem("shuili_memos_v1"); localStorage.removeItem("shuili_settings");', ctx);
  sb.__els.upImportFile = { files: [{ name: "水利一张图备份_20260905.bak", __text: json }] };
  sb.__els.upImportMsg = { innerHTML: "" };
  sb.__els.upMode = { checked: false, value: "merge" }; // merge
  vm.runInContext("upDoImport()", ctx);
  await new Promise(r => setTimeout(r, 50));
  let arr = JSON.parse(ls["shuili_map_v2"]);
  T("合并导入：备份 3 条全部回来", ["b1", "b2", "b3"].every(id => arr.some(x => x.id === id)));
  T("合并导入：本机独有条目保留", arr.some(x => x.id === "b9"));
  T("合并导入：备忘录/设置恢复", !!ls["shuili_memos_v1"] && ls["shuili_settings"].includes("dark"));

  // 5) 覆盖模式：本机独有条目应被覆盖掉
  sb.__els.upMode.checked = true; sb.__els.upMode.value = "overwrite";
  vm.runInContext("upDoImport()", ctx);
  await new Promise(r => setTimeout(r, 50));
  arr = JSON.parse(ls["shuili_map_v2"]);
  T("覆盖导入：与备份一致（本机独有条目被覆盖）", arr.length === 3 && !arr.some(x => x.id === "b9"));

  // 6) 文件概要（导入前提示导出时间/版本）
  sb.__els.upFileInfo = { innerHTML: "" };
  vm.runInContext("upInspectFile()", ctx);
  await new Promise(r => setTimeout(r, 50));
  const info = sb.__els.upFileInfo.innerHTML;
  T("导入前显示导出时间/版本并可核对是否最新", info.includes("导出时间") && info.includes("v3.53") && info.includes("请确认这是最新备份"));

  // ---- 场景：感知 / 古建 默认名 ----
  const sb2 = mkSandbox(); const ctx2 = loadApp(sb2, "cfg_up_perc.js");
  T("感知默认文件名 = 感知设备一张图_日期.bak", /^感知设备一张图_\d{8}\.bak$/.test(vm.runInContext("upDefaultName()", ctx2)));
  const sb3 = mkSandbox(); const ctx3 = loadApp(sb3, "cfg_up_guijian.js");
  T("古建默认文件名 = 古建景点打卡备份_日期.bak", /^古建景点打卡备份_\d{8}\.bak$/.test(vm.runInContext("upDefaultName()", ctx3)));

  // ---- 场景：非本应用备份应被拒绝 ----
  vm.runInContext('localStorage.removeItem("shuili_map_v2")', ctx);
  sb.__els.upImportFile = { files: [{ name: "x.bak", __text: JSON.stringify({ format: "other", payload: {} }) }] };
  sb.__els.upImportMsg = { innerHTML: "" };
  sb.__els.upMode.checked = false;
  vm.runInContext("upDoImport()", ctx);
  await new Promise(r => setTimeout(r, 50));
  T("拒绝非本应用备份文件", String(sb.__els.upImportMsg.innerHTML).includes("不是本应用的升级备份文件"));

  console.log(fail === 0 ? "全部通过：" + pass : "失败 " + fail + " / 通过 " + pass);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log("ASYNC FAIL", e && (e.stack || e.message)); process.exit(1); });
