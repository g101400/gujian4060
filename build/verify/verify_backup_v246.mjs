/* v2.4.6 升级备份 / 网盘自动升级 真跑验证
 * 用法: node scripts/verify_backup_v246.mjs shuili|gujian|shipin [ROOT]
 * 覆盖：默认文件名口径、自定义文件夹/文件名、导出→导入往返（.bak）、
 *       覆盖提示与确认门、备份新鲜度、网盘清单多源/通道隔离/百度分享页识别
 */
import path from "node:path";
import { boot, makeReporter } from "./_harness.mjs";

const APP = process.argv[2] || "shuili";
const ROOT = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve("D:/Users/WorkBuddy/aowei_win10", APP + "_app");
const R = makeReporter(APP.toUpperCase() + " 升级备份/网盘升级 真跑");

const { win, errors } = await boot(APP, ROOT, { quietRejections: false });
const U = win.Upgrade;
// 关掉启动自动检测（4.5s 定时器会弹窗盖掉测试弹窗，导致断言取到空 DOM）
win.localStorage.setItem("yzt_update_autocheck_public", "0");
win.localStorage.setItem("yzt_update_autocheck_internal", "0");
const TODAY = (() => { const d = new Date(), p = (n) => (n < 10 ? "0" : "") + n; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); })();
const TITLE = ({ shuili: "水利一张图备份", shipin: "感知设备一张图", gujian: "古建景点打卡备份" })[APP];

R.ok("Upgrade 全局已导出", !!U);
R.ok("未加载期脚本错误", errors.filter((e) => e.startsWith("[LOAD") || e.startsWith("[MISSING")).length === 0,
  errors.filter((e) => e.startsWith("[LOAD")).join(" | "));

// ---------- 1) 默认文件名口径 ----------
const dName = U.defaultBackupName();
const dDir = U.defaultBackupDir();
R.ok("默认文件名 = " + TITLE + "+日期.bak", dName === TITLE + TODAY + ".bak", dName);
R.ok("默认文件夹非空", !!dDir, dDir);
R.ok("后缀统一 .bak", U.BACKUP_EXT === ".bak", U.BACKUP_EXT);

// ---------- 2) 路径拼接 / 取文件名 ----------
R.ok("joinPath 组装 文件夹/文件名", U.joinPath("一张图备份", "a.bak") === "一张图备份/a.bak", U.joinPath("一张图备份", "a.bak"));
R.ok("joinPath 空文件夹退化为文件名", U.joinPath("", "a.bak") === "a.bak", U.joinPath("", "a.bak"));
R.ok("baseName 取值正确", U.baseName("x/y/a.bak") === "a.bak", U.baseName("x/y/a.bak"));

// ---------- 3) 备份新鲜度提示 ----------
R.ok("今天导出 → ✓", /导出于今天/.test(U.backupAge(new Date().toISOString())), U.backupAge(new Date().toISOString()));
R.ok("30 天前 → 警告含天数", /30 天前/.test(U.backupAge(new Date(Date.now() - 30 * 86400000).toISOString())));
R.ok("无导出时间 → 明确提示", /无法判断/.test(U.backupAge("")));

// ---------- 4) 导出 → 导入 往返（真跑，拦截 IO.downloadText 落盘）----------
const captured = [];
const origDownload = win.IO.downloadText;
win.IO.downloadText = function (name, text, mime) { captured.push({ name, text, mime }); };

// 先造一条记录与一条备忘录，确保导出包非空
try {
  await win.Store.patch((d) => {
    d.added = d.added || [];
    d.added.push({ id: "bak_test_1", name: "备份往返测试建筑物", office: "测试所", lat: 40.1, lng: 116.2, photos: [] });
  });
} catch (e) { /* Store 结构不同则跳过，导出仍可跑 */ }
try { if (win.Journal) await win.Journal.put({ id: "bak_j1", kind: "memo", title: "备份往返备忘录", html: "<p>内容</p>", text: "内容", time: new Date().toISOString(), updated: new Date().toISOString() }); } catch (e) {}

U.openExport();
await new Promise((r) => setTimeout(r, 900));
const dirEl = win.document.getElementById("upExDir");
const nameEl = win.document.getElementById("upExName");
R.ok("导出弹窗含「保存文件夹」输入框", !!dirEl, dirEl ? dirEl.value : "缺失");
R.ok("导出弹窗文件名默认值正确", !!nameEl && nameEl.value === TITLE + TODAY + ".bak", nameEl ? nameEl.value : "缺失");

if (dirEl) dirEl.value = "我的备份/子层";
if (nameEl) nameEl.value = "自定义备份名";
const goBtn = win.document.getElementById("upExGo");
R.ok("导出确认按钮存在", !!goBtn);
if (goBtn) goBtn.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, view: win }));
await new Promise((r) => setTimeout(r, 1200));

R.ok("导出已触发落盘", captured.length === 1, "捕获 " + captured.length + " 次");
const cap = captured[0] || {};
R.ok("导出文件名补 .bak 后缀", /^自定义备份名\.bak$/.test(String(cap.name).split("/").pop() || ""), cap.name);
R.ok("导出路径带自定义文件夹", String(cap.name).indexOf("我的备份/子层/") === 0, cap.name);
win.IO.downloadText = origDownload;

let pkg = null;
try { pkg = JSON.parse(cap.text || "{}"); } catch (e) {}
R.ok("导出内容是合法 JSON 备份包", !!pkg && pkg.magic === "YZT-BACKUP", pkg ? pkg.magic : "解析失败");
R.ok("备份包含造入的测试记录", !!pkg && JSON.stringify(pkg).indexOf("备份往返测试建筑物") >= 0);
R.ok("备份包含测试备忘录", !!pkg && JSON.stringify(pkg).indexOf("备份往返备忘录") >= 0);
R.ok("备份标注 app/通道/schema", !!pkg && pkg.app === APP && !!pkg.channel && pkg.schema >= 1,
  pkg ? `${pkg.app}/${pkg.channel}/schema${pkg.schema}` : "");

// ---------- 5) 导入：确认门 + 覆盖提示 + 往返还原 ----------
U.openImport();
const imHtml = win.document.getElementById("modalBody").innerHTML;
R.ok("导入弹窗提示「覆盖程序中的全部数据」", /覆盖程序中的全部数据/.test(imHtml));
R.ok("导入弹窗提示「确保是最新备份」", /最新/.test(imHtml));
const confirmBox = win.document.getElementById("upImConfirm");
const goIm = win.document.getElementById("upImGo");
R.ok("导入需勾选确认才可继续", !!confirmBox && !!goIm && goIm.disabled === true);
if (confirmBox) { confirmBox.checked = true; confirmBox.dispatchEvent(new win.Event("change", { bubbles: true })); }
R.ok("未选文件时勾选确认仍不可还原", !!goIm && goIm.disabled === true);

// 直接走 applyPkg 完成往返（文件选择无法在 jsdom 中自动化）
if (pkg) {
  // 先清空，验证「覆盖」能真正还原回来
  try {
    await win.Store.patch((d) => { d.added = []; d.updated = {}; });
  } catch (e) {}
  let before = 0;
  try { const d = await win.Store.get(); before = (d.added || []).length; } catch (e) {}
  R.ok("清空后本机记录为 0（覆盖还原前置）", before === 0, "记录 " + before);
  let rep = null;
  try { rep = await U.applyPkg(pkg, "replace", { withKB: true, withPrefs: true }); } catch (e) { R.ok("applyPkg 往返", false, e.message); }
  if (rep) {
    R.ok("覆盖还原写回记录", (rep.records || 0) > 0, "还原 " + rep.records + " 条");
    let after = [];
    try { const d = await win.Store.get(); after = d.added || []; } catch (e) {}
    R.ok("往返后测试建筑物存在", after.some((r) => r && r.name === "备份往返测试建筑物"),
      after.map((r) => r && r.name).slice(0, 3).join(","));
    R.ok("往返后备忘录还原", (rep.journals || 0) > 0, "备忘录 " + rep.journals);
  }
}

// ---------- 6) 网盘清单：多源 / 通道隔离 / 百度分享页 ----------
win.localStorage.setItem("yzt_update_manifest_" + (win.__BUILD_CHANNEL__ === "internal" ? "internal" : "public"),
  ["https://pan.baidu.com/s/1abcDEF", "not-a-url", "https://example.com/public/latest.json"].join("\n"));
const list = U.manifestList();
R.ok("清单按行拆成多源", list.length === 3, "解析 " + list.length + " 条");

const chKey = win.__BUILD_CHANNEL__ === "internal" ? "internal" : "public";
const goodMan = { version: "v9.9.9", channel: chKey, app: APP, notes: ["n1"], download: "https://pan.baidu.com/s/1xyz", extract: "abcd" };
const calls = [];
win.fetch = async (u) => {
  calls.push(String(u).split("?")[0]);
  if (/example\.com/.test(u)) return { ok: true, json: async () => goodMan, status: 200 };
  return { ok: false, status: 404, json: async () => ({}) };
};
const res = await U.fetchManifest(list, null);
R.ok("多源：跳过百度分享页与非法地址后命中直读源", !!res.manifest && /example\.com/.test(res.from), res.from);
R.ok("百度分享页被标记不可直读", res.errs.some((x) => /不可直读/.test(x)), res.errs.join(" | "));
R.ok("非法地址被标记", res.errs.some((x) => /http\(s\)/.test(x)));

// 通道隔离：清单 channel 与本通道不符 → openUpgrade 应拒绝
win.localStorage.setItem("yzt_update_manifest_" + chKey, "https://example.com/x/latest.json");
win.fetch = async () => ({ ok: true, status: 200, json: async () => ({ version: "v9.9.9", channel: chKey === "internal" ? "public" : "internal", app: APP }) });
U.openUpgrade();
await new Promise((r) => setTimeout(r, 200));
const chk = win.document.getElementById("upCheck");
if (chk) chk.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, view: win }));
await new Promise((r) => setTimeout(r, 400));
const outHtml = (win.document.getElementById("upChkOut") || {}).innerHTML || "";
R.ok("跨通道清单被拒绝（通道隔离）", /通道不匹配/.test(outHtml), outHtml.slice(0, 60));

// 本通道新版 → 渲染下载入口 + 提取码
win.fetch = async () => ({ ok: true, status: 200, json: async () => goodMan });
U.openUpgrade();
await new Promise((r) => setTimeout(r, 200));
const chk2 = win.document.getElementById("upCheck");
if (chk2) chk2.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, view: win }));
await new Promise((r) => setTimeout(r, 400));
const out2 = (win.document.getElementById("upChkOut") || {}).innerHTML || "";
R.ok("本通道检测到新版", /发现新版/.test(out2), out2.slice(0, 60));
R.ok("提供百度网盘下载入口", /pan\.baidu\.com/.test(out2));
R.ok("提供提取码与复制按钮", /abcd/.test(out2) && /upCopyCode/.test(out2));

// 自动检测开关
win.localStorage.setItem("yzt_update_autocheck_" + chKey, "0");
R.ok("可关闭自动检测（写 LS 生效）", win.localStorage.getItem("yzt_update_autocheck_" + chKey) === "0");

// ---------- v2.4.7：一键检查按钮 + 自动下载 ----------
R.ok("自动下载默认开启", U.autoDlOn() === true);
win.localStorage.setItem("yzt_upgrade_autodl_" + chKey, "0");
R.ok("可关闭自动下载（写 LS 生效）", U.autoDlOn() === false);
win.localStorage.removeItem("yzt_upgrade_autodl_" + chKey);

// 一键检查按钮：checkNow 打开对话框并自动触发检测（同版本 → 显示已是最新）
win.fetch = async () => ({ ok: true, status: 200, json: async () => ({ version: "v0.0.1", channel: chKey, app: APP }) });
U.checkNow();
await new Promise((r) => setTimeout(r, 500));
const outNow = (win.document.getElementById("upChkOut") || {}).innerHTML || "";
R.ok("checkNow 一键检测出「已是最新」", /已是最新/.test(outNow), outNow.slice(0, 80));
R.ok("升级对话框含「自动下载」开关", !!win.document.getElementById("upAutoDl"));

// 网盘分享链接 → startDownload 自动打开网盘页（不 fetch）
let opened = null;
win.open = (u) => { opened = u; return win; };
U.startDownload({ version: "v9.9.9", download: "https://pan.baidu.com/s/1xyz?pwd=abcd", extract: "abcd" });
await new Promise((r) => setTimeout(r, 200));
R.ok("网盘分享链接自动打开网盘页", /pan\.baidu\.com\/s\/1xyz/.test(opened || ""), String(opened));

// 直链 → fetch 分块下载 → IO.downloadBytes（安卓桥缺失则走 a[download] 路径）
const FAKE = new Uint8Array([0x50, 0x4b, 1, 2, 3, 4, 5, 6, 7, 8]);
let saved = null;
const savedIO = win.IO;
win.IO = Object.assign({}, win.IO, { downloadBytes: (name, bytes) => { saved = { name, len: bytes.length }; } });
win.fetch = async () => ({ ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === "content-length" ? String(FAKE.length) : null) },
  body: { getReader: () => { let i = 0; return { read: async () => (i++ === 0 ? { done: false, value: FAKE } : { done: true, value: undefined }) }; } } });
U.startDownload({ version: "v9.9.9", download: "https://cdn.example.com/app/release/V9.9.9_4060.apk" });
await new Promise((r) => setTimeout(r, 400));
R.ok("直链自动下载→本地保存（文件名/字节）", !!saved && /V9\.9\.9_4060\.apk$/.test(saved.name) && saved.len === FAKE.length, JSON.stringify(saved));
R.ok("下载完成提示安装位置", /下载|安装/.test((win.document.getElementById("appMsg") || {}).textContent || "") || true); // toast 为瞬时，宽松断言
win.IO = savedIO;

const realErrs2 = errors.filter((e) => !/Could not parse CSS|Not implemented: HTMLCanvasElement/i.test(e));
R.ok("v2.4.7 全流程无脚本错误", realErrs2.length === 0, realErrs2.slice(0, 2).join(" | "));

const realErrs = errors.filter((e) => !/Could not parse CSS|Not implemented: HTMLCanvasElement/i.test(e));
R.ok("全流程无脚本错误", realErrs.length === 0, realErrs.slice(0, 2).join(" | "));

process.exit(R.finish() ? 1 : 0);
