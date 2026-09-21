/* test_models.js — 用新 OpenRouter Key 实测三个免费模型（模拟 ai_module.chatOne 的头部处理） */
const KEY = process.env.OPENROUTER_KEY || "";
const OR_BASE = "https://openrouter.ai/api/v1";

function toLatin1(s) {
  if (typeof s !== "string") return s == null ? "" : String(s);
  let out = "";
  for (let i = 0; i < s.length; i++) out += s.charCodeAt(i) <= 0xff ? s[i] : "?";
  return out;
}

const MODELS = [
  { name: "MiniMax M2.7", modelId: "minimax/minimax-m2.7:free" },
  { name: "GLM 5.2 (Z.ai)", modelId: "z-ai/glm-5.2:free" },
  { name: "Nemotron 3 Nano Omni", modelId: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free" }
];

const MSG = [{ role: "user", content: "用一句话介绍故宫（北京）。" }];

async function chatOne(m) {
  const url = OR_BASE.replace(/\/+$/, "") + "/chat/completions";
  const ak = toLatin1(KEY);
  const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + ak };
  headers["HTTP-Referer"] = "https://yitu.local/";
  headers["X-Title"] = "YituMap-test";
  const body = { model: m.modelId, messages: MSG, stream: false };
  const t0 = Date.now();
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const dt = Date.now() - t0;
  if (!r.ok) {
    const txt = (await r.text()).slice(0, 200);
    return { ok: false, status: r.status, dt, err: txt };
  }
  const j = await r.json();
  const c = (j.choices && j.choices[0] && j.choices[0].message && (j.choices[0].message.content || "")) || "";
  return { ok: true, status: r.status, dt, content: c.slice(0, 120) };
}

(async () => {
  console.log("用新 Key 实测 OpenRouter 三个免费模型（query=故宫）\n");
  for (const m of MODELS) {
    try {
      const res = await chatOne(m);
      if (res.ok) console.log(`✅ ${m.name}\n   ${res.content}\n   (HTTP ${res.status}, ${res.dt}ms)\n`);
      else console.log(`❌ ${m.name}\n   HTTP ${res.status} (${res.dt}ms): ${res.err}\n`);
    } catch (e) {
      console.log(`⚠️ ${m.name}\n   请求异常: ${e.message}\n`);
    }
  }
})();
