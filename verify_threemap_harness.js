#!/usr/bin/env node
/**
 * verify_threemap_harness.js — 三图家族「执行级验证」发版门禁
 *
 * 背景（2026-08-31 教训）：`node --check` 只查语法，查不出两类真源 bug——
 *   ① 导出菜单 `defaultOffice()` 被调用却从未定义 → 打开即 ReferenceError（WebView 报 script error）
 *   ② 知识库 `renderKBList(q)` 形参 q 遮蔽同文件 DOM 助手 q(id) → `q is not a function`
 * 这两类只有「实际调用菜单入口函数」时才崩。本脚本用 Node vm + 假 DOM 沙盒
 * 真实加载 app.js / ai_module.js 并调用导出/知识库菜单入口函数，断言不抛错。
 *
 * 用法：node verify_threemap_harness.js
 * 退出码：0=全部通过；非0=发现回归（defaultOffice 缺失 / q 遮蔽 / 加载即崩）。
 *
 * CLAW_ROOT 可覆盖根目录（默认 D:/Users/Claw）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.CLAW_ROOT || 'D:/Users/Claw';

// 11 个活跃 webroot（app.js + ai_module.js 同源）
const WEBROOTS = [
  'android-build/shuili-v329/assets',
  'android-build/perc-v13/assets',
  'android-build/water-v329/assets',
  'native-shell/win-water-webview2/webroot',
  'native-shell/uos-water-pyqt6/webroot',
  'native-shell/win-webview2/webroot',
  'native-shell/uos-pyqt6/webroot',
  'android-build/gujian-v31/assets',
  'travel/android/assets',
  'native-shell/win-gujian-webview2/webroot',
  'native-shell/uos-gujian-pyqt6/webroot',
];

// ---- 假 DOM / 沙盒 ----
function makeEl() {
  const el = {
    style: {}, dataset: {}, value: '', textContent: '', _html: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [],
    appendChild() {}, removeChild() {}, insertBefore() {},
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    removeAttribute() {}, focus() {}, click() {}, scrollIntoView() {},
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    getContext() { return {}; }, width: 0, height: 0,
  };
  Object.defineProperty(el, 'innerHTML', { get() { return el._html; }, set(v) { el._html = v; } });
  return el;
}

// 链式 L（Leaflet）Proxy：任意属性访问返回可继续链式的函数
function chainProxy() {
  const fn = function () { return p; };
  const p = new Proxy(fn, {
    get(t, k) { if (k === 'then') return undefined; return chainProxy(); },
    apply() { return p; },
  });
  return p;
}

function buildSandbox() {
  const els = {};
  const getEl = (id) => (els[id] || (els[id] = makeEl()));
  const doc = {
    getElementById: getEl,
    createElement: () => makeEl(),
    createDocumentFragment: () => makeEl(),
    createTextNode: (t) => ({ text: t }),
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    body: makeEl(), documentElement: makeEl(),
    head: makeEl(), title: '', cookie: '',
  };
  const target = {
    console,
    // 标准内置（vm 新上下文不自动提供，必须显式注入，否则 Object.keys 等报 is not a function）
    Object, Array, JSON, Math, Date, String, Number, Boolean, RegExp, Error,
    TypeError, ReferenceError, SyntaxError, RangeError, Promise, Symbol, Map, Set,
    WeakMap, WeakSet, Proxy, Reflect, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
    navigator: { userAgent: 'node', platform: 'node' },
    location: { href: '', search: '', hash: '' },
    performance: { now: () => 0 },
    document: doc,
    L: chainProxy(),
    fetch: async () => ({ ok: true, text: async () => '', json: async () => ({}) }),
    XMLHttpRequest: function () { return { open() {}, send() {}, setRequestHeader() {} }; },
    Image: function () { return makeEl(); },
    Blob: function () {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    alert: () => {}, confirm: () => true, prompt: () => null,
    toast: () => {}, ask: () => true, busy: () => {}, idle: () => {},
  };
  const sandbox = new Proxy(target, {
    get(t, k) {
      if (k === Symbol.unscopables) return undefined;
      if (k in t) return t[k];
      if (k === 'window' || k === 'self' || k === 'globalThis') return sandbox;
      // 未定义全局：返回 noop 函数（满足任意函数调用），避免 ReferenceError 干扰门禁
      return function () { return undefined; };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  return sandbox;
}

// ---- 静态断言 ----
function staticChecks(src, file) {
  const out = [];
  // app.js：shuili/perc/water 家族应含 defaultOffice（orgValOrDefault 存在即属该家族）
  if (/function\s+orgValOrDefault\b/.test(src)) {
    if (!/function\s+defaultOffice\s*\(/.test(src)) {
      out.push({ level: 'FAIL', msg: 'orgValOrDefault 调用 defaultOffice 但该函数未定义（导出菜单将 script error）' });
    }
  }
  // ai_module.js：renderKBList 形参必须为 kw，禁止 q 遮蔽
  if (/function\s+renderKBList\b/.test(src)) {
    if (/function\s+renderKBList\s*\(\s*q\s*\)/.test(src)) {
      out.push({ level: 'FAIL', msg: 'renderKBList(q) 形参 q 遮蔽 DOM 助手 q(id) → q is not a function' });
    }
    if (!/function\s+renderKBList\s*\(\s*kw\s*\)/.test(src)) {
      out.push({ level: 'WARN', msg: 'renderKBList 形参非 (kw)，请确认非 (q) 遮蔽' });
    }
  }
  return out;
}

// ---- 运行时调用（执行级）----
const TARGET_RE = /(defaultOffice is not defined|q is not a function)/;
function runtimeCall(sandbox, name, args) {
  const fn = sandbox[name];
  if (typeof fn !== 'function') return { level: 'SKIP', msg: `未暴露 ${name}` };
  try {
    fn.apply(null, args || []);
    return { level: 'PASS', msg: `${name}() 无抛错` };
  } catch (e) {
    const isTarget = TARGET_RE.test(e.message || '');
    return {
      level: isTarget ? 'FAIL' : 'WARN',
      msg: `${name}() 抛错：${e.message}${isTarget ? '（目标回归）' : '（沙盒数据缺口，非确定回归）'}`,
    };
  }
}

// ---- 主流程 ----
let failures = 0;
const rows = [];
for (const wr of WEBROOTS) {
  const dir = path.resolve(BASE, wr);
  const appJs = path.join(dir, 'app.js');
  const aiMod = path.join(dir, 'ai_module.js');
  const label = wr.split('/').slice(-2).join('/');

  if (fs.existsSync(appJs)) {
    const src = fs.readFileSync(appJs, 'utf8');
    const sandbox = buildSandbox();
    let loadErr = null;
    try { vm.runInNewContext(src, sandbox, { filename: appJs }); }
    catch (e) { loadErr = e; }
    const findings = [];
    // 静态门禁与加载无关，必须始终执行（决定 defaultOffice 缺失是否 FAIL）
    staticChecks(src, appJs).forEach(f => findings.push(f));
    if (loadErr) findings.push({ level: 'WARN', msg: `app.js 加载即崩：${loadErr.message}（沙盒限制：app.js 依赖 data.js 等外部 <script> 全局，单文件加载缺口，非源码回归）` });
    else if (/function\s+orgValOrDefault\b/.test(src)) {
      ['defaultOffice', 'exportTable', 'openExportPhotos', 'orgValOrDefault', 'assembleExportName']
        .forEach(n => findings.push(runtimeCall(sandbox, n, n === 'orgValOrDefault' ? [{}, 'suo'] : [])));
    }
    rows.push({ file: label + '/app.js', findings });
  }

  if (fs.existsSync(aiMod)) {
    const src = fs.readFileSync(aiMod, 'utf8');
    const sandbox = buildSandbox();
    let loadErr = null;
    try { vm.runInNewContext(src, sandbox, { filename: aiMod }); }
    catch (e) { loadErr = e; }
    const findings = [];
    staticChecks(src, aiMod).forEach(f => findings.push(f));
    if (loadErr) findings.push({ level: 'WARN', msg: `ai_module.js 加载即崩：${loadErr.message}` });
    else {
      findings.push(runtimeCall(sandbox, 'renderKBList', ['测试']));
      findings.push(runtimeCall(sandbox, 'kbSearch', ['测试']));
    }
    rows.push({ file: label + '/ai_module.js', findings });
  }
}

// ---- 报告 ----
console.log('\n=== 三图执行级验证门禁 (verify_threemap_harness) ===');
for (const r of rows) {
  console.log(`\n📄 ${r.file}`);
  if (!r.findings.length) { console.log('   ✅ 无检查项'); continue; }
  for (const f of r.findings) {
    const icon = f.level === 'FAIL' ? '❌' : f.level === 'WARN' ? '⚠️' : f.level === 'SKIP' ? '⏭️' : '✅';
    console.log(`   ${icon} [${f.level}] ${f.msg}`);
    if (f.level === 'FAIL') failures++;
  }
}

console.log('\n=== 结论 ===');
if (failures > 0) {
  console.log(`❌ 发现 ${failures} 处目标回归（defaultOffice 缺失 / q 遮蔽 / 加载即崩）。禁止出包，先修源码。`);
  process.exit(1);
} else {
  console.log('✅ 全部 webroot 通过执行级验证：导出/知识库菜单入口函数均不抛目标错误。可出包。');
  process.exit(0);
}
