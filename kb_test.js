// KB 改造功能测试：导出 md/txt/html、导入解析、csv/docx/xlsx 转换
const fs = require("fs"), vm = require("vm");
function any() { const f = function () { return any(); }; return new Proxy(f, { get(t, k) { if (k === Symbol.toPrimitive) return () => ""; if (k === "length") return 0; return any(); }, set() { return true; }, apply() { return any(); }, has() { return true; }, construct() { return any(); } }); }
function mkCtx() {
  const ls = {}; const sb = {};
  sb.console = { log() {}, error() {}, warn() {} };
  sb.document = any();
  sb.localStorage = { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } };
  sb.navigator = { userAgent: "t" };
  sb.location = { href: "file:///x" };
  sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout; sb.setImmediate = setImmediate; sb.process = { nextTick: process.nextTick };
  sb.fetch = () => new Promise(() => {});
  sb.FileReader = function () { this.readAsText = () => {}; this.readAsArrayBuffer = () => {}; };
  sb.Blob = function (p) { sb.__blob = Array.isArray(p) ? p.join("") : String(p); };
  sb.URL = { createObjectURL: () => "blob:x", revokeObjectURL() {} };
  sb.TextDecoder = TextDecoder;
  sb.DOMParser = class {
    parseFromString(html) {
      const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [0, ""])[1];
      let body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [0, html])[1];
      const strip = s => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      function el(tag, inner) {
        const e = { tagName: tag.toUpperCase(), children: [], _inner: inner,
          get textContent() { return strip(inner); },
          get innerHTML() { return inner; },
          querySelectorAll() { return []; }, rows: null };
        if (tag === "ul" || tag === "ol") {
          (inner.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || []).forEach(m => e.children.push(el("li", m.replace(/<\/?li[^>]*>/gi, ""))));
        }
        if (tag === "table") {
          const trs = (inner.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || []).map(trm => {
            const tds = (trm.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map(tdm => strip(tdm));
            return { cells: tds };
          });
          e.rows = trs;
        }
        return e;
      }
      const children = [];
      const re = /<(h[1-3]|p|ul|table|div)[^>]*>([\s\S]*?)<\/\1>/gi;
      let m;
      while ((m = re.exec(body))) children.push(el(m[1], m[2]));
      return { title, body: { children } };
    }
  };
  sb.L = any(); sb.alert = () => {}; sb.confirm = () => true; sb.prompt = () => "";
  sb.innerWidth = 100;
  sb.atob = (s) => Buffer.from(s, "base64").toString("binary"); sb.btoa = (s) => Buffer.from(s, "binary").toString("base64");
  sb.window = sb; sb.self = sb;
  const ctx = vm.createContext(sb);
  return { sb, ctx, ls };
}
const dir = "android-build/shuili-v329/assets";
const { sb, ctx } = mkCtx();
vm.runInContext(fs.readFileSync(dir + "/ai_seed.js", "utf8"), ctx);
const src = fs.readFileSync(dir + "/ai_module.js", "utf8");
const anchor = "window.openKB = openKB;";
if (!src.includes(anchor)) { console.log("HOOK ANCHOR MISSING"); process.exit(1); }
const hook = anchor + "\n  window.__kbTest = { kbExport: kbExport, kbBuildDoc: kbBuildDoc, kbSplitMd: kbSplitMd, kbSplitTxt: kbSplitTxt, kbSplitHtml: kbSplitHtml, kbCsvToMd: kbCsvToMd, kbTableMd: kbTableMd, mdLiteToHtml: mdLiteToHtml, kbLoad: kbLoad, kbAdd: kbAdd, kbConvDocx: kbConvDocx, kbConvXlsx: kbConvXlsx };";
vm.runInContext(src.replace(anchor, hook), ctx);
vm.runInContext('window.AIModule.init({ domain: "shuili", appName: "测试一张图", allowOnlineQuery: false })', ctx);
let pass = 0, fail = 0;
const T = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); cond ? pass++ : fail++; };
// 种两条数据
vm.runInContext('__kbTest.kbAdd({title:"闸门运行规程",tags:["规程"],type:"external",source:"t.md"},"## 启闭顺序\\n- 先开闸后停机\\n| 参数 | 值 |\\n| --- | --- |\\n| 开度 | 0.5m |")', ctx);
vm.runInContext('__kbTest.kbAdd({title:"水库简介",tags:["简介"],type:"external",source:"t.md"},"**库容** 1.2亿方")', ctx);
// 1) 导出三种格式
const md = vm.runInContext('__kbTest.kbBuildDoc("md", __kbTest.kbLoad())', ctx);
const txt = vm.runInContext('__kbTest.kbBuildDoc("txt", __kbTest.kbLoad())', ctx);
const html = vm.runInContext('__kbTest.kbBuildDoc("html", __kbTest.kbLoad())', ctx);
T("md 导出含标题/正文/分隔", md.includes("## 闸门运行规程") && md.includes("---") && md.includes("1.2亿方"));
T("txt 导出含【】分节", txt.includes("【闸门运行规程】") && txt.includes("===================="));
T("html 导出含 h2/列表/表格", html.includes("<h2>闸门运行规程</h2>") && html.includes("<li>先开闸后停机</li>") && html.includes("<table>"));
// 2) md 分条
const eA = JSON.parse(vm.runInContext('JSON.stringify(__kbTest.kbSplitMd("# A甲\\n正文A\\n## B乙\\n正文B1\\n续行"))', ctx));
T("md 按标题分2条", eA.length === 2 && eA[0].title === "A甲" && eA[1].body.includes("续行"));
// 3) txt 分节
const ts = JSON.parse(vm.runInContext('JSON.stringify(__kbTest.kbSplitTxt("【条目一】\\n内容一\\n【条目二】\\n内容二"))', ctx));
T("txt 按【标题】分节", ts.length === 2 && ts[1].title === "条目二");
// 4) csv → md 表格
const csv = vm.runInContext('__kbTest.kbCsvToMd(\'名称,开度\\n"1号闸","0.5|m"\\n2号闸,1\')', ctx);
T("csv 转 md 表格（引号+竖线转义）", csv.includes("| 名称 | 开度 |") && csv.includes("0.5\\|m"));
// 5) html 分条
const hs = JSON.parse(vm.runInContext('JSON.stringify(__kbTest.kbSplitHtml("<html><head><title>t</title></head><body><h2>章节一</h2><p>段落甲</p><ul><li>x</li></ul><h2>章节二</h2><p>段落乙</p></body></html>"))', ctx));
T("html 按 h2 分2条", hs.length === 2 && hs[0].title === "章节一" && hs[0].body.includes("段落甲"));
// 6) 导出即存桩
vm.runInContext('__kbTest.kbExport("md")', ctx);
T("kbExport 走 downloadText（Blob 捕获）", typeof sb.__blob === "string" && sb.__blob.includes("## 闸门运行规程"));
(async () => {
  // 7) docx 转换（真实 JSZip 打包 document.xml）
  vm.runInContext(fs.readFileSync(dir + "/jszip.min.js", "utf8"), ctx);
  const docxXml = '<?xml version="1.0"?><w:document xmlns:w="http://x"><w:body><w:p><w:r><w:t>第一段：闸门启闭</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>参数</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>数值</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>开度</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>0.5</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>末段</w:t></w:r></w:p></w:body></w:document>';
  const b64 = await vm.runInContext('(async function(){ const z = new JSZip(); z.file("word/document.xml", ' + JSON.stringify(docxXml) + '); return await z.generateAsync({ type: "base64" }); })()', ctx);
  sb.__docxB64 = b64;
  const mdx = await vm.runInContext("__kbTest.kbConvDocx(new Uint8Array(atob(__docxB64).split(\"\").map(function(c){ return c.charCodeAt(0); })))", ctx);
  T("docx → md（段落+表格）", /第一段：闸门启闭/.test(mdx) && mdx.includes("| 参数 | 数值 |") && mdx.includes("| 开度 | 0.5 |"));
  // 8) xlsx 转换
  const xlsxMd = await vm.runInContext('(async function(){ const z = new JSZip(); z.file("xl/sharedStrings.xml", "<sst><si><t>名称</t></si><si><t>水位</t></si><si><t>1号闸</t></si><si><t>13.5</t></si></sst>"); z.file("xl/worksheets/sheet1.xml", \'<?xml?><worksheet><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>13.5</v></c></row></worksheet>\'); return await __kbTest.kbConvXlsx(await z.generateAsync({ type: "arraybuffer" }), null); })()', ctx);
  T("xlsx → md 表格", xlsxMd.includes("| 名称 | 水位 |") && xlsxMd.includes("| 1号闸 | 13.5 |"));
  console.log(fail === 0 ? "全部通过：" + pass : "失败 " + fail + " / 通过 " + pass);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log("ASYNC FAIL", e && e.message); process.exit(1); });
