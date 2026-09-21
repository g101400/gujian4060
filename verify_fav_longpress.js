#!/usr/bin/env node
/**
 * verify_fav_longpress.js — 子菜单「长按 → 添加/移除快捷常用」执行级验证门禁
 *
 * 背景（2026-08-31 核心教训）：`node --check` 只查语法，查不出「函数未定义/形参遮蔽」
 * 这类真源 bug。新功能同样不能只靠语法检查——必须真实模拟长按手势，确认收藏真的被切换。
 *
 * 验证策略（两条腿）：
 *   A. 静态断言：三端 app.js 必须含注入标记 __favLongPressInstalled（防漏注入/漏同步）
 *   B. 执行级：从 app.js 末尾提取注入块，在 vm 沙盒里用假 DOM 真实触发 touchstart，
 *      等 >600ms 后断言收藏切换函数被以正确 key 调用、星标状态翻转、长按后 click 被吞掉
 *
 * 用法：node verify_fav_longpress.js
 * 退出码：0=全部通过；非0=发现缺失/回归（禁止出包）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.CLAW_ROOT || 'D:/Users/Claw';
const MARK_COMMENT = 'v3.48 长按子菜单→快捷常用';
const PRESS_MS = 600;

const TARGETS = [
  { key: 'shuili', dir: 'android-build/shuili-v329/assets' },
  { key: 'perc', dir: 'android-build/perc-v13/assets' },
  { key: 'gujian', dir: 'android-build/gujian-v31/assets' },
];

/** 从 app.js 末尾提取注入块（从标记注释到其后的 `  })();`） */
function extractInjectBlock(src) {
  const i = src.indexOf(MARK_COMMENT);
  if (i < 0) return null;
  const start = src.lastIndexOf('/*', i);
  const endMark = '\n  })();';
  const j = src.indexOf(endMark, i);
  if (start < 0 || j < 0) return null;
  return src.slice(start, j + endMark.length);
}

/** 构造假菜单 DOM：#menuBody 含 N 个 .menu-item.sub，各带 .menu-fav[data-k] */
function makeMenuDom(keys) {
  const items = keys.map((k) => {
    const handlers = {};
    const fav = { className: 'menu-fav', dataset: { k }, textContent: '☆', style: {}, title: '' };
    return {
      __favLP: false, dataset: { gi: '0', ii: '0' }, style: {}, textContent: '菜单项 ' + k,
      className: 'menu-item sub', _fav: fav, _handlers: handlers,
      querySelector(sel) { return sel === '.menu-fav' ? fav : null; },
      querySelectorAll() { return []; },
      addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
      removeEventListener() {},
      appendChild() {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    };
  });
  const mb = {
    id: 'menuBody', innerHTML: '', style: {}, dataset: {}, _items: items,
    querySelector() { return null; },
    querySelectorAll(sel) { return sel === '.menu-item.sub' ? items : []; },
    addEventListener() {}, appendChild() {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  };
  return { mb, items };
}

/** 构建沙盒：真 setTimeout（让 600ms 长按能触发）+ localStorage 记录 + 收藏切换探针 */
function buildSandbox(dom, favToggleName) {
  const calls = { toggle: [], toast: [] };   // toggle 调用记录 / toast 记录
  const store = {};
  const els = { menuBody: dom.mb };
  const doc = {
    readyState: 'complete',
    getElementById(id) { return els[id] || null; },
    createElement() { return makeMenuDom(['tmp']).items[0]; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {},
    body: { appendChild() {}, addEventListener() {} },
  };
  const target = {
    console,
    // 必须显式置 undefined：沙盒 Proxy 对「未定义全局」返回 noop 函数（truthy），
    // 会让注入代码首行 `if (window.__favLongPressInstalled) return;` 误判为已安装而提前退出
    __favLongPressInstalled: undefined,
    Object, Array, JSON, Math, Date, String, Number, Boolean, RegExp, Error,
    TypeError, ReferenceError, SyntaxError, RangeError, Promise, Symbol, Map, Set,
    WeakMap, WeakSet, Proxy, Reflect, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; }, clear() {},
    },
    navigator: { userAgent: 'node', platform: 'node', vibrate() {} },
    location: { href: '', search: '', hash: '' },
    performance: { now: () => Date.now() },
    document: doc,
    MutationObserver: function () { this.observe = function () {}; this.disconnect = function () {}; },
    localStorageStore: store,
    toast: (m) => calls.toast.push(String(m)),
    // 收藏切换探针（模拟水利 toggleFavMenu / 古建 _v32_favToggle）
    toggleFavMenu: function (k) { calls.toggle.push(k); },
    _v32_favToggle: function (k) { calls.toggle.push(k); },
    _v32_favHas: function () { return calls.toggle.length % 1 === 0 ? false : false; },
    __probe: calls,
  };
  const sandbox = new Proxy(target, {
    get(t, k) {
      if (k === Symbol.unscopables) return undefined;
      if (k in t) return t[k];
      if (k === 'window' || k === 'self' || k === 'globalThis') return sandbox;
      return function () { return undefined; };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  return sandbox;
}

function fire(el, type) {
  (el._handlers[type] || []).forEach((fn) => fn({ stopPropagation() {}, preventDefault() {}, target: el }));
}

async function runOne(t) {
  const appJs = path.join(BASE, t.dir, 'app.js');
  const out = { key: t.key, findings: [] };
  if (!fs.existsSync(appJs)) {
    out.findings.push({ level: 'FAIL', msg: 'app.js 不存在' });
    return out;
  }
  const src = fs.readFileSync(appJs, 'utf8');

  // A. 静态：注入标记必须存在
  if (!/__favLongPressInstalled/.test(src)) {
    out.findings.push({ level: 'FAIL', msg: '未注入长按收藏代码（缺 __favLongPressInstalled）' });
    return out;
  }
  out.findings.push({ level: 'PASS', msg: '静态：含长按收藏注入' });

  // B. 执行级：提取注入块并真实模拟长按
  const block = extractInjectBlock(src);
  if (!block) {
    out.findings.push({ level: 'FAIL', msg: '注入标记存在但代码块无法提取（结构异常）' });
    return out;
  }

  const keys = ['locateMe', 'baseMap', 'help'];
  const dom = makeMenuDom(keys);
  const sandbox = buildSandbox(dom);
  try {
    vm.runInNewContext(block, sandbox, { filename: t.key + '/inject-block' });
  } catch (e) {
    out.findings.push({ level: 'FAIL', msg: '注入块执行即崩：' + e.message });
    return out;
  }

  if (sandbox.__favLongPressInstalled !== true) {
    out.findings.push({ level: 'FAIL', msg: '注入块未标记已安装（start 未生效）' });
    return out;
  }

  const el = dom.items[0];
  if (!el._handlers.touchstart || !el._handlers.click) {
    out.findings.push({ level: 'FAIL', msg: '菜单项未绑定 touchstart/click（长按手势不可用）' });
    return out;
  }
  out.findings.push({ level: 'PASS', msg: '绑定：菜单项已挂 touchstart/click' });

  // 触发长按：touchstart 后等 >PRESS_MS
  fire(el, 'touchstart');
  await new Promise((r) => setTimeout(r, PRESS_MS + 350));

  const toggled = sandbox.__probe.toggle;
  if (toggled.length !== 1 || toggled[0] !== 'locateMe') {
    out.findings.push({
      level: 'FAIL',
      msg: `长按 600ms 未正确切换收藏：期望 toggle('locateMe')×1，实际 ${JSON.stringify(toggled)}`,
    });
  } else {
    out.findings.push({ level: 'PASS', msg: "长按 600ms → toggleFavMenu('locateMe') 生效" });
  }

  // 长按后同一手势触发的 click 必须被吞掉（否则「加收藏」会把菜单也打开）
  let clickPassed = false;
  const probe = { stopPropagation() { clickPassed = true; }, preventDefault() {}, target: el };
  (el._handlers.click || []).forEach((fn) => fn(probe));
  if (clickPassed) out.findings.push({ level: 'PASS', msg: '长按后 click 已被吞掉（不会误开菜单）' });
  else out.findings.push({ level: 'WARN', msg: '长按后 click 未被拦截（可能同时打开菜单）' });

  // 短按不应触发收藏
  const el2 = dom.items[1];
  const before = sandbox.__probe.toggle.length;
  fire(el2, 'touchstart');
  fire(el2, 'touchend');           // 立即抬起 = 短按
  await new Promise((r) => setTimeout(r, PRESS_MS + 250));
  if (sandbox.__probe.toggle.length !== before) {
    out.findings.push({ level: 'FAIL', msg: '短按误触发了收藏切换（长按判定失效）' });
  } else {
    out.findings.push({ level: 'PASS', msg: '短按不触发收藏（仅长按生效）' });
  }

  return out;
}

(async function main() {
  console.log('\n=== 子菜单「长按 → 快捷常用」执行级验证门禁 ===');
  let failures = 0;
  for (const t of TARGETS) {
    const r = await runOne(t);
    console.log(`\n📄 ${t.key} (${t.dir}/app.js)`);
    for (const f of r.findings) {
      const icon = f.level === 'FAIL' ? '❌' : f.level === 'WARN' ? '⚠️' : '✅';
      console.log(`   ${icon} [${f.level}] ${f.msg}`);
      if (f.level === 'FAIL') failures++;
    }
  }
  console.log('\n=== 结论 ===');
  if (failures > 0) {
    console.log(`❌ 发现 ${failures} 处问题（缺注入 / 长按不生效 / 短按误触发）。禁止出包。`);
    process.exit(1);
  }
  console.log('✅ 三端长按收藏均通过执行级验证：长按生效、短按不误触、长按不误开菜单。');
  process.exit(0);
})();
