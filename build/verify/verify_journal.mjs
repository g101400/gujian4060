/* 一张图家族「图文笔记（游记/备忘录）」真跑验证
 * 真实 DOM(jsdom) + fake-indexeddb + Leaflet 桩，实际打开编辑器、保存、落库、AI 镜像、列表筛选、bulkPut。
 * 用法: node scripts/verify_journal.mjs shuili|shipin|gujian
 * 退出码: 0 = 全过; 1 = 有失败
 */
import fs from "node:fs";
import path from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";

const APP = process.argv[2] || "gujian";
const ROOT = path.resolve(process.cwd(), APP + "_app");
const idxHtml = path.join(ROOT, "index.html");
if (!fs.existsSync(idxHtml)) { console.error("找不到 index.html:", idxHtml); process.exit(2); }

import "fake-indexeddb/auto";
const errors = [];
process.on("unhandledRejection", (e) => errors.push("[unhandledRejection] " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)));
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("[jsdomError] " + (e && (e.detail && e.detail.stack ? e.detail.stack : (e.stack || e.message)) ? (e.detail ? e.detail.stack : e.stack) : e.message || e)));
vc.on("error", (...a) => errors.push("[console.error] " + a.join(" ")));

const html = fs.readFileSync(idxHtml, "utf8");
const dom = new JSDOM(html, { url: "http://localhost/", runScripts: "outside-only", virtualConsole: vc, pretendToBeVisual: true });
const win = dom.window;
win.addEventListener("error", (ev) => { const e = ev.error || ev; errors.push("[winError] " + (e && e.stack ? e.stack.split("\n").slice(0, 6).join("\n    ") : (ev.message || e))); });

if (globalThis.indexedDB) { win.indexedDB = globalThis.indexedDB; win.IDBKeyRange = globalThis.IDBKeyRange; win.IDBTransaction = globalThis.IDBTransaction || win.IDBTransaction; }

function fakeLayer(extra = {}) { const o = { addTo() { return o; }, remove() { return o; }, clearLayers() { return o; }, eachLayer(cb) { if (cb) cb(o); return o; }, setStyle() { return o; }, on() { return o; }, off() { return o; }, getBounds() { return fakeBounds(); }, getCenter() { return { lat: 40, lng: 116 }; }, ...extra }; return o; }
function fakeBounds() { return { getSouth: () => 39, getWest: () => 115, getNorth: () => 41, getEast: () => 117, isValid: () => true, contains: () => true, pad: () => fakeBounds(), getSouthWest: () => ({ lat: 39, lng: 115 }), getNorthEast: () => ({ lat: 41, lng: 117 }), getCenter: () => ({ lat: 40, lng: 116 }) }; }
const mapStub = fakeLayer({ setView() { return mapStub; }, flyTo() { return mapStub; }, flyToBounds() { return mapStub; }, fitBounds() { return mapStub; }, whenReady(cb) { if (cb) cb(); return mapStub; }, getZoom: () => 13, getCenter: () => ({ lat: 40, lng: 116 }), getBounds: () => fakeBounds(), locate() { return mapStub; }, latLngToContainerPoint: () => ({ x: 0, y: 0 }), distance: () => 100, options: {} });
win.L = { map: () => mapStub, tileLayer: () => fakeLayer({ setUrl() { return this; } }), layerGroup: () => fakeLayer(), featureGroup: () => fakeLayer(), marker: () => fakeLayer({ setLatLng() { return this; }, getLatLng: () => ({ lat: 40, lng: 116 }) }), divIcon: (o) => ({ options: o || {}, createIcon: () => null }), icon: (o) => ({ options: o || {} }), circle: () => fakeLayer({ setRadius() { return this; } }), circleMarker: () => fakeLayer({ setRadius() { return this; } }), polyline: () => fakeLayer(), polygon: () => fakeLayer(), latLng: (a, b) => (typeof a === "object" ? a : { lat: a, lng: b }), latLngBounds: () => fakeBounds(), control: { attribution: () => fakeLayer(), scale: () => fakeLayer(), zoom: () => fakeLayer() }, DomEvent: { stopPropagation() {}, preventDefault() {}, disableClickPropagation() {}, on() {}, off() {} }, Icon: { Default: { imagePath: "", mergeOptions() {}, prototype: {} } }, Browser: { any3d: true, touch: false }, Util: { formatNum: (v) => String(v) }, CRS: { EPSG3857: {} }, Point: function (x, y) { this.x = x; this.y = y; }, version: "stub" };
win.navigator.geolocation = { getCurrentPosition: (ok) => ok && ok({ coords: { latitude: 40, lng: 116 } }), watchPosition: () => 1, clearWatch() {} };
win.alert = () => {}; win.confirm = () => true; win.prompt = () => ""; win.scrollTo = () => {};
win.Element.prototype.scrollIntoView = function () {}; win.Element.prototype.scrollTo = function () {};
win.Element.prototype.getBoundingClientRect = function () { return { x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 40, width: 100, height: 40 }; };
win.URL.createObjectURL = () => "blob:stub"; win.URL.revokeObjectURL = () => {};
win.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, { get: (t, k) => (k === "canvas" ? { width: 100, height: 100 } : (k === "getImageData" ? () => ({ data: new Uint8ClampedArray(4) }) : (k === "measureText" ? () => ({ width: 10 }) : () => {}))) }); };
win.HTMLAnchorElement.prototype.click = function () {};

const inline = []; const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m; while ((m = re.exec(html))) inline.push(m[1]);
const srcs = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((x) => x[1]);
const runJs = (label, code) => { try { win.eval(code); return true; } catch (e) { errors.push("[LOAD " + label + "] " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); return false; } };
let inlineIdx = 0;
for (const src of srcs) { const f = path.join(ROOT, src); if (!fs.existsSync(f)) { errors.push("[MISSING] " + src); continue; } if (/leaflet/i.test(src)) continue; runJs(src, fs.readFileSync(f, "utf8")); while (inlineIdx < inline.length && inlineIdx < 1) { runJs("inline#" + inlineIdx, inline[inlineIdx]); inlineIdx++; } }
for (; inlineIdx < inline.length; inlineIdx++) runJs("inline#" + inlineIdx, inline[inlineIdx]);

await new Promise((r) => setTimeout(r, 1800));

const out = [];
const assert = (n, c, e = "") => { out.push({ n, ok: !!c, e }); console.log((c ? "✅" : "❌") + " " + n + (e ? "  " + e : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) 模块装载
assert("Journal 模块已挂载（global.Journal）", !!win.Journal && typeof win.Journal.put === "function" && typeof win.Journal.all === "function" && typeof win.Journal.bulkPut === "function");
const CFG = { gujian: { kind: "journal", label: "游记", acts: { write: "writeJournal", export: "exportJournal" } }, shuili: { kind: "memo", label: "备忘录", acts: { write: "writeMemo", export: "exportMemo" } }, shipin: { kind: "memo", label: "备忘录", acts: { write: "writeMemo", export: "exportMemo" } } }[APP];
assert("菜单动作已注册 write/export", !!win.__EXT_ACTS__ && typeof win.__EXT_ACTS__[CFG.acts.write] === "function" && typeof win.__EXT_ACTS__[CFG.acts.export] === "function");

// 2) 打开编辑器（不传 editId → 同步开模态）
win.__EXT_ACTS__[CFG.acts.write]();
await sleep(50);
assert("点击「写" + CFG.label + "」打开编辑器（#jrBody 存在）", !!win.document.getElementById("jrBody"));

// 3) 填写并保存（绑定第一个真实对象，验证 bindOptions 取数）
const body = win.document.getElementById("jrBody");
body.innerHTML = "<p>巡查记录：<strong>闸室底板</strong>发现裂缝，已拍照。</p>";
win.document.getElementById("jrTitle").value = "闸室底板裂缝巡查";
win.document.getElementById("jrTime").value = "2026-09-04";
const bindSel = win.document.getElementById("jrBind");
let boundName = "";
if (bindSel && bindSel.options.length > 1) { bindSel.selectedIndex = 1; bindSel.dispatchEvent(new win.Event("change", { bubbles: true })); boundName = bindSel.options[1].textContent; }
win.document.getElementById("jrSave").dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, view: win }));
await sleep(400);

const list1 = await win.Journal.all();
assert("保存后 Journal.all 含 1 条", list1.length === 1, "实际 " + list1.length);
assert("保存内容/标题正确", list1[0] && list1[0].title === "闸室底板裂缝巡查" && /裂缝/.test(list1[0].text || ""));
assert("绑定对象已记录" + (boundName ? "（" + boundName + "）" : ""), list1[0] && !!list1[0].objId, list1[0] && list1[0].objName || "");

// 4) 知识库镜像（AI 可查）
const kb1 = await win.KB.all();
assert("知识库已镜像 journal: 条目（智能AI可查询）", kb1.some((e) => e.id === "journal:" + list1[0].id), "KB 共 " + kb1.length + " 条");
const mir = kb1.find((e) => e.id === "journal:" + list1[0].id);
assert("镜像正文含检索关键词（裂缝）", mir && /裂缝/.test(mir.md || ""));

// 5) 编辑已存条目（editId 路径）→ 更新而非新增
const id0 = list1[0].id;
win.__EXT_ACTS__[CFG.acts.write](id0);
await sleep(50);
assert("编辑模式预填标题", win.document.getElementById("jrTitle").value === "闸室底板裂缝巡查");
win.document.getElementById("jrTitle").value = "闸室底板裂缝复核";
win.document.getElementById("jrSave").dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, view: win }));
await sleep(400);
const list2 = await win.Journal.all();
assert("编辑后仍为 1 条（更新非新增）", list2.length === 1, "实际 " + list2.length);
assert("编辑后标题已更新", list2[0].title === "闸室底板裂缝复核");

// 6) 列表 / 关键词筛选
win.__EXT_ACTS__[CFG.acts.export]();
await sleep(50);
assert("点击「导出" + CFG.label + "」打开列表（#jrList）", !!win.document.getElementById("jrList"));
const kw = win.document.getElementById("jrKw");
kw.value = "复核"; kw.dispatchEvent(new win.Event("input", { bubbles: true }));
await sleep(30);
let items = win.document.querySelectorAll("#jrList .jr-item");
assert("关键词「复核」筛出 1 条", items.length === 1, "实际 " + items.length);
kw.value = "不存在的关键词zzz"; kw.dispatchEvent(new win.Event("input", { bubbles: true }));
await sleep(30);
items = win.document.querySelectorAll("#jrList .jr-item");
assert("无匹配关键词显示空态", items.length === 0);
win.__EXT_ACTS__[CFG.acts.export](); // 重新打开清理

// 7) bulkPut（升级导入路径，幂等）
await win.Journal.bulkPut([{ id: "imp_1", kind: CFG.kind, objId: "", objName: "", objOrg: "", title: "导入条目", html: "<p>导入</p>", text: "导入", imgs: 0, time: "2026-01-01T00:00:00.000Z", created: "2026-01-01T00:00:00.000Z", updated: "2026-01-01T00:00:00.000Z" }]);
const list3 = await win.Journal.all();
assert("bulkPut 新增导入条目（共 2 条）", list3.length === 2, "实际 " + list3.length);

// 8) 运行期无未捕获错误
const realErr = errors.filter((e) => !/Could not parse CSS|Not implemented: HTMLCanvasElement/i.test(e));
assert("运行期无未捕获错误", realErr.length === 0, realErr.slice(0, 3).join(" || "));

const bad = out.filter((o) => !o.ok);
console.log("\n=== " + APP.toUpperCase() + " 图文笔记验证 ===");
console.log("通过: " + (out.length - bad.length) + "/" + out.length);
if (realErr.length) console.log("（错误明细）\n  " + realErr.slice(0, 5).join("\n  "));
process.exit(bad.length ? 1 : 0);
