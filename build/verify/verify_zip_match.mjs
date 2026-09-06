#!/usr/bin/env node
// scripts/verify_zip_match.mjs —— 用【真实 app.js 匹配管线】对真实 zip 做照片→建筑物匹配验证
// 直接镜像 app.js 的 matchOrgScope / matchOrgScopeFrom / folderScope / smartCandidates / photoKey / buildingCandidatesFromFolder，
// 并用 `unzip -l` 读取真实 zip 中央目录（不解压）得到真实文件路径，逐张跑匹配。
// 用法：node scripts/verify_zip_match.mjs [zipPath] [zipNameNoExt]
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileP = promisify(execFile);

const SRC = "D:/Users/WorkBuddy/aowei_win10/shuili_app/data.json";
const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
const records = raw.features || [];

const BASE_OFFICES = ["地下水源所","温泉所","龙山所","史山所","埝头所","水库所","北台上所","西田各庄所","潮河所"];
const DEFAULT = { bureau: "水利工程管理中心", mgmt: "京密引水管理处", office: "水库所" };
const TIER_ORDER = ["bureau", "mgmt", "office", "station", "section"];

const norm = (s) => String(s || "").toLowerCase().replace(/[\s\-_()（）·.]/g, "");
const normOffice = (s) => { if (!s) return ""; const x = String(s).trim(); if (/潮河/.test(x)) return "潮河所"; if (/水库/.test(x)) return "水库所"; return x.replace(/管理所/g, "所"); };
const orgVal = (r, k) => { const v = r[k]; if (v != null && v !== "") return v; if (k === "bureau") return DEFAULT.bureau; if (k === "mgmt") return DEFAULT.mgmt; if (k === "office") return normOffice(r.office); return ""; };
const uniq = (a) => [...new Set(a.filter(Boolean))];
function levenshtein(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

const DIMS = {
  bureaus: uniq([...records.map(r => orgVal(r, "bureau")), DEFAULT.bureau]),
  mgmts: uniq([...records.map(r => orgVal(r, "mgmt")), DEFAULT.mgmt]),
  offices: uniq([...records.map(r => normOffice(orgVal(r, "office"))), ...BASE_OFFICES]),
  stations: uniq(records.map(r => r.station)),
  sections: uniq(records.map(r => r.section)),
};

function photoKey(name) { return norm((name || "").replace(/\.[^.]+$/, "").replace(/\d+$/, "")); }

function matchOrgScope(text, allowTiers) {
  if (!text) return null;
  const base = String(text).split(/[\\/]/).pop() || String(text);
  const t = norm(base.replace(/\.(zip|7z|rar|tar|gz|tgz)$/i, ""));
  if (!t) return null;
  const hit = (val) => {
    const v = norm(val); if (!v || v.length < 2) return { ok: false, score: 0 };
    if (v === t) return { ok: true, score: 100 + v.length };
    if (t.includes(v) || v.includes(t)) return { ok: true, score: 80 + Math.min(v.length, t.length) };
    if (levenshtein(t, v) <= 1 && Math.max(t.length, v.length) >= 2) return { ok: true, score: 60 + Math.min(v.length, t.length) };
    return { ok: false, score: 0 };
  };
  const allowed = (s) => !allowTiers || allowTiers.indexOf(s) >= 0;
  const cands = [];
  if (allowed("office")) for (const off of DIMS.offices) { const h = hit(off); if (h.ok) cands.push({ scope: "office", label: "管理所：" + off, val: off, ...h }); }
  if (allowed("station")) for (const st of DIMS.stations) { const h = hit(st); if (h.ok) cands.push({ scope: "station", label: "管理站：" + st, val: st, ...h }); }
  if (allowed("section")) for (const sc of DIMS.sections) { const h = hit(sc); if (h.ok) cands.push({ scope: "section", label: "渠道段：" + sc, val: sc, ...h }); }
  if (allowed("mgmt")) for (const mg of DIMS.mgmts) { const h = hit(mg); if (h.ok) cands.push({ scope: "mgmt", label: "管理处：" + mg, val: mg, ...h }); }
  if (allowed("bureau")) for (const bu of DIMS.bureaus) { const h = hit(bu); if (h.ok) cands.push({ scope: "bureau", label: "局：" + bu, val: bu, ...h }); }
  if (!cands.length) return null;
  const tier = (s) => TIER_ORDER.indexOf(s);
  const SCOPE_PREF = { office: 3, station: 2, section: 1, mgmt: 2, bureau: 1 };
  cands.sort((a, b) => (b.score - a.score) || ((SCOPE_PREF[b.scope] || 0) - (SCOPE_PREF[a.scope] || 0)) || (tier(b.scope) - tier(a.scope)) || (b.val.length - a.val.length));
  const top = cands[0];
  let recs;
  if (top.scope === "office") recs = records.filter((r) => normOffice(orgVal(r, "office")) === top.val);
  else if (top.scope === "station") recs = records.filter((r) => r.station === top.val);
  else if (top.scope === "section") recs = records.filter((r) => r.section === top.val);
  else if (top.scope === "mgmt") recs = records.filter((r) => orgVal(r, "mgmt") === top.val);
  else recs = records.filter((r) => orgVal(r, "bureau") === top.val);
  return { label: top.label, recs, tier: top.scope, nextTiers: TIER_ORDER.slice(tier(top.scope) + 1) };
}
function matchOrgScopeFrom(text, zipScope) {
  if (!zipScope || !zipScope.nextTiers) return matchOrgScope(text);
  const lower = matchOrgScope(text, zipScope.nextTiers);
  if (lower) return lower;
  return matchOrgScope(text, [zipScope.tier]);
}
function folderScope(folder, baseRecs, zipScope) {
  const base = baseRecs || records;
  if (!folder) return null;
  const segs = String(folder).split(/[\\/]/).map((s) => norm(s)).filter(Boolean);
  if (!segs.length) return null;
  for (const f of segs) {
    const m = matchOrgScopeFrom(f, zipScope);
    if (m && m.recs && m.recs.length) {
      const ids = new Set(base.map((r) => r.id));
      const recs = m.recs.filter((r) => ids.has(r.id));
      if (recs.length) return { label: m.label, recs, tier: m.tier };
    }
  }
  return null;
}
function smartCandidates(name, scope) {
  const base = (scope && scope.recs) || records;
  const key = photoKey(name); if (!key) return [];
  const half = key.slice(0, Math.ceil(key.length / 2));
  const out = [];
  for (const x of base) {
    const xn = norm(x.name); if (!xn) continue;
    let score = 0;
    if (xn === key) score = 100;
    else if (key.includes(xn) || xn.includes(key)) score = 85;
    else if (half.length >= 2 && xn.includes(half)) score = 72;
    else if (key.length >= 2 && xn.includes(key.slice(0, 2))) score = 50;
    else { const r = 1 - levenshtein(key, xn) / Math.max(key.length, xn.length, 1); if (r >= 0.6) score = Math.round(40 + r * 40); }
    if (score >= 45) out.push({ x, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}
// 与 app.js 保持一致：文件夹名别名表（采集异写/笔误 → 标准建筑物名）
const FOLDER_ALIAS = {
  "三号线分水闸": "三扬分水闸",
};
function buildingCandidatesFromFolder(folder, scopeRecs) {
  const base = scopeRecs || records;
  if (!folder || !base || !base.length) return [];
  const segs = String(folder).split(/[\\/]/).map((s) => (s || "").trim()).filter(Boolean);
  const SKIP = /^(照片|相片|分水闸|分水渠|photo|photos|img|image|images|picture|pictures)$/i;
  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = FOLDER_ALIAS[segs[i]] || segs[i];
    if (SKIP.test(seg) || seg.length < 2) continue;
    const c = smartCandidates(seg, { recs: base });
    if (c.length) return c;
  }
  return [];
}

// ---- 读取真实 zip 中央目录（不解压）----
const ZIP = process.argv[2] || "D:/BaiduNetdiskDownload/史山.zip";
const ZIP_NAME = (process.argv[3] || path.basename(ZIP).replace(/\.(zip|7z)$/i, ""));
const IMG_RE = /\.(jpg|jpeg|png|webp|heic|bmp)$/i;

async function listZipImages(zip) {
  const { stdout } = await execFileP("unzip", ["-l", zip], { maxBuffer: 64 * 1024 * 1024 }).catch((e) => ({ stdout: e.stdout || "" }));
  const lines = stdout.split("\n");
  const imgs = [];
  for (const ln of lines) {
    const m = ln.match(/^\s*\d+\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(.+?)\s*$/);
    if (!m) continue;
    const p = m[1].trim();
    if (p.endsWith("/")) continue;            // 目录
    if (!IMG_RE.test(p)) continue;            // 非图片
    const idx = p.lastIndexOf("/");
    imgs.push({ folder: idx >= 0 ? p.slice(0, idx) : "", name: idx >= 0 ? p.slice(idx + 1) : p, full: p });
  }
  return imgs;
}

console.log("=== 真实 zip 三级匹配验证（镜像 app.js 管线）===");
console.log(`zip=${ZIP}\nzip名(去扩展)=${ZIP_NAME}  记录总数=${records.length}`);

const zipScope = matchOrgScope(ZIP_NAME);
console.log(`[1] zip 名命中机构范围: ${zipScope ? zipScope.tier + " / " + zipScope.label + " / " + zipScope.recs.length + " 条 (可继续: " + (zipScope.nextTiers.join(",") || "无") + ")" : "无命中（将全局匹配）"}`);

const imgs = await listZipImages(ZIP);
console.log(`[2] zip 内图片文件: ${imgs.length} 张`);

let auto = 0, ambiguous = 0, byFolder = 0;
const rows = [];
for (const im of imgs) {
  const scope = folderScope(im.folder, zipScope && zipScope.recs, zipScope);
  let cands = smartCandidates(im.name, scope);
  let via = "照片名";
  if (!cands.length) {
    const fc = buildingCandidatesFromFolder(im.folder, scope ? scope.recs : (zipScope ? zipScope.recs : null));
    if (fc.length) { cands = fc; via = "文件夹名"; byFolder++; }
  }
  if (!cands.length && !scope) cands = smartCandidates(im.name, null).slice(0, 8);
  let matched = null;
  if (cands.length && (cands.length === 1 || cands[0].score >= 85)) { matched = cands[0]; auto++; }
  else { matched = null; ambiguous++; }
  rows.push({ im, scope, cands, matched, via });
}

console.log(`[3] 匹配结果：自动绑定 ${auto} 张 / 需人工选择 ${ambiguous} 张（其中文件夹名命中 ${byFolder} 张）`);
console.log("\n--- 全部图片匹配明细（前 40）---");
for (const r of rows.slice(0, 40)) {
  const top = r.matched ? `${r.matched.x.name} [${r.matched.score}]` : (r.cands[0] ? `${r.cands[0].x.name} [${r.cands[0].score}]?` : "无候选");
  console.log(`  ${r.im.full}\n       范围=${r.scope ? r.scope.label : "(全局)"}  via=${r.via}  → ${r.matched ? "✅" : "❓"} ${top}`);
}

// 用户点名的样例：IMG-6857.jpg
const target = rows.find((r) => /IMG[-_]?6857/i.test(r.im.name));
console.log("\n>>> 用户点名样例 IMG-6857.jpg：");
if (target) {
  console.log(`    路径: ${target.im.full}`);
  console.log(`    机构范围: ${zipScope ? zipScope.label : "(无)"}`);
  console.log(`    文件夹层级命中: ${target.scope ? target.scope.label : "无（文件夹是建筑物名，非机构名）"}`);
  console.log(`    匹配通道: ${target.via}`);
  console.log(`    候选(Top5):`);
  target.cands.slice(0, 5).forEach((c, i) => console.log(`      ${i + 1}. [${c.score}] ${c.x.name}  (${normOffice(orgVal(c.x, "office"))})`));
  console.log(`    >>> 结论: ${target.matched ? "自动绑定到「" + target.matched.x.name + "」(score=" + target.matched.score + ")" : "进入人工选择（候选见上）"}`);
} else {
  console.log("    未在 zip 中找到 IMG-6857.jpg（请确认文件名/路径）");
}
