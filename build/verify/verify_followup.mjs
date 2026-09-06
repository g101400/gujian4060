#!/usr/bin/env node
// scripts/verify_followup.mjs —— 验证 #7 智能问询(orgContext) + #8 智能查询后续操作(renderFollowups / 单击复制 / 双击回填检索)
// 数据来源无关：shuili/shipin 用 data.json，gujian 用 data.js（均注入 window.__DATA__）；断言从运行态真实数据派生。
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

// 数据注入：仅当存在 data.json 时（shuili/shipin）；gujian 由 data.js 经脚本标签自行设置 window.__DATA__
const dataFile = path.join(ROOT, "data.json");
if (fs.existsSync(dataFile)) win.__DATA__ = JSON.parse(fs.readFileSync(dataFile, "utf8"));
let ANSWER = "默认答案";
let copied = null;
win.navigator.clipboard = { writeText: (t) => { copied = t; return Promise.resolve(); } };
win.fetch = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: ANSWER } }] }), text: async () => "" });

const inline = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m; while ((m = re.exec(html))) inline.push(m[1]);
const srcs = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((x) => x[1]);
const runJs = (label, code) => { try { win.eval(code); return true; } catch (e) { errors.push("[LOAD " + label + "] " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); return false; }; };
let inlineIdx = 0;
for (const src of srcs) { const f = path.join(ROOT, src); if (!fs.existsSync(f)) { errors.push("[MISSING] " + src); continue; } if (/leaflet/i.test(src)) continue; runJs(src, fs.readFileSync(f, "utf8")); while (inlineIdx < inline.length && inlineIdx < 1) { runJs("inline#" + inlineIdx, inline[inlineIdx]); inlineIdx++; } }
for (; inlineIdx < inline.length; inlineIdx++) runJs("inline#" + inlineIdx, inline[inlineIdx]);

const el = (id) => win.document.getElementById(id);
const clk = (node) => { if (!node) throw new Error("节点不存在"); node.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, view: win })); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);

// 从运行态真实数据派生断言样本（gujian 此时已由 data.js 填好 window.__DATA__）
const FEATS = (win.__DATA__ && win.__DATA__.features) || [];
const SAMPLE_KW = (FEATS[0] && (FEATS[0].name || FEATS[0].office || FEATS[0].city)) || "示例条目";
ANSWER = `本地台账中包含「${SAMPLE_KW}」等条目，请据此做汇总说明。`;
const listCount = win.document.querySelectorAll("#listScroll .li").length;
console.log("    [数据] 总条目=" + FEATS.length + " 首条名称=" + JSON.stringify(SAMPLE_KW) + " 渲染列表数=" + listCount);

const out = [];
const assert = (name, cond, extra = "") => { out.push({ name, ok: !!cond, extra }); console.log((cond ? "✅" : "❌") + " " + name + (extra ? "  " + extra : "")); };

// 打开「智能问询」菜单（同时会设置 AI.domain，含 #7 orgContext / #8 suggestFrom）
clk(win.document.querySelector('.menu-btn[data-act="aiFreeQuery"]'));
await sleep(120);
assert("#7 智能问询面板打开(aiFQIn 存在)", el("aiFQIn"));
const dm = win.AI && win.AI.domain;
assert("#7 AI.domain 已设置", !!dm, dm ? "appName=" + dm.appName : "");
assert("#7 提供 orgContext 钩子", dm && typeof dm.orgContext === "function");
assert("#7 提供 suggestFrom 钩子", dm && typeof dm.suggestFrom === "function");
assert("#7 提供 runSearch 钩子", dm && typeof dm.runSearch === "function");

// orgContext 内容检查：应含台账总数统计行（数据无关，只校验真实反映数据规模）
if (dm && dm.orgContext) {
  const ctx = dm.orgContext("测试");
  console.log("    [orgContext 片段] " + ctx.split("\n").slice(0, 3).join(" | "));
  const mm = ctx.match(/总.{0,6}数：(\d+)/);
  assert("#7 orgContext 含总数统计行", !!mm, mm ? "总数=" + mm[1] : "未匹配");
  assert("#7 orgContext 总数为正且合理(>0 且 ≤ 数据2倍)", mm && +mm[1] > 0 && +mm[1] <= FEATS.length * 2, "总数=" + (mm ? mm[1] : "?") + " 数据=" + FEATS.length);
  assert("#7 orgContext 含层级统计（管理所/城市）", /管理所（|个城市/.test(ctx));
}

// suggestFrom：从文本提取已知可下钻关键词（用真实字段派生的关键词）
if (dm && dm.suggestFrom) {
  const sug = dm.suggestFrom("本台账含 " + SAMPLE_KW + " 等条目");
  console.log("    [suggestFrom] " + JSON.stringify(sug));
  assert("#8 suggestFrom 提取到真实关键词「" + SAMPLE_KW + "」", sug.includes(SAMPLE_KW), JSON.stringify(sug));
}

// 输入问题并发送 → 触发 AI 调用（fetch 桩返回含关键词的答案）
const q = el("aiFQIn");
q.value = "本台账总共有多少条目？";
clk(el("aiFQSend"));
await sleep(300);
assert("#7 智能问询返回结果(aiFQOut 非空)", el("aiFQOut") && el("aiFQOut").textContent.trim().length > 0, el("aiFQOut") ? "len=" + el("aiFQOut").textContent.trim().length : "");

// #8 renderFollowups：结果中含有可下钻关键词 chip
const chips = [...win.document.querySelectorAll("#aiFQFollowups .fup-chip")];
console.log("    [followup chips] " + JSON.stringify(chips.map((c) => c.dataset.kw)));
assert("#8 后续操作区渲染出可下钻关键词 chip", chips.length > 0, "count=" + chips.length);
const kwChip = chips.find((c) => c.dataset.kw === SAMPLE_KW);
assert("#8 含真实关键词「" + SAMPLE_KW + "」下钻 chip", !!kwChip);

// 单击 chip → 复制到剪贴板
copied = null;
if (kwChip) kwChip.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
await sleep(280); // 等过 220ms 复制计时
assert("#8 单击复制关键词到剪贴板", copied === SAMPLE_KW, "copied=" + JSON.stringify(copied));

// 双击 chip → 回填查询框并检索（dm.runSearch 设置 #search 值）
const kwChip2 = win.document.querySelector('#aiFQFollowups .fup-chip[data-kw="' + SAMPLE_KW + '"]');
try { if (kwChip2) kwChip2.dispatchEvent(new win.MouseEvent("dblclick", { bubbles: true })); } catch (e) { errors.push("[dblclick] " + e.message); }
await sleep(120);
const searchVal = el("search") ? el("search").value : "(无 search)";
assert("#8 双击回填查询框(runSearch 写入#search)", searchVal === SAMPLE_KW, "search=" + JSON.stringify(searchVal));

try { if (win.APP && typeof win.APP.close === "function") win.APP.close(); } catch (e) {}

console.log("\n=== #7/#8 验证结果 (" + APP + ") ===");
const bad = out.filter((o) => !o.ok);
console.log("通过: " + (out.length - bad.length) + "/" + out.length + " | 错误: " + errors.filter((e) => !/Could not parse CSS|Not implemented: HTMLCanvasElement/i.test(e)).length);
for (const e of errors.filter((e) => !/Could not parse CSS|Not implemented: HTMLCanvasElement/i.test(e))) console.log("  ⚠ " + String(e).slice(0, 200));
process.exit(bad.length ? 1 : 0);
