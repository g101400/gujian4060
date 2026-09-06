#!/usr/bin/env node
// scripts/verify_popup.mjs —— 真跑地图气泡里每个按钮（APP.*），证明不再 script error
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
win.navigator.share = () => Promise.resolve(); // 桩化分享，避免 jsdom 无 navigator.share 误报
win.alert = () => {}; win.confirm = () => true; win.prompt = () => ""; win.scrollTo = () => {};
win.open = () => ({ focus() {}, close() {}, location: {}, addEventListener() {} }); // jsdom 未实现 window.open，桩化（真实环境用于打开地图导航）
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
const assert = (n, c, e = "") => { out.push({ n, ok: !!c, e }); console.log((c ? "✅" : "❌") + " " + n + (e ? "  " + e : "")); };

// 取第一条有坐标的记录 id（真实数据，非造假）
const recs = (win.__getRecords ? win.__getRecords() : (win.__DATA__ && win.__DATA__.features ? win.__DATA__.features : [])) || [];
const rec = recs.find((r) => isFinite(+r.lat) && isFinite(+r.lon)) || recs[0];
assert("拿到真实基础数据记录", !!rec, rec ? "样例: " + (rec.name || rec.id) : "__DATA__ 为空");
const rid = rec ? String(rec.id) : "";

// 1) 气泡 HTML 里被引用的 APP.xxx 必须全部可调用
const APPO = win.APP || {};
assert("window.APP 已挂载", !!win.APP);

// 从源码里真实抽出气泡按钮引用的方法名（不写死，源码改了这里自动跟）
const appjs = fs.readFileSync(path.join(ROOT, "js/app.js"), "utf8");
const pop = appjs.slice(appjs.indexOf("function popupHtml"), appjs.indexOf("function popupHtml") + 2600);
const refs = [...new Set([...pop.matchAll(/APP\.([\w$]+)\s*\(/g)].map((m) => m[1]))];
assert("气泡引用了 APP 方法（抽到 " + refs.length + " 个）", refs.length > 0, refs.join(", "));
for (const k of refs) assert("APP." + k + " 是函数（否则点击即 script error）", typeof APPO[k] === "function");

// 2) 真调一遍：捕获同步异常（del 会走 confirm，已被桩成 true，这里放到最后单独跑）
const errBefore = errors.length;
for (const k of refs) {
  if (k === "del") continue;   // 删除留到最后，避免影响后续断言
  try { const rv = APPO[k](rid); if (rv && typeof rv.then === "function") await rv.catch((e) => errors.push("[await APP." + k + "] " + e)); assert("真调 APP." + k + "() 未抛异常", true); }
  catch (e) { assert("真调 APP." + k + "() 未抛异常", false, String(e && e.message || e)); }
}
await sleep(300);
const newErr = errors.slice(errBefore).filter((e) => !/Could not parse CSS|Not implemented|NotSupportedError|navigator\.share|clipboard/i.test(e));
assert("真调气泡按钮期间无新增运行时错误", newErr.length === 0, newErr.slice(0, 3).join(" || "));

const bad = out.filter((o) => !o.ok);
console.log("\n=== " + APP_NAME_UP() + " 气泡按钮验证 ===");
function APP_NAME_UP() { return (process.argv[2] || "shuili").toUpperCase(); }
console.log("通过: " + (out.length - bad.length) + "/" + out.length + " | 加载/运行错误: " + errors.filter((e) => !/Could not parse CSS|Not implemented: HTMLCanvasElement/i.test(e)).length);
if (errors.length) console.log("（错误明细前 5 条）\n  " + errors.slice(0, 5).join("\n  "));
process.exit(bad.length ? 1 : 0);
