/* swap_key.js — 将 OpenRouter Key 全局替换为新密钥（含构建产物，避免旧密钥随包发布） */
const fs = require("fs");
const path = require("path");

const ROOT = "D:/Users/Claw";
const OLD = process.env.OPENROUTER_KEY_OLD || "";
const NEW = process.env.OPENROUTER_KEY_NEW || "";

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      walk(p, out);
    } else if (e.name === "ai_seed.js") {
      out.push(p);
    }
  }
}

const files = [];
walk(ROOT, files);
let done = 0, skip = 0, fail = 0;
for (const f of files) {
  try {
    let s = fs.readFileSync(f, "utf8");
    if (s.indexOf(OLD) < 0) { skip++; continue; }
    s = s.split(OLD).join(NEW);
    fs.writeFileSync(f, s, "utf8");
    done++; console.log("✅ " + path.relative(ROOT, f));
  } catch (e) {
    fail++; console.log("❌ " + f + " :: " + e.message);
  }
}
console.log("\n密钥替换：更新 " + done + " / 已是最新 " + skip + " / 失败 " + fail);
