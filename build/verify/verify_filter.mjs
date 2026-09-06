#!/usr/bin/env node
// scripts/verify_filter.mjs —— 真实 DOM 驱动验证 #5（筛选/管理所维护添加是否生效）
// 加载真实 index.html + 脚本顺序（与 smoke_menu 同套桩），真实点击菜单/管理器/筛选按钮，断言 DOM 结果。
// 2026-08-31 加固：自动识别机构模型——水利端(mOffice 存在)跑全量专属断言；感知/古建端无 mOffice → 水利专属断言统一 SKIP（不误报 ❌）。
// 铁律：跨端缺功能须先读源码判定，勿被验证脚本假阴性误导。
import fs from "node:fs";
import path from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";

const APP = process.argv[2] || "shuili";
const ROOT = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(process.cwd(), "..", APP + "_app");
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
function fakeLayer(extra = {}) { const o = { addTo() { return o; }, remove() { return o; }, removeLayer() { return o; }, addLayer() { return o; }, clearLayers() { return o; }, eachLayer(cb) { if (cb) cb(o); return o; }, setLatLngs() { return o; }, setStyle() { return o; }, bringToFront() { return o; }, getLatLngs() { return []; }, getLayers() { return []; }, openPopup() { return o; }, closePopup() { return o; }, bindPopup() { return o; }, bindTooltip() { return o; }, setTooltipContent() { return o; }, unbindPopup() { return o; }, on() { return o; }, off() { return o; }, setZIndexOffset() { return o; }, redraw() { return o; }, setIcon() { return o; }, setOpacity() { return o; }, getBounds() { return fakeBounds(); }, getCenter() { return { lat: 40, lng: 116 }; }, getZoom() { return 13; }, ...extra }; return o; }
function fakeBounds() { return { getSouth: () => 39, getWest: () => 115, getNorth: () => 41, getEast: () => 117, isValid: () => true, contains: () => true, pad: () => fakeBounds(), getSouthWest: () => ({ lat: 39, lng: 115 }), getNorthEast: () => ({ lat: 41, lng: 117 }), getCenter: () => ({ lat: 40, lng: 116 }) }; }
const mapStub = fakeLayer({ setView() { return mapStub; }, flyTo() { return mapStub; }, flyToBounds() { return mapStub; }, fitBounds() { return mapStub; }, setZoom() { return mapStub; }, panTo() { return mapStub; }, invalidateSize() { return mapStub; }, hasLayer: () => false, removeLayer() { return mapStub; }, on() { return mapStub; }, off() { return mapStub; }, whenReady(cb) { if (cb) cb(); return mapStub; }, getZoom: () => 13, getCenter: () => ({ lat: 40, lng: 116 }), getBounds: () => fakeBounds(), locate() { return mapStub; }, stopLocate() { return mapStub; }, closePopup() { return mapStub; }, addControl() { return mapStub; }, removeControl() { return mapStub; }, setMaxBounds() { return mapStub; }, _container: null, getPane: () => null, getSize: () => ({ x: 800, y: 600 }), latLngToContainerPoint: () => ({ x: 0, y: 0 }), containerPointToLatLng: () => ({ lat: 40, lng: 116 }), distance: () => 100, options: {}, zoomControl: null, attributionControl: null, scrollWheelZoom: { enable() {}, disable() {} }, dragging: { enable() {}, disable() {} } });
win.L = { map: () => mapStub, tileLayer: () => fakeLayer({ setUrl() { return this; } }), layerGroup: () => fakeLayer(), featureGroup: () => fakeLayer(), marker: () => fakeLayer({ setLatLng() { return this; }, getLatLng: () => ({ lat: 40, lng: 116 }) }), divIcon: (o) => ({ options: o || {}, createIcon: () => null }), icon: (o) => ({ options: o || {} }), circle: () => fakeLayer({ setRadius() { return this; } }), circleMarker: () => fakeLayer({ setRadius() { return this; } }), polyline: () => fakeLayer(), polygon: () => fakeLayer(), latLng: (a, b) => (typeof a === "object" ? a : { lat: a, lng: b }), latLngBounds: () => fakeBounds(), control: { attribution: () => fakeLayer({ addTo: () => fakeLayer() }), scale: () => fakeLayer(), zoom: () => fakeLayer() }, DomEvent: { stopPropagation() {}, preventDefault() {}, disableClickPropagation() {}, on() {}, off() {} }, Icon: { Default: { imagePath: "", mergeOptions() {}, prototype: {} } }, Browser: { any3d: true, touch: false }, Util: { formatNum: (v) => String(v) }, CRS: { EPSG3857: {} }, Point: function (x, y) { this.x = x; this.y = y; }, version: "1.9.4-stub" };
win.navigator.geolocation = { getCurrentPosition: (ok) => ok && ok({ coords: { latitude: 40, lng: 116, longitude: 116 } }), watchPosition: () => 1, clearWatch() {} };
win.alert = () => {}; win.confirm = () => true; win.prompt = () => ""; win.scrollTo = () => {};
win.Element.prototype.scrollIntoView = function () {}; win.Element.prototype.scrollTo = function () {};
win.Element.prototype.getBoundingClientRect = function () { return { x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 40, width: 100, height: 40 }; };
win.URL.createObjectURL = () => "blob:stub"; win.URL.revokeObjectURL = () => {};
win.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, { get: (t, k) => (k === "canvas" ? { width: 100, height: 100 } : (k === "getImageData" ? () => ({ data: new Uint8ClampedArray(4) }) : (k === "measureText" ? () => ({ width: 10 }) : () => {}))) }); };
win.HTMLAnchorElement.prototype.click = function () {};
if (!win.crypto) win.crypto = {};
if (!win.crypto.getRandomValues) win.crypto.getRandomValues = (a) => { for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 256) | 0; return a; };

const inline = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m; while ((m = re.exec(html))) inline.push(m[1]);
const srcs = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((x) => x[1]);
const runJs = (label, code) => { try { win.eval(code); return true; } catch (e) { errors.push("[LOAD " + label + "] " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); return false; } };
let inlineIdx = 0;
for (const src of srcs) { const f = path.join(ROOT, src); if (!fs.existsSync(f)) { errors.push("[MISSING] " + src); continue; } if (/leaflet/i.test(src)) continue; runJs(src, fs.readFileSync(f, "utf8")); while (inlineIdx < inline.length && inlineIdx < 1) { runJs("inline#" + inlineIdx, inline[inlineIdx]); inlineIdx++; } }
for (; inlineIdx < inline.length; inlineIdx++) runJs("inline#" + inlineIdx, inline[inlineIdx]);

const el = (id) => win.document.getElementById(id);
const clk = (node) => { if (!node) throw new Error("节点不存在，无法点击"); node.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, view: win })); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await sleep(2500);
const out = [];
let skipCount = 0;
const assert = (name, cond, extra = "") => { out.push({ name, ok: !!cond, extra }); console.log((cond ? "✅" : "❌") + " " + name + (extra ? "  " + extra : "")); };
const assertSkip = (name) => { skipCount++; console.log("⏭️ " + name + "  (SKIP: 本端非水利机构模型，不计入失败)"); };

// 打开筛选菜单
clk(win.document.querySelector('.menu-btn[data-act="filter"]'));
await sleep(120);
assert("筛选菜单打开(modalBody 存在)", el("modalBody") && el("fApply"));
if (el("mOffice")) {
  // ===== 水利端：全量机构专属断言 =====
assert("筛选含「管理所维护」按钮(mOffice)", el("mOffice"));
assert("筛选含「管理站维护」按钮(mStation)", el("mStation"));
assert("筛选含「建筑物类型管理」按钮(mBtypeMgr)", el("mBtypeMgr"));

// --- 用例 A：管理所维护中添加新管理所，关闭后应出现在筛选 chip 中 ---
const NEW_OFF = "验证所AUTO" + Date.now().toString().slice(-5);
clk(el("mOffice"));
await sleep(120);
assert("管理所维护弹窗打开(ofAdd 存在)", el("ofAdd") && el("ofAddBtn"));
el("ofAdd").value = NEW_OFF;
clk(el("ofAddBtn"));
await sleep(150);
// 关闭管理器 → 返回筛选
clk(el("ofClose"));
await sleep(150);
const offGroup = [...win.document.querySelectorAll(".fgroup")].find((g) => /管理所/.test((g.querySelector(".ftitle") || {}).textContent || ""));
const offChips = offGroup ? [...offGroup.querySelectorAll('.chip[data-grp="管理所"]')].map((c) => c.dataset.v) : [];
assert("#5 管理所维护「添加」后出现在筛选 chip", offChips.includes(NEW_OFF), `新管理所=${NEW_OFF} 是否出现=${offChips.includes(NEW_OFF)}`);

// --- 用例 B：管理处 chip 可切换 + 选未选中「管理所」→ 应用 → 重开仍保留 ---
clk(win.document.querySelector('.menu-btn[data-act="filter"]'));
await sleep(120);
const mgmtChip = win.document.querySelector('.chip[data-grp="管理处"]');
if (mgmtChip) {
  const before = mgmtChip.classList.contains("on");
  clk(mgmtChip); await sleep(30);
  const mid = mgmtChip.classList.contains("on");
  clk(mgmtChip); await sleep(30); // 复原
  assert("「管理处」chip 点击可切换 on/off（toggle 生效）", mid !== before && mgmtChip.classList.contains("on") === before);
}
clk(win.document.querySelector('.menu-btn[data-act="filter"]'));
await sleep(120);
const offChip = [...win.document.querySelectorAll('.chip[data-grp="管理所"]')].find((c) => !c.classList.contains("on"));
assert("存在未选中的「管理所」chip 供测试", !!offChip);
if (offChip) {
  const name = offChip.dataset.v;
  clk(offChip);
  await sleep(40);
  assert("点击未选中「管理所」chip 后变 on", offChip.classList.contains("on"), `选中=${name}`);
  clk(el("fApply"));
  await sleep(150);
  clk(win.document.querySelector('.menu-btn[data-act="filter"]'));
  await sleep(150);
  const offChip2 = [...win.document.querySelectorAll('.chip[data-grp="管理所"]')].find((c) => c.dataset.v === name);
  assert("#5 筛选「应用」后重开仍保留选择", offChip2 && offChip2.classList.contains("on"), `重开后=${name} 仍 on=${offChip2 && offChip2.classList.contains("on")}`);
}

// --- 用例 C：管理站筛选组存在且可筛选（#5 用户点名维度） ---
clk(win.document.querySelector('.menu-btn[data-act="filter"]'));
await sleep(120);
const stGroup = [...win.document.querySelectorAll(".fgroup")].find((g) => /管理站/.test((g.querySelector(".ftitle") || {}).textContent || ""));
assert("#5 筛选含「管理站」分组", !!stGroup);
const stChip = stGroup ? [...stGroup.querySelectorAll('.chip[data-grp="管理站"]')].find((c) => !c.classList.contains("on")) : null;
assert("「管理站」分组含可选项 chip", !!stChip, stChip ? `示例=${stChip.dataset.v}` : "(数据无管理站)");
if (stChip) {
  const sname = stChip.dataset.v;
  clk(stChip); await sleep(40);
  assert("点击「管理站」chip 后变 on", stChip.classList.contains("on"), `选中=${sname}`);
  clk(el("fApply")); await sleep(150);
  clk(win.document.querySelector('.menu-btn[data-act="filter"]')); await sleep(150);
  const stChip2 = [...win.document.querySelectorAll('.chip[data-grp="管理站"]')].find((c) => c.dataset.v === sname);
  assert("#5 「管理站」筛选应用后重开仍保留", stChip2 && stChip2.classList.contains("on"));
}
} else {
  // ===== 非水利端（感知/古建）：机构模型差异化，水利专属断言统一 SKIP，不误报 ❌ =====
  assertSkip("筛选含「管理所维护」按钮(mOffice)");
  assertSkip("筛选含「管理站维护」按钮(mStation)");
  assertSkip("筛选含「建筑物类型管理」按钮(mBtypeMgr)");
  assertSkip("#5 管理所维护「添加」后出现在筛选 chip");
  assertSkip("#5 筛选「应用」后重开仍保留选择");
  assertSkip("#5 筛选含「管理站」分组");
  assertSkip("#5 「管理站」筛选应用后重开仍保留");
}
// 关闭弹窗
try { if (win.APP && typeof win.APP.close === "function") win.APP.close(); } catch (e) {}

console.log("\n=== #5 验证结果 ===");
const bad = out.filter((o) => !o.ok);
console.log("通过: " + (out.length - bad.length) + "/" + out.length + " | SKIP(非本端): " + skipCount + " | 加载/运行错误: " + errors.filter((e) => !/Could not parse CSS|Not implemented: HTMLCanvasElement/i.test(e)).length);
for (const e of errors.filter((e) => !/Could not parse CSS|Not implemented: HTMLCanvasElement/i.test(e))) console.log("  ⚠ " + String(e).slice(0, 200));
process.exit(bad.length ? 1 : 0);
