#!/usr/bin/env node
// scripts/verify_kbformats.mjs —— v2.4.5 知识库格式改造真跑验证：
// 导出 md/txt/html（主流知识库兼容）→ 再导入还原；外部文件智能转换
//（pdf 文本流 / docx / xlsx / html / csv → md，进度回调）；旧 zip 备份往返兼容。
import fs from "node:fs";
import path from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";

const APP = process.argv[2] || "shuili";
const ROOT = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(process.cwd(), APP + "_app");
const idxHtml = path.join(ROOT, "index.html");
if (!fs.existsSync(idxHtml)) { console.error("找不到 index.html:", idxHtml); process.exit(2); }

import "fake-indexeddb/auto";
const errors = [];
process.on("unhandledRejection", (e) => errors.push("[unhandledRejection] " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)));
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("[jsdomError] " + (e && e.message ? e.message : e)));
const html = fs.readFileSync(idxHtml, "utf8");
const dom = new JSDOM("<html><body></body></html>", { url: "http://localhost/", runScripts: "outside-only", virtualConsole: vc, pretendToBeVisual: true });
const win = dom.window;
if (globalThis.indexedDB) { win.indexedDB = globalThis.indexedDB; win.IDBKeyRange = globalThis.IDBKeyRange; }
if (globalThis.DecompressionStream) win.DecompressionStream = globalThis.DecompressionStream; // Node18+ 提供，docx/xlsx inflate 真跑
if (globalThis.CompressionStream) win.CompressionStream = globalThis.CompressionStream;

const runJs = (label, code) => { try { win.eval(code); return true; } catch (e) { errors.push("[LOAD " + label + "] " + (e && e.stack ? e.stack.split("\n")[0] : e)); return false; } };
runJs("kb.js", fs.readFileSync(path.join(ROOT, "js/kb.js"), "utf8"));
runJs("io.js", fs.readFileSync(path.join(ROOT, "js/io.js"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(400);

const out = [];
const assert = (n, c, e = "") => { out.push({ n, ok: !!c, e }); console.log((c ? "✅" : "❌") + " " + n + (e ? "  " + e : "")); };

const KB = win.KB, IO = win.IO;
assert("KB 与 IO 引擎加载", !!(KB && IO && KB.exportAs && KB.convertExternalAuto));
if (!KB || !IO) { console.log("\n=== 加载失败，终止 ==="); errors.forEach((e) => console.log(e)); process.exit(1); }

// ---------- 种子数据 ----------
await KB.put({ id: "bld_test1", type: "building", title: "温泉节制闸", tags: ["温汤所", "水闸"], md: "# 温泉节制闸\n\n- 管理所：温汤所\n\n| 孔数 | 孔宽 |\n|---|---|\n| 3 | 5m |", meta: { source: "skeleton" } });
await KB.put({ id: "bld_test2", type: "building", title: "明珠水库大坝", tags: ["柳林庄所", "大坝"], md: "# 明珠水库大坝\n\n坝高 42 米。", meta: {} });
await KB.put({ id: "MEMORY", type: "memory", title: "MEMORY", tags: ["hermes"], md: "# MEMORY\n- 测试记忆", meta: {} });

// ---------- T1 导出 md（front matter + 锚点）----------
const mdOut = await KB.exportAs("md");
const mdText = typeof mdOut.data === "string" ? mdOut.data : new TextDecoder().decode(mdOut.data);
assert("导出 md 文件名/类型", /\.md$/.test(mdOut.name) && /markdown/.test(mdOut.mime), mdOut.name);
assert("md 含 <!-- kb-entry --> 锚点", mdText.includes("<!-- kb-entry -->"));
assert("md 含 YAML front matter（title/tags/id）", mdText.includes("title: 温泉节制闸") && mdText.includes("tags: [温汤所, 水闸]") && mdText.includes("id: bld_test1"));
assert("md 正文完整", mdText.includes("坝高 42 米"));
assert("md 不含操作日志", !mdText.includes("操作日志"));

// ---------- T2 md 往返导入（front matter 还原）----------
const mdFile = new win.File([mdText], "knowledge_base_test.md", { type: "text/markdown" });
const n1 = await KB.importDocuments([mdFile], () => {});
const back = await KB.get("bld_test1");
assert("md 再导入计数=1", n1 === 1, String(n1));
assert("front matter 元数据还原（id/title/tags）", back && back.title === "温泉节制闸" && Array.isArray(back.tags) && back.tags.join(",") === "温汤所,水闸");

// ---------- T3 导出 txt / html ----------
const txtOut = await KB.exportAs("txt");
const txtText = typeof txtOut.data === "string" ? txtOut.data : new TextDecoder().decode(txtOut.data);
assert("导出 txt 含标题与正文", /\.txt$/.test(txtOut.name) && txtText.includes("【温泉节制闸】") && txtText.includes("坝高 42 米"));
const htmlOut = await KB.exportAs("html");
const htmlText = typeof htmlOut.data === "string" ? htmlOut.data : new TextDecoder().decode(htmlOut.data);
assert("导出 html 独立文档（DOCTYPE/table/h2）", /\.html$/.test(htmlOut.name) && htmlText.includes("<!DOCTYPE html>") && htmlText.includes("<h2>温泉节制闸</h2>") && htmlText.includes("<table"));
assert("html 导出含表格单元格", htmlText.includes("<td>3</td>"));

// ---------- T4 html → md ----------
const sampleHtml = "<html><head><style>.x{color:red}</style></head><body><h1>工程简介</h1><p>这是<b>加粗</b>与<i>斜体</i>。<a href='http://x.cn'>链接</a></p><ul><li>要点一</li><li>要点二</li></ul><table><tr><th>名称</th><th>值</th></tr><tr><td>坝高</td><td>42米</td></tr></table><script>alert(1)</script></body></html>";
const convMd = KB.htmlToMd(sampleHtml);
assert("html→md 标题转换", convMd.includes("# 工程简介"));
assert("html→md 粗体/链接/列表", convMd.includes("**加粗**") && convMd.includes("[链接](http://x.cn)") && convMd.includes("- 要点一"));
assert("html→md 表格转换", convMd.includes("| 坝高 | 42米 |"));
assert("html→md 剔除 script/style", !convMd.includes("alert") && !convMd.includes("color:red"));

// ---------- T5 docx → md（STORE zip + inflate 真跑两种都验）----------
const docXml = `<?xml version="1.0"?><w:document xmlns:w="http://w"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>年度报告</w:t></w:r></w:p><w:p><w:r><w:t>正文第一段。</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>指标</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>数值</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>库容</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1.2亿方</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`;
const docxZip = KB._zip.makeZip([{ name: "word/document.xml", data: docXml }]);
const docxEntry = await KB.convertExternalAuto(new win.File([docxZip], "年度总结.docx"), () => {});
assert("docx→md 入库成功", !!docxEntry && /# 年度报告/.test(docxEntry.md));
assert("docx→md 表格转换", /\| 库容 \| 1.2亿方 \|/.test(docxEntry.md));
assert("docx→md 段落保留", docxEntry.md.includes("正文第一段"));
assert("docx 元数据（tags 含 docx）", (docxEntry.tags || []).includes("docx"));

// ---------- T6 xlsx → md（走 IO.xlsxMatrix 真跑）----------
const sheetXml = `<?xml version="1.0"?><worksheet xmlns="http://s"><row r="A1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="A2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>42</v></c></row></worksheet>`;
const ssXml = `<?xml version="1.0"?><sst xmlns="http://s"><si><t>名称</t></si><si><t>高度</t></si><si><t>大坝</t></si></sst>`;
const xlsxZip = KB._zip.makeZip([{ name: "xl/worksheets/sheet1.xml", data: sheetXml }, { name: "xl/sharedStrings.xml", data: ssXml }]);
const xlsxEntry = await KB.convertExternalAuto(new win.File([xlsxZip], "工程参数.xlsx"), () => {});
assert("xlsx→md 入库成功", !!xlsxEntry && xlsxEntry.md.includes("| 大坝 | 42 |"));
assert("xlsx→md 表头分隔行", /\|---\|---\|/.test(xlsxEntry.md));

// ---------- T7 pdf → md（未压缩文本流真跑 + 进度回调）----------
let progCalls = 0, lastP = 0;
const pdfRaw = "%PDF-1.4\n1 0 obj\n<< /Length 120 >>\nstream\nBT /F1 12 Tf 72 720 Td (The dam height is 42 meters.) Tj 0 -20 Td (Second line data 2026.) Tj ET\nendstream\nendobj\n%%EOF";
const pdfEntry = await KB.convertExternalAuto(new win.File([pdfRaw], "监测报告.pdf"), (p) => { progCalls++; lastP = p; });
assert("pdf→md 入库成功", !!pdfEntry && pdfEntry.md.includes("The dam height is 42 meters."));
assert("pdf→md 多行文本", pdfEntry.md.includes("Second line data 2026."));
assert("pdf 转换进度回调触发且到 100", progCalls >= 2 && lastP === 100, `calls=${progCalls} last=${lastP}`);

// ---------- T8 pdf 反例：扫描件（无文本）明确报错 ----------
let scanErr = "";
try { await KB.convertExternalAuto(new win.File(["%PDF-1.4\n1 0 obj\nstream\n\x00\x01\x02\x03\nendstream\nendobj"], "scan.pdf"), () => {}); } catch (e) { scanErr = e.message; }
assert("扫描件/无文本 PDF 明确报错不静默", /无法|扫描|提取/.test(scanErr), scanErr);

// ---------- T9 旧式 .doc / BIFF8 .xls 明确引导 ----------
let docErr = "", xlsErr = "";
try { await KB.convertExternalAuto(new win.File(["dummy"], "老文档.doc"), () => {}); } catch (e) { docErr = e.message; }
const biff = new win.File([new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0, 0, 0, 0])], "老表格.xls");
try { await KB.convertExternalAuto(biff, () => {}); } catch (e) { xlsErr = e.message; }
assert(".doc 明确报错引导另存 docx", /docx/.test(docErr), docErr);
assert("BIFF8 .xls 明确报错引导另存 xlsx", /xlsx/.test(xlsErr), xlsErr);

// ---------- T10 csv / txt 导入 ----------
const csvEntry = await KB.convertExternalAuto(new win.File(["名称,部位\n闸门,2号"], "台账.csv"), () => {});
assert("csv→md 表格", csvEntry.md.includes("| 名称 | 部位 |") && csvEntry.md.includes("| 闸门 | 2号 |"));
const txtEntry = await KB.convertExternalAuto(new win.File(["一段纯文本内容。"], "备注.txt"), () => {});
assert("txt 直接入库", txtEntry.md.includes("一段纯文本内容。"));

// ---------- T11 检索（缓存后仍正确）----------
await KB.put({ id: "extra1", type: "doc", title: "溢洪道说明", tags: ["枢纽"], md: "# 溢洪道\n\n泄流能力校核。", meta: {} });
const hits = await KB.retrieve("溢洪道 泄流", 5);
assert("检索命中新条目（hayCache 失效正确）", hits.includes("溢洪道"));

// ---------- T12 旧 zip 完整备份往返兼容 ----------
const zipBytes = await KB.exportZip();
const nZip = await KB.importZip(zipBytes.buffer || zipBytes);
assert("旧 zip 备份导出→导入往返", nZip > 0, "imported=" + nZip);
const zipOut = await KB.exportAs("zip");
assert("exportAs(zip) 仍可用（二进制）", zipOut.data && zipOut.data.byteLength > 0 && /\.zip$/.test(zipOut.name));

// ---------- T13 扫描件 PDF：内嵌 JPEG 页图提取 ----------
// 构造：仅含一张 JPEG 页图（DCTDecode）的扫描件 PDF（无文本流 → pdfToMd 必报「扫描件」→ OCR 兜底）
const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 1, 2, 3, 4, 5, 6, 7, 8, 0xFF, 0xD9]);
let scanPdf = "%PDF-1.4\n1 0 obj\n<< /Type /XObject /Subtype /Image /Width 640 /Height 480 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpegBytes.length + " >>\nstream\n";
scanPdf += String.fromCharCode.apply(null, jpegBytes);
scanPdf += "\nendstream\nendobj\n%%EOF";
const l1bytes = (s) => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xFF; return a; }; // latin1（PDF 字节流口径，勿用 TextEncoder）
const scanBytes = l1bytes(scanPdf);
const imgs = KB.pdfExtractImages(scanBytes);
assert("PDF 内嵌页图提取（数量/宽度/JPEG魔数）", imgs.length === 1 && imgs[0].w === 640 && imgs[0].h === 480 && imgs[0].filter === "DCTDecode" && imgs[0].data[0] === 0xFF && imgs[0].data[1] === 0xD8,
  imgs.length ? `w=${imgs[0].w} filter=${imgs[0].filter}` : "0 张");
assert("文本型 PDF 提取页图=0（不误伤）", KB.pdfExtractImages(new TextEncoder().encode(pdfRaw)).length === 0);

// ---------- T14 扫描件 PDF → OCR 兜底真跑（桩引擎，验证接线与进度）----------
let ocrCalls = 0, ocrProg = 0;
win.OCR = { recognize: async (img, onProg) => { ocrCalls++; if (onProg) onProg(50, "OCR 识别中…"); ocrProg = 1; return "扫描件第一页识别出的文字内容示例，用于真跑验证。"; } };
const ocrPdf = await KB.convertExternalAuto(new win.File([scanBytes], "扫描件.pdf"), () => {});
assert("扫描件 PDF 自动走 OCR 兜底并入库", !!ocrPdf && ocrPdf.md.includes("扫描件第一页识别出的文字内容"), ocrPdf ? ocrPdf.md.slice(0, 60) : "null");
assert("OCR 引擎被调用且进度回调打通", ocrCalls === 1 && ocrProg === 1);

// ---------- T15 图片文件直接 OCR 入库 ----------
const imgEntry = await KB.convertExternalAuto(new win.File([jpegBytes], "现场照片.jpg"), () => {});
assert("图片文件 OCR 入库", !!imgEntry && imgEntry.md.includes("扫描件第一页识别出的文字内容") && (imgEntry.tags || []).includes("jpg"));

// ---------- T16 OCR 缺失/失败 fail-loud ----------
win.OCR = undefined;
let noOcr = "";
try { await KB.convertExternalAuto(new win.File([scanBytes], "扫描件2.pdf"), () => {}); } catch (e) { noOcr = e.message; }
assert("OCR 引擎缺失明确报错不静默", /OCR|无法|识别/.test(noOcr), noOcr);
win.OCR = { recognize: async () => "。。。 !!  \n" }; // 空结果/噪声
let badOcr = "";
try { await KB.convertExternalAuto(new win.File([jpegBytes], "模糊图.png"), () => {}); } catch (e) { badOcr = e.message; }
assert("OCR 无有效文字明确报错", /未识别|模糊|有效文字/.test(badOcr), badOcr);
win.OCR = undefined;

// ---------- 汇总 ----------
const pass = out.filter((o) => o.ok).length;
console.log(`\n=== ${APP} 知识库格式改造验证: ${pass} / ${out.length} ===`);
// Node webstreams 适配层(node:internal/webstreams/adapters)对“坏输入 inflate”错误路径测试产生的
// plumbing rejection 噪音不计为页面错误（应用断言均已 ✅ 且 fail-loud 信息正确）
const REAL_NOISE = /node:internal\/webstreams\/adapters/;
const realErrors = errors.filter((e) => !REAL_NOISE.test(e));
const noiseN = errors.length - realErrors.length;
if (noiseN) console.log(`（忽略 ${noiseN} 条 Node webstreams 适配层噪音 rejection，非应用错误）`);
if (realErrors.length) { console.log("页面错误:"); realErrors.forEach((e) => console.log("  " + e)); }
process.exit(pass === out.length && realErrors.length === 0 ? 0 : 1);
