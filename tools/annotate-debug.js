#!/usr/bin/env node
/**
 * 标注调试器（annotate-debug）
 *
 * 用途：喂一段真实节目原文，用「当前 sidepanel.js 里的正式标注 prompt」调 DeepSeek，
 * 得到 notes JSON，并渲染成一个 HTML 预览，让你直接看：
 *   - 黄荧光笔  = quote / fact（默认 highlightTypes）
 *   - 加粗      = method / case（默认 boldTypes）
 *   - 每一行标注来自哪个类型、命中哪段原文
 *
 * 这样改 prompt / 改视觉映射时，可以不刷新 Chrome 就快速看到效果。
 *
 * 用法：
 *   node tools/annotate-debug.js "要标注的原文（≤6000字）"
 *   node tools/annotate-debug.js --file sample.txt
 *   node tools/annotate-debug.js            # 从 stdin 读
 *
 * 需要环境变量（或在 tools/annotate-debug.config.json）：
 *   AI_API_KEY  DeepSeek API Key
 * 可选：AI_MODEL（默认 deepseek-v4-flash）
 *
 * 输出：tools/build/annotate-preview.html（用浏览器打开）
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

// ---------- 1. 从真实源码里抽取 prompt 与视觉映射，保证与实现一致 ----------
const src = fs.readFileSync(path.join(ROOT, "sidepanel.js"), "utf8");

function extractBetween(startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s < 0) throw new Error(`未找到起点标记：${startMarker}`);
  const e = src.indexOf(endMarker, s);
  if (e < 0) throw new Error(`未找到终点标记：${endMarker}`);
  return src.slice(s, e);
}

const ANNOTATION_EDITOR_SYSTEM = extractBetween(
  "const ANNOTATION_EDITOR_SYSTEM = ",
  "\n  function readingPreferenceInstruction",
)
  .replace(/^const ANNOTATION_EDITOR_SYSTEM = /, "")
  .replace(/;$/, "")
  .trim()
  .replace(/^`/, "")
  .replace(/`$/, "");

// 视觉映射：当前实现「先黄后加粗」，若某类型同时命中两者则优先黄。
function visualClassNameFor(markType, highlightTypes, boldTypes) {
  if (["quote", "fact", "method", "case"].includes(markType)) {
    const isBold = (boldTypes || ["method", "case"]).includes(markType);
    const isHighlighted = (highlightTypes || ["quote", "fact"]).includes(markType);
    if (isHighlighted) return "quote"; // 黄
    if (isBold) return "fact";         // 加粗
    return "unmarked";
  }
  return markType;
}

// ---------- 2. 读配置 ----------
const configPath = path.join(__dirname, "annotate-debug.config.json");
const cfg = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : {};
const API_KEY = process.env.AI_API_KEY || cfg.aiApiKey || "";
const MODEL = process.env.AI_MODEL || cfg.aiModel || "deepseek-v4-flash";
const BASE_URL = cfg.baseUrl || "https://api.deepseek.com";

// ---------- 3. 读原文（CLI / --file / stdin） ----------
function readPassage(argv) {
  if (argv.includes("--file")) {
    const f = argv[argv.indexOf("--file") + 1];
    return fs.readFileSync(path.resolve(ROOT, f), "utf8").trim();
  }
  if (argv.length) return argv.join(" ").trim();
  if (!process.stdin.isTTY) return fs.readFileSync(0, "utf8").trim();
  return "";
}

// ---------- 4. 调 DeepSeek ----------
async function callDeepSeek(system, user, maxTokens = 5000) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: maxTokens,
    }),
  });
  const body = await res.json().catch(() => ({}));
  const content = body?.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(content);
  } catch (_e) {
    // 兜底：吞掉可能的 markdown 围栏
    const stripped = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(stripped);
  }
}

// ---------- 5. 构建用户输入（与 regenerateAnnotations 尽量一致） ----------
function buildUser(passage, episodeTitle, groupIndex = 1, groupCount = 1) {
  const numbered = passage
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, i) => `[S${i}|00:00] ${line.trim()}`)
    .join("\n");
  return `节目：${episodeTitle}\n读者偏好：内容精炼，快速抓住重点；按重要性给内容分层（1=核心判断/观点/结论，2=关键事件/数据/因果，3=支撑论据/例子，4=背景与细节）。用黄色荧光笔高亮 1（核心判断/观点/结论）、2（关键事件/数据/因果）的内容；用加粗强调 1（核心判断/观点/结论）的内容。重点划线这些类型的内容：金句/重要判断、事件/案例、方法论/可复用方法、数据/事实。只按内容重要度分层，不要为了凑数标注。
这是逐字稿的第 ${groupIndex}/${groupCount} 段：
${numbered}`;
}

// ---------- 6. 渲染 HTML ----------
function renderHtml(passage, notes, highlightTypes, boldTypes) {
  // 把所有类型的 highlightText 定位回原文并打标（模拟 locatePhrase + applyGeneratedHighlights）
  const ranges = [];
  for (const note of notes || []) {
    const phrase = String(note?.highlightText || "").trim();
    if (!phrase || phrase.length < 4) continue;
    const idx = passage.indexOf(phrase);
    if (idx < 0) continue;
    ranges.push({
      start: idx,
      end: idx + phrase.length,
      type: note.type,
      label: note.type,
      title: note.title || "",
    });
  }
  ranges.sort((a, b) => a.start - b.start);
  // 去掉重叠
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start < last.end) continue;
    merged.push(r);
  }
  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let buf = "";
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) buf += esc(passage.slice(cursor, r.start));
    const cls = visualClassNameFor(r.type, highlightTypes, boldTypes);
    const isYellow = cls === "quote";
    buf += `<mark class="${isYellow ? "y" : "b"}" title="${esc(r.type)}">${esc(passage.slice(r.start, r.end))}</mark>`;
    cursor = r.end;
  }
  buf += esc(passage.slice(cursor));

  const body = (notes || [])
    .map(
      (n, i) =>
        `<tr><td>${i + 1}</td><td>${esc(n.type || "")}</td><td>${esc((n.title || "").slice(0, 40))}</td><td>${esc((n.highlightText || "").slice(0, 120))}</td></tr>`,
    )
    .join("\n");

  const count = (t) => (notes || []).filter((n) => n.type === t).length;

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>标注预览</title>
<style>
  body{max-width:820px;margin:40px auto;font:17px/1.9 -apple-system,"PingFang SC",sans-serif;color:#1d1d1f;padding:0 16px}
  h1{font-size:22px} h2{font-size:16px;color:#555}
  .legend{display:flex;gap:20px;margin:10px 0 4px;font-size:13px}
  .legend .y{background:linear-gradient(transparent 12%,rgba(255,201,40,.72) 12%,rgba(255,201,40,.72) 88%,transparent 88%);padding:0 2px}
  .legend .b{font-weight:800}
  .passage{margin:18px 0;line-height:2;white-space:pre-wrap}
  mark{color:inherit}
  mark.y{background:linear-gradient(transparent 12%,rgba(255,201,40,.72) 12%,rgba(255,201,40,.72) 88%,transparent 88%);border-radius:3px}
  mark.b{font-weight:800}
  table{border-collapse:collapse;width:100%;font-size:12px;margin-top:24px}
  th,td{border:1px solid #eee;padding:5px 8px;text-align:left}
  th{background:#fafafa}
  .stats{font-size:13px;color:#666;margin:8px 0}
</style></head><body>
<h1>标注预览</h1>
<div class="legend"><span><mark class="y">黄色荧光笔</mark> = quote / fact</span><span><mark class="b">加粗</mark> = method / case</span><span class="stats">共 ${(notes || []).length} 条：quote ${count("quote")} · case ${count("case")} · fact ${count("fact")} · method ${count("method")}</span></div>
<h2>命中原文（逐字渲染）</h2>
<div class="passage">${buf}</div>
<h2>标注清单</h2>
<table><thead><tr><th>#</th><th>类型</th><th>标题</th><th>highlightText</th></tr></thead><tbody>${body}</tbody></table>
</body></html>`;
}

// ---------- main ----------
(async () => {
  const passage = readPassage(process.argv.slice(2));
  if (!passage) {
    console.error(
      "请传入原文：\n  node tools/annotate-debug.js \"原文...\"\n  node tools/annotate-debug.js --file sample.txt\n  node tools/annotate-debug.js < sample.txt",
    );
    process.exit(1);
  }
  if (!API_KEY) {
    console.error("缺少 AI_API_KEY（环境变量）或 tools/annotate-debug.config.json 中的 aiApiKey。");
    process.exit(1);
  }
  if (passage.length > 6000) {
    console.warn(`原文 ${passage.length} 字，超过 6000，仍会尝试（可能超长）。`);
  }

  const highlightTypes = ["quote", "fact"];
  const boldTypes = ["method", "case"];
  const episodeTitle = "演示节目（调试）";
  console.error(`正在调用 ${MODEL}，原文约 ${passage.length} 字…`);

  const user = buildUser(passage, episodeTitle, 1, 1);
  const result = await callDeepSeek(ANNOTATION_EDITOR_SYSTEM, user, 6000);
  const notes = Array.isArray(result?.notes) ? result.notes : [];

  const outFile = path.join(__dirname, "build", "annotate-preview.html");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, renderHtml(passage, notes, highlightTypes, boldTypes));
  console.error(`已写出预览：${outFile}`);
  console.log(
    JSON.stringify({
      count: notes.length,
      byType: {
        quote: notes.filter((n) => n.type === "quote").length,
        case: notes.filter((n) => n.type === "case").length,
        fact: notes.filter((n) => n.type === "fact").length,
        method: notes.filter((n) => n.type === "method").length,
      },
      preview: outFile,
      notes,
    }, null, 2),
  );
})().catch((err) => {
  console.error("调试器运行失败：", err?.message || err);
  process.exit(1);
});
