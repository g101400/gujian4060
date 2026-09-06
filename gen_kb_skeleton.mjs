#!/usr/bin/env node
// gen_kb_skeleton.mjs —— 古建打卡版（与水利/感知同构；数据源为 data.js 而非 data.json）
// 顶层 window.__DATA__ = { features:[…] }；提取 name/province/city/atype 等生成 KB 条目
// 运行：node gen_kb_skeleton.mjs [data.js] [kb_skeleton.json]
import fs from "fs";
import vm from "vm";
const src = process.argv[2] || "data.js";
const out = process.argv[3] || "kb_skeleton.json";
const code = fs.readFileSync(src, "utf8");
const ctx = { window: {}, document: {} };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const raw = ctx.window.__DATA__;
const records = (raw && Array.isArray(raw.features)) ? raw.features : [];
function uid() { return "kb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
const valid = records.filter((r) => r && r.lat != null && r.lon != null);
const entries = [];
for (const r of valid) {
  const ph = (r.photos || []).length;
  const rows = Object.entries(r.params || {}).map(([k, v]) => `| ${k} | ${v} |`).join("\n");
  const md = [
    `# ${r.name || "未命名"}`,
    "",
    `- 省份：${r.province || "-"}`,
    `- 城市：${r.city || "-"}`,
    `- 区/县（站）：${r.station || "-"}`,
    `- 类型：${r.atype || "-"}`,
    `- 坐标：${r.lat}, ${r.lon}`,
    `- 照片：${ph} 张（存储于本地 IndexedDB / 附件，离线可用）`,
    "",
    "## 工程参数",
    rows ? rows : "_（暂无）_",
  ].join("\n");
  entries.push({
    id: uid(),
    type: "building",
    title: r.name || "未命名",
    tags: [r.atype, r.city, r.province].filter(Boolean).join(","),
    md,
    meta: { lat: r.lat, lon: r.lon, province: r.province, city: r.city, atype: r.atype, id: r.id }
  });
}
const skeleton = { entries, index: { total: entries.length, generatedAt: new Date().toISOString(), src: src } };
fs.writeFileSync(out, JSON.stringify(skeleton, null, 2));
console.log("OK " + entries.length + " entries -> " + out);
