/* fix_menu.js — 菜单顺序智能优化：
 *  1) 危险操作（删除古建/删除建筑物、恢复初始数据）归入「设置」子菜单
 *  2) 智能AI注入改为按组名合并（智能AI设置并入同一「设置」分组）
 *  3) 信息与帮助（关于/帮助）置底到最末
 */
const fs = require("fs");
const path = require("path");
const ROOT = "D:/Users/Claw";

// 注入块（旧→新）：新块含 设置(危险操作) + 智能AI(同名合并) + 信息与帮助(置底)
const INJ_OLD = `    // 智能AI（设置 + 智能助手）：参数化模块，注入菜单
    if (window.AIModule && typeof AIModule.getMenuGroups === "function") {
      AIModule.getMenuGroups().forEach(function (g) { groups.push(g); });
    }`;

function injNew(settingsItems, infoItems) {
  return (
`    // 设置：危险操作归入设置子菜单（与智能AI设置合并为同一分组）
    groups.push({ g: "设置", ico: "⚙️", items: [
${settingsItems}
    ]});
    // 智能AI（设置 + 智能助手）：参数化模块，注入菜单（同名分组自动合并）
    if (window.AIModule && typeof AIModule.getMenuGroups === "function") {
      AIModule.getMenuGroups().forEach(function (g) {
        var ex = groups.find(function (x) { return x.g === g.g; });
        if (ex) { g.items.forEach(function (it) { ex.items.push(it); }); }
        else groups.push(g);
      });
    }
    // 信息与帮助置底（关于/帮助放在最末）
    groups.push({ g: "信息与帮助", ico: "ℹ️", items: [
${infoItems}
    ]});`);
}

const PRODUCTS = [
  {
    name: "gujian",
    files: [
      "travel/android/assets/app.js",
      "travel/webroot/app.js",
      "native-shell/win-gujian-webview2/webroot/app.js",
      "native-shell/uos-gujian-pyqt6/webroot/app.js"
    ],
    dangerRemove: `        { ico: "🚫", t: "删除古建", f: deleteHeritage },
        { ico: "♻️", t: "恢复初始数据", f: resetData }
`,
    settingsItems: `      { ico: "🚫", t: "删除古建", f: deleteHeritage },
      { ico: "♻️", t: "恢复初始数据", f: resetData }`,
    infoHelpBlock: `      { g: "信息与帮助", ico: "ℹ️", items: [
        { ico: "📈", t: "统计", f: showStats },
        { ico: "❓", t: "帮助", f: showHelp },
        { ico: "📝", t: "版本变更", f: openChangelog },
        { ico: "ℹ️", t: "关于", f: showAbout }
      ]}`,
    infoItems: `      { ico: "📈", t: "统计", f: showStats },
      { ico: "📝", t: "版本变更", f: openChangelog },
      { ico: "❓", t: "帮助", f: showHelp },
      { ico: "ℹ️", t: "关于", f: showAbout }`
  },
  {
    name: "water",
    files: [
      "android-build/shuili-v329/assets/app.js",
      "native-shell/win-water-webview2/webroot/app.js",
      "native-shell/uos-water-pyqt6/webroot/app.js"
    ],
    dangerRemove: `        { ico: "🏚️", t: "删除建筑物", f: deleteBuildingsMenu },
        { ico: "♻️", t: "恢复初始数据", f: resetData }
`,
    settingsItems: `      { ico: "🏚️", t: "删除建筑物", f: deleteBuildingsMenu },
      { ico: "♻️", t: "恢复初始数据", f: resetData }`,
    infoHelpBlock: `      { g: "信息与帮助", ico: "ℹ️", items: [
        { ico: "📈", t: "统计", f: showStats },
        { ico: "❓", t: "帮助", f: showHelp },
        { ico: "📝", t: "版本变更", f: openChangelog },
        { ico: "📊", t: "四端功能对照单", f: openPlatformCompare },
        { ico: "🖼️", t: "照片（目录与命名）", f: openPhotoHelp },
        { ico: "ℹ️", t: "关于", f: showAbout }
      ]}`,
    infoItems: `      { ico: "📈", t: "统计", f: showStats },
      { ico: "📝", t: "版本变更", f: openChangelog },
      { ico: "📊", t: "四端功能对照单", f: openPlatformCompare },
      { ico: "🖼️", t: "照片（目录与命名）", f: openPhotoHelp },
      { ico: "❓", t: "帮助", f: showHelp },
      { ico: "ℹ️", t: "关于", f: showAbout }`
  },
  {
    name: "perc",
    files: [
      "android-build/perc-v13/assets/app.js",
      "native-shell/win-webview2/webroot/app.js",
      "native-shell/uos-pyqt6/webroot/app.js"
    ],
    dangerRemove: `        { ico: "🏚️", t: "删除建筑物", f: deleteBuildingsMenu },
        { ico: "♻️", t: "恢复初始数据", f: resetData }
`,
    settingsItems: `      { ico: "🏚️", t: "删除建筑物", f: deleteBuildingsMenu },
      { ico: "♻️", t: "恢复初始数据", f: resetData }`,
    infoHelpBlock: `      { g: "信息与帮助", ico: "ℹ️", items: [
        { ico: "📈", t: "统计", f: showStats },
        { ico: "📝", t: "照片（目录与命名）", f: openPhotoHelp },
        { ico: "❓", t: "帮助", f: showHelp },
        { ico: "📝",  t: "版本变更", f: openChangelog },
        { ico: "📊", t: "四端功能对照单", f: openPlatformCompare },
        { ico: "ℹ️", t: "关于", f: showAbout }
      ]}`,
    infoItems: `      { ico: "📈", t: "统计", f: showStats },
      { ico: "📝", t: "照片（目录与命名）", f: openPhotoHelp },
      { ico: "❓", t: "帮助", f: showHelp },
      { ico: "📝", t: "版本变更", f: openChangelog },
      { ico: "📊", t: "四端功能对照单", f: openPlatformCompare },
      { ico: "ℹ️", t: "关于", f: showAbout }`
  }
];

let ok = 0, fail = 0;
for (const p of PRODUCTS) {
  for (const rel of p.files) {
    const fp = path.join(ROOT, rel);
    try {
      if (!fs.existsSync(fp)) throw new Error("文件不存在");
      let s = fs.readFileSync(fp, "utf8");
      // 校验锚点
      if (s.indexOf(p.dangerRemove) < 0) throw new Error("未找到危险操作行");
      if (s.indexOf(INJ_OLD) < 0) throw new Error("未找到注入锚点");
      if (s.indexOf(p.infoHelpBlock) < 0) throw new Error("未找到信息与帮助块");
      // 1) 从数据管理移除危险操作
      s = s.replace(p.dangerRemove, "");
      // 2) 移除原数组中的信息与帮助分组
      s = s.replace(p.infoHelpBlock, "");
      // 3) 替换注入块（含设置/合并/信息与帮助置底）
      s = s.replace(INJ_OLD, injNew(p.settingsItems, p.infoItems));
      const b = fp + ".menu1bak";
      if (!fs.existsSync(b)) fs.copyFileSync(fp, b);
      fs.writeFileSync(fp, s, "utf8");
      ok++; console.log("✅ [" + p.name + "] " + rel);
    } catch (e) {
      fail++; console.log("❌ [" + p.name + "] " + rel + " :: " + e.message);
    }
  }
}
console.log("\n菜单优化：成功 " + ok + " / 失败 " + fail);
