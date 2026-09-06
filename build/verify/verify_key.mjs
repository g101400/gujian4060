#!/usr/bin/env node
// scripts/verify_key.mjs —— 验证 #9 天地图密钥隐藏 + 复制需密码 3305
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
const clk = (node) => { if (!node) throw new Error("节点不存在"); node.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, view: win })); };
const toastEl = () => win.document.getElementById("toast");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);

const out = [];
const assert = (name, cond, extra = "") => { out.push({ name, ok: !!cond, extra }); console.log((cond ? "✅" : "❌") + " " + name + (extra ? "  " + extra : "")); };

// 打开密钥面板
clk(win.document.querySelector('.menu-btn[data-act="tiandituKey"]'));
await sleep(150);
assert("密钥面板打开(tdtClient 存在)", el("tdtClient"));
assert("#9 当前密钥不预填明文(tdtClient 为空)", el("tdtClient") && el("tdtClient").value === "", el("tdtClient") ? `value=${JSON.stringify(el("tdtClient").value)}` : "");
const roTok = [...win.document.querySelectorAll('input[readonly]')].find((i) => /••/.test(i.value));
assert("#9 当前 token 显示已掩码(••••)", !!roTok, roTok ? `显示=${JSON.stringify(roTok.value)}` : "未找到掩码输入");
assert("#9 存在密码输入框(tdtPwd)", el("tdtPwd"));
assert("#9 存在复制按钮(tdtCopy)", el("tdtCopy"));

// 剪贴板桩
let copied = null;
win.navigator.clipboard = { writeText: (t) => { copied = t; return Promise.resolve(); } };

// 错误密码：应拒绝复制
el("tdtPwd").value = "0000";
clk(el("tdtCopy"));
await sleep(60);
assert("#9 错误密码拒绝复制(clipboard 未写入)", copied === null, `copied=${JSON.stringify(copied)}`);
assert("#9 错误密码提示访问密码错误", /访问密码错误/.test(toastEl().textContent || ""), `toast=${JSON.stringify(toastEl().textContent)}`);

// 正确密码 3305：应复制
el("tdtPwd").value = "3305";
clk(el("tdtCopy"));
await sleep(60);
assert("#9 密码 3305 复制成功(clipboard 写入)", copied && /TIANDITU_TOKEN=/.test(copied), copied ? `前20=${JSON.stringify(copied.slice(0, 20))}` : "未写入");
assert("#9 复制成功提示", /已复制当前密钥/.test(toastEl().textContent || ""), `toast=${JSON.stringify(toastEl().textContent)}`);

try { if (win.APP && typeof win.APP.close === "function") win.APP.close(); } catch (e) {}

console.log("\n=== #9 验证结果 ===");
const bad = out.filter((o) => !o.ok);
console.log("通过: " + (out.length - bad.length) + "/" + out.length + " | 错误: " + errors.filter((e) => !/Could not parse CSS|Not implemented: HTMLCanvasElement/i.test(e)).length);
for (const e of errors.filter((e) => !/Could not parse CSS|Not implemented: HTMLCanvasElement/i.test(e))) console.log("  ⚠ " + String(e).slice(0, 200));
process.exit(bad.length ? 1 : 0);
