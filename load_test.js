
function any() {
  const f = function(){ return any(); };
  return new Proxy(f, {
    get(t, k){ if (k === Symbol.toPrimitive) return () => ""; if (k === "length") return 0; return any(); },
    set(){ return true; },
    apply(){ return any(); },
    has(){ return true; },
    construct(){ return any(); }
  });
}
// 浏览器语义加载验证：vm 全局脚本 + 宽松 DOM 桩，验证启动与菜单函数调用零 ReferenceError
const fs = require("fs"), vm = require("vm");
let load_test_any = true;
function dummyEl() {
  if (load_test_any) { return any(); }
  const store = {};
  return new Proxy(function(){}, {
    get(t, k) {
      if (k === "style") return store.style ||= {};
      if (k === "classList") return { add(){}, remove(){}, toggle(){}, contains(){ return false; } };
      if (k === "children") return [];
      if (k === "dataset") return store.dataset ||= {};
      if (k === Symbol.toPrimitive) return () => "";
      if (typeof k === "string" && /^(addEventListener|removeEventListener|appendChild|removeChild|remove|setAttribute|getAttribute|insertBefore|click|focus|blur|select|pause|play|load)$/.test(k)) return () => {};
      if (k === "querySelector" || k === "closest" || k === "parentNode" || k === "parentElement" || k === "firstChild" || k === "lastChild") return dummyEl();
      if (k === "querySelectorAll" || k === "getElementsByTagName" || k === "getElementsByClassName") return () => [];
      if (k === "getBoundingClientRect") return () => ({ left:0, top:0, right:0, bottom:0, width:0, height:0 });
      if (k === "value" || k === "textContent" || k === "innerHTML" || k === "innerText" || k === "src" || k === "id" || k === "className") return "";
      if (k === "files" || k === "childNodes") return [];
      return dummyEl();
    },
    set() { return true; },
    apply() { return dummyEl(); },
    has() { return true; }
  });
}
function makeSandbox(file) {
  const lsStore = {};
  const sb = {};
  const doc = dummyEl();
  Object.assign(sb, {
    console: { log(){}, info(){}, warn(){}, error(){} },
    document: doc,
    localStorage: { getItem: k => (k in lsStore ? lsStore[k] : null), setItem: (k,v)=>{ lsStore[k]=String(v); }, removeItem: k=>{ delete lsStore[k]; }, clear: ()=>{}, key: ()=>null, get length(){ return Object.keys(lsStore).length; } },
    navigator: { userAgent: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile", onLine: true, language: "zh-CN", geolocation: { getCurrentPosition(ok){ ok({ coords:{ latitude:40, longitude:116 } }); } } },
    location: { href: "file:///android_asset/index.html", protocol: "file:", search: "", hash: "", reload(){}, assign(){} },
    history: { pushState(){}, replaceState(){} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: cb => setTimeout(cb, 0), cancelAnimationFrame: clearTimeout,
    fetch: () => new Promise((res) => setTimeout(() => res({ ok:true, json: async () => ({}), text: async () => "" }), 0)),
    XMLHttpRequest: function(){ this.open=()=>{}; this.send=()=>{}; this.setRequestHeader=()=>{}; },
    FileReader: function(){ this.readAsText=()=>{}; this.readAsArrayBuffer=()=>{}; this.readAsDataURL=()=>{}; },
    Blob: function(){}, URL: { createObjectURL: () => "blob:x", revokeObjectURL(){} },
    FormData: function(){}, Image: function(){},
    crypto: { getRandomValues: a => a },
    alert(){}, confirm(){ return true; }, prompt(){ return ""; },
    matchMedia: () => ({ matches:false, addListener(){}, addEventListener(){} }),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){},
    innerWidth: 1080, innerHeight: 1920, devicePixelRatio: 2,
    L: any(),
    APP_VERSION: "", APPNAME: ""
  });
  sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.top = sb; sb.parent = sb;
  sb.__call = (expr) => vm.runInContext(expr, ctx);
  const ctx = vm.createContext(sb);
  return { sb, ctx };
}
const file = process.argv[2];
const dir = require("path").dirname(file);
const pre = ["ovobj_bridge.js", "ctx_menu.js", "ai_seed.js", "ai_module.js"].map(f => dir + "/" + f).filter(f => fs.existsSync(f));
const { ctx } = makeSandbox(file);
for (const pf of pre) { try { vm.runInContext(fs.readFileSync(pf, "utf8"), ctx, { filename: pf }); } catch (e) { console.log("PRE ERROR", pf, e.message); } }
const code = fs.readFileSync(file, "utf8");
const checks = process.argv[3] ? process.argv[3].split(",") : [];
try {
  vm.runInContext(code, ctx, { filename: file });
  console.log("STARTUP OK");
  for (const fn of checks) {
    try {
      const r = vm.runInContext(`(typeof ${fn} === "function") ? (${fn})() : "MISSING"`, ctx);
      console.log(`CALL ${fn} ->`, r === undefined ? "OK(无异常)" : r);
    } catch (e) { console.log(`CALL ${fn} ERROR:`, e.message); }
  }
} catch (e) {
  console.log("STARTUP ERROR:", e.message, "@", (e.stack.split("\n")[0]||""));
}
process.exit(0);
