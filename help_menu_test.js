// help_menu_test.js — 信息与帮助子菜单运行时验证（openChangelog/四端功能对照单/功能介绍/关于 零异常）
const fs = require("fs"), vm = require("vm");
let pass = 0, fail = 0;
const T = (n, c) => { console.log((c ? "PASS" : "FAIL") + " " + n); c ? pass++ : fail++; };

function any() {
  const f = function () { return any(); };
  return new Proxy(f, {
    get(t, k) { if (k === Symbol.toPrimitive) return () => ""; if (k === "length") return 0; return any(); },
    set() { return true; }, apply() { return any(); }, has() { return true; }, construct() { return any(); }
  });
}
function mkSb() {
  const ls = {}; const sb = {};
  sb.console = { log() {}, error() {}, warn() {} };
  sb.localStorage = { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } };
  sb.navigator = { userAgent: "test" };
  sb.location = { href: "file:///x", reload() {} };
  sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout; sb.setInterval = setInterval; sb.clearInterval = clearInterval;
  sb.alert = () => {}; sb.confirm = () => true; sb.prompt = () => "";
  sb.innerWidth = 400; sb.innerHeight = 800;
  sb.devicePixelRatio = 2;
  sb.requestAnimationFrame = fn => setTimeout(fn, 0);
  sb.fetch = () => new Promise(() => {});
  sb.FileReader = function () {};
  sb.Blob = function () {};
  sb.URL = { createObjectURL: () => "blob:x", revokeObjectURL() {} };
  sb.TextDecoder = TextDecoder; sb.TextEncoder = TextEncoder;
  sb.Image = function () {};
  sb.addEventListener = () => {}; sb.removeEventListener = () => {};
  sb.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  sb.history = { pushState() {}, replaceState() {} };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.L = any();   // Leaflet 桩
  sb.screen = { width: 1080, height: 1920, availWidth: 1080, availHeight: 1848 };
  sb.__ls = ls;
  return sb;
}
// 宽松 DOM 桩（沿用 load_test 风格）
function domStub() {
  const store = {};
  return new Proxy(function () {}, {
    get(t, k) {
      if (k === "style") return store.style ||= {};
      if (k === "classList") return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (k === "children") return []; if (k === "dataset") return store.dataset ||= {};
      if (k === Symbol.toPrimitive) return () => "";
      if (/^(addEventListener|removeEventListener|appendChild|removeChild|remove|setAttribute|getAttribute|insertBefore|click|focus|blur|select|pause|play|load)$/.test(k)) return () => {};
      if (["querySelector", "closest", "parentNode", "parentElement", "firstChild", "lastChild"].includes(k)) return domStub();
      if (["querySelectorAll", "getElementsByTagName", "getElementsByClassName"].includes(k)) return () => [];
      if (k === "getBoundingClientRect") return () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
      if (["value", "textContent", "innerHTML", "innerText", "src", "id", "className"].includes(k)) return "";
      if (["files", "childNodes"].includes(k)) return [];
      return any();
    },
    set() { return true; }, apply() { return domStub(); }
  });
}

const CASES = [
  ["shuili", "android-build/shuili-v329/assets/app.js", ["openChangelog", "openPlatformCompare", "showHelp", "showAbout", "showStats"]],
  ["perc", "android-build/perc-v13/assets/app.js", ["openChangelog", "openPlatformCompare", "showHelp", "showAbout", "showStats"]],
  ["gujian", "travel/android/assets/app.js", ["openChangelog", "openPlatformCompare", "showHelp", "showAbout", "showStats"]],
];

for (const [name, file, fns] of CASES) {
  const sb = mkSb();
  sb.document = Object.assign(domStub(), { createElement: () => domStub(), head: domStub(), body: domStub(), documentElement: domStub(), getElementById: () => domStub(), querySelector: () => domStub(), querySelectorAll: () => [], addEventListener() {}, title: "t" });
  const ctx = vm.createContext(sb);
  const dir = file.replace(/[^/\\]+$/, "");
  // 按 index.html 顺序加载依赖脚本
  for (const dep of ["data.js", "kb_building_seed.js", "ovobj_bridge.js", "ai_seed.js", "ai_module.js", "ctx_menu.js"]) {
    try { vm.runInContext(fs.readFileSync(dir + dep, "utf8"), ctx, { filename: dep }); } catch (e) { console.log("  (dep " + dep + " 桩环境忽略: " + e.message + ")"); }
  }
  let src = fs.readFileSync(file, "utf8");
  // 在宿主 IIFE 末尾注入暴露钩子（仅测试用，不落盘）
  const m = [...src.matchAll(/\n\}\)\(/g)];
  if (!m.length) { console.log("FAIL " + name + " IIFE 锚点未找到"); fail++; continue; }
  const idx = src.indexOf("\n})(", 0);
  const insertAt = src.lastIndexOf("\n})(", idx + 1 >= 0 ? undefined : 0);
  // 取最后一个 "\n})("（宿主 IIFE 结束）
  const last = src.lastIndexOf("\n})(");
  const hook = "\n  window.__helpTest = { " + fns.map(f => f + ": " + f).join(", ") + " };";
  src = src.slice(0, last) + hook + src.slice(last);
  try {
    vm.runInContext(src, ctx, { filename: file });
    T(name + " 启动加载零异常", true);
  } catch (e) {
    T(name + " 启动加载零异常", false); console.log("   启动异常: " + e.message); continue;
  }
  for (const fn of fns) {
    try {
      vm.runInContext("window.__helpTest && window.__helpTest." + fn + " ? window.__helpTest." + fn + "() : (function(){throw new Error('未暴露')})()", ctx);
      T(name + " ." + fn + "() 零异常", true);
    } catch (e) {
      T(name + " ." + fn + "() 零异常", false); console.log("   " + fn + " 异常: " + (e && e.message));
    }
  }
}
console.log(fail === 0 ? "全部通过：" + pass : "失败 " + fail + " / 通过 " + pass);
process.exit(fail === 0 ? 0 : 1);
