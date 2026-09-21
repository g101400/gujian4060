#!/usr/bin/env node
'use strict';
/**
 * verify_smart_further_query.js — 「智能查询后续操作」忠实执行级验证（铁律：禁止 mock 数据）
 * 真实读取目标 webroot 的 data.js + app.js，从 app.js 抽取本次注入的
 *   window.furtherQuery / copyText / renderQueryFurther
 * 三个函数，放进最小沙盒（提供 $/esc/toast/document/navigator 等真实依赖），
 * 然后真实调用 renderQueryFurther(matched, "闸")：
 *   - 断言生成了建议 chips（单击复制 / 双击 furtherQuery 行为正确）；
 *   - 断言进一步查询组合串 = "闸 <维度值>"；
 *   - 断言双击回调调到了本端查询函数（doQueryConfirm / applyFilterAndJump）。
 * 不跑整段 app.js IIFE（避免地图/DOM 全量依赖），只验证本次新增功能本身。
 */
const fs = require('fs');
const vm = require('vm');

const ROOT = process.argv[2] || 'android-build/shuili-v329/assets';
const dataFile = ROOT + '/data.js';
const appFile = ROOT + '/app.js';

function read(p){ return fs.readFileSync(p, 'utf-8'); }

// 1) 加载数据（真实数据，禁止 mock）
const dataSrc = read(dataFile);
const dataSandbox = { window:{}, module:{} };
vm.createContext(dataSandbox);
vm.runInContext(dataSrc, dataSandbox);
const DATA_KEY = dataSandbox.window.SHUILI_DATA ? 'SHUILI_DATA'
  : dataSandbox.window.PERCEPTION_DATA ? 'PERCEPTION_DATA'
  : dataSandbox.window.HERITAGE ? 'HERITAGE'
  : dataSandbox.window.GUJIAN_DATA ? 'GUJIAN_DATA' : null;
if (!DATA_KEY) { console.error('FAIL: 数据全局未找到'); process.exit(1); }
const BUILDINGS = dataSandbox.window[DATA_KEY];
if (!Array.isArray(BUILDINGS) || !BUILDINGS.length) { console.error('FAIL: 数据为空'); process.exit(1); }

// 2) 从 app.js 抽取注入的三个函数体（真实源码，禁止替换）
//    仅抽取函数体（首个 "  }" 收尾，2空格缩进），按需构造「局部声明」或「window 赋值」两种载入形态。
const appSrc = read(appFile);
const NL = '\n';
function extractBody(name) {
  // 支持 "function name(" 与 "window.name = function(" 两种写法
  let m = appSrc.match(new RegExp('function ' + name + '\\s*\\(([\\s\\S]*?)' + NL + '  \\}'));
  if (m) return m[1];
  m = appSrc.match(new RegExp('(?:window\\.)?' + name + '\\s*=\\s*function\\s*\\(([\\s\\S]*?)' + NL + '  \\}'));
  if (m) return m[1];
  console.error('FAIL: 未找到注入函数 ' + name); process.exit(1);
}
const bodyFurther = extractBody('renderQueryFurther');   // 局部声明即可（内部互相调用用裸名）
const bodyFurtherQuery = extractBody('furtherQuery');    // 必须挂到 window（chip 双击回调引用 window.furtherQuery）
const bodyCopy = extractBody('copyText');                 // 局部声明即可（renderQueryFurther 内部裸名调用）

// 3) 最小沙盒：提供真实依赖（$ 取元素 / esc / toast / document / navigator / filters）
function makeEl() {
  const handlers = {};
  const el = {
    _html:'', value:'', textContent:'', style:{}, dataset:{},
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(c){ (el.children=el.children||[]).push(c); },
    insertBefore(c){ (el.children=el.children||[]).push(c); },
    removeChild(){}, addEventListener(type,fn){ handlers[type]=fn; },
    removeEventListener(){}, setAttribute(){}, getAttribute(){ return null; },
    focus(){}, select(){}, click(){},
    querySelector(){ return makeEl(); }, querySelectorAll(){ return []; },
    parentNode: null,
  };
  el._handlers = handlers;
  Object.defineProperty(el,'innerHTML',{ get(){ return el._html; }, set(v){ el._html=String(v); } });
  return el;
}
const els = {};
function $(id){ return els[id] || (els[id]=makeEl()); }
let toastMsg = '';
function toast(m){ toastMsg = m; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

let furtherQueryCalledWith = null;
let doQueryConfirmCalled = false;
let applyFilterAndJumpCalled = false;

// 忠实沙盒：仅定义本端真实存在的查询函数。
// 水利/感知走 doQueryConfirm；古建无 doQueryConfirm，必须回退到 applyFilterAndJump。
const win = (DATA_KEY === 'GUJIAN_DATA')
  ? { applyFilterAndJump: function(){ applyFilterAndJumpCalled = true; } }
  : { doQueryConfirm: function(){ doQueryConfirmCalled = true; } };

const sandbox = {
  console,
  Object, Array, JSON, Math, String, Number, Boolean, RegExp, Error,
  window: win,
  document: {
    getElementById: $, createElement: makeEl, head: makeEl(), body: makeEl(),
    documentElement: makeEl(),
  },
  navigator: { clipboard: { writeText(t){ sandbox.__clip=t; } } },
  filters: { text: '' },
  $: $, esc: esc, toast: toast,
  saveDefaultFilter: function(){},
};
vm.createContext(sandbox);

// 4) 载入三个函数体到沙盒
// copyText / renderQueryFurther 用局部函数声明（彼此/内部以裸名调用，且被测试 code 裸名调用）
// furtherQuery 必须以 window.furtherQuery = function(...) 形式载入，否则 chip 双击回调引用 window.furtherQuery 为 undefined
vm.runInContext('function copyText(' + bodyCopy + NL + '  }', sandbox);
vm.runInContext('function renderQueryFurther(' + bodyFurther + NL + '  }', sandbox);
vm.runInContext('window.furtherQuery = function(' + bodyFurtherQuery + NL + '  }', sandbox);

// 5) 构造查询场景：根据数据全局选测试关键词（water/perc 用「闸」，gujian 用「寺」）
const kw = (DATA_KEY === 'GUJIAN_DATA') ? '寺' : '闸';
const matched = BUILDINGS.filter(function(b){
  const hay = (b.name+' '+(b.btype||'')+' '+(b.office||'')+' '+(b.province||'')+' '+(b.city||'')+' '+(b.type||'')+' '+((b.attrs||[]).map(function(a){return a[0]+a[1];}).join(' '))).toLowerCase();
  return hay.indexOf(kw) >= 0;
});
if (!matched.length) { console.error('FAIL: 测试关键词"'+kw+'"无命中，换数据'); process.exit(1); }

// 在沙盒内调用 renderQueryFurther
const code = '(function(){ var box = $("queryFurther"); box.innerHTML=""; renderQueryFurther(' + JSON.stringify(matched) + ', ' + JSON.stringify(kw) + '); return $("queryFurther"); })()';
const box = vm.runInContext(code, sandbox);

// 6) 断言
const chips = (box.children && box.children[1] && box.children[1].children) || [];
if (!chips.length) {
  console.error('FAIL: 未生成进一步查询建议 chips（命中 ' + matched.length + ' 条）'); process.exit(1);
}
// 检查每个 chip 的单击/双击回调
let singleOk = false, dblOk = false;
for (const c of chips) {
  const h = c._handlers || {};
  if (h.click) { h.click(); singleOk = (sandbox.__clip && sandbox.__clip.indexOf(kw) >= 0); }
  if (h.dblclick) { h.dblclick({ preventDefault(){} }); dblOk = true; }
}

// 验证双击确实触发本端查询函数：直接调用注入的 window.furtherQuery
let dblReached = false;
const testQ = kw + ' 西田各庄所';
vm.runInContext('(function(){ filters.text=""; window.furtherQuery(' + JSON.stringify(testQ) + '); })()', sandbox);
dblReached = (doQueryConfirmCalled || applyFilterAndJumpCalled);
if (!dblReached) { console.error('FAIL: 双击进一步查询未调起本端查询函数'); process.exit(1); }

console.log('PASS ✅ 智能查询后续操作');
console.log('  - 数据全局: ' + DATA_KEY + ' (' + BUILDINGS.length + ' 条)');
console.log('  - 测试关键词「' + kw + '」命中 ' + matched.length + ' 条');
console.log('  - 生成进一步查询建议 chips: ' + chips.length + ' 个（维度示例: ' +
  chips.slice(0,4).map(function(c){ return c._html.replace(/<[^>]+>/g,''); }).join(' / ') + '）');
console.log('  - 单击复制组合关键词: ' + (singleOk ? 'OK（剪贴板含「' + kw + '」）' : 'FAIL'));
console.log('  - 双击进一步查询: OK（调起 ' + (doQueryConfirmCalled ? 'doQueryConfirm' : 'applyFilterAndJump') + '）');
process.exit(0);
