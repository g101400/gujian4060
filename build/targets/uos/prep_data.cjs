/* prep_data.mjs —— 预置数据 Step1：用「发货代码」jingmi_app/js/io.js 实跑解析 D 盘真实 ovkmz
 * 输出 win11/_prep/recs.json（含照片全图 base64），供 prep_finalize.py 压缩略图并生成 data.js/data.json
 * 这是「导入识别 ovkmz」的第一次真实文件验证（557 建筑物 + ovatta 照片 + description 参数 + Folder 层级） */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = "C:/Users/admin/WorkBuddy/win11";
const REAL = "D:/BaiduNetdiskDownload/水利工程基础信息.ovkmz";

const dom = new JSDOM("<!DOCTYPE html><body></body>", { url: "http://localhost/" });
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.navigator = dom.window.navigator;

const code = fs.readFileSync(path.join(ROOT, "jingmi_app/js/io.js"), "utf8");
new Function("window", code).call(global, global.window);
const IO = global.window.IO;

if (!fs.existsSync(REAL)) { console.error("真实文件缺失：" + REAL); process.exit(2); }
fs.mkdirSync(path.join(ROOT, "_prep"), { recursive: true });

(async () => {
  const buf = new Uint8Array(fs.readFileSync(REAL));
  console.log("样本大小:", (buf.length / 1048576).toFixed(2), "MB");
  const recs = await IO.importKmzBuffer(buf.buffer);
  console.log("解析建筑物:", recs.length);

  const withPhotos = recs.filter((r) => (r.photos || []).length);
  const totalPhotos = recs.reduce((a, r) => a + (r.photos || []).length, 0);
  const withParams = recs.filter((r) => r.params && Object.keys(r.params).length).length;
  const withOffice = recs.filter((r) => r.office).length;
  const withStation = recs.filter((r) => r.station).length;
  const noCoord = recs.filter((r) => r.lon == null || r.lat == null || isNaN(r.lon) || isNaN(r.lat)).length;
  console.log(`有照片: ${withPhotos.length} 条 / 共 ${totalPhotos} 张`);
  console.log(`有参数: ${withParams} 条, 有管理所: ${withOffice} 条, 有管理站: ${withStation} 条, 缺坐标: ${noCoord} 条`);
  const offices = [...new Set(recs.map((r) => r.office).filter(Boolean))];
  console.log("管理所:", offices.join(" / "));
  const types = new Set(recs.map((r) => r.btype).filter(Boolean));
  console.log("建筑物类型数:", types.size);
  const t0 = recs.find((r) => r.photos && r.photos.length);
  if (t0) console.log("照片样例:", t0.name, "->", t0.photos[0].caption, "dataUrl 长度", t0.photos[0].dataUrl.length);

  if (!recs.length) { console.error("解析失败：0 条"); process.exit(3); }
  fs.writeFileSync(path.join(ROOT, "_prep/recs.json"), JSON.stringify(recs), "utf8");
  console.log("已写 _prep/recs.json");
})().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(3); });
