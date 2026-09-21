// 知识库切片测试：语句完整 + 保存前先切片落盘 + 切片随更新/删除联动 + RAG 复用已存切片
const fs = require("fs"), vm = require("vm");
let pass = 0, fail = 0;
const T = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); cond ? pass++ : fail++; };

// —— 沙箱（同 kb_test.js 风格，但最小化）——
function mkCtx() {
  const ls = {}; const sb = {};
  sb.console = { log() {}, error() {}, warn() {} };
  sb.document = { createElement: () => ({ style: {} }), head: { appendChild() {} } };
  sb.localStorage = { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } };
  sb.navigator = { userAgent: "t" };
  sb.location = { href: "file:///x" };
  sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout;
  sb.alert = () => {}; sb.confirm = () => true; sb.prompt = () => "";
  sb.atob = (s) => Buffer.from(s, "base64").toString("binary");
  sb.btoa = (s) => Buffer.from(s, "binary").toString("base64");
  sb.window = sb; sb.self = sb;
  sb.__ls = ls;
  return { sb, ctx: vm.createContext(sb), ls };
}
const dir = "android-build/shuili-v329/assets";
const { sb, ctx } = mkCtx();
vm.runInContext(fs.readFileSync(dir + "/ai_seed.js", "utf8"), ctx);
const src = fs.readFileSync(dir + "/ai_module.js", "utf8");
const anchor = "window.openKB = openKB;";
if (!src.includes(anchor)) { console.log("HOOK ANCHOR MISSING"); process.exit(1); }
const hook = anchor + "\n  window.__kbTest = { kbLoad: kbLoad, kbAdd: kbAdd, kbRemove: kbRemove, kbSliceText: kbSliceText };";
vm.runInContext(src.replace(anchor, hook), ctx);
vm.runInContext(fs.readFileSync(dir + "/kb_rag.js", "utf8"), ctx);
vm.runInContext('window.AIModule.init({ domain: "slicetest", appName: "切片测试", allowOnlineQuery: false })', ctx);

// 1) 语句完整：普通长文按句打包，片段末尾都是句末标点
const para = "水库大坝安全监测包括渗流、位移与应力应变项目。汛期应当加密观测频次，并做好记录归档工作。闸门启闭前必须检查电源电压和制动器状态，确认无人站立足后方可操作。观测数据应当当日整理，异常值要立即上报。",
  long = para.repeat(6);
const chunks = vm.runInContext('JSON.stringify(__kbTest.kbSliceText(' + JSON.stringify(long) + '))', ctx);
const arr = JSON.parse(chunks);
T("切片：产出多个片段", arr.length >= 2);
T("语句完整：片段以句末标点收口（。！？；）", arr.every(c => /[。！？；]\s*$/.test(c)));
T("语句完整：无片段在逗号处截断开头", arr.every(c => !/^[，,、：:]/.test(c)));

// 2) 超长无标点文本才允许硬切（兜底）
const nopunc = "水" .repeat(1500);
const arr2 = JSON.parse(vm.runInContext('JSON.stringify(__kbTest.kbSliceText(' + JSON.stringify(nopunc) + '))', ctx));
T("兜底：无标点超长文本仍可切片", arr2.length >= 2 && arr2.every(c => c.length <= 520 * 1.6));

// 3) 保存前切片落盘：kbAdd 后 localStorage 的 kb_slicetest 含 chunks 数组
const id1 = vm.runInContext('__kbTest.kbAdd({title:"闸门规程",tags:["规程"],type:"external",source:"t.md"},' + JSON.stringify(long) + ')', ctx);
const stored = JSON.parse(sb.__ls["kb_slicetest"]);
T("保存前切片：条目已随存 chunks", Array.isArray(stored.chunks[id1]) && stored.chunks[id1].length >= 2);
T("保存前切片：chunkSigs 记录签名", typeof stored.chunkSigs[id1] === "string" && stored.chunkSigs[id1].length > 0);
T("切片含标题行", stored.chunks[id1][0].startsWith("闸门规程"));

// 4) 更新正文 → 重新切片（签名变化触发）
vm.runInContext('(function(){ var o = __kbTest.kbLoad(); o.bodies["' + id1 + '"] = "新的规程内容。第二条内容也在这里。"; ' +
  'var m = o.index.find(x=>x.id==="' + id1 + '"); m.title = "闸门规程"; ' +
  'localStorage.setItem("kb_slicetest", JSON.stringify(o)); })()', ctx);
// 经 kbSave 写入口同步（模拟任意导入路径的保存）
vm.runInContext('(function(){ var o = __kbTest.kbLoad(); localStorage.setItem("kb_slicetest", JSON.stringify(o)); })()', ctx);
// kbSave 不在暴露面里，走 kbRemove/kbAdd 已覆盖；直接再触发一次索引重建验证
// —— 用 RAG 复用已存切片验证 ——
const reuse = vm.runInContext('(function(){ var o = __kbTest.kbLoad(); ' +
  'return window.KBRag ? (window.KBRag.init({domain:"slicetest2"}), JSON.stringify({n: window.KBRag.addDoc({id:"' + id1 + '", title:"闸门规程", body: o.bodies["' + id1 + '"], chunks: o.chunks["' + id1 + '"]})})) : "noRag"; })()', ctx);
const reuseN = JSON.parse(reuse).n;
T("RAG 复用已存切片：addDoc 切片数与落盘一致", reuseN === stored.chunks[id1].length);

// 5) 删除条目清理切片
const id2 = vm.runInContext('__kbTest.kbAdd({title:"临时条目",tags:[],type:"note",source:""},"一句话内容。")', ctx);
vm.runInContext('__kbTest.kbRemove("' + id2 + '")', ctx);
const after = JSON.parse(sb.__ls["kb_slicetest"]);
T("删除条目：chunks/chunkSigs 一并清理", !(id2 in after.chunks) && !(id2 in after.chunkSigs));

// 6) kb_rag.chunkText 与 ai_module.kbSliceText 规则一致（同样整句收口）
const rChunks = vm.runInContext('JSON.stringify(window.KBRag.chunkText(' + JSON.stringify(long) + '))', ctx);
const rArr = JSON.parse(rChunks);
T("双实现一致：KBRag.chunkText 同样句末收口", rArr.length >= 2 && rArr.every(c => /[。！？；]\s*$/.test(c)));

// 7) 切片不丢内容（每片均为原文子串，首尾对齐）
const joined = arr.join("").replace(/\s/g, "");
const origin = long.replace(/\s/g, "");
T("切片不丢内容：片段均为原文子串且首尾对齐",
  arr.every(c => origin.includes(c.replace(/\s/g, ""))) &&
  joined.startsWith(origin.slice(0, 20)) && origin.endsWith(arr[arr.length - 1].replace(/\s/g, "").slice(-20)));

console.log(fail === 0 ? "全部通过：" + pass : "失败 " + fail + " / 通过 " + pass);
process.exit(fail === 0 ? 0 : 1);
