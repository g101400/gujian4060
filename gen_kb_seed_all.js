// 构建期工具：为 perc / gujian 生成 kb_building_seed.js（全局数组 window.KB_BUILDING_SEED）
// 该种子在 ai_module.js init() 时合并进本地知识库，实现"发行前预生成、安装即得本地 KB"。
// shuili 的同功能生成器见 android-build/shuili-v329/gen_kb_seed.js（历史先行版本）。
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = "D:/Users/Claw";

function gen(appDir, globalName, mapFn) {
  const assets = path.join(ROOT, appDir, "assets");
  const data = fs.readFileSync(path.join(assets, "data.js"), "utf8");
  const win = {};
  const sandbox = { window: win, console: console };
  vm.createContext(sandbox);
  vm.runInContext(data, sandbox, { timeout: 5000 });
  const arr = win[globalName] || [];
  if (!arr.length) { console.error("未找到 " + globalName + "（" + appDir + "）"); process.exit(1); }
  const t0 = new Date().toLocaleString("zh-CN");
  const seed = arr.map(mapFn).filter(Boolean);
  const out = "// 自动生成（gen_kb_seed_all.js），请勿手改。建筑骨干预生成种子，ai_module.js init 时合并进本地 KB。\n" +
    "window.KB_BUILDING_SEED = " + JSON.stringify(seed) + ";\n";
  fs.writeFileSync(path.join(assets, "kb_building_seed.js"), out, "utf8");
  console.log("已生成 " + appDir + "/assets/kb_building_seed.js：" + seed.length + " 条，" + (out.length / 1024).toFixed(1) + " KB");
}

// 感知项目一张图：字段与水利同构 + subsystem
gen("android-build/perc-v13", "PERCEPTION_DATA", function (b) {
  var o = { id: b.id, name: b.name, office: b.office, station: b.station, btype: b.btype, chan: b.chan, ts: t0() };
  if (b.lon != null) o.lon = b.lon;
  if (b.lat != null) o.lat = b.lat;
  if (b.subsystem) o.subsystem = b.subsystem;
  o.photos = Array.isArray(b.photos) ? b.photos : [];
  o.attrs = Array.isArray(b.attrs) ? b.attrs : [];
  return o;
});

// 古建景点打卡：type→btype 映射，含属地/朝代/级别/简介/特点
gen("travel/android", "GUJIAN_DATA", function (b) {
  var o = { id: b.id, name: b.name, btype: b.type, province: b.province, city: b.city,
    dynasty: b.dynasty, level: b.level, intro: b.intro, features: b.features, ts: t0() };
  if (b.lon != null) o.lon = b.lon;
  if (b.lat != null) o.lat = b.lat;
  o.photos = Array.isArray(b.photos) ? b.photos : [];
  return o;
});

function t0() { return new Date().toLocaleString("zh-CN"); }
