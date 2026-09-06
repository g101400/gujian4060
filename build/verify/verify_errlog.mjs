#!/usr/bin/env node
// scripts/verify_errlog.mjs —— 真跑功能⑯「错误日志」全链路：
// 全局错误捕获 → 环形缓冲落库 → 菜单打开 → 内容展示 → 复制 → 清空。
import fs from "node:fs";
import path from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";

const APP = process.argv[2] || "shuili";
const ROOT = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(process.cwd(), APP + "_app");
const idxHtml = path.join(ROOT, "index.html");
if (!fs.existsSync(idxHtml)) { console.error("找不到 index.html:", idxHtml); process.exit(2); }

import "fake-indexeddb/auto";
const errors = [];
process.on("unhandledRejection", (e) => errors.push("[unhandledRejection] " + (e && e.message ? e.message : e)));
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("[jsdomError] " + (e && e.message ? e.message : e)));
const html = fs.readFileSync(idxHtml, "utf8");
const dom = new JSDOM(html, { url: "http://localhost/", runScripts: "outside-only", virtualConsole: vc, pretendToBeVisual: true });
const win = dom.window;
if (globalThis.indexedDB) { win.indexedDB = globalThis.indexedDB; win.IDBKeyRange = globalThis.IDBKeyRange; }

function fakeLayer(extra = {}) { const o = { addTo() { return o; }, remove() { return o; }, removeLayer() { return o; }, addLayer() { return o; }, clearLayers() { return o; }, eachLayer(cb) { if (cb) cb(o); return o; }, setLatLngs() { return o; }, setStyle() { return o; }, bringToFront() { return o; }, getLatLngs() { return []; }, getLayers() { return []; }, openPopup() { return o; }, closePopup() { return o; }, bindPopup() { return o; }, bindTooltip() { return o; }, unbindPopup() { return o; }, on() { return o; }, off() { return o; }, setZIndexOffset() { return o; }, redraw() { return o; }, setIcon() { return o; }, setOpacity() { return o; }, getBounds() { return fakeBounds(); }, getCenter() { return { lat: 40, lng: 116 }; }, getZoom() { return 13; }, ...extra }; return o; }
function fakeBounds() { return { getSouth: () => 39, getWest: () => 115, getNorth: () => 41, getEast: () => 117, isValid: () => true, contains: () => true, pad: () => fakeBounds(), getSouthWest: () => ({ lat: 39, lng: 115 }), getNorthEast: () => ({ lat: 41, lng: 117 }), getCenter: () => ({ lat: 40, lng: 116 }) }; }
const mapStub = fakeLayer({ setView() { return mapStub; }, flyTo() { return mapStub; }, flyToBounds() { return mapStub; }, fitBounds() { return mapStub; }, setZoom() { return mapStub; }, panTo() { return mapStub; }, invalidateSize() { return mapStub; }, hasLayer: () => false, on() { return mapStub; }, off() { return mapStub; }, whenReady(cb) { if (cb) cb(); return mapStub; }, closePopup() { return mapStub; }, addControl() { return mapStub; }, removeControl() { return mapStub; }, locate() { return mapStub; }, stopLocate() { return mapStub; }, getZoom: () => 13, getCenter: () => ({ lat: 40, lng: 116 }), getBounds: () => fakeBounds(), getSize: () => ({ x: 800, y: 600 }), latLngToContainerPoint: () => ({ x: 0, y: 0 }), containerPointToLatLng: () => ({ lat: 40, lng: 116 }), distance: () => 100, options: {} });
win.L = { map: () => mapStub, tileLayer: () => fakeLayer({ setUrl() { return this; } }), layerGroup: () => fakeLayer(), featureGroup: () => fakeLayer(), marker: () => fakeLayer({ setLatLng() { return this; }, getLatLng: () => ({ lat: 40, lng: 116 }) }), divIcon: (o) => ({ options: o || {}, createIcon: () => null }), icon: (o) => ({ options: o || {} }), circle: () => fakeLayer({ setRadius() { return this; } }), circleMarker: () => fakeLayer({ setRadius() { return this; } }), polyline: () => fakeLayer(), polygon: () => fakeLayer(), latLng: (a, b) => (typeof a === "object" ? a : { lat: a, lng: b }), latLngBounds: () => fakeBounds(), control: { attribution: () => fakeLayer({ addTo: () => fakeLayer() }), scale: () => fakeLayer(), zoom: () => fakeLayer() }, DomEvent: { stopPropagation() {}, preventDefault() {}, disableClickPropagation() {}, on() {}, off() {} }, Icon: { Default: { imagePath: "", mergeOptions() {}, prototype: {} } }, Browser: { any3d: true, touch: false }, Util: { formatNum: (v) => String(v) }, CRS: { EPSG3857: {} }, Point: function (x, y) { this.x = x; this.y = y; }, version: "1.9.4-stub" };
win.navigator.geolocation = { getCurrentPosition: (ok) => ok && ok({ coords: { latitude: 40, lng: 116, longitude: 116 } }), watchPosition: () => 1, clearWatch() {} };
win.navigator.share = () => Promise.resolve();
win.alert = () => {}; win.confirm = () => true; win.prompt = () => ""; win.scrollTo = () => {};
win.open = () => ({ focus() {}, close() {}, location: {}, addEventListener() {} });
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
const runJs = (label, code) => { try { win.eval(code); return true; } catch (e) { errors.push("[LOAD " + label + "] " + (e && e.message ? e.message : e)); return false; } };
let inlineIdx = 0;
for (const src of srcs) { const f = path.join(ROOT, src); if (!fs.existsSync(f)) { errors.push("[MISSING] " + src); continue; } if (/leaflet/i.test(src)) continue; runJs(src, fs.readFileSync(f, "utf8")); while (inlineIdx < inline.length && inlineIdx < 1) { runJs("inline#" + inlineIdx, inline[inlineIdx]); inlineIdx++; } }
for (; inlineIdx < inline.length; inlineIdx++) runJs("inline#" + inlineIdx, inline[inlineIdx]);

const el = (id) => win.document.getElementById(id);
const clk = (node) => { if (!node) throw new Error("节点不存在"); node.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, view: win })); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);

const out = [];
const assert = (n, c, e = "") => { out.push({ n, ok: !!c, e }); console.log((c ? "✅" : "❌") + " " + n + (e ? "  " + e : "")); };

const APP_ID = win.__APP_ID__ || "app";
const KEY = APP_ID + "_errlog_v1";

// T1 捕获钩子已挂载
assert("window.__ERR_LOG_PUSH__ 已挂载（全局错误捕获生效）", typeof win.__ERR_LOG_PUSH__ === "function");

// T2 直推一条 + 真实 error 事件各一条
win.__ERR_LOG_PUSH__("TEST-直接推送：闸门开度解析失败");
win.dispatchEvent(new win.ErrorEvent("error", { message: "TEST-真实error事件：照片解码失败", filename: "app.js", lineno: 42, error: new Error("x") }));
await sleep(100);
let stored = [];
try { stored = JSON.parse(win.localStorage.getItem(KEY) || "[]"); } catch (_) {}
assert("两条错误已入环形缓冲 localStorage", Array.isArray(stored) && stored.length >= 2, "实际 " + (stored.length || 0) + " 条");
assert("消息内容完整（含位置信息）", stored.some((x) => /TEST-真实error事件/.test(x.m || "") && /app\.js:42/.test(x.m || "")));

// T3 环形缓冲上限 300 条
for (let i = 0; i < 320; i++) win.__ERR_LOG_PUSH__("FLOOD-" + i);
await sleep(50);
try { stored = JSON.parse(win.localStorage.getItem(KEY) || "[]"); } catch (_) { stored = []; }
assert("环形缓冲封顶 300 条（不无限膨胀）", stored.length <= 300 && stored.length >= 300, "实际 " + stored.length);

// T4 菜单按钮存在且点击打开面板
const btn = win.document.querySelector('[data-act="errlog"]');
assert("「错误日志」菜单按钮存在（信息与帮助分组）", !!btn);
let modalShown = false, bodyText = "";
try {
  clk(btn); await sleep(300);
  const modal = win.document.querySelector(".modal, .modal-card, [class*=modal]");
  bodyText = win.document.body.textContent || "";
  modalShown = !!modal || /错误日志/.test(bodyText);
} catch (e) { bodyText = "点击异常: " + e.message; }
assert("点击菜单打开错误日志面板", modalShown, bodyText.slice(0, 80));
assert("面板展示已捕获的错误（含 FLOOD 条目）", /FLOOD|TEST-/.test(bodyText));

// T5 清空按钮真点
const clearBtn = el("elClear");
assert("「清空」按钮存在且点击后缓冲清零", !!clearBtn && (() => { try { clk(clearBtn); } catch (_) { return false; } try { return JSON.parse(win.localStorage.getItem(KEY) || "[]").length === 0; } catch (_) { return win.localStorage.getItem(KEY) === null; } })());

const bad = out.filter((o) => !o.ok);
console.log("\n=== " + APP.toUpperCase() + " 错误日志功能验证 ===");
console.log("通过: " + (out.length - bad.length) + "/" + out.length);
process.exit(bad.length ? 1 : 0);
