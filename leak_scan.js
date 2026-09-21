#!/usr/bin/env node
// leak_scan.js —— 用真实备份里的内部单位名作为“违禁词”，扫描脱敏产物是否残留。
const fs = require("fs");
const path = require("path");
const ROOT = "D:/Users/Claw";
const UNIT_RE = /[一-龥·]{2,}(管理处|管理所|管理段|管理站|总干渠|段引渠|引渠|水库|闸门|所|站|段|闸|政府|委员会)/g;
function loadData(file) { const window = {}; new Function("window", fs.readFileSync(file, "utf-8") + "\n;return window;")(window); return window; }

function forbiddenFor(prod) {
  const dir = path.join(ROOT, ".strip_backup", prod);
  const set = new Set();
  const pairs = [
    { f: path.join(dir, "data.js.real.bak"), v: prod === "shuili" ? "SHUILI_DATA" : "PERCEPTION_DATA", m: prod === "shuili" ? "SHUILI_META" : "PERCEPTION_META" },
    { f: path.join(dir, "kb_building_seed.js.real.bak"), v: "KB_BUILDING_SEED", m: null },
  ];
  pairs.forEach(({ f, v, m }) => {
    const win = loadData(f);
    (win[v] || []).forEach(r => {
      ["office", "station", "chan"].forEach(k => { if (r[k]) set.add(String(r[k])); });
      if (Array.isArray(r.attrs)) r.attrs.forEach(([, val]) => { const s = String(val == null ? "" : val); let mm; UNIT_RE.lastIndex = 0; while ((mm = UNIT_RE.exec(s))) set.add(mm[0]); });
    });
    if (m && win[m]) {
      const mv = win[m];
      const tk = mv.types || mv.subsystems;
      if (Array.isArray(tk)) tk.forEach(t => { const s = String(t == null ? "" : t); let mm; UNIT_RE.lastIndex = 0; while ((mm = UNIT_RE.exec(s))) set.add(mm[0]); });
      if (Array.isArray(mv.offices)) mv.offices.forEach(o => set.add(String(o)));
    }
  });
  // 仅保留内部特征明显的（>=3字，且非纯“水库/管理处”等通用词）
  return [...set].filter(s => s.length >= 3 && !/^(水库|管理处|管理所|管理段|管理站|总干渠|引渠|闸门|政府|委员会|站|段|闸|所)$/.test(s));
}

const targets = [
  path.join(ROOT, "android-build/shuili-v329/assets/data.demo.js"),
  path.join(ROOT, "android-build/shuili-v329/assets/kb_building_seed.demo.js"),
  path.join(ROOT, "android-build/perc-v13/assets/data.demo.js"),
  path.join(ROOT, "android-build/perc-v13/assets/kb_building_seed.demo.js"),
];

let totalLeak = 0;
targets.forEach(t => {
  const txt = fs.readFileSync(t, "utf-8");
  // 该产物对应产品：shuili 文件用 shuili 违禁词，perc 文件用 perc 违禁词
  const prod = t.indexOf("shuili-v329") >= 0 ? "shuili" : "perc";
  const forb = forbiddenFor(prod);
  const hits = forb.filter(s => txt.indexOf(s) >= 0);
  console.log(`\n=== ${path.basename(t)} (${prod})  违禁词基数=${forb.length}  命中=${hits.length} ===`);
  if (hits.length) { hits.slice(0, 30).forEach(h => console.log("  LEAK: " + h)); totalLeak += hits.length; }
});
console.log(`\n[TOTAL LEAKS] ${totalLeak}`);
