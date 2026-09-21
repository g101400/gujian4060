// RAG 引擎测试：切片 / 向量 / 混合检索 / 模糊容错 / 反向查条目 / 大模型链路 / 记忆 / 持久化 / 提示词
const fs = require("fs"), vm = require("vm");
let pass = 0, fail = 0;
const T = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); cond ? pass++ : fail++; };

function mkSandbox() {
  const ls = {};
  const sb = {};
  sb.console = console;
  sb.localStorage = { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } };
  sb.document = { createElement: () => ({ style: {} }), head: { appendChild() {} } };
  sb.setTimeout = setTimeout;
  sb.window = sb; sb.self = sb;
  sb.__ls = ls;
  return sb;
}
const sb = mkSandbox();
const ctx = vm.createContext(sb);
vm.runInContext(fs.readFileSync("android-build/shuili-v329/assets/kb_rag.js", "utf8"), ctx, { filename: "kb_rag.js" });
vm.runInContext('window.KBRag.init({ domain: "test" })', ctx);
const R = sb.KBRag;

// 1) 切片：按标题/段落/句末切分，且带重叠
const long = "第一章 总则\n" + "本规程适用于水库闸门启闭作业，操作人员须持证上岗。".repeat(12) + "\n第二章 操作\n" + "启闭前检查电源电压与制动器状态。".repeat(10);
const chunks = R.chunkText(long, { size: 200, overlap: 40 });
T("切片：产出多个片段", chunks.length >= 3);
T("切片：单片段不超长", chunks.every(c => c.length <= 200 * 1.5 + 40));

// 2) 向量：语义相近 > 语义相远
const docs = [
  { id: "d1", title: "闸门启闭规程", body: "闸门启闭前必须检查电源电压、制动器与限位开关，确认无人站在闸门下方后方可操作。启闭顺序为先开中间孔，再开两侧孔。", source: "规程.pdf", type: "external" },
  { id: "d2", title: "水库大坝安全监测", body: "大坝安全监测包括渗流、位移、应力应变等项目，汛期应加密观测频次并做好记录归档。", source: "监测.docx", type: "external" },
  { id: "d3", title: "食堂管理规定", body: "职工食堂应保持卫生，食材采购须索证索票，餐具每餐消毒并做好留样。", source: "后勤.txt", type: "note" }
];
const nChunks = R.buildIndex(docs, () => {});
T("向量化：生成切片", nChunks >= 3);
T("索引统计：3 篇文档", R.stats().docs === 3);

const h1 = R.search("闸门启闭的操作顺序是什么", { topK: 3 });
T("混合检索：闸门问题首命中《闸门启闭规程》", h1.length > 0 && h1[0].docId === "d1");
const h2 = R.search("大坝渗流观测", { topK: 3 });
T("混合检索：大坝问题首命中《水库大坝安全监测》", h2.length > 0 && h2[0].docId === "d2");
const h3 = R.search("食堂餐具消毒", { topK: 3 });
T("混合检索：食堂问题首命中《食堂管理规定》", h3.length > 0 && h3[0].docId === "d3");
T("检索返回三路打分明细", !!(h1[0].detail && typeof h1[0].detail.vector === "number" && typeof h1[0].detail.bm25 === "number" && typeof h1[0].detail.fuzzy === "number"));

// 4) 模糊容错：错字/缺字仍能命中
const hf = R.search("闸们启闭", { topK: 3 });
T("模糊查询：错字『闸们启闭』仍能命中闸门规程", hf.length > 0 && hf[0].docId === "d1");

// 5) 反向查条目：给内容找出处
const rev = R.reverseQuery("启闭前检查电源电压与制动器状态，确认无人站在闸门下方", 3);
T("反向查询：内容反查到《闸门启闭规程》", rev.length > 0 && rev[0].docId === "d1");

// 6) 记忆管理
R.remember("user", "闸门启闭顺序？");
R.remember("assistant", "先开中间孔，再开两侧孔。");
const rc = R.recall("闸门", 3);
T("记忆：召回相关对话", rc.length >= 1 && rc.some(x => String(x.t).includes("中间孔")));

// 7) 智能问答（mock 大模型）：提示词含资料与引用要求，答案带来源
let captured = null;
const mockChat = (msgs) => { captured = msgs; return Promise.resolve("依据资料[1]：启闭顺序为先开中间孔，再开两侧孔[1]。"); };
R.init({ domain: "test", chat: mockChat, hermesLearn: () => {} });
R.askSmart("闸门启闭顺序是什么？", { chat: mockChat, llm: true, onProgress: () => {} }).then((res) => {
  T("智能问答：返回大模型答案", /中间孔/.test(res.answer));
  T("智能问答：命中片段作为来源", res.hits.length > 0 && res.hits[0].docId === "d1");
  const sys = (captured || []).map(m => m.content).join("\n");
  T("提示词：包含资料上下文与引用要求", sys.includes("【资料】") && sys.includes("[1]") && sys.includes("禁止臆造"));
  T("提示词：包含近期记忆", sys.includes("【近期对话记忆】"));

  // 8) 离线降级：大模型报错 → 抽取式答案
  const badChat = () => Promise.reject(new Error("网络不可用"));
  return R.askSmart("大坝监测有哪些项目", { chat: badChat, llm: true, onProgress: () => {} }).then((r2) => {
    T("降级：大模型失败时给抽取式答案", r2.source === "fallback" && /渗流|位移/.test(r2.answer));
    // 9) 离线模式（不调大模型）
    return R.askSmart("食堂规定", { llm: false, onProgress: () => {} }).then((r3) => {
      T("离线模式：直接给原文片段", r3.source === "offline" && r3.hits.length > 0);
      // 10) 持久化：重新载入索引仍可检索
      const sb2 = mkSandbox();
      sb2.localStorage.setItem("kb_vec_test", sb.localStorage.getItem("kb_vec_test"));
      const ctx2 = vm.createContext(sb2);
      vm.runInContext(fs.readFileSync("android-build/shuili-v329/assets/kb_rag.js", "utf8"), ctx2);
      vm.runInContext('window.KBRag.init({ domain: "test" })', ctx2);
      const loaded = sb2.KBRag.stats();
      T("持久化：索引可从 localStorage 恢复", loaded.chunks === R.stats().chunks && loaded.chunks > 0);
      const hReload = sb2.KBRag.search("闸门启闭", { topK: 2 });
      T("持久化：恢复后检索仍准确", hReload.length > 0 && hReload[0].docId === "d1");
      // 11) 增量入库 + 删除
      sb2.KBRag.addDoc({ id: "d4", title: "防汛值班制度", body: "汛期实行 24 小时值班，值班人员须在岗并保持通讯畅通。", source: "防汛.txt" });
      T("增量：新文档入库后可检索", sb2.KBRag.search("汛期值班", { topK: 2 }).some(x => x.docId === "d4"));
      sb2.KBRag.removeDoc("d4");
      T("增量：删除文档后不再命中", !sb2.KBRag.search("汛期值班", { topK: 3 }).some(x => x.docId === "d4"));
      // 12) 候选提示词
      const tips = R.suggestPrompts(docs, 4);
      T("智能生成候选提示词", Array.isArray(tips) && tips.length >= 3 && tips[0].length > 4);
      console.log(fail === 0 ? "全部通过：" + pass : "失败 " + fail + " / 通过 " + pass);
      process.exit(fail === 0 ? 0 : 1);
    });
  });
}).catch(e => { console.log("ASYNC FAIL", e && (e.stack || e.message)); process.exit(1); });
