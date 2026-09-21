/* 智能App 升级清单直链服务（yitu-upgrade-hub）
 * 作用：为 三平台（古建/水利一张图/水利感知）的 app 内「软件升级（检测新版）」提供可跨域 fetch 的清单。
 * 为什么需要它：百度网盘没有 CORS 直链，WebView 内 fetch 会被拦；本服务对清单响应加
 * Access-Control-Allow-Origin: *，app（file:// 源）即可正常检测。APK 统一托管在百度网盘。
 * 更新版本：改 manifests/*.json 里对应通道的 version/note/url 即可，然后重新发布本目录。
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const MANIFEST_DIR = path.join(__dirname, "manifests");
const APPS = ["gujian", "shuili", "perc"];

function manifestOf(app) {
  const p = path.join(MANIFEST_DIR, app + ".json");
  if (!/^[a-z]+$/.test(app) || !fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

const server = http.createServer(function (req, res) {
  const u = (req.url || "/").split("?")[0];

  // CORS：app 内 WebView 页面源是 file://（Origin: null），必须显式放行
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (u === "/" || u === "/index.html") {
    const rows = APPS.map(function (app) {
      const m = manifestOf(app);
      if (!m) return "<tr><td>" + app + "</td><td colspan='3'>清单缺失</td></tr>";
      const chs = Object.keys(m.channels || {}).map(function (ch) {
        const e = m.channels[ch];
        const label = ch === "single" ? "通用" : ch === "public" ? "公开版" : "内部版";
        return "<li>" + label + "：<b>v" + e.version + "</b>" + (e.note ? "（" + e.note + "）" : "") + "</li>";
      }).join("");
      return "<tr><td>" + m.appName + "</td><td><ul>" + chs + "</ul></td><td>" + m.updatedAt + "</td><td>/manifests/" + app + ".json</td></tr>";
    }).join("");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!doctype html><meta charset='utf-8'><title>智能App升级检测服务</title>" +
      "<h2>智能App 升级清单服务</h2><p>APK 安装包统一托管在百度网盘发布目录。清单每 0 缓存直读，改 manifests/ 下 JSON 即时生效。</p>" +
      "<table border='1' cellpadding='6' style='border-collapse:collapse'><tr><th>应用</th><th>通道/版本</th><th>更新时间</th><th>清单地址</th></tr>" + rows + "</table>");
    return;
  }

  const m1 = u.match(/^\/manifests\/([a-z]+)\.json$/);
  if (m1) {
    const m = manifestOf(m1[1]);
    if (!m) { res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" }); res.end('{"error":"manifest not found"}'); return; }
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(m));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("not found");
});

server.listen(PORT, "0.0.0.0", function () {
  console.log("yitu-upgrade-hub listening on 0.0.0.0:" + PORT);
});
