const vm = require('vm'), fs = require('fs');
const src = fs.readFileSync('android-build/shuili-v329/assets/ovobj_bridge.js', 'utf8');
const sb = {}; sb.window = sb;
const fakeEl = { textContent: '', classList: { add() {}, remove() {} } };
sb.__shuili = { getBuildings: () => [], pickExportScope: (t, cb) => cb([]), APPNAME: 'X', getTodayStr: () => 'd', save() {}, render() {}, buildLegend() {}, toast() {}, ask(t, m, b, cb) { if (cb) cb(b && b[0] ? b[0].v : 1); }, $: () => fakeEl };
sb.busy = () => {}; sb.idle = () => {}; sb.busyDetail = () => {}; sb.Android = undefined;
sb.document = { createElement: () => ({ href: '', click() {}, remove() {}, files: [], set onchange(x) {}, set type(v) {}, set accept(v) {} }), body: { appendChild() {} } };
sb.URL = { createObjectURL: (b) => { sb.__blob = b; return 'b'; }, revokeObjectURL() {} };
sb.console = console; sb.setTimeout = setTimeout; sb.atob = atob; sb.btoa = btoa; sb.Blob = Blob; sb.TextDecoder = undefined; sb.TextEncoder = undefined;
vm.createContext(sb); vm.runInContext(src, sb, { filename: 'b.js' });

const ptsIn = [
  { name: '京引管理处', lat: 40.30533556, lon: 116.6138773 },
  { name: '北台上所', lat: 40.37857315, lon: 116.6725663 },
  { name: '史山所', lat: 40.26374445, lon: 116.569299 },
  { name: '宾馆对面', lat: 40.32505847, lon: 116.6206791 },
  { name: '调', lat: 39.9, lon: 116.3 } // 单字名（最短）
];
const ab = sb.buildOvobj(ptsIn);
console.log('exported byteLength =', ab.byteLength);
const dv = new DataView(ab);
console.log('count@0x0C =', dv.getInt32(0x0c, true), 'size@0x14 =', dv.getInt32(0x14, true));
const rePts = sb.parseOvobj(ab);
console.log('re-parsed count =', rePts.length, '(expected', ptsIn.length, ')');
console.log(JSON.stringify(rePts.map(p => ({ name: p.name, lat: p.lat, lon: p.lon })), null, 0));
// 逐对象 hex 检查单字名对象布局
const single = sb.buildOvobj([{ name: '调', lat: 39.9, lon: 116.3 }]);
console.log('single-name obj byteLength =', single.byteLength, '(21+3=24)');
const sdv = new DataView(single);
console.log('lat=', sdv.getFloat64(0, true), 'lon=', sdv.getFloat64(8, true), 'nameLen@20=', new Uint8Array(single)[20], 'name=', Array.from(new Uint8Array(single).slice(21, 24)));
