var XYD_PIPELINE = (() => {
  "use strict";

  const LENGTH_PROFILES = Object.freeze({
    short: Object.freeze({ label: "简短·2-3分钟", targetChars: "700–1000", sections: "2–3", points: "2–3", maxTokens: 3000 }),
    medium: Object.freeze({ label: "中等·3-5分钟", targetChars: "1200–1800", sections: "3–5", points: "3–4", maxTokens: 4600 }),
    long: Object.freeze({ label: "详细·6-8分钟", targetChars: "2200–3200", sections: "5–7", points: "3–5", maxTokens: 7000 }),
  });

  function summaryLengthProfile(value) {
    return LENGTH_PROFILES[value] || LENGTH_PROFILES.medium;
  }

  // 把 "2–3" / "700–1000" 这类范围字符串解析成数值区间，便于在输出端做硬约束。
  function summaryLengthNumbers(value) {
    const profile = summaryLengthProfile(value);
    const range = (input) => {
      const m = String(input).match(/\d+/g);
      const lo = m ? Number(m[0]) : 0;
      const hi = m && m[1] ? Number(m[1]) : lo;
      return { lo, hi };
    };
    const section = range(profile.sections);
    const point = range(profile.points);
    const chars = range(profile.targetChars);
    return {
      sectionMin: section.lo, sectionMax: section.hi,
      pointMin: point.lo, pointMax: point.hi,
      charMin: chars.lo, charMax: chars.hi,
    };
  }

  function summaryLengthInstruction(value) {
    const profile = summaryLengthProfile(value);
    return `目标阅读时长为${profile.label.replace("·", "，")}；正文约 ${profile.targetChars} 个汉字；输出 ${profile.sections} 个主题小节，每节 ${profile.points} 条信息密度高的要点。篇幅必须明显符合该档位，不得用相同内容只改标签。`;
  }

  // 把模型返回的速读总览按档位硬约束：小节数不超过档位上限、每节要点数不超过上限，
  // 且过滤掉没有标题或没有要点的空小节。这样档位差异在端侧是可验证的，而不只靠提示词。
  function clampOverviewToProfile(modelResult, value) {
    const nums = summaryLengthNumbers(value);
    const sections = (Array.isArray(modelResult?.sections) ? modelResult.sections : [])
      .slice(0, nums.sectionMax)
      .map((section) => ({
        heading: typeof section?.heading === "string" ? section.heading.slice(0, 120) : "",
        points: (Array.isArray(section?.points) ? section.points : [])
          .slice(0, nums.pointMax)
          .map((point) => (typeof point === "string" ? point.slice(0, 400) : ""))
          .filter(Boolean),
      }))
      .filter((section) => section.heading && section.points.length);
    if (!sections.length) return null;
    return {
      opening: typeof modelResult?.opening === "string" ? modelResult.opening.slice(0, 600) : "",
      sections,
    };
  }

  // 把任意时间戳吸附到最近的真实段落起点（≤目标值的最大起点，或最近的起点），
  // 用于把模型生成的章节起点固定到真实逐字稿时间，避免出现悬空/跳变的时间轴。
  function snapToNearestTimestamp(value, timestamps) {
    const target = Math.max(0, Number(value) || 0);
    const starts = (Array.isArray(timestamps) ? timestamps : [])
      .map((t) => Math.max(0, Number(t) || 0))
      .sort((a, b) => a - b);
    if (!starts.length) return target;
    const before = starts.filter((t) => t <= target);
    return before.length ? before[before.length - 1] : starts[0];
  }

  // 速读总览的 opening 只是「一句话总起」，不应整段被 == 高亮铺满。
  // 若模型把整段 opening 用一对 == 包住，撤掉这对标记，让黄色高亮只跟字走。
  function normalizeOpeningHighlight(text) {
    const value = String(text || "");
    const pairs = value.match(/==/g);
    if (!pairs || pairs.length !== 2) return value;
    const first = value.indexOf("==");
    const last = value.lastIndexOf("==");
    if (first === 0 && last === value.length - 2) return value.slice(2, -2);
    return value;
  }

  function planSegmentBatches(segments, { maxSegments = 8, maxChars = 3000 } = {}) {
    const batches = [];
    let current = [];
    let chars = 0;
    (Array.isArray(segments) ? segments : []).forEach((segment, index) => {
      const value = String(segment?.text || "").trim();
      if (!value) return;
      if (current.length && (current.length >= maxSegments || chars + value.length > maxChars)) {
        batches.push(current);
        current = [];
        chars = 0;
      }
      current.push({ id: `s${index}`, index, text: value });
      chars += value.length;
    });
    if (current.length) batches.push(current);
    return batches;
  }

  const contentLength = (value) => String(value || "").replace(/[\s\p{P}\p{S}]/gu, "").length;

  function alignRewrittenSegments(parsed, sourceBatch, { mode = "polish", targetLanguage = "" } = {}) {
    const output = new Map((Array.isArray(parsed?.segments) ? parsed.segments : [])
      .map((item) => [String(item?.id || ""), String(item?.text || "").trim()]));
    const accepted = new Map();
    for (const source of Array.isArray(sourceBatch) ? sourceBatch : []) {
      const value = output.get(String(source.id));
      if (!value) continue;
      if (mode === "polish") {
        const before = contentLength(source.text);
        const ratio = before ? contentLength(value) / before : 1;
        if (ratio < .8 || ratio > 1.2) continue;
      } else if (targetLanguage === "en") {
        const before = (source.text.match(/[\u3400-\u9fff]/g) || []).length;
        const after = (value.match(/[\u3400-\u9fff]/g) || []).length;
        if (before >= 10 && after >= before / 2) continue;
      } else if (targetLanguage === "zh-CN") {
        const latin = (source.text.match(/[A-Za-z]/g) || []).length;
        if (latin >= 20 && !/[\u3400-\u9fff]/.test(value)) continue;
      }
      accepted.set(source.index, value);
    }
    return accepted;
  }

  function normalizeCaptionText(value) {
    return String(value || "")
      .replace(/<[^>]*>/g, "")
      .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .replace(/\s+([，。！？；：、,.!?;:])/g, "$1")
      .trim();
  }

  // 自动字幕常用滚动窗口重复上一句，也会产生零时长、重叠和纯音效行。
  // 先做确定性修复，再交给模型校对；不改写语义，也不移动已有起点。
  function repairCaptionSegments(input, { dropCues = true } = {}) {
    const source = (Array.isArray(input) ? input : [])
      .map((item, index) => ({
        ...item,
        _order: index,
        startSeconds: Math.max(0, Number(item?.startSeconds) || 0),
        durationSeconds: Math.max(0, Number(item?.durationSeconds) || 0),
        text: normalizeCaptionText(item?.text),
      }))
      .filter((item) => item.text)
      .sort((a, b) => a.startSeconds - b.startSeconds || a._order - b._order);
    const out = [];
    const cueOnly = /^(?:[（(\[【]?(?:音乐|掌声|笑声|欢呼|片头|片尾|music|applause|laughter)[）)\]】]?|♪+|♫+)$/i;
    const compact = (value) => normalizeCaptionText(value).replace(/[\s，。！？；：、,.!?;:'"“”‘’()（）\[\]【】]/g, "").toLowerCase();
    for (const item of source) {
      if (dropCues && cueOnly.test(item.text)) continue;
      const previous = out[out.length - 1];
      if (previous) {
        const a = compact(previous.text);
        const b = compact(item.text);
        const close = item.startSeconds <= previous.startSeconds + Math.max(previous.durationSeconds, 4) + 1.5;
        if (a && b && close && (a === b || b.startsWith(a))) {
          if (b.length > a.length) previous.text = item.text;
          previous.durationSeconds = Math.max(previous.durationSeconds, item.startSeconds + item.durationSeconds - previous.startSeconds);
          continue;
        }
        if (a && b && close && a.startsWith(b)) {
          previous.durationSeconds = Math.max(previous.durationSeconds, item.startSeconds + item.durationSeconds - previous.startSeconds);
          continue;
        }
      }
      const { _order, ...clean } = item;
      out.push(clean);
    }
    return out.map((item, index) => {
      const nextStart = out[index + 1]?.startSeconds;
      const inferred = Number.isFinite(nextStart) ? Math.max(.2, nextStart - item.startSeconds) : 3;
      return { ...item, durationSeconds: item.durationSeconds > 0 ? item.durationSeconds : inferred };
    });
  }

  function planChapterChunks(segments, { maxChars = 6500, singleChars = 8200, overlapChars = 450, maxSeconds = 0 } = {}) {    const list = (Array.isArray(segments) ? segments : []).filter((item) => String(item?.text || "").trim());
    if (!list.length) return [];
    const groups = [];
    if (list.reduce((sum, item) => sum + String(item.text).length, 0) <= singleChars) groups.push(list);
    else {
      let group = [];
      let size = 0;
      let groupStart = -1;
      for (const item of list) {
        const itemStart = Math.max(0, Number(item.startSeconds) || 0);
        const overChars = group.length && size + String(item.text).length > maxChars;
        const overTime = maxSeconds > 0 && groupStart >= 0 && itemStart - groupStart >= maxSeconds;
        if (overChars || overTime) {
          groups.push(group);
          group = [];
          size = 0;
          groupStart = -1;
        }
        if (groupStart < 0) groupStart = itemStart;
        group.push(item);
        size += String(item.text).length;
      }
      if (group.length) groups.push(group);
    }
    const line = (item) => `[${formatTime(item.startSeconds)}] ${String(item.text).replace(/\s+/g, " ")}`;
    return groups.map((group, index) => {
      const previous = groups[index - 1] || [];
      const context = [];
      let size = 0;
      for (let i = previous.length - 1; i >= 0 && size < overlapChars; i -= 1) {
        context.unshift(previous[i]);
        size += String(previous[i].text).length;
      }
      const last = group[group.length - 1];
      return {
        index,
        startSeconds: Math.max(0, Number(group[0]?.startSeconds) || 0),
        endSeconds: Math.max(0, Number(last?.startSeconds) + Number(last?.durationSeconds || 0) || 0),
        text: group.map(line).join("\n"),
        contextText: context.map(line).join("\n"),
      };
    });
  }

  function formatTime(value) {
    const total = Math.max(0, Math.round(Number(value) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/==([^=]+)==/g, "<mark>$1</mark>");
  }

  // 把一段带标注的原文渲染成富文本 HTML（保留高亮/加粗）。
  // note: commenter 输出的 highlights 是 [{type, start, end}]；type 决定视觉。
  // 视觉与 sidepanel 保持一致：quote/fact=黄高亮，method/case=加粗。
  // 把一段带标注的原文渲染成富文本 HTML（保留黄高亮 / 自定义颜色 / 加粗）。
  // 视觉规则：
  //   - 黄色高亮：type 为 quote/fact/user-highlight
  //   - 自定义颜色：type 为 companion、user-highlight--green 等，且带有有效 color（用该颜色）
  //   - 加粗：type 为 method/case/user-bold
  function highlightTextToHtml(text, highlights, opts = {}) {
    const value = String(text || "");
    const marks = (Array.isArray(highlights) ? highlights : [])
      .map((mark) => {
        const type = mark?.type;
        const color = /^#[0-9a-f]{6}$/i.test(String(mark?.color || "")) ? mark.color : "";
        return {
          isBold: ["method", "case", "user-bold"].includes(type),
          isYellow: ["quote", "fact", "user-highlight"].includes(type) || (["companion"].includes(type) && !color),
          isColored: Boolean(color) && ["companion", "user-highlight--green"].includes(type),
          color,
          start: Math.max(0, Number(mark?.start) || 0),
          end: Math.min(value.length, Number(mark?.end) || 0),
        };
      })
      .filter((m) => m.end > m.start);
    if (!marks.length) return escapeHtml(value);
    const boundaries = [...new Set([0, value.length, ...marks.flatMap((m) => [m.start, m.end])])].sort((a, b) => a - b);
    let out = "";
    for (let i = 0; i < boundaries.length - 1; i += 1) {
      const start = boundaries[i];
      const end = boundaries[i + 1];
      if (end <= start) continue;
      const chunk = value.slice(start, end);
      const active = marks.filter((m) => m.start <= start && m.end >= end);
      const bold = active.some((m) => m.isBold);
      const yellow = active.some((m) => m.isYellow);
      const colored = active.find((m) => m.isColored);
      let html = escapeHtml(chunk);
      if (colored && colored.color) {
        // 自定义颜色：用不透明浅色底 + 原色文字，保证打印/粘贴也能看到。
        html = `<mark style="background:${lightenHex(colored.color)};color:${colored.color}">${html}</mark>`;
      } else if (yellow) {
        html = `<mark>${html}</mark>`;
      }
      if (bold) html = `<strong>${html}</strong>`;
      out += html;
    }
    return out;
  }

  // 把一个 6 位 hex 颜色与白色混合，得到不透明浅色（用于 mark 底色）。
  function lightenHex(hex) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return hex;
    const to = (i) => Math.round(Number.parseInt(m[i], 16) * 0.25 + 255 * 0.75);
    return `#${[1, 2, 3].map((i) => to(i).toString(16).padStart(2, "0")).join("")}`;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function markdownToHtml(markdown, title = "小黄笔", extra = {}) {
    const lines = String(markdown || "").split(/\r?\n/);
    const root = [];
    // 列表栈：每项 { list, lastLi }；栈深即当前嵌套层级。
    const stack = [];
    const closeToDepth = (target) => {
      while (stack.length > target) stack.pop();
    };
    for (const raw of lines) {
      if (!raw.trim()) { closeToDepth(0); continue; }
      const heading = raw.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        closeToDepth(0);
        const level = Math.min(4, heading[1].length + 1);
        root.push({ tag: `h${level}`, html: inlineMarkdown(heading[2]) });
        continue;
      }
      const bullet = raw.match(/^(\s*)[-*•·]\s+(.+)$/);
      if (bullet) {
        const depth = Math.min(4, Math.floor(bullet[1].replace(/\t/g, "  ").length / 2)) + 1;
        closeToDepth(depth - 1);
        while (stack.length < depth) {
          const list = { tag: "ul", children: [] };
          const parent = stack.length === 0
            ? root
            : (stack[stack.length - 1].lastLi ? stack[stack.length - 1].lastLi.children : stack[stack.length - 1].list.children);
          parent.push(list);
          stack.push({ list, lastLi: null });
        }
        const top = stack[stack.length - 1];
        const li = { tag: "li", html: inlineMarkdown(bullet[2]), children: [] };
        top.list.children.push(li);
        top.lastLi = li;
        continue;
      }
      closeToDepth(0);
      root.push({ tag: "p", html: inlineMarkdown(raw.trim()) });
    }
    closeToDepth(0);
    const render = (node) => node.tag === "ul"
      ? `<ul>${node.children.map(render).join("")}</ul>`
      : `<${node.tag}>${node.html}${node.children?.map(render).join("") || ""}</${node.tag}>`;
    const sourceHtml = extra?.source
      ? `<p class="source"><a href="${escapeHtml(extra.source)}">来源：${escapeHtml(extra.sourceLabel || extra.source)}</a></p>`
      : "";
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
body{max-width:760px;margin:32px auto;padding:0 18px;font:13.5px/1.7 -apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#1d1d1f;word-break:break-word}
h1{font-size:21px;line-height:1.35;margin:0 0 14px;font-weight:800;letter-spacing:-.02em}
h2{margin:24px 0 10px;font-size:17px;font-weight:700;letter-spacing:-.01em}
h3{margin:18px 0 8px;font-size:15px;font-weight:700}
h4{margin:14px 0 6px;font-size:13.5px;font-weight:700}
p{margin:.5em 0}
ul{padding-left:1.4em;margin:.4em 0}
ul ul{margin:.25em 0}
li{margin:.3em 0}
strong{font-weight:700}
mark{background:#ffe769;padding:0 .1em;border-radius:2px}
hr{border:0;border-top:1px solid #ececec;margin:22px 0}
.source{color:#8e8e93;font-size:12px;margin-bottom:16px}
.source a{color:#8e8e93;text-decoration:none;border-bottom:1px solid #d0d0d0}
@media print{body{margin:0 auto;font-size:12.5px}}
</style></head><body><h1>${escapeHtml(title)}</h1>${sourceHtml}${root.map(render).join("")}</body></html>`;
  }

  function markdownToPlainText(markdown) {
    // 保留嵌套列表的缩进，从而在纯文本里也体现「递进关系」；内联加粗/高亮降级为原文文字。
    return String(markdown || "").replace(/^#{1,6}\s+/gm, "").replace(/^(\s*)[-*•·]\s+/gm, "$1· ").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/==([^=]+)==/g, "$1").replace(/\n{3,}/g, "\n\n").trim();
  }

  return { summaryLengthProfile, summaryLengthInstruction, summaryLengthNumbers, clampOverviewToProfile, snapToNearestTimestamp, normalizeOpeningHighlight, planSegmentBatches, alignRewrittenSegments, normalizeCaptionText, repairCaptionSegments, planChapterChunks, markdownToHtml, markdownToPlainText, highlightTextToHtml };
})();

if (typeof module !== "undefined" && module.exports) module.exports = XYD_PIPELINE;
