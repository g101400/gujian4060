#!/usr/bin/env node
// 执行级验证：古建 zip 导入最佳匹配持久化（T-026）
// 不加载整份 app.js，提取修复后的「匹配记忆」逻辑放进 mock 环境实际执行并断言：
//   1) 记忆键 = zipName|folder|fname
//   2) 首次导入高匹配 → 自动落库并写入记忆（localStorage 持久化）
//   3) 二次导入同键 → 复用记忆，直接落库、不进入待确认弹窗（re-prompt 防护）
//   4) 用户确认/跳过 → 记忆写入 __skip__ 或 heritage id
'use strict';

function run() {
  // ---- mock 环境 ----
  const store = {};
  const localStorage = {
    getItem(k) { return k in store ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
  };
  const calls = { link: 0, linkIds: [], promptCount: 0, auto: 0 };
  let HERITAGE = [
    { id: 'h1', name: '佛香阁', city: '北京', province: '北京', spot: '颐和园', photos: [] },
    { id: 'h2', name: '排云殿', city: '北京', province: '北京', spot: '颐和园', photos: [] },
  ];

  // ---- 修复后的匹配记忆基础设施（与 app.js 完全一致）----
  var __MATCH_MEM_KEY = 'gujian_match_memory';
  function __loadMatchMem() { try { return JSON.parse(localStorage.getItem(__MATCH_MEM_KEY) || '{}'); } catch (e) { return {}; } }
  function __saveMatchMem(m) { try { localStorage.setItem(__MATCH_MEM_KEY, JSON.stringify(m)); } catch (e) {} }
  var PHOTO_MATCH_MEMORY = __loadMatchMem();
  function __matchMemKey(it) { return [it.zipName || '', it.folder || '', it.fname || ''].join('￿'); }
  function __rememberMatch(it, bid) { PHOTO_MATCH_MEMORY[__matchMemKey(it)] = bid; __saveMatchMem(PHOTO_MATCH_MEMORY); }

  // 依赖桩
  function matchScopeForItem() { return { cands: HERITAGE, label: '' }; }
  function smartFuzzyMatches(base, cands) {
    const out = cands.map(function (b) { return { b: b, s: (b.name === base ? 800 : 100) }; });
    out.sort(function (x, y) { return y.s - x.s; });
    return out;
  }
  function linkOrBase64(b, it) { calls.link++; calls.linkIds.push(b.id); if (it.data) { b.photos.push({ file: it.data, added: Date.now() }); return true; } return false; }
  function dupCheck() { return false; }
  function render() {} function save() {} function toast() {} function flushCompress() {}
  function finishPhotoMatch(pending) { calls.promptCount += pending.length; }
  function queueCompress() {}

  // ---- 修复后的 runPhotoMatch 复用分支（与 app.js 一致）----
  function runPhotoMatch(items) {
    var pending = []; var auto = 0;
    items.forEach(function (it) {
      var scope = matchScopeForItem(it);
      var ms = smartFuzzyMatches(it.base, scope.cands);
      var top = ms[0];
      var memBid = PHOTO_MATCH_MEMORY[__matchMemKey(it)];
      if (memBid === '__skip__') return;
      if (memBid) {
        var mbMem = HERITAGE.find(function (x) { return x.id === memBid; });
        if (mbMem) { if (linkOrBase64(mbMem, it)) { auto++; } else { pending.push({ it: it, b: mbMem, candidates: ms, multi: false }); } return; }
      }
      if (top && top.s >= 700) {
        var b = top.b;
        __rememberMatch(it, b.id);
        if (linkOrBase64(b, it)) { auto++; } else { pending.push({ it: it, b: b, candidates: ms, multi: false }); }
      } else if (ms.length && ms[0].s >= 200) {
        pending.push({ it: it, b: null, candidates: ms, multi: true, scopeLabel: scope.label });
      } else {
        pending.push({ it: it, b: null, candidates: [], multi: true, nomatch: true, scopeLabel: scope.label });
      }
    });
    if (auto || pending.length === 0) { render(); save(); }
    if (pending.length) finishPhotoMatch(pending);
    flushCompress();
    return { auto: auto, pending: pending.length };
  }

  // 模拟 confirmAmbiguous 的记忆写入
  function confirmChoice(it, bid) { if (!bid) { __rememberMatch(it, '__skip__'); return; } __rememberMatch(it, bid); }

  // ---- 断言 ----
  // 1) 键推导
  assert(__matchMemKey({ zipName: '颐和园.zip', folder: '佛香阁', fname: 'IMG-001' }) === '颐和园.zip￿佛香阁￿IMG-001', '记忆键应为 zipName|folder|fname');

  // 2) 首次导入高匹配（带 data → 自动落库）→ 写记忆
  calls.link = 0; calls.linkIds = []; calls.promptCount = 0;
  const itA = { zipName: '颐和园.zip', folder: '佛香阁', fname: 'IMG-001', base: '佛香阁', data: 'data:image/jpeg;base64,AAA' };
  let r1 = runPhotoMatch([itA]);
  assert(r1.auto === 1, '首次高匹配应自动落库 (got ' + r1.auto + ')');
  assert(PHOTO_MATCH_MEMORY['颐和园.zip￿佛香阁￿IMG-001'] === 'h1', '高匹配应写入记忆 h1');
  // 记忆已持久化到 localStorage
  assert(JSON.parse(store[__MATCH_MEM_KEY])['颐和园.zip￿佛香阁￿IMG-001'] === 'h1', '记忆应持久化到 localStorage');

  // 3) 二次导入同键 → 复用记忆，不进待确认弹窗（不重复 prompt 该项）
  calls.promptCount = 0; calls.link = 0; calls.linkIds = [];
  const itA2 = { zipName: '颐和园.zip', folder: '佛香阁', fname: 'IMG-001', base: '佛香阁', data: 'data:image/jpeg;base64,BBB' };
  let r2 = runPhotoMatch([itA2]);
  assert(r2.auto === 1, '二次导入应复用记忆自动落库 (got ' + r2.auto + ')');
  assert(calls.linkIds.indexOf('h1') >= 0, '二次导入应落库到记忆中的 h1');
  assert(calls.promptCount === 0, '二次导入不应再弹待确认 (re-prompt 防护)');

  // 4) 用户手动确认写入记忆
  const itB = { zipName: '圆明园.zip', folder: '', fname: 'P-2', base: '排云殿', data: 'data:,' };
  confirmChoice(itB, 'h2');
  assert(PHOTO_MATCH_MEMORY['圆明园.zip￿￿P-2'] === 'h2', '手动确认应写记忆 h2');
  // 跳过写入 __skip__
  const itC = { zipName: '北海.zip', folder: '', fname: 'X', base: '未知', data: 'data:,' };
  confirmChoice(itC, '');
  assert(PHOTO_MATCH_MEMORY['北海.zip￿￿X'] === '__skip__', '跳过应写记忆 __skip__');
  // 跳过的项二次导入不应落库/不 prompt
  calls.promptCount = 0; calls.link = 0;
  runPhotoMatch([itC]);
  assert(calls.link === 0 && calls.promptCount === 0, '已跳过项二次导入不应落库/不 prompt');

  console.log('✅ verify_guijian_zipmatch_persist.js 全部通过');
  process.exit(0);
}

function assert(cond, msg) { if (!cond) { console.error('❌ ' + msg); process.exit(1); } }
run();
