const vm = require('vm'), fs = require('fs');
const src = fs.readFileSync('android-build/shuili-v329/assets/ovobj_bridge.js', 'utf8');
const sb = {}; sb.window = sb;
const fakeEl = { textContent: '', classList: { add() {}, remove() {} } };
sb.__shuili = {
  getBuildings: () => [], pickExportScope: (t, cb) => cb([]), APPNAME: 'X', getTodayStr: () => 'd',
  save() {}, render() {}, buildLegend() {}, toast(m) { console.log('TOAST', m); },
  ask(t, m, b, cb) { if (cb) cb(b && b[0] ? b[0].v : 1); }, $: (id) => fakeEl
};
sb.busy = () => {}; sb.idle = () => {}; sb.busyDetail = () => {}; sb.Android = undefined;
sb.document = { createElement: () => ({ href: '', click() {}, remove() {}, files: [], set onchange(x) {}, set type(v) {}, set accept(v) {} }), body: { appendChild() {} } };
sb.URL = { createObjectURL: (b) => { sb.__blob = b; return 'b'; }, revokeObjectURL() {} };
sb.console = console; sb.setTimeout = setTimeout; sb.atob = atob; sb.btoa = btoa; sb.Blob = Blob; sb.TextDecoder = undefined; sb.TextEncoder = undefined;
vm.createContext(sb); vm.runInContext(src, sb, { filename: 'b.js' });
const f = 'C:/Users/admin/Downloads/处、所、站.ovobj';
const bytes = fs.readFileSync(f);
const u8 = new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
sb.cacheOvobjTemplate(u8);
const t = sb.__OVOBJ_TEMPLATE;
console.log('typeof template =', typeof t);
console.log('template.length =', t && t.length);
console.log('template keys =', t && Object.keys(t));
if (t && t.buf) {
  console.log('buf.length =', t.buf.length, '| _latOff =', t._latOff, '| _lonOff =', t._lonOff, '| _nameLenOff =', t._nameLenOff, '| _nameOff =', t._nameOff);
  console.log('first 40 bytes of buf hex:', Array.from(t.buf.slice(0, 40)).map(x => x.toString(16).padStart(2, '0')).join(' '));
}
try { const o = new Uint8Array(t.length); console.log('o.length =', o.length); }
catch (e) { console.log('o err', e.message); }
try { const ab = sb.buildOvobj([{ name: '测试点', lat: 40.3, lon: 116.6 }]); console.log('buildOvobj OK, byteLength =', ab.byteLength); }
catch (e) { console.log('buildOvobj ERR:', e.message, '\n', (e.stack || '').split('\n').slice(0, 5).join('\n')); }
