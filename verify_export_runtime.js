#!/usr/bin/env node
/**
 * verify_export_runtime.js — 导出菜单「真实执行」验证
 * 加载 data.js + ovobj_bridge.js + app.js（与浏览器同序），在忠实沙盒中实际调用
 * exportTable() / openExportPhotos() / doExportTable() / doExportPhotos()，
 * 断言不抛错。区别于 verify_threemap_harness 的 noop 掩码：本脚本对「应用内未定义函数」
 * 不做掩码，能真正捕获 ReferenceError（即 WebView 报的 script error）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.CLAW_ROOT || 'D:/Users/Claw';
const ROOT = process.argv[2] || 'android-build/water-v329/assets';

function makeEl(id) {
  const el = {
    id, _html: '', textContent: '', value: '', style: {}, dataset: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    children: [],
    appendChild(){}, removeChild(){}, insertBefore(){},
    addEventListener(){}, removeEventListener(){}, setAttribute(){}, getAttribute(){ return null; },
    removeAttribute(){}, focus(){}, click(){}, scrollIntoView(){},
    getContext(){ return {}; }, width:0, height:0,
    querySelector(){ return makeEl('q'); },
    querySelectorAll(){ return []; },
    insertAdjacentHTML(){},
  };
  Object.defineProperty(el, 'innerHTML', { get(){ return el._html; }, set(v){ el._html = String(v); } });
  return el;
}

function buildSandbox() {
  const els = {};
  const getEl = (id) => (els[id] || (els[id] = makeEl(id)));
  const doc = {
    getElementById: getEl,
    createElement: () => makeEl('new'),
    createDocumentFragment: () => makeEl('frag'),
    createTextNode: (t) => ({ text: t }),
    querySelector: () => makeEl('q'),
    querySelectorAll: () => [],
    addEventListener(){}, removeEventListener(){},
    body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head'),
    title:'', cookie:'',
  };
  const target = {
    console,
    Object, Array, JSON, Math, Date, String, Number, Boolean, RegExp, Error,
    TypeError, ReferenceError, SyntaxError, RangeError, Promise, Symbol, Map, Set,
    WeakMap, WeakSet, Proxy, Reflect, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    setTimeout: ()=>0, clearTimeout(){}, setInterval: ()=>0, clearInterval(){},
    requestAnimationFrame: ()=>0, cancelAnimationFrame(){},
    localStorage: { getItem:()=>null, setItem(){}, removeItem(){}, clear(){} },
    navigator: { userAgent:'node', clipboard:{ writeText(){} } },
    location: { href:'http://localhost/', search:'', hash:'' },
    performance: { now:()=>0 },
    document: doc,
    L: (function chainProxy(){ const fn=function(){return p;}; const p=new Proxy(fn,{ get(t,k){ if(k==='then') return undefined; return chainProxy(); }, apply(){ return p; } }); return p; })(),
    fetch: async () => ({ ok:true, text: async()=>'', json: async()=>({}) }),
    XMLHttpRequest: function(){ return { open(){}, send(){}, setRequestHeader(){} }; },
    Image: function(){ return makeEl('img'); },
    Blob: function(){}, URL: { createObjectURL:()=>'blob:x', revokeObjectURL(){} },
    alert(){}, confirm:()=>true, prompt:()=>null,
    toast(){}, ask:()=>true, busy(){}, idle(){}, _logErr(){},
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){},
    matchMedia(){ return { matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }; },
    getComputedStyle(){ return { getPropertyValue(){ return ''; } }; },
    scrollTo(){}, open(){}, close(){}, focus(){}, postMessage(){},
    openSheet(name){ target.__lastSheet = name; }, closeSheet(){},
    JSZip: function(){ return { file(){}, generateAsync(){ return Promise.resolve({}); } }; },
  };
  const sandbox = new Proxy(target, {
    get(t,k){
      if (k===Symbol.unscopables) return undefined;
      if (k in t) return t[k];
      if (k==='window'||k==='self'||k==='globalThis') return sandbox;
      // 注意：不再对未知全局返回 noop，而是让它真正抛 ReferenceError（捕获真源 bug）
      return undefined;
    },
    set(t,k,v){ t[k]=v; return true; },
  });
  sandbox.window = sandbox; sandbox.self = sandbox;
  return sandbox;
}

function main() {
  const dir = path.resolve(BASE, ROOT);
  const load = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
  const src = ['data.js','ovobj_bridge.js','app.js'].map(load).join('\n;\n');
  const sandbox = buildSandbox();
  let loadErr = null;
  try { vm.runInNewContext(src, sandbox, { filename: ROOT+'+app.js' }); }
  catch (e) { loadErr = e; }
  if (loadErr) { console.log('[LOAD-FAIL]', loadErr.message); process.exit(2); }
  console.log('[LOAD-OK] data.js+bridge+app.js 加载成功，BUILDINGS=', (sandbox.BUILDINGS||[]).length);

  const tests = ['exportTable','openExportPhotos','doExportTable','doExportPhotos'];
  let failed = 0;
  for (const name of tests) {
    if (typeof sandbox[name] !== 'function') { console.log(`[SKIP] ${name} 未暴露`); continue; }
    try { sandbox[name](); console.log(`[PASS] ${name}() 无抛错`); }
    catch (e) { failed++; console.log(`[FAIL] ${name}() 抛错: ${e.message}`); }
  }
  console.log(failed ? `\n❌ ${failed} 个导出菜单抛错` : '\n✅ 导出菜单全部无 script error');
  process.exit(failed ? 1 : 0);
}
main();
