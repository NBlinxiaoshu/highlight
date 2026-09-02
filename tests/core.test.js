const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const PIPELINE = require("../pipeline.js");

const root = path.resolve(__dirname, "..");
const settings = require(path.join(root, "settings.js"));
const app = require(path.join(root, "sidepanel.js"));

test("识别带分享参数的小宇宙单集 URL", () => {
  assert.equal(
    settings.episodeIdFromUrl("https://www.xiaoyuzhoufm.com/episode/6a7ab5ac17676351c570146a?s=share"),
    "6a7ab5ac17676351c570146a",
  );
  assert.equal(settings.episodeIdFromUrl("https://example.com/episode/6a7ab5ac17676351c570146a"), "");
});

test("设置只保留允许字段且不会接受任意模型覆盖", () => {
  assert.deepEqual(settings.normalize({ supadataApiKey: " supa ", aiApiKey: " test-key ", aiModel: "evil" }), {
    asrProvider: "supadata",
    dashscopeApiKey: "",
    dashscopeBaseUrl: "https://ws-37mwgpdpfsnksueh.ap-southeast-1.maas.aliyuncs.com/api/v1",
    supadataApiKey: "supa",
    aiApiKey: "test-key",
    aiBaseUrl: "https://api.deepseek.com",
    aiModel: "deepseek-v4-flash",
    syncBaseUrl: "http://127.0.0.1:8787",
    summaryLength: "medium",
    writingStyle: "concise",
    focusPreferences: ["viewpoint", "method", "case"],
    summaryFormat: "list",
    summaryFeatures: { emoji: false, highlights: true, grouped: true },
    highlightLevels: [1, 2],
    boldLevels: [1],
    markTypes: ["quote", "case", "method", "fact"],
    highlightTypes: ["quote", "fact"],
    boldTypes: ["method", "case"],
    customItems: [],
    customColor: "#ff9500",
    customGoal: "",
    customDirection: "",
    summaryAutoGenerate: false,
    summaryAutoTranslate: false,
    summaryLanguage: "zh-CN",
    transcriptPrompt: "",
    summaryPrompt: "",
    highlightPrompt: "",
  });
  assert.deepEqual(settings.normalize({ highlightLevels: [9, 3, 1, 3], boldLevels: [0, 2] }).highlightLevels, [1, 3]);
  assert.deepEqual(settings.normalize({ highlightLevels: [9, 3, 1, 3], boldLevels: [0, 2] }).boldLevels, [2]);
  assert.deepEqual(settings.normalize({ highlightTypes: ["x", "quote"], boldTypes: ["y", "method"], customItems: ["z", "ai"], customColor: "bad" }).highlightTypes, ["quote"]);
  assert.deepEqual(settings.normalize({ highlightTypes: ["x", "quote"], boldTypes: ["y", "method"], customItems: ["z", "ai"], customColor: "bad" }).boldTypes, ["method"]);
});

test("高亮/加粗类型数组为空时回退到默认，避免标注全部无视觉", () => {
  // 空数组（例如 dock 里把一类全取消勾选）不应导致标注变透明/不加粗。
  const normalized = settings.normalize({ highlightTypes: [], boldTypes: [] });
  assert.deepEqual(normalized.highlightTypes, ["quote", "fact"]);
  assert.deepEqual(normalized.boldTypes, ["method", "case"]);
  // 只清空一边，另一边也应回退到它的默认。
  assert.deepEqual(settings.normalize({ highlightTypes: [], boldTypes: ["quote", "case"] }).highlightTypes, ["quote", "fact"]);
});

test("Supadata 毫秒时间戳被转换为秒", () => {
  assert.deepEqual(app.normalizeTranscript({ content: [{ offset: 125000, duration: 5000, text: "观点" }] }), [
    { startSeconds: 125, durationSeconds: 5, text: "观点" },
  ]);
});

test("百炼服务返回的秒级时间戳不会被归零", () => {
  assert.deepEqual(app.normalizeTranscript([{ startSeconds: 125.5, durationSeconds: 4.2, speakerId: "2", text: "带时间戳的原文" }]), [
    { startSeconds: 125.5, durationSeconds: 4.2, speakerId: "2", text: "带时间戳的原文" },
  ]);
});

test("长逐字稿分组且保留时间戳", () => {
  const groups = app.groupTranscript([
    { startSeconds: 0, text: "A".repeat(40) },
    { startSeconds: 61, text: "B".repeat(40) },
  ], 60);
  assert.equal(groups.length, 2);
  assert.match(groups[1], /^\[1:01\]/);
});

test("精读分组带稳定段落编号，原文匹配可忽略空格", () => {
  const groups = app.groupTranscriptForAnnotations([{ startSeconds: 61, speaker: "雨白", text: "小红书 上线 福利社" }]);
  assert.match(groups[0], /^\[S0\|1:01\] 雨白：/);
  assert.deepEqual(app.locatePhrase("小红书 上线 福利社", "小红书上线福利社"), { start: 0, end: 10 });
});

test("原文定位不把标注截成 4–6 字碎片，也不误标不相关短句", () => {
  const orig = "小红书在2014年12月上线了福利社，这是它自营的电商产品。";
  // 长句精确命中。
  assert.deepEqual(app.locatePhrase(orig, "小红书在2014年12月上线了福利社"), { start: 0, end: 18 });
  // 语气碎片 / 不相关短句 / 不相关长句：都不命中，避免乱标。
  assert.equal(app.locatePhrase(orig, "小红书的确"), null);
  assert.equal(app.locatePhrase(orig, "这么一个"), null);
  assert.equal(app.locatePhrase(orig, "谷歌收购了地球并开发人工智能操作系统"), null);
});

test("短句被整理成带起始时间的自然段", () => {
  const paragraphs = app.paragraphizeTranscript([
    { startSeconds: 10, durationSeconds: 2, text: "这是第一句" },
    { startSeconds: 12, durationSeconds: 3, text: "接着说明。" },
    { startSeconds: 20, durationSeconds: 2, text: "这是下一段。" },
  ]);
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs[0].startSeconds, 10);
  assert.match(paragraphs[0].text, /接着说明/);
});

test("正式文稿按说话人切换分段并保留时间戳", () => {
  const paragraphs = app.formalParagraphizeTranscript([
    { startSeconds: 10, durationSeconds: 2, speakerId: "0", speaker: "主持人", text: "欢迎来到节目。" },
    { startSeconds: 12, durationSeconds: 3, speakerId: "0", speaker: "主持人", text: "今天聊一个具体案例。" },
    { startSeconds: 15, durationSeconds: 4, speakerId: "1", speaker: "姜思达", text: "我先说说自己的经历。" },
  ]);
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs[0].speaker, "主持人");
  assert.equal(paragraphs[1].speaker, "姜思达");
  assert.equal(paragraphs[1].startSeconds, 15);
});

test("可疑的大幅改写会回退为 ASR 原文", () => {
  assert.equal(app.safeCorrectedText("这是一段保持原意的逐字稿", "摘要"), "这是一段保持原意的逐字稿");
  assert.equal(app.safeCorrectedText("姜思达今天来到节目", "姜思达今天来到了节目。"), "姜思达今天来到了节目。");
});

test("精读标注排除广告价格和节目排期，但保留有意义的经营事实", () => {
  assert.equal(app.isLowValueOrPromotionalText("每集售价十九块九，专题打包价九十九块九"), true);
  assert.equal(app.isLowValueOrPromotionalText("这个系列第一季一共八期，目前已经完成六期"), true);
  assert.equal(app.isLowValueOrPromotionalText("2018年融资3亿美元，估值超过30亿美元"), false);
  assert.equal(app.isLowValueOrPromotionalText("2014年12月，小红书上线福利社，正式尝试自营电商"), false);
});

test("金句、Case 与各类型给出正反例，密度由证据自适应", () => {
  assert.match(app.ANNOTATION_EDITOR_SYSTEM, /金句 quote/);
  assert.match(app.ANNOTATION_EDITOR_SYSTEM, /案例 case/);
  assert.match(app.ANNOTATION_EDITOR_SYSTEM, /第一季共八期/);
  assert.match(app.ANNOTATION_EDITOR_SYSTEM, /每集19\.9元/);
  // 不再写死每期条数，改为按证据密度自适应、并明确“出现就必标”。
  assert.doesNotMatch(app.ANNOTATION_EDITOR_SYSTEM, /quote 金句：每期/);
  assert.doesNotMatch(app.ANNOTATION_EDITOR_SYSTEM, /每组4–8条|每组2–4条/);
  assert.match(app.ANNOTATION_EDITOR_SYSTEM, /把这段话里所有有证据价值的内容都标出来/);
  assert.match(app.ANNOTATION_EDITOR_SYSTEM, /年份、用户数、GMV、估值、融资额、市场份额、增长率/);
  assert.match(app.ANNOTATION_EDITOR_SYSTEM, /GMV|估值|市场份额/);
  assert.match(app.ANNOTATION_EDITOR_SYSTEM, /窜天猴|坐火箭/);
  assert.doesNotMatch(app.ANNOTATION_EDITOR_SYSTEM, /约 25%/);
});

test("模型输出被限长并按章节时间排序", () => {
  const digest = app.normalizeDigest({
    contentStartSeconds: 12,
    overview: { opening: "总起", sections: [{ heading: "第一节", points: ["要点一", "要点二"] }, { heading: "第二节", points: ["要点三"] }] },
    chapters: [{ startSeconds: 80, title: "后" }, { startSeconds: 10, title: "前", points: ["论据", "结论"], detail: "一段连续正文。" }],
  }, 100);
  assert.deepEqual(digest.chapters.map((item) => item.startSeconds), [10, 80]);
  assert.deepEqual(digest.chapters[0].points, ["论据", "结论"]);
  assert.equal(digest.chapters[0].detail, "一段连续正文。");
  assert.equal(digest.contentStartSeconds, 12);
  assert.equal(digest.overview.opening, "总起");
  assert.equal(digest.overview.sections.length, 2);
  assert.deepEqual(digest.overview.sections[0].points, ["要点一", "要点二"]);
  assert.equal(Object.hasOwn(digest, "oneSentence"), false);
  assert.equal(Object.hasOwn(digest, "skipSegments"), false);
  assert.equal(Object.hasOwn(digest, "quotes"), false);
});

test("相邻章节间隔过近会被聚拢合并，避免时间轴几秒一条", () => {
  const out = app.mergeCloseChapters([
    { startSeconds: 100, title: "A 引言", summary: "s1", points: ["p1"] },
    { startSeconds: 150, title: "A 续", summary: "", points: ["p2"] },
    { startSeconds: 320, title: "B 背景", summary: "s2", points: ["p3"] },
    { startSeconds: 600, title: "C 案例", summary: "s3", points: ["p4"] },
  ], 90);
  // 100s 与 150s（间隔 50s < 90s）合并成一个，320s/600s 间隔够大各自保留。
  assert.equal(out.length, 3);
  assert.equal(out[0].startSeconds, 100);
  assert.equal(out[0].title, "A 引言");
  assert.deepEqual(out[0].points, ["p1", "p2"]);
  assert.equal(out[1].startSeconds, 320);
  assert.equal(out[2].startSeconds, 600);
});

test("自动跳过只接受开头连续区间并受比例和时长双重限制", () => {
  assert.equal(app.inferIntroContentStart([
    { type: "skip", startSeconds: 2280, endSeconds: 2390 },
  ], 2400), 0, "末尾广告不能被当作正文起点");
  assert.equal(app.inferIntroContentStart([
    { type: "skip", startSeconds: 0, endSeconds: 360 },
  ], 2400), 0, "超过整期12%的候选应完全放弃");
  assert.equal(app.inferIntroContentStart([
    { type: "skip", startSeconds: 0, endSeconds: 120 },
    { type: "skip", startSeconds: 130, endSeconds: 180 },
    { type: "skip", startSeconds: 2280, endSeconds: 2390 },
  ], 2400), 180, "只合并开头连续片头，忽略末尾广告");
  assert.equal(app.sanitizeContentStart(2340, 2400), 0, "旧缓存中的异常正文起点也必须被纠正");
});

test("manifest 只声明必要站点且源码中没有硬编码 Key", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.host_permissions, [
    "https://www.xiaoyuzhoufm.com/*",
    "https://www.youtube.com/*",
    "https://*.bilibili.com/*",
    "https://api.bilibili.com/*",
    "https://*.hdslb.com/*",
    "https://*.bilivideo.com/*",
    "https://api.supadata.ai/*",
    "https://api.deepseek.com/*",
    "http://127.0.0.1:8787/*",
  ]);
  const files = fs.readdirSync(root).filter((file) => file.endsWith(".js"));
  const source = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  assert.doesNotMatch(source, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
});

test("Supadata 限额错误提供额度入口", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.match(html, /id="errorSettingsBtn"/);
  assert.match(source, /error\?\.service === "Supadata" && error\?\.status === 429/);
  assert.match(source, /https:\/\/supadata\.ai\/dashboard/);
});

test("No.214 页面连接中断时仍从本地 Word 原稿恢复", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.match(source, /DEMO_EPISODE_META/);
  assert.match(source, /const demoMeta = globalThis\.XYD_DEMOS\?\.find\?\.\(activeEpisodeId\)/);
  assert.match(source, /if \(!episode && demoMeta\)/);
  assert.match(source, /chrome\.storage\.local\.set\(\{ \[transcriptCacheKey\(\)\]: transcriptSegments \}\)/);
});

test("缓存摘要先恢复，阅读导航不依赖播放器且搭子视觉无紫色", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "sidepanel.css"), "utf8");
  assert.match(source, /const userHasDigest = cached\?\.digest && cached\?\.mode !== "imported"/);
  assert.match(source, /if \(!userHasDigest && demo\?\.digest\)/);
  assert.doesNotMatch(source, /await chrome\.storage\.local\.set\(\{ \[digestCacheKey\]: cached \}\)/);
  assert.match(source, /highlightActiveEntry\(next\.segment\.startSeconds, true\);[\s\S]*seekTo\(next\.segment\.startSeconds\)\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(styles, /#5944a7|#7558d9|#9e8ce6|172,148,255|117,88,217/);
  assert.match(styles, /mark\.companion[^}]*color-mix[^}]*color:/);
});

test("原文是首页且摘要支持文档式层级", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "sidepanel.css"), "utf8");
  assert.ok(html.indexOf('id="transcriptTab"') < html.indexOf('id="summaryTab"'));
  assert.match(html, /id="transcriptTab" class="tab active"/);
  assert.match(source, /function renderDocumentOutline/);
  assert.match(source, /function appendInlineMarkdown/);
  assert.match(source, /appendHighlightedText/);
  assert.match(source, /applyGeneratedHighlights/);
  assert.match(source, /highlightText/);
  assert.match(html, /id="chapterRail"/);
  assert.doesNotMatch(html, /id="smartSkipBar"|id="chapterRailToggle"/);
  assert.match(source, /function highlightActiveChapter/);
  assert.match(source, /function applyChapterValley/);
  assert.match(source, /pointerenter[\s\S]*applyChapterValley\(chapterIndex\)/);
  assert.match(source, /classList\.add\("dismissed"\)[\s\S]*applyChapterValley\(-1\)/);
  assert.match(source, /intro-fade/);
  assert.match(source, /已自动跳过片头和广告/);
  assert.doesNotMatch(styles, /has-case/);
  assert.match(styles, /var\(--yellow\)/);
  assert.match(styles, /\.topbar \{ position: static/);
  assert.match(styles, /\.tabs \{ position: sticky/);
  assert.doesNotMatch(html, /小宇宙精读<\/h1>|id="transcriptToolbar"|id="followPlaybackBtn"/);
  assert.match(html, /id="markHighlightBtn"/);
  assert.match(html, /id="markBoldBtn"/);
  assert.match(html, /id="markCustomBtn"/);
  assert.match(html, /id="markDockPanel"/);
  assert.doesNotMatch(html, /id="highlightLegend"/);
  assert.match(source, /introSegments\.slice\(-2\)/);
  assert.match(styles, /body::after[^}]*linear-gradient/);
  assert.doesNotMatch(html, />关键事实</);
  assert.match(styles, /mark\.fact/);
  assert.match(source, /const limits = \{ case: 192, quote: 120, fact: 400, method: 160 \}/);
  assert.doesNotMatch(source, /ensureAnnotationDensity/);
  assert.match(html, /id="readingDock"/);
  assert.match(html, /markHighlightBtn/);
  assert.doesNotMatch(html, /companionSheet/);
  assert.match(html, /id="summaryAutoGenerateToggle"/);
  assert.match(source, /function toggleMarkDockPanel/);
  assert.match(source, /function renderMarkDockPanel/);
  assert.match(source, /function jumpToAnnotation/);
  assert.match(source, /window\.getSelection/);
  assert.match(styles, /user-select: text/);
  assert.match(styles, /mark-dock/);
  assert.match(source, /function setAnnotationVisibility/);
  assert.match(source, /HISTORY_INDEX_KEY/);
  assert.match(source, /function touchHistory/);
  assert.match(html, /id="historyView"/);
  assert.match(html, /id="historySearch"/);
  assert.match(html, /id="historyFilterBtn"/);
  assert.doesNotMatch(html, /id="historySheet"|云端登录/);
  assert.match(source, /function setHistoryPage/);
  assert.match(source, /function renderHistoryEntries/);
  assert.match(source, /chrome\.storage\.local\.remove/);
  assert.match(styles, /\.history-item-icon::after/);
  assert.match(styles, /mark\.companion[^}]*color-mix[^}]*color:/);
  assert.match(styles, /--companion-color/);
  assert.match(source, /function appleCompanionColor/);
  assert.match(source, /segment\.highlights/);
  assert.match(source, /function normalizeCompanionNotes/);
  assert.doesNotMatch(html, /companionResultHeader/);
  assert.match(source, /persistentTranscript/);
  assert.match(source, /if \(chrome\.storage\?\.local\) await chrome\.storage\.local\.set\(\{ \[transcriptCacheKey\(\)\]: transcriptSegments \}\)/);
  assert.match(source, /async function requestAliyunTranscript/);
  assert.match(source, /只有用户主动点击“智能生成”后/);
  assert.match(html, /id="summaryTab"[\s\S]*m12 3 1\.8 5\.2/);
  assert.match(html, /id="notesTab"[\s\S]*M4 20h4L18\.5/);
  assert.match(source, /note: \["M4 20h4L18\.5/);
  assert.match(source, /source: \["M14 3v4/);
  assert.doesNotMatch(html, /id="oneSentence"|id="skipSegments"|id="quotes"/);
  assert.doesNotMatch(html, />节目笔记</);
  assert.match(html, /id="loginBtn"[^>]*>登录</);
  assert.match(html, /id="authForm"/);
  assert.doesNotMatch(html, /episodeMeta|transcriptCount|transcriptTabCount|id="coreIdeas"/);
  assert.match(source, /chapter-peek/);
  assert.match(source, /near-1/);
  assert.doesNotMatch(source, /notesPerChapter/);
  assert.match(html, /id="notesTab"/);
  assert.match(html, /id="notesView"/);
  assert.match(html, /id="selectionToolbar"/);
  assert.match(html, /id="copySelectionBtn"/);
  assert.match(html, /id="noteSelectionBtn"/);
  assert.match(source, /function jumpToTranscript/);
  assert.match(source, /function addReaderNote/);
  assert.match(source, /function showSelectionToolbar/);
  assert.match(styles, /::selection[^}]*rgba\(255,201,40/);
  assert.match(styles, /body \{[^}]*background: #fff/);
});

test("原文支持划词改格式与 AI 高亮接受/取消", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "sidepanel.css"), "utf8");
  for (const id of ["boldSelectionBtn", "hlYellowSelectionBtn", "hlGreenSelectionBtn", "clearFormatSelectionBtn", "acceptHighlightBtn", "rejectHighlightBtn"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="highlightConfirm"/);
  assert.match(source, /function applyFormatToSelection/);
  assert.match(source, /function resolvePendingHighlight/);
  assert.match(source, /function openHighlightConfirm/);
  assert.match(source, /function persistTranscriptHighlights/);
  assert.match(source, /pending: true/);
  assert.match(source, /options\.onPendingClick/);
  assert.match(styles, /mark\.pending\s*\{/);
  assert.match(styles, /mark\.user-highlight\s*\{/);
  assert.match(styles, /mark\.user-bold\s*\{/);
});

test("摘要与时间轴拆成独立顶栏视图，时间轴带章节跳转", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  for (const id of ["summaryTab", "timelineTab", "transcriptTab", "notesTab"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /data-tab="timeline"/);
  assert.match(source, /function switchView/);
  assert.match(source, /byId\("summaryInsightsPanel"\)\.hidden = target !== "summary"/);
  assert.match(source, /byId\("summaryTimelinePanel"\)\.hidden = target !== "timeline"/);
  assert.match(source, /byId\("timelineTab"\)\.addEventListener\("click", \(\) => switchView\("timeline"\)\)/);
  assert.match(html, /class="tabs-tools"/);
  assert.doesNotMatch(source, /summaryWorkbenchTitle/);
  assert.match(source, /renderList\("chapters"/);
  assert.doesNotMatch(source, /summaryInsightsBtn/);
});

test("No.214 Word 原稿已整理为正文长段、整段案例和少量观点", () => {
  const demoSource = fs.readFileSync(path.join(root, "demo-transcript.js"), "utf8");
  assert.match(demoSource, /6a7ab5ac17676351c570146a/);
  assert.match(demoSource, /用户提供的 Word 原稿 · 已整理断句/);
  assert.match(demoSource, /"highlights":/);
  delete globalThis.XYD_DEMO_DATA;
  delete require.cache[require.resolve(path.join(root, "demo-transcript.js"))];
  require(path.join(root, "demo-transcript.js"));
  const demo = globalThis.XYD_DEMO_DATA;
  const body = demo.segments.filter((segment) => segment.startSeconds >= demo.contentStartSeconds);
  assert.equal(demo.contentStartSeconds, 603);
  assert.ok(body.length >= 250);
  assert.ok(body.every((segment) => segment.text.length >= 80));
  assert.ok(body.flatMap((segment) => segment.highlights || []).length <= 8);
  assert.ok(demo.digest.chapters.length >= 12);
  assert.ok(demo.digest.chapters.every((chapter) => chapter.points.length >= 3));
});

test("case 案例分析不再渲染成整段卡片，而是和其它类型一样只走内联高亮/加粗", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "sidepanel.css"), "utf8");
  // case 写入 segment.highlights，而不是 segment.annotation。
  const apply = source.slice(source.indexOf("function applyGeneratedHighlights"), source.indexOf("function isLowValueOrPromotionalText"));
  assert.match(apply, /candidate\.segment\.highlights = \[\.\.\.highlights, \{ id: `hl-/);
  assert.doesNotMatch(apply, /segment\.annotation = \{ type: "case"/);
  // 渲染不再读 annotation 画黄框。
  const render = source.slice(source.indexOf("const appendSegment"), source.indexOf("const appendSkipDivider"));
  assert.doesNotMatch(render, /segment\.annotation\?\.type === "case"/);
  assert.doesNotMatch(styles, /transcript-entry\.case-highlight|\.case-label/);
  // 默认案例走加粗（boldTypes 含 case）；空数组也能回退到默认，避免标注全部无视觉。
  assert.match(source, /settings\?\.boldTypes\?\.length \? settings\.boldTypes : \["method", "case"\]/);
});

test("进度卡片带 spinner 与阶段耗时埋点", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.match(html, /class="spinner"/);
  assert.doesNotMatch(html, /writing-loader/);
  assert.doesNotMatch(source, /writingLoader/);
  assert.match(source, /PROGRESS_METRICS_KEY = "xyd_progress_metrics"/);
  assert.match(source, /async function recordProgressStage/);
  assert.match(source, /progressStageStartedAt/);
  assert.match(html, /id="progressTrack"/);
  assert.match(html, /id="progressFill"/);
  assert.match(source, /function updateProgressBar/);
  assert.match(source, /indeterminate/);
  assert.match(source, /已完成\s*\$\{job\.completedChunks/);
});

test("我的页面保留历史并提供可持久化的阅读偏好", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const options = fs.readFileSync(path.join(root, "options.html"), "utf8");
  assert.match(html, /data-profile-section="account"/);
  assert.match(html, /data-profile-section="history"/);
  assert.match(html, /data-profile-section="preferences"/);
  assert.match(html, /id="profileSummaryLength"/);
  assert.match(html, /id="profileWritingStyle"/);
  assert.match(html, /value="viewpoint"[\s\S]*value="method"[\s\S]*value="case"[\s\S]*value="fact"/);
  assert.match(source, /function saveReadingPreferences/);
  assert.match(source, /function readingPreferenceInstruction/);
  assert.match(source, /function runPromptPreview/);
  assert.match(source, /function assembledSystemPrompt/);
  assert.match(html, /id="profileTranscriptPrompt"/);
  assert.match(html, /id="profileSummaryPrompt"/);
  assert.match(html, /id="profileHighlightPrompt"/);
  assert.doesNotMatch(html, /profileCompanionPrompt/);
  assert.match(html, /id="promptPreviewBtn"/);
  assert.match(html, /id="promptPreviewStage"/);
  assert.match(html, /id="profileAvatarInput"[^>]*type="file"/);
  assert.match(html, /id="profileNickname"/);
  assert.match(source, /PROFILE_KEY = "xyd_user_profile"/);
  assert.match(source, /function saveUserProfile/);
  assert.doesNotMatch(html, /id="profileAccountEmail"[^<]*<\/b><i>/);
  assert.doesNotMatch(html, /会员状态/);
  assert.match(html, /id="historyFilterLabel">全部<\/b><i/);
  assert.match(html, /class="profile-layout"/);
  assert.match(html, /空白页背景\.png|id="transcriptEmpty"/);
  assert.match(options, /阿里云百炼[\s\S]*DeepSeek[\s\S]*同步服务/);
  assert.match(options, /查看同步服务使用指南/);
  assert.doesNotMatch(options, /AI 工作方式/);
});

test("摘要设置面板只保留自动生成/自动翻译/语言", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.match(html, /id="summaryAutoGenerateToggle"/);
  assert.match(html, /id="summaryAutoTranslateToggle"/);
  assert.match(html, /id="summaryLanguageSelect"/);
  assert.match(html, /<option value="zh-CN">中文<\/option><option value="en">英文<\/option><option value="zh-en">双语<\/option>/);
  assert.match(source, /summaryAutoGenerate/);
  assert.match(source, /summaryAutoTranslate/);
  assert.match(source, /summaryLanguage/);
  assert.doesNotMatch(html, /id="summaryHighlightLevels"|id="summaryBoldLevels"|id="summaryMarkTypes"|id="customMarkRow"/);
});

test("摘要页顶部只保留长度下拉和加入笔记", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.match(html, /class="digest-toolbar"/);
  assert.match(html, /id="summaryLengthToolbar"/);
  assert.match(html, /id="addQuickReadNoteBtn"/);
  assert.match(html, /data-tooltip="加入笔记"/);
  assert.doesNotMatch(html, /id="summarySettingsShortcut"/);
  assert.match(source, /summaryLengthToolbar/);
  assert.doesNotMatch(html, /summary-inline-prefs|sipMarkTypes|sipCustomColor/);
});

test("高亮/加粗/自定义驱动按类别的视觉映射", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "sidepanel.css"), "utf8");
  assert.match(source, /function visualClassNameFor/);
  assert.match(source, /function classNameForRegion/);
  assert.match(source, /highlightTypes/);
  assert.match(source, /boldTypes/);
  assert.match(source, /customColor/);
  assert.match(styles, /mark\.method/);
  assert.match(source, /firstUnusedCompanionColor/);
  assert.match(source, /renderMarkDockPanel/);
  // 视觉互斥时不要丢掉 companion / user-* 等非四类的 class（否则智能分析划线消失）。
  const region = source.slice(source.indexOf("function classNameForRegion"), source.indexOf("function appendHighlightedText"));
  assert.match(region, /for \(const cls of classes\) if \(cls\) return cls;/);
  // 智能分析（companion）要压在高亮/加粗之上：class 优先级 companion > fact > quote。
  assert.match(region, /if \(classes\.includes\("companion"\)\) return "companion";[\s\S]*if \(classes\.includes\("fact"\)\) return "fact";[\s\S]*if \(classes\.includes\("quote"\)\) return "quote";/);
});

test("原文页三个下拉：高亮/加粗四类、自定义四类+选色", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  assert.match(html, /id="markHighlightBtn"/);
  assert.match(html, /id="markBoldBtn"/);
  assert.match(html, /id="markCustomBtn"/);
  assert.match(html, /id="markDockPanel"/);
  assert.match(source, /fourLabels = \{ quote: "核心观点", method: "方法论", case: "案例分析", fact: "数据事实" \}/);
  assert.match(source, /customLabels = \{ ai: "AI知识", product: "产品设计", business: "商业化思维", custom: "自定义" \}/);
  assert.match(source, /buildDockCategoryOption/);
  assert.match(source, /function toggleHighlightCategory/);
  // 高亮/加粗类型选择是「可加可减」的开关：点击同一类型再次取消。
  const toggle = source.slice(source.indexOf("async function toggleHighlightCategory"), source.indexOf("function buildDockDivider"));
  assert.match(toggle, /if \(cur\.has\(cat\)\) cur\.delete\(cat\);\s*else cur\.add\(cat\);/);
  assert.doesNotMatch(source, /高亮内容（多选）|加粗层级（多选）|自定义划线颜色/);
});

test("打开节目不会自动创建 ASR，原文与摘要都由用户主动生成", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const initializeBody = source.slice(source.indexOf("async function initialize()"));
  assert.doesNotMatch(initializeBody, /cloudRequest\("\/v1\/asr\/jobs"/);
  assert.match(html, /还没有原文[\s\S]*id="transcriptGenerateBtn"[^>]*>智能生成/);
  assert.match(html, /还没有摘要[\s\S]*id="fullBtn"[^>]*>智能生成/);
});

test("导出/复制按当前视图，且点击弹出菜单不会被 pointerdown 抢先隐藏", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  // 导出菜单项存在。
  assert.match(html, /data-export="(txt|md|doc|pdf|web)"/);
  // 点击弹出面板内部时 pointerdown 不隐藏菜单，避免 click 丢失导致“点了没动静”。
  const pointerdown = source.slice(source.indexOf('document.addEventListener("pointerdown"'), source.indexOf("const savePersonalNote"));
  assert.match(pointerdown, /closest\("#summaryExportMenu, #summarySettingsPanel, #summaryLengthPanel"\)/);
  // 导出/复制按当前视图（原文/笔记/摘要）。
  assert.match(source, /function currentExportMarkdown\(\)/);
  assert.match(source, /function transcriptMarkdown\(\)/);
  assert.match(source, /function notesMarkdown\(\)/);
  assert.match(source, /function currentExportHtml\(title, sourceUrl\)/);
  // 复制富文本：原文视图复制带标注。
  assert.match(source, /function copyRich\(plain, html, okMessage\)/);
});

test("原文页语言下拉可直接翻译，复制不弹菜单、导出含网页", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.match(html, /id="transcriptLangBtn"/);
  assert.match(html, /id="transcriptLangLabel"/);
  assert.match(source, /\[\["source", "原文"\], \["zh-CN", "中文"\]/);
  assert.match(source, /function translateTranscript/);
  assert.match(source, /transcriptLang = "source"/);
  assert.match(source, /segment\.translatedText/);
  assert.match(source, /alignRewrittenSegments/);
  assert.match(source, /segment\.translatedLang/);
  assert.match(source, /byId\("transcriptLangBtn"\)\.addEventListener\("click"/);
  assert.doesNotMatch(html, /summaryCopyMenu/);
  assert.match(source, /byId\("copySummaryBtn"\)\.addEventListener\("click", copySummaryRich\)/);
  assert.match(html, /data-export="web"/);
  assert.match(source, /format === "web"/);
  assert.match(html, />加入笔记<\/button>/);
  assert.doesNotMatch(html, />记笔记<\/button>/);
});

test("下拉菜单使用统一的极简视觉规范", () => {
  const styles = fs.readFileSync(path.join(root, "sidepanel.css"), "utf8");
  assert.match(styles, /select \{[\s\S]*appearance: none/);
  assert.match(styles, /select:focus-visible/);
  assert.match(styles, /background-image: url\("data:image\/svg\+xml/);
});

test("三档摘要长度有真实且递增的篇幅与 token 约束", () => {
  const short = PIPELINE.summaryLengthProfile("short");
  const medium = PIPELINE.summaryLengthProfile("medium");
  const long = PIPELINE.summaryLengthProfile("long");
  assert.ok(short.maxTokens < medium.maxTokens);
  assert.ok(medium.maxTokens < long.maxTokens);
  assert.match(PIPELINE.summaryLengthInstruction("short"), /700–1000/);
  assert.match(PIPELINE.summaryLengthInstruction("long"), /2200–3200/);
});

test("三档摘要长度的数值区间与端侧硬约束一致", () => {
  assert.deepEqual(PIPELINE.summaryLengthNumbers("short"), { sectionMin: 2, sectionMax: 3, pointMin: 2, pointMax: 3, charMin: 700, charMax: 1000 });
  assert.deepEqual(PIPELINE.summaryLengthNumbers("medium"), { sectionMin: 3, sectionMax: 5, pointMin: 3, pointMax: 4, charMin: 1200, charMax: 1800 });
  assert.deepEqual(PIPELINE.summaryLengthNumbers("long"), { sectionMin: 5, sectionMax: 7, pointMin: 3, pointMax: 5, charMin: 2200, charMax: 3200 });
});

test("速读总览按档位截断小节与要点，并过滤空小节", () => {
  const model = { opening: "总起", sections: Array.from({ length: 10 }, (_, i) => ({ heading: `第${i}节`, points: ["一", "二", "三", "四", "五"] })) };
  const short = PIPELINE.clampOverviewToProfile(model, "short");
  assert.equal(short.opening, "总起");
  assert.equal(short.sections.length, 3, "简短档最多 3 个小节");
  assert.ok(short.sections.every((s) => s.points.length <= 3), "简短档每节最多 3 点");
  const long = PIPELINE.clampOverviewToProfile(model, "long");
  assert.equal(long.sections.length, 7, "详细档最多 7 个小节");
  assert.ok(long.sections.every((s) => s.points.length <= 5), "详细档每节最多 5 点");
  assert.equal(PIPELINE.clampOverviewToProfile({ sections: [{ heading: "", points: [] }] }, "medium"), null, "没有有效小节时返回 null");
});

test("顺句按 id 对齐且拒绝明显改写，不会移动原时间轴", () => {
  const source = [
    { startSeconds: 3, durationSeconds: 2, text: "大家好欢迎回来" },
    { startSeconds: 5, durationSeconds: 3, text: "今天我们聊产品" },
  ];
  const batch = PIPELINE.planSegmentBatches(source)[0];
  const aligned = PIPELINE.alignRewrittenSegments({ segments: [
    { id: "s1", text: "今天，我们聊产品。" },
    { id: "s0", text: "完全无关且被大幅扩写成另一段内容，不能接受。" },
  ] }, batch, { mode: "polish" });
  assert.equal(aligned.get(1), "今天，我们聊产品。");
  assert.equal(aligned.has(0), false);
  assert.deepEqual(source.map((item) => item.startSeconds), [3, 5]);
});

test("自动字幕预处理清除标签、音效和滚动重复，保留原时间轴", () => {
  const repaired = PIPELINE.repairCaptionSegments([
    { startSeconds: 0, durationSeconds: 0, text: "<i>经济学研究</i> 社会" },
    { startSeconds: 1, durationSeconds: 2, text: "经济学研究社会如何管理稀缺资源" },
    { startSeconds: 3, durationSeconds: 1, text: "[音乐]" },
    { startSeconds: 5, durationSeconds: 0, text: "机会成本 &amp; 激励" },
  ]);
  assert.equal(repaired.length, 2);
  assert.equal(repaired[0].startSeconds, 0);
  assert.equal(repaired[0].text, "经济学研究社会如何管理稀缺资源");
  assert.equal(repaired[1].text, "机会成本 & 激励");
  assert.ok(repaired[1].durationSeconds > 0);
});

test("历史记录内置小宇宙、YouTube、B站三个可直接查看的 demo", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "demo-library.js"), "utf8");
  assert.match(html, /demo-library\.js/);
  for (const value of ["6a7ab5ac17676351c570146a", "96jN2OCOfLs", "BV1gt411g7RU"]) assert.match(source, new RegExp(value));
  assert.match(source, /translatedText/);
  assert.match(source, /字幕修复/);
  const appSource = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.match(appSource, /isBili \? rest\.slice\(5\)/);
});

test("B站无官方字幕时可回退课程音频 ASR，智能分析覆盖整期分块", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
  assert.match(source, /getBilibiliAudioUrl/);
  assert.match(source, /官方字幕不可用，正在用百炼转写课程音频/);
  assert.match(content, /x\/player\/playurl/);
  const smart = source.slice(source.indexOf("async function runCustomMark"), source.indexOf("async function applyCustomHighlights"));
  assert.match(smart, /planChapterChunks/);
  assert.doesNotMatch(smart, /slice\(0, 110000\)/);
});

test("长视频章节按字幕边界切块并携带上一块尾部上下文", () => {
  const segments = Array.from({ length: 12 }, (_, index) => ({ startSeconds: index * 60, durationSeconds: 30, text: `${index}`.repeat(900) }));
  const chunks = PIPELINE.planChapterChunks(segments, { maxChars: 3000, singleChars: 4000, overlapChars: 500 });
  assert.ok(chunks.length >= 4);
  assert.equal(chunks[0].contextText, "");
  assert.match(chunks[1].contextText, /^\[2:00\]/);
  assert.ok(chunks.at(-1).startSeconds >= 540);
});

test("章节切块可按时间窗分布，避免只按字数导致断句", () => {
  const segments = Array.from({ length: 40 }, (_, index) => ({ startSeconds: index * 180, durationSeconds: 120, text: "X".repeat(500) }));
  const byTime = PIPELINE.planChapterChunks(segments, { maxSeconds: 720 });
  assert.ok(byTime.length >= 4, "超过 720 秒即应切开");
  assert.ok(byTime.every((chunk, index) => index === 0 || chunk.startSeconds > byTime[index - 1].startSeconds), "各块时间递增");
  assert.ok(byTime[0].startSeconds <= 720);
  assert.ok(byTime.length >= 2 && byTime[1].startSeconds < 30 * 60, "第二块不应跨过整段中点");
});

test("章节起点吸附到最近的真实段落时间，避免悬空时间轴", () => {
  const starts = [0, 125, 420, 900, 1503];
  assert.equal(PIPELINE.snapToNearestTimestamp(430, starts), 420, "落在段落之间吸附到前一真实起点");
  assert.equal(PIPELINE.snapToNearestTimestamp(899, starts), 420, "不超过目标的最近起点");
  assert.equal(PIPELINE.snapToNearestTimestamp(80, starts), 0, "0 也是真实起点，目标晚于 0 时吸附到 0");
  assert.equal(PIPELINE.snapToNearestTimestamp(80, [125, 420]), 125, "目标早于所有起点时取最近起点");
  assert.equal(PIPELINE.snapToNearestTimestamp(2000, []), 2000, "没有段落时保持原值");
});

test("复制和导出 HTML 保留标题、递进列表、加粗与高亮", () => {
  const markdown = "## 主题\n- **判断：** 关键结论\n  - ==证据==";
  const html = PIPELINE.markdownToHtml(markdown, "测试");
  assert.match(html, /<h3>主题<\/h3>/);
  assert.match(html, /<strong>判断：<\/strong>/);
  assert.match(html, /<mark>证据<\/mark>/);
  assert.match(html, /<ul>/);
  // 嵌套列表必须合法地放进 <li> 内，而不是变成 <ul> 平级兄弟节点。
  assert.match(html, /<li><strong>判断：<\/strong> 关键结论<ul><li><mark>证据<\/mark><\/li><\/ul><\/li>/);
  // 纯文本复制保留嵌套缩进，体现「递进关系」。
  assert.equal(PIPELINE.markdownToPlainText(markdown), "主题\n· 判断： 关键结论\n  · 证据");
});

test("原文导出的富文本保留黄高亮/自定义颜色/加粗，并附带来源链接和舒适字号", () => {
  const rich = PIPELINE.highlightTextToHtml("小红书在2014年12月上线了福利社，这是自营电商平台。", [
    { type: "fact", start: 0, end: 12 },
    { type: "companion", color: "#007aff", start: 12, end: 20 },
    { type: "method", start: 20, end: 32 },
  ]);
  assert.match(rich, /<mark>小红书在2014年12月<\/mark>/);
  assert.match(rich, /<mark style="background:#bfdeff;color:#007aff">/);
  assert.match(rich, /<strong>是自营电商平台。<\/strong>/);
  const doc = PIPELINE.markdownToHtml("# 标题", "标题", { source: "https://example.com/e", sourceLabel: "小宇宙单集" });
  assert.match(doc, /<a href="https:\/\/example\.com\/e">来源：小宇宙单集<\/a>/);
  assert.match(doc, /font:13\.5px\/1\.7/);
  // 纯文本复制降级：去掉 markdown 标记，但保留文字。
  assert.equal(PIPELINE.markdownToPlainText("**加粗** ==高亮=="), "加粗 高亮");
});

test("生成期间在原文视图推进，进度卡在内容区展示而不是放在 tab 上", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "sidepanel.css"), "utf8");
  // 生成状态只出现在内容区进度卡，不在 tab 上加徽标。
  assert.doesNotMatch(html, /data-status="transcript"|data-status="summary"|data-status="timeline"/);
  assert.doesNotMatch(css, /\.tab-status/);
  assert.doesNotMatch(source, /function setGenerationStatus|function clearGenerationStatus/);
  // updateProgress 不再强行切到摘要视图、也不强行留在原文（不阻止用户点 tab）。
  const body = source.slice(source.indexOf("function updateProgress(title, detail)"), source.indexOf("function updateProgressBar"));
  assert.match(body, /progressKindForTitle\(title\)/);
  assert.doesNotMatch(body, /switchView\("transcript"\)/);
  assert.doesNotMatch(body, /switchView\("summary"\)/);
  // 原文视图有独立进度条，转写/标注阶段可见。
  assert.match(html, /id="transcriptProgress"/);
  assert.match(source, /function setTranscriptProgress/);
  assert.match(source, /function hideTranscriptProgress/);
  // 阶段分类：时间轴/章节→时间轴、摘要/速读/总览→摘要、其余→原文。
  assert.ok(source.indexOf('if (/时间轴|章节/.test(value)) return "timeline"') > 0);
  assert.ok(source.indexOf('if (/摘要|速读|总览/.test(value)) return "summary"') > 0);
  // renderDigest 不再自动切回摘要，避免生成完成后跳转。
  const renderDigest = source.slice(source.indexOf("function renderDigest(value)"), source.indexOf("async function run("));
  assert.doesNotMatch(renderDigest, /switchView\("summary"\)/);
});

test("三档长度点击立即重新生成，重新生成只重做点击的那一块", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  // 切换长度档位后立即按当前配置重新生成摘要（不再提示“点重新生成才生效”）。
  assert.match(source, /已切换为\$\{summaryLengthLabel\(button\.dataset\.length\)\}[\s\S]*正在重新生成/);
  assert.match(source, /regenerateDigestPart\("overview"\)/);
  // 时间轴视图的「重新生成」只重建章节并停留在时间轴视图，不再顺带重建摘要。
  const regen = source.slice(source.indexOf("async function regenerateDigestPart(part)"), source.indexOf("// L1+L2"));
  const ifBranch = regen.slice(regen.indexOf("if (isTimeline)"), regen.indexOf("} else {"));
  assert.match(ifBranch, /generateChaptersFromTranscript/);
  assert.match(ifBranch, /switchView\("timeline"\)/);
  assert.match(ifBranch, /已重新生成时间轴/);
  assert.doesNotMatch(ifBranch, /generateOverviewFromChapters/);
  const elseBranch = regen.slice(regen.indexOf("} else {"), regen.indexOf("} catch"));
  assert.match(elseBranch, /generateOverviewFromChapters/);
  assert.match(elseBranch, /switchView\("summary"\)/);
  assert.match(elseBranch, /已重新生成摘要/);
});

test("生成进度文案面向用户，不露出内部实现说明", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  // 时间轴生成：标题描述当前动作，详情对用户有意义；删除内部容错/技术说明。
  assert.match(source, /正在生成时间轴 \$\{index \+ 1\}\/\$\{chunks\.length\}/);
  assert.match(source, /"按话题把原文整理成可跳转的章节。"/);
  assert.match(source, /"正在生成摘要", "基于章节整理整期脉络与要点。"/);
  assert.match(source, /"正在获取原文"/);
  assert.doesNotMatch(source, /不会因后面一段失败而重来|时间戳保持不变|只补标点|百炼正在识别时间戳并区分说话人/);
});

test("速读总览 opening 不被整段高亮铺满，黄色只跟字走", () => {
  // 整段被一对 == 包住时撤掉标记，让开头行保持干净。
  assert.equal(PIPELINE.normalizeOpeningHighlight("==这期讲播客，核心结论如下=="), "这期讲播客，核心结论如下");
  // 部分高亮（未包整段）保留。
  assert.equal(PIPELINE.normalizeOpeningHighlight("核心结论是：==这种危机并非偶然==，值得警惕"), "核心结论是：==这种危机并非偶然==，值得警惕");
  // 多处 == 高亮保留。
  assert.equal(PIPELINE.normalizeOpeningHighlight("==A==和==B==都在讲"), "==A==和==B==都在讲");
  // 渲染时先经过 normalizeOpeningHighlight 再拼 mark，避免整段 <mark>。
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.match(source, /appendInlineMarkdown\(opening, XYD_PIPELINE\.normalizeOpeningHighlight\(overview\.opening\)\)/);
  const styles = fs.readFileSync(path.join(root, "sidepanel.css"), "utf8");
  // opening 不再有整段黄底渐变，只给内联 mark 上色。
  assert.doesNotMatch(styles, /\.overview-opening \{[\s\S]*background-image: linear-gradient/);
  assert.match(styles, /\.overview-opening mark \{[\s\S]*background: rgba\(255,201,40/);
  // opening 提示词改为：用 == 括住核心结论（黄色跟字走），不是整段刷黄。
  assert.match(source, /用 == 把最核心的那句结论括住/);
});

test("时间轴展开/收起小三角首次点击即旋转，展开/收起与一级内容同行，三级用色区分", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "sidepanel.css"), "utf8");
  // 首次点击即正确设置 aria-expanded，从而驱动 .chapter-expand[aria-expanded="true"] 旋转小三角。
  assert.match(source, /const wasCollapsed = detailBody\.hidden;/);
  assert.match(source, /expand\.setAttribute\("aria-expanded", String\(wasCollapsed\)\);/);
  // 展开/收起内联跟随在一级内容文字末尾（追加到段落 <p> 内，不是右上角也不是另起一行）。
  assert.match(source, /if \(expand\) pd\.appendChild\(expand\);/);
  assert.match(source, /pd\.textContent = detailText;/);
  assert.match(source, /el\.append\(pd\);/);
  assert.doesNotMatch(source, /contentRow\.appendChild\(expand\)|left\.append\(expand\)|actions\.appendChild\(expand\)|position: absolute/);
  // CSS：按钮紧跟一级内容文字（vertical-align: middle + 左间距），标题黑、一级深灰、二级灰。
  assert.match(styles, /\.chapter-detail-text \.chapter-expand \{ vertical-align: middle; margin-left: 6px; \}/);
  assert.match(styles, /\.chapter-detail h3 \{[\s\S]*color: var\(--ink\)/);
  assert.match(styles, /\.chapter-detail-text \{[\s\S]*color: #3f3f42/);
  assert.match(styles, /\.chapter-detail-list\.chapter-detail-points \{ color: var\(--secondary\);/);
  assert.match(styles, /\.chapter-expand\[aria-expanded="true"\] \.chapter-expand-caret \{ transform: rotate\(180deg\);/);
});

test("摘要与时间轴内容独立：重组只清空正在重组的视图，标注按25%补齐", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  // 摘要/时间轴各自有独立的内容区与进度区，互不影响。
  assert.match(html, /id="summaryProgress"/);
  assert.match(html, /id="timelineProgress"/);
  // 已有摘要时，进度卡只进入正在重组的视图（renderPanelProgress），另一个视图内容保留。
  assert.match(source, /const progressPanel = currentDigest \? \(kind === "timeline" \? "timeline" : kind === "summary" \? "summary" : ""\) : ""/);
  assert.match(source, /renderPanelProgress\(progressPanel, title, detail\)/);
  assert.match(source, /contentEl\.hidden = true;/);
  // 重组完成时恢复两个视图的内容并隐藏进度。
  assert.match(source, /function clearAllPanelProgress/);
  assert.match(source, /clearAllPanelProgress\(\);/);
  // 不再做关键词密度补足：标注覆盖完全交给模型按提示词判断。
  assert.doesNotMatch(source, /ensureAnnotationDensity/);
  assert.doesNotMatch(source, /约 25% 的内容标出来/);
  // 智能分析（custom）改为忽略空格的精确命中，避免因标点/空格不同而丢掉。
  const custom = source.slice(source.indexOf("async function applyCustomHighlights"), source.indexOf("async function regenerateCustomMark"));
  assert.match(custom, /locatePhrase\(candidate\.segment\.text, excerpt\.text\)/);
  assert.doesNotMatch(custom, /item\.segment\.text\.includes\(excerpt\.text\)/);
});
