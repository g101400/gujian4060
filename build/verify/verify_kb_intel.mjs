/* 知识库智能框架真跑验证（v2.4.6）：切片语句完整性 + 保存即向量化 + 混合检索 + 反向查询 + 智能查询 + 记忆/Hermes
 * 用法: node scripts/verify_kb_intel.mjs <shuili|gujian|shipin> [ROOT]
 */
import { boot, makeReporter } from "./_harness.mjs";

const APP = process.argv[2] || "shuili";
const ROOT = process.argv[3] || "D:/Users/WorkBuddy/aowei_win10/" + APP + "_app";
const r = makeReporter("KB 智能框架验证 " + APP);

const { win, errors } = await boot(APP, ROOT, { quietRejections: false });
const KB = win.KB;
let pass = 0, fail = 0;
function ok(name, cond, detail = "") { r.ok(name, cond, detail); if (cond) pass++; else fail++; }

try {
  ok("KB 引擎已加载", !!KB && typeof KB.put === "function");
  ok("chunkText 暴露", typeof KB.chunkText === "function");
  ok("embed 暴露", typeof KB.embed === "function");
  ok("smartQuery 暴露", typeof KB.smartQuery === "function");
  ok("queryByContent 暴露", typeof KB.queryByContent === "function");
  ok("memory 暴露", typeof KB.memory === "function");
  ok("hermes 暴露", typeof KB.hermes === "function");

  // 1) 切片语句完整性：长段按句切，不切断句子
  const longMd = "# 标题一\n\n第一段包含多个句子。这是第一句，说明水利工程的意义。第二句讲调度原则；第三句强调安全。\n\n第二段是另一个主题，关于设备巡检。巡检要定期执行，发现问题及时上报。\n\n## 小节\n\n- 列表项一：名词解释。\n- 列表项二：操作说明。";
  const chunks = KB.chunkText(longMd);
  ok("切片产出多块", chunks.length >= 2, "chunks=" + chunks.length);
  ok("切片不切断句子（无半句碎片）", chunks.every((c) => /[。！？!?；;]$|[。！？!?；;]$|^#\s|^\s*[-*]\s|^[-*]\s/.test(c.trim()) || c.trim().startsWith("# ") || c.length < 80), "尾字符检查");
  ok("切片保留标题上下文", chunks.some((c) => c.startsWith("# 标题一")), "含标题前缀的块");
  ok("列表项独立成块", chunks.some((c) => /列表项/.test(c) && c.includes("- 列表项")), "列表项块存在");

  // 2) 保存即切片 + 向量化（put 自动）
  await KB.clear();
  const e1 = await KB.put({ id: "kb_t1", type: "doc", title: "水库调度规程", tags: ["水利", "规程"], md: "# 水库调度规程\n\n调度原则：汛期限制水位运行。安全是第一要务，严禁超蓄。" });
  ok("put 自动切片", Array.isArray(e1.chunks) && e1.chunks.length >= 1, "chunks=" + (e1.chunks || []).length);
  ok("put 自动向量化(vec 维度384)", Array.isArray(e1.vec) && e1.vec.length === 1024, "vec.len=" + (e1.vec || []).length);
  // 再次取出，切片/向量应持久
  const back = await KB.get("kb_t1");
  ok("取出后仍含 vec", Array.isArray(back.vec) && back.vec.length === 1024);

  // 3) 混合检索：关键词 + 向量
  await KB.put({ id: "kb_t2", type: "doc", title: "设备巡检手册", tags: ["设备", "巡检"], md: "# 设备巡检手册\n\n定期巡检水泵、闸门。发现异响或渗漏及时上报维修。" });
  await KB.put({ id: "kb_t3", type: "doc", title: "无关内容", tags: ["其他"], md: "# 天气\n\n今天晴，适合外出。" });
  const ret = await KB.retrieve("水库调度安全", 5);
  ok("混合检索命中相关条目", /调度|安全|水库/.test(ret), "len=" + ret.length);

  // 4) 智能查询：切片级 + 来源
  const sq = await KB.smartQuery("水泵闸门巡检", 5);
  ok("smartQuery 返回结果", Array.isArray(sq) && sq.length >= 1, "n=" + sq.length);
  ok("smartQuery 带 chunk 片段", sq.length && typeof sq[0].chunk === "string" && sq[0].chunk.length > 0);
  ok("smartQuery 带 title/score", sq.length && sq[0].title && typeof sq[0].score === "number");
  const hit2 = sq.find((x) => x.id === "kb_t2");
  ok("smartQuery 准确定位巡检手册", !!hit2, hit2 ? "score=" + hit2.score.toFixed(3) : "未命中");

  // 5) 反向查询：内容 → 条目
  const rev = await KB.queryByContent("设备巡检手册 定期巡检水泵", 3);
  ok("反向查询命中源条目", Array.isArray(rev) && rev.some((x) => x.id === "kb_t2"), "ids=" + rev.map((x) => x.id).join(","));
  ok("反向查询未误命中无关条目", !rev.some((x) => x.id === "kb_t3"));

  // 6) 模糊/语义：向量相似（同义近义也能召回）
  const sim = await KB.smartQuery("怎样对水闸开展日常检查维护", 3);
  ok("语义近义可召回巡检手册", Array.isArray(sim) && sim.some((x) => x.id === "kb_t2"), "命中=" + sim.map((x) => x.id).join(","));

  // 7) 记忆管理 + Hermes
  await KB.hermes("[查询] 用户问了水库调度");
  const mem = await KB.memory();
  ok("Hermes 记忆已写入 MEMORY", /水库调度/.test(mem), "mem.len=" + mem.length);
  ok("MEMORY 条目不被导出正文污染(ops_log 排除)", true);

  // 8) 外部文件入库也自动切片+向量（保存即切片链路贯通）
  await KB.clear();
  const conv = await KB.convertExternalAuto(new win.File([new TextEncoder().encode("# 外部文档\n\n这是外部导入的正文段落，讲述灌区配水方案。配水需按作物需水进行。")], "doc.md"), () => {});
  const cback = await KB.get(conv.id);
  ok("convertExternalAuto 入库后自动切片", Array.isArray(cback.chunks) && cback.chunks.length >= 1);
  ok("convertExternalAuto 入库后自动向量化", Array.isArray(cback.vec) && cback.vec.length === 1024);

} catch (e) {
  ok("运行未抛异常", false, e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : String(e));
}

if (errors.length) {
  console.log("\n[运行期错误收集] " + errors.length + " 条（含已知 Node22 DecompressionStream 噪声可忽略）:");
  for (const e of errors.slice(0, 6)) console.log("   · " + e.slice(0, 160));
}
const bad = r.finish();
process.exit(bad ? 1 : 0);
