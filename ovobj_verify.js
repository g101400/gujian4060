// 实证验证 ovobj_bridge.js：在 stubbed window 环境加载并真实跑 解析→导出→再导入 全流程
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const bridgePath = 'android-build/shuili-v329/assets/ovobj_bridge.js';
const src = fs.readFileSync(bridgePath, 'utf8');

const GLOBAL_BUILDINGS = [];      // 模拟 app.js 的 BUILDINGS（被 loadData/resetData 重新赋值）
const captured = { blob: null };  // 捕获 saveBlobOrDownload 的非安卓 Blob

const sandbox = {};
sandbox.window = sandbox;
sandbox.__shuili = {
  getBuildings: () => GLOBAL_BUILDINGS,
  pickExportScope: (type, cb) => { cb(GLOBAL_BUILDINGS); },
  APPNAME: '测试工程',
  getTodayStr: () => '20260827',
  save: () => { sandbox.__saved = (sandbox.__saved || 0) + 1; },
  render: () => { sandbox.__rendered = (sandbox.__rendered || 0) + 1; },
  buildLegend: () => { sandbox.__legend = (sandbox.__legend || 0) + 1; },
  toast: (m) => { (sandbox.__toasts = sandbox.__toasts || []).push(m); },
  ask: (t, m, b, cb) => { (sandbox.__asks = sandbox.__asks || []).push({ t, m }); if (cb) cb(b && b.length ? b[0].v : 1); },
  $: (id) => ({ textContent: '', classList: { add() {}, remove() {} } }),
};
sandbox.busy = () => { sandbox.__busy = (sandbox.__busy || 0) + 1; };
sandbox.idle = () => { sandbox.__idle = (sandbox.__idle || 0) + 1; };
sandbox.busyDetail = () => {};
sandbox.Android = undefined; // 走非安卓分支（saveBlobOrDownload 用 Blob 下载；import 走 legacy 文件选择）
sandbox.document = {
  createElement: () => ({ href: '', download: '', click() {}, remove() {}, onchange: null, type: '', accept: '', files: [] }),
  body: { appendChild() {} },
};
sandbox.URL = { createObjectURL: (b) => { captured.blob = b; return 'blob:x'; }, revokeObjectURL() {} };
sandbox.console = console;
sandbox.setTimeout = setTimeout;
sandbox.atob = atob; sandbox.btoa = btoa;
sandbox.Blob = Blob;
sandbox.TextDecoder = undefined; sandbox.TextEncoder = undefined; // 强制走 polyfill（兼容老 WebView）

vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'ovobj_bridge.js' });

function readBuf(p) {
  const bytes = fs.readFileSync(p);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
function assert(cond, msg) {
  if (cond) { console.log('  ✅ PASS:', msg); return true; }
  console.log('  ❌ FAIL:', msg); sandbox.__fail = (sandbox.__fail || 0) + 1; return false;
}

(async () => {
  const dir = 'C:/Users/admin/Downloads';
  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.ovobj'));
  console.log('=== Downloads 中的 ovobj 文件 ===', files);

  let totalParsed = 0;
  const samplePts = [];
  for (const f of files) {
    console.log('\n--- 解析 ' + f + ' ---');
    const buf = readBuf(path.join(dir, f));
    // 验证 OviO 魔数
    const head = new Uint8Array(buf.slice(0, 4));
    assert(head[0] === 0x4f && head[1] === 0x76 && head[2] === 0x69 && head[3] === 0x4f, 'OviO 魔数正确');
    const pts = sandbox.parseOvobj(buf);
    assert(pts.length > 0, '解析出 ' + pts.length + ' 个坐标点');
    console.log('    样例:', JSON.stringify(pts.slice(0, 3).map(p => ({ name: p.name, lat: p.lat, lon: p.lon }))));
    totalParsed += pts.length;
    if (samplePts.length === 0) samplePts.push(...pts);
    // 缓存模板供导出用
    sandbox.cacheOvobjTemplate(new Uint8Array(buf.slice(0)));
  }
  assert(totalParsed > 0, '三个文件合计解析 ' + totalParsed + ' 个点');

  // 把解析结果灌入 BUILDINGS（模拟已导入的数据），用于导出测试
  GLOBAL_BUILDINGS.length = 0;
  samplePts.forEach((p, i) => GLOBAL_BUILDINGS.push({
    id: 'k' + i, name: p.name, office: '', station: '', chan: '', btype: '奥维坐标',
    path: '', attrs: [], photos: [], geom: 'Point', lat: p.lat, lon: p.lon, alt: 0
  }));
  console.log('\n=== 导出 ovobj（二进制）===');
  captured.blob = null;
  sandbox.exportOvobj();
  await new Promise(r => setTimeout(r, 100));
  assert(captured.blob != null, 'exportOvobj 调用了 saveBlobOrDownload（无 script error）');
  if (captured.blob) {
    const ab = await captured.blob.arrayBuffer();
    const dv = new DataView(ab);
    const magic = new Uint8Array(ab.slice(0, 4));
    const cnt = dv.getInt32(0x0c, true);
    assert(magic[0] === 0x4f && magic[1] === 0x76 && magic[2] === 0x69 && magic[3] === 0x4f, '导出 ovobj 头部 OviO 魔数正确');
    assert(cnt === samplePts.length, '导出对象数 ' + cnt + ' == 解析点数 ' + samplePts.length);
    // 再导入导出的 ovobj，验证 round-trip
    const rePts = sandbox.parseOvobj(ab);
    assert(rePts.length === cnt, '导出文件可再次解析，点数一致(' + rePts.length + ')');
  }

  console.log('\n=== 导出 obj（文本坐标）===');
  captured.blob = null;
  sandbox.exportObj();
  await new Promise(r => setTimeout(r, 100));
  assert(captured.blob != null, 'exportObj 调用了 saveBlobOrDownload（无 script error）');
  if (captured.blob) {
    const text = await captured.blob.text();
    const lines = text.split(/\r?\n/);
    assert(lines[0] === '名称,经度,纬度,海拔', 'obj 表头正确：' + lines[0]);
    assert(lines.length - 1 === GLOBAL_BUILDINGS.length, 'obj 数据行数 ' + (lines.length - 1) + ' == 建筑数 ' + GLOBAL_BUILDINGS.length);
    console.log('    样例:', lines.slice(0, 3).join(' | '));
  }

  console.log('\n=== 导入合并（mergeCoordPoints）===');
  const before = GLOBAL_BUILDINGS.length;
  const newPts = samplePts.map(p => ({ name: p.name + '_新', lat: p.lat + 0.001, lon: p.lon + 0.001 }));
  sandbox.mergeCoordPoints(newPts, '验证导入');
  await new Promise(r => setTimeout(r, 200));
  assert((sandbox.__saved || 0) > 0, 'mergeCoordPoints 调用了 save()');
  assert((sandbox.__rendered || 0) > 0, 'mergeCoordPoints 调用了 render()');
  assert((sandbox.__legend || 0) > 0, 'mergeCoordPoints 调用了 buildLegend()');
  assert(GLOBAL_BUILDINGS.length >= before + newPts.length, '新增点已写入 BUILDINGS（' + before + ' → ' + GLOBAL_BUILDINGS.length + '）');

  console.log('\n=== 导入入口不抛错（importOvobj/importObj）===');
  try { sandbox.importOvobj(); sandbox.importObj(); console.log('  ✅ PASS: importOvobj/importObj 入口无 ReferenceError'); }
  catch (e) { console.log('  ❌ FAIL: 入口抛错 ' + e.message); sandbox.__fail = (sandbox.__fail || 0) + 1; }

  console.log('\n=== 已收集 toast ===', (sandbox.__toasts || []).slice(0, 5));
  console.log(sandbox.__fail ? ('\n❌ 存在 ' + sandbox.__fail + ' 项失败') : '\n🎉 全部通过：ovobj 导入/导出作用域 bug 已修复且逻辑正确');
  process.exit(sandbox.__fail ? 1 : 0);
})();
