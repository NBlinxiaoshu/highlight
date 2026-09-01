const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
    highlightTypes: ["quote", "method"],
    boldTypes: ["case", "fact"],
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
    companionPrompt: "",
  });
  assert.deepEqual(settings.normalize({ highlightLevels: [9, 3, 1, 3], boldLevels: [0, 2] }).highlightLevels, [1, 3]);
  assert.deepEqual(settings.normalize({ highlightLevels: [9, 3, 1, 3], boldLevels: [0, 2] }).boldLevels, [2]);
  assert.deepEqual(settings.normalize({ highlightTypes: ["x", "quote"], boldTypes: ["y", "method"], customItems: ["z", "ai"], customColor: "bad" }).highlightTypes, ["quote"]);
  assert.deepEqual(settings.normalize({ highlightTypes: ["x", "quote"], boldTypes: ["y", "method"], customItems: ["z", "ai"], customColor: "bad" }).boldTypes, ["method"]);
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

test("金句、Case 与搭子 Prompt 带有正反例和最低价值门槛", () => {
  assert.match(app.ANNOTATION_EDITOR_SYSTEM, /金句 quote/);
  assert.match(app.ANNOTATION_EDITOR_SYSTEM, /案例 case/);
  assert.match(app.ANNOTATION_EDITOR_SYSTEM, /第一季共八期/);
  assert.match(app.ANNOTATION_EDITOR_SYSTEM, /每集19\.9元/);
  assert.match(app.COMPANIONS.product.prompt, /用户问题—产品动作—约束—结果/);
  assert.match(app.COMPANIONS.gossip.prompt, /人名出现不等于有瓜/);
  assert.match(app.COMPANIONS.ai.prompt, /只出现“算法、数据、智能”三个字不够/);
  assert.match(app.COMPANIONS.custom.prompt, /可观察证据/);
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
  assert.match(source, /!episode && activeEpisodeId === DEMO_EPISODE_META\.id/);
  assert.match(source, /chrome\.storage\.local\.set\(\{ \[transcriptCacheKey\(\)\]: transcriptSegments \}\)/);
});

test("缓存摘要先恢复，阅读导航不依赖播放器且搭子视觉无紫色", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "sidepanel.css"), "utf8");
  assert.ok(source.indexOf("if (demo?.digest)") < source.indexOf('else if (!settings.aiApiKey)'));
  assert.match(source, /highlightActiveEntry\(next\.segment\.startSeconds, true\);[\s\S]*seekTo\(next\.segment\.startSeconds\)\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(styles, /#5944a7|#7558d9|#9e8ce6|172,148,255|117,88,217/);
  assert.match(styles, /\.companion-choice\.selected[^}]*background: #fff/);
  assert.match(styles, /\.companion-choice\.selected strong[^}]*var\(--yellow\)/);
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
  assert.match(source, /case: 64, quote: 24, fact: 100/);
  assert.match(source, /ensureAnnotationDensity\(\.25/);
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
  assert.match(source, /正在继续阅读/);
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
  assert.match(source, /highlights:\s*\[/);
  assert.match(source, /function normalizeCompanionNotes/);
  assert.match(source, /function buildCompanionPreview/);
  assert.match(source, /function applyCompanionHighlights/);
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
  assert.equal(body.filter((segment) => segment.annotation?.type === "case").length, 12);
  assert.ok(body.flatMap((segment) => segment.highlights || []).length <= 8);
  assert.ok(demo.digest.chapters.length >= 12);
  assert.ok(demo.digest.chapters.every((chapter) => chapter.points.length >= 3));
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
  assert.match(html, /id="profileCompanionPrompt"/);
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
  assert.match(source, /highlightTypes/);
  assert.match(source, /boldTypes/);
  assert.match(source, /customItems/);
  assert.match(source, /customColor/);
  assert.match(styles, /mark\.method/);
  assert.match(source, /renderMarkDockPanel/);
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
  assert.match(source, /buildDockCheck/);
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

test("原文页语言下拉可直接翻译，复制不弹菜单、导出含网页", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.match(html, /id="transcriptLangBtn"/);
  assert.match(html, /id="transcriptLangLabel"/);
  assert.match(source, /\[\["source", "原文"\], \["zh-CN", "中文"\]/);
  assert.match(source, /function translateTranscript/);
  assert.match(source, /transcriptLang = "source"/);
  assert.match(source, /segment\.translatedText/);
  assert.match(source, /res\?\.translation/);
  assert.match(source, /segment\.translatedLang/);
  assert.match(source, /byId\("transcriptLangBtn"\)\.addEventListener\("click"/);
  assert.doesNotMatch(html, /summaryCopyMenu/);
  assert.match(source, /byId\("copySummaryBtn"\)\.addEventListener\("click", \(\) => copyText\(summaryMarkdown\(\)\)\)/);
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
