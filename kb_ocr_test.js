// KB OCR 集成回归：扫描版 PDF→OCR 兜底、图片→OCR，走 mocked 引擎验证调用链与产物
const fs = require("fs"), vm = require("vm");
const dir = "android-build/shuili-v329/assets";
let pass = 0, fail = 0;
const T = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); cond ? pass++ : fail++; };

// ---- mocks ----
const ocrCalls = []; // {kind, pages}
const progLog = [];
const OCREngineMock = {
  recognize(cv, onProg) {
    ocrCalls.push({ w: cv.width, h: cv.height });
    if (onProg) onProg(1);
    return Promise.resolve("识别文本 密云水库 开度 0.5 立方米每秒 安全监测");
  },
  dispose() { ocrCalls.disposed = true; }
};
const pageMock = {
  getViewport: ({ scale }) => ({ width: 1000 * scale, height: 1400 * scale }),
  render: () => ({ promise: Promise.resolve() })
};
const pdfjsMock = {
  GlobalWorkerOptions: {},
  getDocument: (opts) => {
    pdfjsMock.gotBytes = opts.data && opts.data.length > 0;
    return { promise: Promise.resolve({ numPages: 2, getPage: () => Promise.resolve(pageMock) }) };
  }
};
function mkEl(tag) {
  if (tag === "canvas") return { width: 0, height: 0, getContext: () => ({ fillStyle: "", fillRect() {}, drawImage() {} }) };
  return { style: {}, set textContent(v) { this._t = v; }, get textContent() { return this._t || ""; }, innerHTML: "" };
}
const els = {};
const ls = {};
const sb = {};
sb.console = console;
sb.document = {
  createElement: (tag) => mkEl(tag),
  getElementById: (id) => (els[id] = els[id] || mkEl("div")),
  head: { appendChild() {} },
  documentElement: { appendChild() {} }
};
sb.localStorage = { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } };
sb.navigator = { userAgent: "t" };
sb.location = { href: "file:///android_asset/index.html" };
sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout; sb.setImmediate = setImmediate;
sb.FileReader = function () {
  this.readAsArrayBuffer = function () { const self = this; setTimeout(() => self.onload && self.onload({ target: self }), 0); };
  this.result = new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3]).buffer; // 假 PDF 头
};
sb.Image = function () {
  const self = this;
  let _src = "";
  Object.defineProperty(self, "src", {
    set(v) { _src = v; setTimeout(() => { self.naturalWidth = 800; self.naturalHeight = 300; self.onload && self.onload(); }, 0); },
    get() { return _src; }
  });
};
sb.Blob = function (p) { sb.__blobLen = p && p[0] ? p[0].length : 0; };
sb.URL = { createObjectURL: () => "blob:x", revokeObjectURL() {} };
sb.TextDecoder = TextDecoder;
sb.__prog = progLog; sb.window = sb; sb.self = sb;
sb.__OCRM = OCREngineMock; sb.__PDFM = pdfjsMock;
const ctx = vm.createContext(sb);
vm.runInContext("window.OCREngine = __OCRM; window.pdfjsLib = __PDFM;", ctx);
// 加载 ai_module（加载时文本注入临时钩子到闭包内，不污染源码文件）
const src = fs.readFileSync(dir + "/ai_module.js", "utf8");
const anchor = "window.openKB = openKB;";
if (!src.includes(anchor)) { console.log("HOOK ANCHOR MISSING"); process.exit(1); }
vm.runInContext(fs.readFileSync(dir + "/ai_seed.js", "utf8"), ctx, { filename: "ai_seed.js" });
vm.runInContext(src.replace(anchor, anchor +
  "\n  window.__kbT = { kbConvPdf: kbConvPdf, kbConvImage: kbConvImage, kbImportExternal: kbImportExternal };"), ctx, { filename: "ai_module.js" });
vm.runInContext('window.AIModule.init({ domain: "shuili", appName: "测试一张图", allowOnlineQuery: false })', ctx);

(async () => {
  // 1) 图片 → OCR
  const imgMd = await vm.runInContext("__kbT.kbConvImage(new Uint8Array([1,2,3]).buffer, 'png', function(p,m){ __prog.push([p,m]); })", ctx);
  T("图片走 OCR 通道", ocrCalls.length === 1);
  T("图片 OCR 产物带说明头", imgMd.includes("（图片 OCR 识别") && imgMd.includes("密云水库"));
  T("图片进度回调被调用", progLog.length >= 2);
  // 2) 扫描版 PDF（文本层为空）→ pdf.js 渲染 + 逐页 OCR
  progLog.length = 0;
  const pdfMd = await vm.runInContext("__kbT.kbConvPdf(new Uint8Array([0x25,0x50,0x44,0x46,9,9]).buffer, function(p,m){ __prog.push([p,m]); })", ctx);
  T("扫描 PDF 渲染了 2 页并逐页 OCR", ocrCalls.length === 3 && pdfjsMock.gotBytes);
  T("扫描 PDF 产物带 OCR 说明头 + 两页文本", pdfMd.includes("（扫描版 PDF，内置 OCR 识别") && (pdfMd.match(/密云水库/g) || []).length >= 2);
  T("OCR 页级进度进进度条", progLog.some(x => String(x[1]).indexOf("OCR 识别第") >= 0));
  // 3) 完整导入流（kbImportExternal → 入库）
  const kbBefore = JSON.parse(vm.runInContext("JSON.stringify(window.AIModule._kb ? window.AIModule._kb() : (JSON.parse(localStorage.getItem('kb_shuili')||'{\"index\":[]}').index.length))", ctx));
  console.log("(info) 导入前 KB 条数:", Array.isArray(kbBefore) ? kbBefore.length : kbBefore);
  await new Promise(res => {
    vm.runInContext("__kbT.kbImportExternal({ name: 'scan_report.pdf' })", ctx);
    setTimeout(res, 300);
  });
  const kbAfterS = vm.runInContext("localStorage.getItem('kb_shuili')", ctx);
  const kbAfter = JSON.parse(kbAfterS || "{}");
  const idx = kbAfter.index || [];
  const added = idx.find(m => m.title === "scan_report");
  T("kbImportExternal 扫描 PDF 已入库", !!added && (kbAfter.bodies[added.id] || "").includes("密云水库"));
  console.log(fail === 0 ? "全部通过：" + pass : "失败 " + fail + " / 通过 " + pass);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log("ASYNC FAIL", e && (e.stack || e.message)); process.exit(1); });
