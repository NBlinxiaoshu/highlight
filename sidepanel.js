var XYD_APP = (() => {
  "use strict";

  const SUPADATA_URL = "https://api.supadata.ai/v1/transcript";
  const SUPADATA_YOUTUBE_TRANSCRIPT_URL = "https://api.supadata.ai/v1/youtube/transcript";
  const POLL_INTERVAL_MS = 5000;
  const MAX_POLLS = 360;
  const HISTORY_INDEX_KEY = "xyd_history_index";
  const PROFILE_KEY = "xyd_user_profile";
  const DEMO_EPISODE_META = Object.freeze({
    id: "6a7ab5ac17676351c570146a",
    title: "No.214 📕 寻找同类：小红书、bilibili，以及五花八门的那些社区｜中国互联网故事 26",
    podcast: "半拿铁｜商业沉浮录",
    description: "",
    duration: 11056,
    audioUrl: "",
  });
  const DEMO_GOLDEN_QUOTES = new Set([
    "创业只是一个普通的职业选择，甚至就是一份工作而已",
    "我不是说火的内容，有流量的内容我都推，而是在其他平台你可能讨论比较少见的，比较少的内容，我去做一些差异化",
    "而UGC内容和KOC内容一直都是小红书的核心差异化的价值",
    "你不懂社区会死，你只懂社区也会死",
    "视频的核心指标从之前的播放次数改成了播放时长，不是只鼓励大家做标题党，提升打开率了",
    "不做贴片不等于没有广告，它只是把原本一次体面又有价值的广告，变成了100次狼狈又不体面的广告",
    "社区不是一群人在看一个东西而已，社区是你能看到成千上万的人跨越时间，跨越空间，跟你在这一时刻这个地方一起相聚",
  ]);
  const DEMO_EXTRA_CASES = [
    [677, "赔偿 100 万元离开斯坦福创业"],
    [1386, "四万名精准用户完成冷启动"],
    [1566, "小红书上线福利社，正式尝试自营电商"],
    [1675, "融资与估值把小红书推入独角兽行列"],
    [2250, "投放《偶像练习生》带来女性用户增长"],
    [3461, "小绿洲与福利社相继关闭"],
    [4576, "A站资金链断裂后被快手收购"],
    [5624, "FGO代理改变B站收入结构"],
    [7042, "商业预算集中在头部UP主"],
    [8073, "TapTap用用户规模建立行业影响力"],
    [8892, "脉脉在融资后实现早期盈亏平衡"],
  ];
  const DEMO_KEY_FACTS = [
    [677, "2013年7月，毛文超怒赔100万后下海创业"],
    [1386, "累计四万多的粉丝"],
    [1629, "16年3月又拿到了腾讯领投的1亿美元融资"],
    [1675, "2018年拿到了阿里巴巴领投的3亿美元融资"],
    [1675, "2018年小红书已经估值超过30亿美元"],
    [2011, "半年花了1.5亿"],
    [2668, "2020年8月，小红书推出了视频号，视频时长也直接延长到了最高15分钟"],
    [3461, "2023年10月，只做了一年多的小绿洲直接关闭"],
    [5624, "上线前30天就吸引了450万的玩家"],
    [5679, "2015年B站的游戏收入只有1.31亿，2016年直接窜到5点二三亿"],
    [5679, "2017年做到了24.68亿"],
    [7042, "一个品牌有1亿全案营销预算，B站这个平台可能能分到1000万"],
    [8073, "累计用户已超过2000万，日活超过100万"],
    [8073, "已经有2万家游戏厂商和开发者入驻"],
    [8892, "16年慢慢已经有2000万注册用户，200万的日活，B轮之后估值超过1亿"],
  ];
  const COMPANION_SHARED_CONTRACT = `你不是摘要机，而是坐在读者旁边、会划原文并写旁注的共读者。
选择标准：只有与你的视角直接相关、能改变理解或支持判断的内容才划。证据可以是一句，也可以是相邻数段；只取最小充分原文，不因出现人名、年份、数字或术语就选择。
写作标准：标题要像编辑写的短标题，具体、有记忆点；旁注必须包含你的判断及其依据，可以有性格和幽默，但幽默来自事实中的反差，不玩梗硬凑。不得复述、拔高、虚构动机或补写因果。
一律跳过：节目开场、嘉宾名单、购买渠道、价格优惠、订阅引导、品牌口播、普通履历罗列、无结论的寒暄。`;
  const COMPANIONS = {
    gossip: { name: "正主吃瓜", role: "吃瓜视角", color: "#ff2d55", description: "八卦一手消息，带你一起吃瓜", prompt: `${COMPANION_SHARED_CONTRACT}
你是一位嘴快但证据更快的人物故事编辑。只关注人物关系、利益变化、公开言行反差、冲突、站队、反转和改变命运的选择。人名出现不等于有瓜；没有关系变化或矛盾张力就不要划。传闻必须标明是传闻，不能替当事人脑补。
正例——原文：“走可以，但得赔一百万。2013年7月，毛文超赔钱离开公司创业。”
标题：创业第一步：先给自己赎个身
旁注：别人从零开始，他先从负一百万爬回零。职业选择在这里不是鸡汤，是一张真金白银的单程票。
反例——“本季一共八期，已经完成六期；嘉宾有甲、乙、丙。”这是排期与名单，没有人物关系或冲突，不选。` },
    ai: { name: "沐神笔记", role: "AI 前沿视角", color: "#007aff", description: "聚焦 AI 前沿，看看这次又炼出了什么丹", prompt: `${COMPANION_SHARED_CONTRACT}
你是一位做过 AI 研究和工程落地的科学家。关注模型、数据、训练、评测、Agent、推理、工程权衡、失败条件和能力边界；也可选择虽未提 AI、却能严谨解释数据飞轮、人机协作或智能产品机制的内容。只出现“算法、数据、智能”三个字不够，必须有机制、约束或可验证结论。
正例——原文：“数据库是社区生产内容的机制，而搜索是调取这些数据的入口。”
标题：没讲 AI，却把数据飞轮讲透了
旁注：模型不是凭空长出能力的。持续生产真实经验的机制和可召回的数据，才是智能产品更难复制的地基。
反例——“我们使用先进算法，效果很好。”没有任务、指标、方法或边界，属于营销空话，不选。` },
    product: { name: "Zara 产品雷达", role: "产品视角", color: "#00c7be", description: "产品 sense 持续积累中", prompt: `${COMPANION_SHARED_CONTRACT}
你是一位产品 sense 很强、习惯追问取舍的产品经理。寻找“用户问题—产品动作—约束—结果”的证据链，也关注增长实验、商业化取舍、指标定义、机制变化、失败与反常识决策。一个关键动作即使结果尚未知也可选，但必须说明它在解决什么问题；单纯上线日期或公司履历不选。
正例——原文：“《偶像练习生》投放效果很好，后来又投了《创造101》。”
标题：不是撞上爆款，是验证后连续下注
旁注：第一次投放验证了人群匹配，随后复投把偶然变成渠道策略。值得学的是“试一次—看结果—加注”的动作链。
正例——原文：“2014年12月，小红书上线福利社。”
标题：社区刚起势，电商就提前进场
旁注：这不是普通版本更新，而是平台很早就在验证“内容如何通向交易”。
反例——“产品于2014年上线。”只有日期，没有问题、动作含义或结果，不选。` },
    custom: { name: "你的自定义搭子", role: "自定义视角", color: "#af52de", description: "自己决定这次重点看什么", prompt: `${COMPANION_SHARED_CONTRACT}
严格围绕读者指定的目标工作。先在心里把目标拆成3–6条可观察证据，例如人物、动作、机制、指标、风险和结果，再选择直接命中的原文；不要把关键词命中误当成相关性。旁注说明“这段为什么回答了读者的问题”。
正例（目标：只看商业模式）——原文同时给出用户增长和商业化困境。
标题：用户在增长，收入问题却还没被回答
旁注：增长与收入没有同步出现，这个落差比单看用户数更能判断模式是否成立。
反例——只因出现“收入”二字就选择一段广告报价，不选。` },
  };
  const DEMO_COMPANION_NOTES = Object.freeze({
    gossip: [
      { startSeconds: 677, title: "创业第一步：先给自己赎个身", detail: "别人创业从零开始，毛文超是负一百万开局。这个瓜的重点不是“热血”，而是他真拿现金给职业路径买了张单程票。", highlights: [{ startSeconds: 677, text: "走得还钱。对，你走可以，你得把钱还了得赔多少钱？100万。你看看。2013年7月，毛文超怒赔100万后下海创业。" }] },
      { startSeconds: 861, title: "创业灵感出现两个版本，先别急着站队", detail: "一个版本说痛点来自毛文超父母出国购物，另一个版本说是瞿芳在田子坊提出。好故事往往越讲越顺，原文反而诚实地把冲突留下来了。", highlights: [{ startSeconds: 861, text: "2012年，毛文超的父母当时准备去美国旅行，想要采购搜一些东西。他上网去搜，美国在哪买东西，什么东西好啊，结果搜不明白，搜不到都没有。" }, { startSeconds: 909, text: "瞿芳表示女性出国旅游的时候，要花大量的时间研究去哪儿购物。所以出去旅行购物这个市场是非常值得做的。" }] },
      { startSeconds: 2250, title: "综艺投放押中爆款，用户真的追着偶像来了", detail: "《偶像练习生》和《创造101》把小红书第一次推向大规模破圈。这里不是“明星很有用”这么简单，而是人群、内容和平台气质刚好对上了。", highlights: [{ startSeconds: 2250, text: "小红书在这几年投放了爱奇艺的综艺偶像练习生，结果效果非常好。" }, { startSeconds: 2250, text: "大量的女性粉丝开始注册小红书。后来小红书又投放了在一开始还没有那么火的创造101" }] },
      { startSeconds: 2359, title: "赵露思一来，社区差点被网友改名", detail: "用户吐槽“叫小路书吧”，本质是在替平台守人设：大家接受明星，但不接受明星盖过普通人的生活经验。", highlights: [{ startSeconds: 2359, text: "小红书给非常多的用户，很可能是全量push了那个通知，说赵露思来小红书了" }, { startSeconds: 2359, text: "当时很多网友说别叫小红书了，叫小路书吧。" }] },
      { startSeconds: 5132, title: "一句话把爱好者网站问成了商业公司", detail: "陈睿没有先谈融资和收入，而是先逼徐逸回答“你到底想做什么”。很多公司命运的分叉，最初就藏在这种看似随口的问题里。", highlights: [{ startSeconds: 5132, text: "你是想就做一个爱好者的社团，还是想正儿八经做一家互联网公司？" }] },
    ],
    product: [
      { startSeconds: 1566, title: "社区刚起势，电商就提前进场", detail: "2014 年上线福利社是一次明确的商业化动作。值得划的不是“做了电商”，而是社区价值尚未完全建立时，平台已经开始回答怎么赚钱。", highlights: [{ startSeconds: 1566, text: "很早在2014年12月，小红书就上线了福利社。福利社是什么呢？就是他自己的电商产品。" }] },
      { startSeconds: 2250, title: "增长不是抽象策略，是连续押中两档综艺", detail: "《偶像练习生》验证有效后继续投《创造101》，这是“找到有效渠道—复投—扩大人群”的完整动作链。", highlights: [{ startSeconds: 2250, text: "小红书在这几年投放了爱奇艺的综艺偶像练习生，结果效果非常好。" }, { startSeconds: 2250, text: "后来小红书又投放了在一开始还没有那么火的创造101，再加上后来的各种综艺的投放效果都很好。" }] },
      { startSeconds: 2359, title: "真正的护城河不是明星，是普通人的经验", detail: "UGC/KOC 是小红书与中心化内容平台的分水岭。产品动作一旦伤害这个认知，即使短期有流量，也会触发用户反弹。", highlights: [{ startSeconds: 2359, text: "而UGC内容和KOC内容一直都是小红书的核心差异化的价值。" }] },
      { startSeconds: 3461, title: "社区赢了，商业化却还在反复横跳", detail: "小绿洲和福利社相继关闭，说明用户增长不能自动推导出商业模型。这里应该整段看，因为动作、反复和结果共同构成了案例。", highlights: [{ startSeconds: 3461, text: "2023年10月，只做了一年多的小绿洲直接关闭，坚持了很多年的福利社其实是在这一年彻底关闭的。小红书这些年方向上你就能看到它的飘忽不定。" }, { startSeconds: 3461, text: "社区蒸蒸日上，各方面都很乐观。男性用户变多日活月活疯狂增长" }, { startSeconds: 3461, text: "但是商业化角度来说，你别说外界了，内部大家都有点迷糊，也不知道该怎么办。" }] },
      { startSeconds: 3851, title: "社区生产数据库，搜索负责把价值取出来", detail: "这是非常完整的产品飞轮：低门槛分享沉淀真实经验，搜索承接具体意图，再用反馈鼓励下一次分享。", highlights: [{ startSeconds: 3851, text: "数据库是社区变成了生产这些内容的机制，而搜索是调取这些数据的入口。" }] },
      { startSeconds: 9340, title: "时间戳评论不是装饰，是音频社区的最小连接器", detail: "它把孤独的线性收听变成了围绕同一秒发生的讨论。功能很小，却直接改变用户对“这里有没有人在一起”的感知。", highlights: [{ startSeconds: 9340, text: "时间戳评论它跟那个弹幕对于视频的意义是一样的，异曲同工了。它变成了在音频领域非常核心的一个功能，让大家能够基于某个时间点去做评论。" }] },
    ],
    ai: [
      { startSeconds: 3851, title: "这段不是讲 AI，却把数据飞轮讲明白了", detail: "模型能力之外，真正稀缺的是持续产生真实经验的数据机制。社区负责生产，搜索负责召回——这比“接个大模型”更接近 AI 产品的地基。", highlights: [{ startSeconds: 3851, text: "数据库是社区变成了生产这些内容的机制，而搜索是调取这些数据的入口。" }] },
      { startSeconds: 4023, title: "推荐系统干的不是搬家，是重做信息分发", detail: "“重新发明贴吧和论坛”这句话够狠：同样是兴趣社区，算法把用户从主动逛板块改成了被动获得匹配内容，产品形态因此重写。", highlights: [{ startSeconds: 4023, text: "小红书用推荐算法重新发明了贴吧和论坛。" }] },
      { startSeconds: 7757, title: "算法把人留下，评论区才把人变成社区", detail: "推荐负责命中兴趣，热评负责制造共同语境。只优化点击率会得到内容流，加入人与人的反馈才可能长出社区。", highlights: [{ startSeconds: 7757, text: "因为他的推荐算法做的太好了。" }, { startSeconds: 7757, text: "内涵段子的评论区当时也非常热闹，甚至成为了整个内涵段子的重要组成部分。" }] },
      { startSeconds: 9144, title: "订阅会刷完，推荐流不会：留存机制的残酷差别", detail: "这是 Feed 产品最朴素也最致命的机制差异。对 Agent 或 AI 信息产品同样成立：用户完成任务后，凭什么还会回来？", highlights: [{ startSeconds: 9144, text: "但工具它有一个问题，因为它是订阅逻辑，它跟今日头条它不一样，它是可以刷完了就推荐算法。" }, { startSeconds: 9144, text: "今日头条、抖音无限流妈的费的流可以无限刷。但订阅是你关心的东西，你可能就关心这几件事儿，你刷完了也就给他关了怎么办？" }] },
    ],
  });

  let activeTabId = 0;
  let episode = null;
  let activePlatformId = "";
  let settings = null;
  let lastMode = "full";
  let transcriptSegments = [];
  let activeView = "transcript";
  let playbackTimer = null;
  let activeTranscriptIndex = -1;
  let autoFollowPausedUntil = 0;
  let lastAutoScrollAt = 0;
  let currentDigest = null;
  let showIntro = false;
  let activeChapterIndex = -1;
  let activeRailIndex = -1;
  let selectedCompanion = "";
  let selectedCompanionColor = COMPANIONS.custom.color;
  let companionNotesState = [];
  let transcriptLang = "source";
  let transcriptTranslating = false;

  function transcriptTargetLabel(lang) {
    return { "zh-CN": "中文", en: "英文", "zh-en": "中英双语" }[lang] || "中文";
  }

  async function translateTranscript(lang) {
    if (!transcriptSegments.length) return showToast("还没有原文");
    if (!settings?.aiApiKey) return showToast("先在设置中填写 DeepSeek API Key");
    transcriptLang = lang;
    updateLangButton();
    if (lang === "source") { renderTranscript(); return; }
    if (transcriptTranslating) return;
    const contentStart = detectedContentStart();
    const body = transcriptSegments.filter((segment) => segment.startSeconds >= contentStart);
    const uncached = body.filter((segment) => segment.translatedLang !== lang);
    if (!uncached.length) { renderTranscript(); return; }
    transcriptTranslating = true;
    byId("readingDock").classList.add("translating");
    try {
      for (let i = 0; i < uncached.length; i += 1) {
        const segment = uncached[i];
        const target = lang === "zh-en" ? "中英双语（先给原文，再给对照译文）" : transcriptTargetLabel(lang);
        try {
          const res = await callDeepSeek(`你是翻译编辑。把下面这段播客原文翻译成${target}。只返回 JSON：{"translation":"译文"}。不要解释；保留人名、公司名、产品名、数字与专有名词。`, segment.text, 3000);
          segment.translatedText = text(res?.translation, 4000);
          segment.translatedLang = lang;
        } catch (_e) { /* 单段失败跳过，保留原文 */ }
      }
    } finally {
      transcriptTranslating = false;
      byId("readingDock").classList.remove("translating");
      renderTranscript();
      showToast(`已翻译原文（${transcriptTargetLabel(lang)}）`);
    }
  }

  async function regenerateTranslation() {
    if (!transcriptSegments.length) return showToast("还没有原文");
    if (transcriptLang === "source") return showToast("当前是原文，未翻译");
    for (const segment of transcriptSegments) { delete segment.translatedText; delete segment.translatedLang; }
    await translateTranscript(transcriptLang);
  }
  const annotationVisibility = { case: true, quote: true, companion: true };
  let readerNotes = [];
  let activeSelection = null;
  let toastTimer = null;
  let cloudAuth = null;
  let userProfile = { nickname: "小澍", avatarDataUrl: "" };
  let isTranscribing = false;
  let historyEntries = [];
  let historySourceFilter = "all";
  let historyFavoriteOnly = false;
  let historyPageOpen = false;
  let historyReturnView = "transcript";
  let activeSummaryView = "insights";

  const byId = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function createActionIcon(kind) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("ui-action-icon");
    const iconPaths = {
      note: ["M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16v4", "m13.5 6.5 4 4"],
      source: ["M14 3v4a1 1 0 0 0 1 1h4", "M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z", "M9 13h6M9 17h6"],
      summary: ["M13 5h8M13 9h5M13 15h8M13 19h5", "M5 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M5 17m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0"],
      delete: ["M5 7h14", "M9 7V4h6v3", "M7 7l1 13h8l1-13", "M10 11v5M14 11v5"],
      refresh: ["M4 12a8 8 0 1 0 2.3-5.6L4 8", "M4 4v4h4"],
      star: ["m12 3.2 2.72 5.52 6.1.89-4.41 4.3 1.04 6.07L12 17.27 6.55 20.14l1.04-6.07-4.41-4.3 6.1-.89z"],
      back: ["M19 12H5", "m11 18-6-6 6-6"],
    };
    const paths = iconPaths[kind] || iconPaths.source;
    for (const value of paths) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", value);
      svg.appendChild(path);
    }
    return svg;
  }

  function appleCompanionColor(value) {
    const color = String(value || "").toLowerCase();
    return ({ "#ffd7df": "#ff2d55", "#cfe5ff": "#007aff", "#d8efc5": "#00c7be", "#ffe48a": "#af52de", "#00a7a0": "#00c7be" })[color] || (/^#[0-9a-f]{6}$/i.test(color) ? color : "#af52de");
  }

  function text(value, max = 20000) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
  }

  function clampSeconds(value, duration = Number.MAX_SAFE_INTEGER) {
    return Math.min(Math.max(0, Math.round(Number(value) || 0)), duration || Number.MAX_SAFE_INTEGER);
  }

  function formatTime(value) {
    const seconds = clampSeconds(value);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }

  function normalizeTranscript(payload) {
    const source = Array.isArray(payload) ? payload : payload?.content;
    if (typeof source === "string") return [{ startSeconds: 0, durationSeconds: 0, text: text(source, 1000000) }];
    if (!Array.isArray(source)) return [];
    return source.map((item) => {
      if (typeof item === "string") return { startSeconds: 0, durationSeconds: 0, text: text(item, 50000) };
      const offset = item?.startSeconds ?? item?.offset ?? item?.startMs ?? item?.start ?? item?.startTime ?? 0;
      const duration = item?.durationSeconds ?? item?.duration ?? item?.durationMs ?? 0;
      const usesMilliseconds = Object.hasOwn(item || {}, "offset") || Object.hasOwn(item || {}, "startMs") || Object.hasOwn(item || {}, "durationMs") || Number(offset) > 100000 || Number(duration) > 10000;
      const speakerId = text(item?.speakerId ?? item?.speaker_id, 30);
      const speaker = text(item?.speaker, 50);
      return {
        startSeconds: Math.max(0, Number(offset) || 0) / (usesMilliseconds ? 1000 : 1),
        durationSeconds: Math.max(0, Number(duration) || 0) / (usesMilliseconds ? 1000 : 1),
        ...(speakerId ? { speakerId } : {}),
        ...(speaker ? { speaker } : {}),
        text: text(item?.text, 50000),
      };
    }).filter((item) => item.text);
  }

  function paragraphizeTranscript(segments, targetChars = 180) {
    const paragraphs = [];
    let current = null;
    const flush = () => {
      if (!current?.text) return;
      paragraphs.push(current);
      current = null;
    };
    for (const segment of segments) {
      const clean = text(segment.text, 50000).replace(/\s+/g, " ");
      if (!clean) continue;
      const startSeconds = Math.max(0, Number(segment.startSeconds) || 0);
      const durationSeconds = Math.max(0, Number(segment.durationSeconds) || 0);
      if (!current) {
        current = { startSeconds, durationSeconds, text: clean };
      } else {
        const currentEnd = current.startSeconds + current.durationSeconds;
        const closeInTime = !current.durationSeconds || startSeconds - currentEnd < 4;
        const shouldJoin = closeInTime && current.text.length < targetChars && !/[。！？!?…][”’」』）)]?$/.test(current.text);
        if (!shouldJoin) flush();
        if (!current) current = { startSeconds, durationSeconds, text: clean };
        else {
          current.text += /[\u3400-\u9fff，。！？；：]$/.test(current.text) ? clean : ` ${clean}`;
          current.durationSeconds = Math.max(current.durationSeconds, startSeconds + durationSeconds - current.startSeconds);
        }
      }
      if (current.text.length >= targetChars * 1.6) flush();
    }
    flush();
    return paragraphs;
  }

  function groupTranscript(segments, maxChars = 14000) {
    const groups = [];
    let current = "";
    for (const segment of segments) {
      const line = `[${formatTime(segment.startSeconds)}] ${segment.text.replace(/\s+/g, " ")}\n`;
      if (current && current.length + line.length > maxChars) {
        groups.push(current.trim());
        current = "";
      }
      if (line.length > maxChars) {
        for (let i = 0; i < line.length; i += maxChars) groups.push(line.slice(i, i + maxChars));
      } else {
        current += line;
      }
    }
    if (current.trim()) groups.push(current.trim());
    return groups;
  }

  function groupTranscriptForAnnotations(segments, maxChars = 14000) {
    const groups = [];
    let current = "";
    segments.forEach((segment, segmentIndex) => {
      const speaker = text(segment.speaker, 50);
      const line = `[S${segmentIndex}|${formatTime(segment.startSeconds)}] ${speaker ? `${speaker}：` : ""}${segment.text.replace(/\s+/g, " ")}\n`;
      if (current && current.length + line.length > maxChars) {
        groups.push(current.trim());
        current = "";
      }
      current += line;
    });
    if (current.trim()) groups.push(current.trim());
    return groups;
  }

  function locatePhrase(source, phrase) {
    const original = String(source || "");
    const needle = String(phrase || "").trim();
    if (!needle) return null;
    const exact = original.indexOf(needle);
    if (exact >= 0) return { start: exact, end: exact + needle.length };
    const compact = (value, withMap = false) => {
      let valueOut = "";
      const map = [];
      [...value].forEach((char, index) => {
        if (/\s/.test(char)) return;
        valueOut += char;
        if (withMap) map.push(index);
      });
      return { value: valueOut, map };
    };
    const haystack = compact(original, true);
    const compactNeedle = compact(needle).value;
    const start = haystack.value.indexOf(compactNeedle);
    if (start < 0 || !compactNeedle) return null;
    return { start: haystack.map[start], end: haystack.map[start + compactNeedle.length - 1] + 1 };
  }

  function maxAutoSkipSeconds(duration = 0) {
    const seconds = Math.max(0, Number(duration) || 0);
    return seconds > 0 ? Math.min(12 * 60, seconds * .12) : 12 * 60;
  }

  function sanitizeContentStart(value, duration = 0) {
    const seconds = clampSeconds(value, duration > 0 ? duration : Number.MAX_SAFE_INTEGER);
    return seconds > 0 && seconds <= maxAutoSkipSeconds(duration) ? seconds : 0;
  }

  function inferIntroContentStart(notes, duration = 0) {
    const cap = maxAutoSkipSeconds(duration);
    const candidates = (Array.isArray(notes) ? notes : [])
      .filter((note) => note?.type === "skip")
      .map((note) => ({ start: Math.max(0, Number(note?.startSeconds) || 0), end: Math.max(0, Number(note?.endSeconds) || 0) }))
      .filter((item) => item.end > item.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    let cursor = 0;
    for (const item of candidates) {
      // 只接受从节目开头连续出现的片头；末尾广告绝不能反推正文起点。
      if (item.start > Math.max(60, cursor + 45)) break;
      // 超过比例或绝对时长上限时不做任何自动跳过，而不是武断截断。
      if (item.end > cap) return 0;
      cursor = Math.max(cursor, item.end);
    }
    return sanitizeContentStart(cursor, duration);
  }

  function normalizeDigest(raw, duration = 0) {
    const limit = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    const array = (value, max) => Array.isArray(value) ? value.slice(0, max) : [];
    const sections = Array.isArray(raw?.overview?.sections) ? raw.overview.sections : Array.isArray(raw?.sections) ? raw.sections : [];
    return {
      quickRead: text(raw?.quickRead, 8000),
      overview: {
        opening: text(raw?.overview?.opening || raw?.opening, 600),
        sections: sections.slice(0, 6).map((item) => ({
          heading: text(item?.heading, 120),
          points: array(item?.points, 8).map((point) => text(point, 400)).filter(Boolean),
        })).filter((item) => item.heading),
      },
      contentStartSeconds: sanitizeContentStart(raw?.contentStartSeconds, duration),
      chapters: array(raw?.chapters, 30).map((item) => ({
        startSeconds: clampSeconds(item?.startSeconds, limit),
        title: text(item?.title, 150),
        summary: text(item?.summary, 1600),
        detail: text(item?.detail || item?.summary, 3500),
        points: array(item?.points, 8).map((point) => text(point, 800)).filter(Boolean),
      })).filter((item) => item.title).sort((a, b) => a.startSeconds - b.startSeconds),
    };
  }

  async function readJson(response, service) {
    const bodyText = await response.text();
    let body = {};
    try { body = bodyText ? JSON.parse(bodyText) : {}; } catch (_error) {}
    if (!response.ok) {
      const detail = body?.error?.message || (typeof body?.error === "string" ? body.error : "") || body?.message || bodyText.slice(0, 500);
      const error = new Error(`${service} 请求失败（${response.status}）${detail ? `：${detail}` : ""}`);
      error.status = response.status;
      error.service = service;
      throw error;
    }
    return body;
  }

  async function requestSupadataTranscript(audioUrl, onProgress = () => {}) {
    const query = new URLSearchParams({ url: audioUrl, mode: "generate", text: "false", chunkSize: "500" });
    const response = await fetch(`${SUPADATA_URL}?${query}`, { headers: { "x-api-key": settings.supadataApiKey } });
    const body = await readJson(response, "Supadata");
    if (response.status !== 202 && (Array.isArray(body?.content) || typeof body?.content === "string")) return normalizeTranscript(body);
    const jobId = body?.jobId || body?.job_id || body?.id;
    if (!jobId) throw new Error("Supadata 没有返回逐字稿或任务 ID。");
    for (let attempt = 1; attempt <= MAX_POLLS; attempt += 1) {
      onProgress(`音频较长，正在等待转写完成（已等待约 ${Math.floor(attempt * POLL_INTERVAL_MS / 60000)} 分钟）`);
      await sleep(POLL_INTERVAL_MS);
      const pollResponse = await fetch(`${SUPADATA_URL}/${encodeURIComponent(jobId)}`, { headers: { "x-api-key": settings.supadataApiKey } });
      const poll = await readJson(pollResponse, "Supadata");
      if (Array.isArray(poll?.content) || typeof poll?.content === "string") return normalizeTranscript(poll);
      if (["failed", "error", "cancelled"].includes(String(poll?.status || "").toLowerCase())) throw new Error(`转写失败：${poll?.error || poll?.message || "未知原因"}`);
    }
    throw new Error("转写等待超过 30 分钟，请稍后重试。Supadata 可能仍在后台处理。 ");
  }

  // YouTube 不转写音频，直接从官方字幕取稿（Supadata 已封装 pot/时间轴细节）。
  // 返回结构与播客转写一致（content[].offset/duration 为毫秒），复用 normalizeTranscript。
  async function requestYoutubeTranscript(videoId, onProgress = () => {}) {
    onProgress("正在读取视频字幕…");
    const query = new URLSearchParams({ videoId });
    const response = await fetch(`${SUPADATA_YOUTUBE_TRANSCRIPT_URL}?${query}`, { headers: { "x-api-key": settings.supadataApiKey } });
    const body = await readJson(response, "Supadata");
    const content = Array.isArray(body?.content) ? body.content : Array.isArray(body?.transcript) ? body.transcript : null;
    if (content && content.length) return normalizeTranscript({ content });
    if (typeof body?.text === "string" && body.text.trim()) return normalizeTranscript({ content: [{ text: body.text, offset: 0, duration: 0 }] });
    throw new Error(body?.error || body?.message || "Supadata 没有返回该视频的字幕。");
  }

  async function cloudRequest(path, options = {}) {
    const baseUrl = settings?.syncBaseUrl || XYD_SETTINGS.DEFAULTS.syncBaseUrl;
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (cloudAuth?.token) headers.Authorization = `Bearer ${cloudAuth.token}`;
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    return readJson(response, "同步服务");
  }

  function renderAuthState() {
    const button = byId("loginBtn");
    const signedIn = Boolean(cloudAuth?.token);
    const profileOpen = signedIn && !byId("profileView")?.hidden;
    button.replaceChildren();
    if (profileOpen) {
      const back = createActionIcon("back");
      back.classList.add("topbar-back-icon");
      const label = document.createElement("span");
      label.textContent = "返回";
      button.append(back, label);
    } else if (signedIn) {
      const avatar = document.createElement("img");
      avatar.className = "topbar-avatar";
      avatar.src = userProfile.avatarDataUrl || "IP.png";
      avatar.alt = "";
      const label = document.createElement("span");
      label.textContent = "我的";
      button.append(avatar, label);
    } else button.textContent = "登录";
    button.classList.toggle("signed-in", signedIn);
    button.classList.toggle("profile-return", profileOpen);
    button.setAttribute("aria-label", profileOpen ? "返回博客页面" : signedIn ? "打开我的页面" : "登录");
    byId("profileEmail").textContent = signedIn ? text(cloudAuth.email, 200) : "";
    byId("profileAccountEmail").textContent = signedIn ? text(cloudAuth.email, 200) : "";
    byId("profileGreeting").textContent = `Hi~ ${userProfile.nickname || "小澍"}`;
    byId("profileNickname").value = userProfile.nickname || "小澍";
    byId("profileAvatarPreview").src = userProfile.avatarDataUrl || "IP.png";
    byId("authEmail").value = signedIn ? text(cloudAuth.email, 200) : byId("authEmail").value;
    byId("authPassword").hidden = signedIn;
    byId("authPassword").closest("label").hidden = signedIn;
    byId("loginSubmitBtn").hidden = signedIn;
    byId("registerBtn").hidden = signedIn;
    byId("logoutBtn").hidden = !signedIn;
    byId("authTitle").textContent = signedIn ? "账号已登录" : "登录小黄笔";
  }

  async function saveUserProfile(next) {
    userProfile = {
      nickname: text(next?.nickname || userProfile.nickname || "小澍", 20).trim() || "小澍",
      avatarDataUrl: /^data:image\/(?:png|jpeg|webp);base64,/.test(next?.avatarDataUrl || userProfile.avatarDataUrl || "")
        ? (next?.avatarDataUrl || userProfile.avatarDataUrl)
        : "",
    };
    await chrome.storage.local.set({ [PROFILE_KEY]: userProfile });
    renderAuthState();
  }

  function setProfileSection(section = "account") {
    document.querySelectorAll("[data-profile-panel]").forEach((panel) => { panel.hidden = panel.dataset.profilePanel !== section; });
    document.querySelectorAll("[data-profile-section]").forEach((button) => button.classList.toggle("selected", button.dataset.profileSection === section));
    if (section === "history") loadHistoryEntries().catch(() => showToast("暂时无法读取历史记录"));
  }

  function renderReadingPreferences() {
    byId("profileSummaryLength").value = settings?.summaryLength || "medium";
    byId("profileWritingStyle").value = settings?.writingStyle || "concise";
    const selected = new Set(settings?.focusPreferences || ["viewpoint", "method", "case"]);
    document.querySelectorAll('.focus-chips input[type="checkbox"]').forEach((input) => { input.checked = selected.has(input.value); });
    byId("profileTranscriptPrompt").value = settings?.transcriptPrompt || "";
    byId("profileSummaryPrompt").value = settings?.summaryPrompt || "";
    byId("profileHighlightPrompt").value = settings?.highlightPrompt || "";
    byId("profileCompanionPrompt").value = settings?.companionPrompt || "";
    if (document.getElementById("promptPreviewPassage")) byId("promptPreviewPassage").textContent = PROMPT_PREVIEW_PASSAGE;
    renderAllPromptAssemblies();
  }

  async function saveReadingPreferences() {
    const focusPreferences = Array.from(document.querySelectorAll('.focus-chips input[type="checkbox"]:checked')).map((input) => input.value);
    settings = XYD_SETTINGS.normalize({ ...settings, summaryLength: byId("profileSummaryLength").value, writingStyle: byId("profileWritingStyle").value, focusPreferences, transcriptPrompt: byId("profileTranscriptPrompt").value, summaryPrompt: byId("profileSummaryPrompt").value, highlightPrompt: byId("profileHighlightPrompt").value, companionPrompt: byId("profileCompanionPrompt").value });
    await chrome.storage.local.set({ [XYD_SETTINGS.STORAGE_KEY]: settings });
    renderAllPromptAssemblies();
    byId("preferenceSaved").textContent = "已自动保存";
    setTimeout(() => { byId("preferenceSaved").textContent = ""; }, 1600);
  }

  function setAuthSheet(open) {
    byId("authSheet").hidden = !open;
    byId("authMessage").hidden = true;
    renderAuthState();
    if (open && !cloudAuth?.token) setTimeout(() => byId("authEmail").focus(), 0);
  }

  async function authenticateCloud(mode) {
    const email = text(byId("authEmail").value, 200).toLowerCase();
    const password = String(byId("authPassword").value || "");
    const message = byId("authMessage");
    message.hidden = true;
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      message.textContent = "请输入正确邮箱和至少 8 位密码";
      message.hidden = false;
      return;
    }
    try {
      const result = await cloudRequest(`/v1/auth/${mode}`, { method: "POST", body: JSON.stringify({ email, password }) });
      cloudAuth = { token: text(result?.token, 1000), email: text(result?.user?.email || email, 200), userId: text(result?.user?.id, 100) };
      if (!cloudAuth.token) throw new Error("登录服务没有返回凭证");
      await chrome.storage.local.set({ [XYD_SETTINGS.AUTH_KEY]: cloudAuth });
      byId("authPassword").value = "";
      renderAuthState();
      setAuthSheet(false);
      showToast(mode === "register" ? "账号已创建" : "已登录");
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : String(error);
      message.hidden = false;
    }
  }

  async function logoutCloud() {
    cloudAuth = null;
    await chrome.storage.local.remove(XYD_SETTINGS.AUTH_KEY);
    byId("authEmail").value = "";
    renderAuthState();
    setAuthSheet(false);
    setProfilePage(false);
    showToast("已退出登录");
  }

  function setProfilePage(open) {
    if (!cloudAuth?.token && open) return setAuthSheet(true);
    historyPageOpen = Boolean(open);
    document.body.classList.toggle("profile-open", Boolean(open));
    byId("profileView").hidden = !open;
    renderAuthState();
    if (open) { setProfileSection("account"); renderReadingPreferences(); }
    if (open) stopPlaybackTracking();
    for (const id of ["emptyState", "episodeCard", "viewTabs", "summaryView", "transcriptView", "notesView"]) {
      const element = byId(id);
      if (!element) continue;
      element.hidden = open || (id === "emptyState" ? Boolean(episode) : id === "episodeCard" || id === "viewTabs" ? !episode : true);
    }
    if (!open) {
      byId("profileView").hidden = true;
      if (episode) { setHidden("episodeCard", false); setHidden("viewTabs", false); switchView(activeView); }
      else setHidden("emptyState", false);
    }
  }

  async function requestAliyunTranscript(audioUrl, onProgress = () => {}, force = false) {
    const created = await cloudRequest("/v1/asr/jobs", {
      method: "POST",
      headers: {
        "x-dashscope-key": settings.dashscopeApiKey,
        "x-dashscope-base-url": settings.dashscopeBaseUrl,
      },
      body: JSON.stringify({ episodeId: episode.id, audioUrl, model: "qwen-audio-3.0-asr-flash-filetrans", force, title: episode.title, podcast: episode.podcast, description: episode.description }),
    });
    const jobId = created?.jobId;
    if (!jobId) throw new Error("转写服务没有返回任务 ID。");
    let received = 0;
    isTranscribing = true;
    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
      await sleep(attempt ? 2500 : 400);
      const job = await cloudRequest(`/v1/asr/jobs/${encodeURIComponent(jobId)}`);
      const partial = normalizeTranscript(job?.segments || []);
      if (partial.length > received) {
        received = partial.length;
        await setTranscript(partial, true);
        onProgress(`已完成 ${job.completedChunks || 0}/${job.totalChunks || "…"} 段，后面的内容会继续补上。`);
        switchView("transcript");
      }
      if (job?.status === "completed") {
        isTranscribing = false;
        renderTranscript();
        return partial;
      }
      if (["failed", "cancelled"].includes(job?.status)) throw new Error(job?.error || "阿里云转写失败。");
    }
    isTranscribing = false;
    throw new Error("转写等待超时，任务会留在历史记录中继续处理。");
  }

  function currentPlatformId() {
    if (activePlatformId) return activePlatformId;
    // 兜底：不要用被去掉查询串的 episode.pageUrl（YouTube 会被剥掉 ?v=ID）。
    const probe = episode?.pageUrl || "";
    const platform = XYD_PLATFORM?.detectPlatform?.(probe);
    return platform ? platform.id : "xiaoyuzhou";
  }

  function requestTranscript(audioUrl, onProgress = () => {}, force = false) {
    if (currentPlatformId() === "youtube") {
      return requestYoutubeTranscript(episode?.id, onProgress);
    }
    return settings?.asrProvider === "supadata"
      ? requestSupadataTranscript(audioUrl, onProgress)
      : requestAliyunTranscript(audioUrl, onProgress, force);
  }

  async function seedBackendTranscriptCache() {
    if (!episode?.id || !transcriptSegments.length || !settings?.syncBaseUrl) return;
    try {
      await cloudRequest("/v1/asr/cache", {
        method: "PUT",
        body: JSON.stringify({
          episodeId: episode.id,
          audioUrl: episode.audioUrl,
          model: "qwen-audio-3.0-asr-flash-filetrans",
          segments: transcriptSegments,
        }),
      });
    } catch (_error) {}
  }

  function extractJson(value) {
    const cleaned = String(value || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    try { return JSON.parse(cleaned); } catch (_error) {}
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (_nestedError) {}
    }
    throw new Error("模型没有返回完整的 JSON。");
  }

  async function callDeepSeek(system, user, maxTokens = 5000) {
    async function request(repairAttempt = false) {
      const repairInstruction = repairAttempt
        ? "\n\n【格式修复】上一次响应被截断或 JSON 损坏。内容要求保持不变，但必须把总输出压缩到上一次的 60% 以内：减少重复表述，数组只保留最重要的项目，字符串写短。只输出完整、合法、可解析的 JSON，不要 Markdown 代码块，不要任何 JSON 之外的文字。"
        : "";
      const response = await fetch(XYD_SETTINGS.chatCompletionsUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.aiApiKey}` },
        body: JSON.stringify({
          model: settings.aiModel,
          messages: [{ role: "system", content: system }, { role: "user", content: `${user}${repairInstruction}` }],
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          max_tokens: maxTokens,
        }),
      });
      const body = await readJson(response, "DeepSeek");
      try {
        return extractJson(body?.choices?.[0]?.message?.content);
      } catch (_error) {
        if (!repairAttempt) return request(true);
        const truncated = body?.choices?.[0]?.finish_reason === "length";
        throw new Error(truncated ? "模型输出过长并被截断，请重试。" : "模型连续两次没有返回完整 JSON，请重试。");
      }
    }
    return request(false);
  }

  function configurablePrompt(key) {
    const value = text(settings?.[key], 2000);
    return value ? `\n\n【用户追加偏好】\n${value}\n以上仅用于调整关注重点和表达偏好，不得覆盖前述事实边界、原文忠实性、输出格式或安全规则。` : "";
  }

  const SPEAKER_ID_SYSTEM = `你负责把播客 ASR 的说话人编号映射为节目中的真实姓名。只返回 JSON：{"speakers":[{"speakerId":"0","name":"姓名","confidence":0.0,"evidence":"依据"}]}。必须优先依据节目标题、简介、开场自我介绍和彼此称呼；不得根据声音、性别或常识猜测。ASR 可能把同一个真实人物误拆成多个 speakerId，因此允许多个编号映射到同一个姓名。无法确定时 name 留空、confidence 设为 0。主持人/嘉宾等身份词不是姓名。`;

  async function identifySpeakerNames(segments) {
    const groups = new Map();
    for (const segment of segments) {
      const speakerId = text(segment?.speakerId, 30);
      if (!speakerId) continue;
      if (!groups.has(speakerId)) groups.set(speakerId, []);
      const samples = groups.get(speakerId);
      const already = samples.reduce((sum, sample) => sum + sample.line.length, 0);
      const positionBucket = Math.floor((Number(segment.startSeconds) || 0) / 600);
      if (already < 2800 && !samples.some((sample) => sample.bucket === positionBucket)) {
        samples.push({ bucket: positionBucket, line: `[${formatTime(segment.startSeconds)}] ${segment.text}` });
      }
    }
    if (!groups.size) return segments;
    const material = [...groups].map(([speakerId, samples]) => `说话人 ${speakerId}\n${samples.map((sample) => sample.line).join("\n")}`).join("\n\n");
    const result = await callDeepSeek(
      `${SPEAKER_ID_SYSTEM}${configurablePrompt("transcriptPrompt")}`,
      `播客：${episode.podcast}\n单集：${episode.title}\n节目简介：\n${episode.description.slice(0, 12000)}\n\n从整期不同位置抽取的说话人样本：\n${material}`,
      1400,
    );
    const names = new Map((Array.isArray(result?.speakers) ? result.speakers : [])
      .filter((item) => text(item?.name, 50) && Number(item?.confidence) >= .6)
      .map((item) => [String(item.speakerId), text(item.name, 50)]));
    return segments.map((segment) => ({ ...segment, speaker: names.get(String(segment.speakerId)) || segment.speaker || (segment.speakerId ? `说话人 ${Number(segment.speakerId) + 1}` : "") }));
  }

  function transcriptCorrectionBatches(segments, maxChars = 4500) {
    const batches = [];
    let current = [];
    let size = 0;
    segments.forEach((segment, index) => {
      const item = {
        i: index,
        t: formatTime(segment.startSeconds),
        speaker: segment.speaker || (segment.speakerId ? `说话人 ${Number(segment.speakerId) + 1}` : ""),
        text: text(segment.text, 50000),
      };
      const itemSize = JSON.stringify(item).length;
      if (current.length && size + itemSize > maxChars) {
        batches.push(current);
        current = [];
        size = 0;
      }
      current.push(item);
      size += itemSize;
    });
    if (current.length) batches.push(current);
    return batches;
  }

  function safeCorrectedText(original, corrected) {
    const before = text(original, 50000);
    const after = text(corrected, 50000).replace(/\s+/g, " ");
    if (!after || after.length < Math.max(2, before.length * .55) || after.length > Math.max(40, before.length * 1.7)) return before;
    return after;
  }

  async function correctTranscriptWithAgent(segments) {
    const corrected = segments.map((segment) => ({ ...segment, rawText: text(segment.rawText || segment.text, 50000) }));
    const batches = transcriptCorrectionBatches(corrected);
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      updateProgress(`正在校对逐字稿 ${batchIndex + 1}/${batches.length}`, "修正专名、同音错字和明显断句错误，时间戳保持不变。");
      try {
        const result = await callDeepSeek(
          `你是中文播客逐字稿校对编辑。只返回 JSON：{"items":[{"i":0,"text":"校对后的原话"}]}。
规则：
1. i 必须原样返回，不能增加、删除或重排条目。
2. 保留说话人的原意、口语风格、语气词和有意义的重复；这是逐字稿，不是摘要或改写。
3. 只修正能从上下文确定的同音错字、节目名、人名、品牌名、数字写法、标点和明显被拆坏的句子。
4. 不凭常识杜撰专名；不确定时保留原文。
5. 不合并不同说话人的内容，不输出解释。${configurablePrompt("transcriptPrompt")}`,
          `节目：${episode.title}\n播客：${episode.podcast}\n节目简介：${episode.description.slice(0, 6000)}\n\n待校对片段：\n${JSON.stringify(batches[batchIndex])}`,
          4200,
        );
        const updates = new Map((Array.isArray(result?.items) ? result.items : [])
          .filter((item) => Number.isInteger(Number(item?.i)))
          .map((item) => [Number(item.i), item.text]));
        for (const item of batches[batchIndex]) {
          if (!updates.has(item.i)) continue;
          corrected[item.i].text = safeCorrectedText(corrected[item.i].text, updates.get(item.i));
        }
      } catch (_error) {
        // 单批格式异常时保留 ASR 原文，不能让整期逐字稿和后续摘要一起失败。
      }
    }
    return corrected;
  }

  function splitTranscriptSegment(segment, targetChars = 220) {
    const value = text(segment.text, 50000);
    if (value.length <= targetChars * 1.45) return [{ ...segment, text: value }];
    const sentences = value.match(/[^。！？!?；;]+[。！？!?；;]?/g)?.map((item) => item.trim()).filter(Boolean) || [value];
    const groups = [];
    let current = "";
    for (const sentence of sentences) {
      if (current && current.length + sentence.length > targetChars) {
        groups.push(current);
        current = "";
      }
      current += sentence;
    }
    if (current) groups.push(current);
    if (groups.length === 1) return [{ ...segment, text: value }];
    let consumed = 0;
    return groups.map((group) => {
      const ratio = value.length ? consumed / value.length : 0;
      const lengthRatio = value.length ? group.length / value.length : 1;
      consumed += group.length;
      return {
        ...segment,
        startSeconds: segment.startSeconds + segment.durationSeconds * ratio,
        durationSeconds: segment.durationSeconds * lengthRatio,
        text: group,
      };
    });
  }

  function formalParagraphizeTranscript(segments, targetChars = 220) {
    const source = segments.flatMap((segment) => splitTranscriptSegment(segment, targetChars));
    const paragraphs = [];
    let current = null;
    const flush = () => {
      if (current?.text) paragraphs.push(current);
      current = null;
    };
    for (const segment of source) {
      const clean = text(segment.text, 50000).replace(/\s+/g, " ");
      if (!clean) continue;
      const next = { ...segment, text: clean };
      if (!current) {
        current = next;
        continue;
      }
      const currentEnd = current.startSeconds + current.durationSeconds;
      const sameSpeaker = String(current.speakerId || current.speaker || "") === String(next.speakerId || next.speaker || "");
      const closeInTime = next.startSeconds - currentEnd < 4.5;
      const completeSentence = /[。！？!?…][”’」』）)]?$/.test(current.text);
      const shouldJoin = sameSpeaker && closeInTime && current.text.length < targetChars && (!completeSentence || current.text.length < targetChars * .48);
      if (!shouldJoin) {
        flush();
        current = next;
        continue;
      }
      current.text += /[\u3400-\u9fff，。！？；：]$/.test(current.text) ? next.text : ` ${next.text}`;
      current.durationSeconds = Math.max(current.durationSeconds, next.startSeconds + next.durationSeconds - current.startSeconds);
      current.rawText = [current.rawText, next.rawText].filter(Boolean).join(" ");
      if (current.text.length >= targetChars * 1.35) flush();
    }
    flush();
    return paragraphs;
  }

  async function refineTranscriptWithAgents(segments) {
    let named = segments;
    updateProgress("正在确认发言人", "结合节目简介、开场自我介绍和彼此称呼匹配姓名。");
    try { named = await identifySpeakerNames(segments); } catch (_error) {}
    updateProgress("正在整理正式文稿", "按说话人切换、语义完整性和停顿重新分段。");
    return formalParagraphizeTranscript(named);
  }

  const DIGEST_SCHEMA = `只返回 JSON：{"quickRead":"", "contentStartSeconds":0, "chapters":[{"startSeconds":0,"title":"","summary":"","points":[""]}]}`;
  const EDITOR_SYSTEM = `你是中文播客的资深内容编辑。目标是把完整逐字稿整理成可直接阅读、具体而有层次的节目笔记。忠于原文，不补充素材外事实，不写“一句话结论”“本期真正讨论什么”等空泛判断，也不要使用“揭示、深刻、核心本质、值得注意的是”一类模板化 AI 措辞。只在节目开头存在明确的片头音乐、固定寒暄或品牌广告，且随后出现清楚的议题切换时，才把正式内容起点写入 contentStartSeconds；不确定就填0。节目自身的背景、系列缘起、嘉宾介绍若与本期讨论有关，属于正文，不能跳过。末尾广告绝不能作为正文起点。时间必须取自逐字稿。quickRead 应覆盖整期主要脉络，控制在 800–1600 个汉字；按议题自然组织，不要与 chapters 重复，不要把零碎标注简单拼接。只保留节目讲述的事实、事件、论证、案例和观点之间的关系；不要输出产品设计观察、可迁移方法论、收听建议或阅读建议。

quickRead 必须使用真正的 Markdown 层级，不写大段连续正文：
## 议题标题
- 一级要点：概括一个阶段、判断或事件链
  - **背景：** 为什么发生
  - **动作：** 谁做了什么
  - **结果：** 带来了什么变化
  - **分歧：** 不同说法或仍未解决的问题
- 下一个一级要点
每个一级要点下面选择最适合内容的 2–4 个二级要点，不必机械套用全部标签。只使用 ## 标题、- 一级圆点、两个空格加 - 二级圆点；不要输出 ###、序号标题或裸露的 Markdown 符号。

chapters 按真实话题变化划分并覆盖整期正式内容：40分钟以内通常 5–8 章，40–120分钟通常 8–12 章，更长节目最多 16 章。每章 summary 120–240 字，提供 2–4 条 points，每条不超过 120 字，用来补充事件、动作、论据、结果或分歧，不能重复 summary。标题直接描述内容，不使用“第1章”“第一章”等编号。整个 JSON 必须一次完整闭合；宁可压缩措辞，也不允许在数组中途截断。${DIGEST_SCHEMA}`;
  const CHAPTER_EDITOR_SYSTEM = `你是播客章节提炼编辑。看一段带时间戳的逐字稿，按话题整理成 1-3 个章节。
只返回 JSON：{"chapters":[{"startSeconds":0,"title":"","detail":"","points":[""]}]}

这是写好的样子，照着这个形态来（小标题一句话点题，正文一整段连贯叙述，不写"某某说"）：

【写好的样子】
为父则刚，是卸下性别枷锁
杨雨坤新书《为父则刚》英文名是《He only did what a father ought to do》，强调父亲做该做的事，不需要被过度赞美。他25岁结婚生女，当时等美国签证近一年，因使馆关闭和拒签，与妻女分离焦虑到夜夜惊醒。转申请奥地利，看中托育体系（师生比1:3）和育儿补贴，可以亲带女儿。他把「他只是做爸爸该做的事」的评论置顶，反思男性育儿不应被捧杀。

育儿没有标准答案，但有科学原理
他用Excel记录孩子作息，但变化以周为单位永远失效。他崩溃过，和妻子同测抑郁量表自己分数更高。脑科学解释：长期高皮质醇损害前额叶和海马体，导致易怒和「脑雾」；「一孕傻三年」其实是「谁带娃谁傻三年」。爸爸大脑也会因养育发生结构变化。主要抚养人稳定最重要，切换需至少两周过渡。

情绪命名、温柔坚定，胜过恐惧压制
孩子前额叶未成熟，杏仁核主导情绪风暴。家长帮情绪命名能加强前额叶觉察，消解痛苦；恐惧压制则强化杏仁核。温柔坚定是定好规矩、允许崩溃、陪伴缓和，规则稳定比溺爱更有安全感。

（如果这一节信息密度高、是几个并列的观点或事实，就把它写成这样，用圆点分点：
认知的误区
- 吼叫压制只会强化杏仁核，让孩子更情绪化，理性脑发育受阻。
- "一孕傻三年"其实是带娃太累导致皮质醇升高，不是真的变傻，爸爸同样会这样。
- 三岁前稳定环境让突触密度达高峰，安全感比任何早教都重要。）

写标题：一句话点题，像上面的示例那样，**标题里不要出现冒号"："**，也不要写"第1章"、不写"某某说"。如果标题想表达"主题+说明"，直接合成一句通顺的话，不要用冒号隔开。.
写正文：如果这一节讲了**两个或更多并列的信息**（几个观点、几种原因、几类事实、几点建议），就**必须**用圆点分行，每条圆点一行（- 开头）；只讲一件事的来龙去脉才写成一整段。判断标准：能不能拆成"第一点…第二点…第三点"？能，就分圆点；不能，就一整段。
写要点 points：给这一节 2–4 条展开后要详述的要点，每条 40–90 字（2–3 句），比 detail 更深入、更具体（事实、数据、方法、结果、分歧），不重复 detail 的引言式概括，不写"某某说"，不罗列过程。
注意：正文里的引用或书名一律用中文引号「」或《》，**不要用英文双引号**（会破坏 JSON）。`;  const OVERVIEW_EDITOR_SYSTEM = `你是中文播客的速读编辑。根据章节材料写「速读总览」，让读者 30 秒内 get 这期核心。风格像小红书「点点」的笔记。
只返回 JSON：{"opening":"","sections":[{"heading":"","points":["",""]}]}

【opening】1 句话总起：点明是谁、聊了什么、核心结论。不超过 60 字。
【sections】3 个小节，每节：
- heading：一句话点题的标题（不加冒号，不用栏目名）
- points：2-4 条要点，每条一句话；第 1 条给判断/结论，后面的给论据、数据、例子。不要写"某某说"。
【示例】
opening: 这期杨雨坤（奥地利脑科学博士）用亲身经历和脑科学视角聊育儿。**核心是：爱是陪出来的，不是天生的；大脑终身可塑。**
sections:
- heading: 为父则刚，是卸下性别枷锁
  points: [新书叫《为父则刚》，强调父亲做该做的事，不需要被过度赞美, 他25岁结婚生女，等美国签证近一年，因使馆关闭和拒签与妻女分离到夜夜惊醒, 转申请奥地利，看中托育体系（师生比1:3）和育儿补贴，能亲自带女儿]
- heading: 育儿没有标准答案，但有科学原理
  points: [他用Excel记录孩子作息，但变化以周为单位永远失效, 长期高皮质醇损害前额叶和海马体，导致易怒和「脑雾」, 主要抚养人稳定最重要，切换需至少两周过渡]
- heading: 情绪命名、温柔坚定，胜过恐惧压制
  points: [孩子前额叶未成熟，杏仁核主导情绪风暴，帮情绪命名能加强前额叶觉察、消解痛苦, 恐惧压制只会强化杏仁核；温柔坚定是定好规矩、允许崩溃、陪伴缓和, 规则稳定比溺爱更有安全感]

【规则】
- 必须输出完整 1 个 opening + 3 个 sections，只给 opening 不算完成。
- 多举具体的人、年龄、数字、经历；忠于材料，不补充外部事实。
- 只给结论、转折、能改变理解的事实，不罗列过程。
- 不用英文双引号（会破坏 JSON），引用用中文「」或《》。
【去 AI 味】
- 禁止：值得注意的是、深刻揭示了、核心本质、不仅仅是、而且更是、总而言之、一言以蔽之、不难发现、某种意义上、一个值得思考的问题。
- 禁止模板句"不是A而是B""与其说A不如说B""从A到B的转变"。
- 不用——破折号，不用""包裹比喻，不用"这件事"指代。
- 直接陈述，像人说话，不用总结陈词。`;
  const ANNOTATION_EDITOR_SYSTEM = `你是严谨的中文播客精读编辑。你的任务不是把“看起来重要”的词加粗，而是帮助读者找到真正能改变理解的原文。
只返回 JSON：{"notes":[{"segmentIndex":0,"startSeconds":0,"endSeconds":0,"type":"skip|quote|case|fact|method|idea|chapter","title":"","detail":"","highlightText":"","importance":1}]}。

【先识别不该读的内容】
- skip 只用于节目开头连续出现的片头音乐、固定寒暄或明确品牌广告，并且必须有“接下来进入本期议题”一类清楚切换证据。不确定就不要输出 skip。
- 节目自身背景、系列缘起、与议题有关的主持人或嘉宾介绍属于正文，不能 skip。节目末尾的购买渠道、售价、订阅引导不能标成开头 skip。
- 自动跳过不得超过整期时长的12%，也不得超过12分钟；若候选区间超过任一上限，完全不输出 skip。
- skip 内绝不能再产生 quote、case 或 fact。

【金句 quote】
- 必须是说话者明确提出的判断、定义、因果关系、取舍或有解释力的主张；脱离上下文仍基本成立。
- 优先选择“不是A而是B”“因为X所以Y”“真正决定X的是Y”等完整观点。每组2–4条，宁缺毋滥。
- 不选：口号、情绪感叹、普通设问、过渡句、未解释的态度、节目自夸和不完整句。
- 正例：“UGC内容和KOC内容一直都是小红书的核心差异化价值。”
- 反例：“我们决定认真做它，做好它。”只有态度，没有可学习的判断。

【案例 case】
- 是一个可复述的事件或动作链，至少包含“主体+动作”，最好还有背景、约束、结果或后续；可以是一句，也可以是连续数段。
- 必选候选：产品上线/关闭、投放、融资、收购、转型、改版、指标口径变化、失败实验、战略选择及其结果。
- 标题必须说清具体事件，不写“一个案例”“关键动作”。每组4–8条，但不得为凑数选择静态资料。
- 正例：“2014年12月，小红书上线福利社”是关键商业化动作；“投放《偶像练习生》有效，随后继续投《创造101》”是完整增长动作链。
- 反例：嘉宾名单、个人履历、产品名罗列、只有年份而没有动作含义的句子。

【关键事实 fact】
- 数字只有在说明规模、变化、代价、效率、结果或前后比较，并能改变读者理解时才有价值。
- 正例：“2018年融资3亿美元，估值超过30亿美元”；它说明融资规模和阶段。
- 反例：“第一季共八期，目前完成六期”“每集19.9元，打包99.9元”；前者是排期，后者是广告价格，都不标。
- 机制或竞争优势可作为 fact，但必须是清晰事实判断，不能只是宣传词。

【方法论 method】
- 是说话人明确给出的可复用方法、判断标准、做事路径或经验总结，能脱离本集场景迁移使用。
- 正例：“先小范围试一次—看结果—再加注”是连续下注的渠道策略；“社区负责生产内容、搜索负责召回”是数据飞轮的方法。
- 反例：只陈述“我们做了X”而没有方法含义，或单纯的数据结果。

【原文与密度】
- 正文总体目标约25%，这是上限方向而非硬性配额；低价值内容宁可不标。
- highlightText 必须逐字复制4–400字连续原文，不改字、不拼接；case 可覆盖完整段落，quote 只覆盖观点本身。
- 每段开头都有 S 编号。segmentIndex 必须原样返回对应的 S 编号；不允许跨多个 S 段拼接 highlightText。case 需要跨段时拆成多个相邻 case，每段使用自己的 segmentIndex 和同一标题。
- importance 5代表会改变对整期主题的理解，3代表有明确证据价值，1–2不要输出。保留事实，不扩写。`;

  function readingPreferenceInstruction() {
    const length = { short: "摘要从紧，优先保留最重要的内容", medium: "摘要保持中等篇幅和完整脉络", long: "摘要更详细，保留更多论据与上下文" }[settings?.summaryLength] || "摘要保持中等篇幅和完整脉络";
    const style = { concise: "表达简洁专业", conversational: "表达自然易读，像有判断力的朋友做笔记", academic: "表达严谨，明确区分事实、观点与推断" }[settings?.writingStyle] || "表达简洁专业";
    const focusMap = { viewpoint: "观点洞察", method: "可执行方法", case: "案例分析", fact: "数据事实", funny: "有趣表达", controversy: "争议观点" };
    const focus = (settings?.focusPreferences || []).map((key) => focusMap[key]).filter(Boolean);
    const levelMap = { 1: "核心判断/观点/结论", 2: "关键事件/数据/因果", 3: "支撑论据/例子", 4: "背景与细节" };
    const highlightLevels = settings?.highlightLevels?.length ? settings.highlightLevels : [1, 2];
    const boldLevels = settings?.boldLevels?.length ? settings.boldLevels : [1];
    const markText = (levels) => levels.slice().sort((a, b) => a - b).map((level) => `${level}（${levelMap[level] || ""}）`).join("、") || "无";
    const typeMap = { quote: "金句/重要判断", case: "事件/案例", method: "方法论/可复用方法", fact: "数据/事实", custom: "用户自定义关注点" };
    const markTypes = settings?.markTypes?.length ? settings.markTypes : ["quote", "case", "method", "fact"];
    const typeText = markTypes.map((key) => typeMap[key]).filter(Boolean).join("、") || "无";
    const visualText = `按重要性给内容分层（1=${levelMap[1]}，2=${levelMap[2]}，3=${levelMap[3]}，4=${levelMap[4]}）。用黄色荧光笔高亮 ${markText(highlightLevels)} 的内容；用加粗强调 ${markText(boldLevels)} 的内容。重点划线这些类型的内容：${typeText}。只按内容重要度分层，不要为了凑数标注。`;
    const features = settings?.summaryFeatures || {};
    const featureText = [features.highlights !== false ? "突出原文证据、数字与关键动作" : "不额外强调证据", features.bold !== false ? "对关键判断加粗" : "不强制加粗"].join("；");
    const autoTranslate = Boolean(settings?.summaryAutoTranslate);
    const lang = settings?.summaryLanguage || "zh-CN";
    const languageText = autoTranslate
      ? `摘要使用${({ "zh-CN": "简体中文", en: "英文", "zh-en": "中英双语(先中文后英文对照)" })[lang] || "简体中文"}输出。`
      : `摘要跟随原文语言输出（原文是中文就用中文，原文是英文就用英文），不要擅自翻译。`;
    return `读者偏好：${length}；${style}；${featureText}${focus.length ? `；优先关注${focus.join("、")}` : ""}。${visualText}${languageText}偏好只影响排序、形式和篇幅，不能降低事实门槛或遗漏整期主线。`;
  }

  // 提示词透明化：把「内置系统提示词 + 用户追加偏好」拼接成最终发给模型的内容，供「我的 → 阅读偏好」实时预览。
  // 效果预览的测试文段：取自内置节目的真实逐字稿片段，仅用于本地演示，不调用模型。
  const PROMPT_PREVIEW_PASSAGE = "2014年9月，王宁创办了 keep。按照王宁自己的描述，他自己就有亲身经历，大学毕业前因为感情问题，因为个人状态问题开始减肥，半年时间从180斤减到128斤。你看看问题是当时他就发现了，如果一个完全不懂健身的人我忽然突发奇想减肥了。网上当然你可以搜到很多信息，但这些信息完全不成体系，非常碎片。百度贴吧、健身论坛、知乎、视频网站各种各样的，有让你深蹲的，还有让你举铁的，有人让你HIIT的，有给你饮食建议的等等等等。很复杂。";
  const PROMPT_PREVIEW_EPISODE = { podcast: "半拿铁", title: "No.214 互联网产品史", description: "本期聊中国互联网产品史，从社区、商业化到工具与平台。" };
  const PROMPT_STAGES = {
    transcript: { label: "说话人识别", overrideKey: "transcriptPrompt", baseSystem() { return SPEAKER_ID_SYSTEM; }, buildUser() { return `播客：${PROMPT_PREVIEW_EPISODE.podcast}\n单集：${PROMPT_PREVIEW_EPISODE.title}\n节目简介：\n${PROMPT_PREVIEW_EPISODE.description}\n\n从整期不同位置抽取的说话人样本：\n说话人 0\n[22:03] ${PROMPT_PREVIEW_PASSAGE}`; } },
    summary: { label: "摘要提炼", overrideKey: "summaryPrompt", baseSystem() { return EDITOR_SYSTEM; }, buildUser() { return `节目：${PROMPT_PREVIEW_EPISODE.title}\n时长：1:00:00\n${readingPreferenceInstruction()}\n\n节目简介/时间轴：\n${PROMPT_PREVIEW_EPISODE.description}\n\n根据文案做审慎摘要。信息不足时明确说明；不要假装听过音频。`; } },
    highlight: { label: "重点标注", overrideKey: "highlightPrompt", baseSystem() { return ANNOTATION_EDITOR_SYSTEM; }, buildUser() { return `节目：${PROMPT_PREVIEW_EPISODE.title}\n${readingPreferenceInstruction()}\n这是逐字稿的第 1/1 段：\n${PROMPT_PREVIEW_PASSAGE}`; } },
    companion: { label: "共读搭子", overrideKey: "companionPrompt", baseSystem() { return `你是播客共读编辑。${COMPANIONS.product.prompt}\n\n执行规则：\n1. 先通读后按“与角色相关度、信息增量、证据完整度、可复用性”各1–5分在心里排序，只输出总分至少15分的5–12条；不足5条就如实少选。\n2. 笔记要分布在整期正文，但不能为了分布或数量选择广告、名单和空话。\n3. 每条可精确划一句，也可划2–3处相邻或分开的原文。只选支撑旁注的最小充分证据：观点划一句，事件可划完整动作链。\n4. highlights.text 必须是逐字稿中8–400字的连续原文，一字不改；startSeconds 填该原文附近时间。\n5. title 具体、有角色口吻；detail 用2–4句完成“判断—证据—为什么重要”，禁用‘值得关注、很有启发、体现了、揭示了’等空话。\n6. 不得发明人物、数字、因果和立场；广告价格、节目期数、嘉宾名单即使有数字也不得入选。\n只返回 JSON：{"notes":[{"title":"","detail":"","highlights":[{"startSeconds":0,"text":""}]}]}。`; }, buildUser() { return `节目：${PROMPT_PREVIEW_EPISODE.title}\n\n逐字稿：\n[22:03] ${PROMPT_PREVIEW_PASSAGE}`; } },
  };
  const PROMPT_STAGE_TO_ASSEMBLED = { transcript: "profTranscriptAssembled", summary: "profSummaryAssembled", highlight: "profHighlightAssembled", companion: "profCompanionAssembled" };

  // 拼接单个环节的最终系统提示词：内置系统 + 用户追加偏好（与 callDeepSeek 完全一致）。
  function assembledSystemPrompt(stageKey) {
    const stage = PROMPT_STAGES[stageKey];
    if (!stage) return "";
    return stage.baseSystem() + configurablePrompt(stage.overrideKey);
  }

  function renderPromptAssembly(stageKey) {
    const pre = document.getElementById(PROMPT_STAGE_TO_ASSEMBLED[stageKey]);
    if (!pre) return;
    pre.textContent = assembledSystemPrompt(stageKey);
  }

  function renderAllPromptAssemblies() {
    Object.keys(PROMPT_STAGES).forEach(renderPromptAssembly);
  }

  function runPromptPreview() {
    const stageKey = byId("promptPreviewStage").value;
    const stage = PROMPT_STAGES[stageKey];
    if (!stage) return;
    const result = byId("promptPreviewResult");
    result.textContent = `【系统提示词】\n${assembledSystemPrompt(stageKey)}\n\n【用户输入】\n${stage.buildUser()}`;
    result.hidden = false;
    byId("preferenceSaved").textContent = "以上为当前配置下将会发送给模型的完整提示词";
    setTimeout(() => { byId("preferenceSaved").textContent = ""; }, 4000);
  }

  async function quickDigest() {
    updateProgress("正在阅读节目文案", "快速模式不会转写音频。");
    return callDeepSeek(`${EDITOR_SYSTEM}${configurablePrompt("summaryPrompt")}`, `节目：${episode.title}\n时长：${formatTime(episode.duration)}\n${readingPreferenceInstruction()}\n\n节目简介/时间轴：\n${episode.description || "（没有节目文案）"}\n\n根据文案做审慎摘要。信息不足时明确说明；不要假装听过音频。`);
  }

  async function regenerateAnnotations(options = {}) {
    const silent = Boolean(options?.silent);
    const scopedTypes = Array.isArray(options?.types) && options.types.length ? options.types : null;
    const segments = transcriptSegments;
    if (!segments.length) throw new Error("没有可重新整理的逐字稿。");
    const groups = groupTranscriptForAnnotations(segments);
    const notes = [];
    const scopeLabel = { quote: "核心观点/金句", method: "方法论", case: "案例分析/重要事件", fact: "关键数据/事实" };
    const scopeText = scopedTypes ? `\n【本次只输出这些类型】${scopedTypes.map((t) => scopeLabel[t] || t).join("、")}；不要输出其他类型。` : "";
    for (let index = 0; index < groups.length; index += 1) {
      if (!silent) updateProgress(`正在识别重点 ${index + 1}/${groups.length}`, "标记金句、案例和关键事实，为原文加标注。");
      try {
        const result = await callDeepSeek(
          `${ANNOTATION_EDITOR_SYSTEM}${configurablePrompt("highlightPrompt")}${scopeText}`,
          `节目：${episode.title}\n${readingPreferenceInstruction()}\n这是逐字稿的第 ${index + 1}/${groups.length} 段：\n${groups[index]}`,
          3500,
        );
        notes.push(...(Array.isArray(result?.notes) ? result.notes.slice(0, 40) : []));
      } catch (_error) {
        // 某一小段失败不应阻断整期；其余段落仍可生成重点。
      }
    }
    if (scopedTypes) {
      // 重新生成：只重跑并应用这一类，先清掉这一类旧标注，不覆盖其他类型。
      clearGeneratedHighlights(scopedTypes);
      const appliedHighlights = applyGeneratedHighlights(notes, scopedTypes);
      await setTranscript(transcriptSegments, true);
      return { appliedHighlights, densityHighlights: 0, inferredContentStart: 0 };
    }
    const appliedHighlights = applyGeneratedHighlights(notes);
    const inferredContentStart = inferIntroContentStart(notes, episode.duration);
    const densityHighlights = ensureAnnotationDensity(.25, inferredContentStart);
    if (appliedHighlights + densityHighlights > 0) await setTranscript(transcriptSegments, true);
    return { appliedHighlights, densityHighlights, inferredContentStart };
  }

  function clearGeneratedHighlights(types) {
    const set = new Set(types);
    for (const segment of transcriptSegments) {
      segment.highlights = (segment.highlights || []).filter((mark) => !set.has(mark.type));
      if (set.has("case") && segment.annotation?.type === "case") delete segment.annotation;
    }
  }

  async function regenerateAllTranscript() {
    if (!transcriptSegments.length) return showToast("还没有原文，先完成转写");
    if (!settings?.aiApiKey) return showToast("先在设置中填写 DeepSeek API Key");
    showToast("正在重新生成原文标注…");
    try {
      // 清空智能分析（companion）标注
      for (const segment of transcriptSegments) segment.highlights = (segment.highlights || []).filter((mark) => !(mark.type === "companion" && mark.custom));
      customMarkResult = null;
      await regenerateAnnotations({ silent: true });
      renderTranscript();
      showToast("已重新生成原文标注（并清空智能分析）");
    } catch (error) { showToast(friendlyError(error)); }
  }

  async function regenerateAnnotationsFromDock(kind = "all") {
    if (!transcriptSegments.length) return showToast("还没有原文，先完成转写");
    if (!settings?.aiApiKey) return showToast("先在设置中填写 DeepSeek API Key");
    const types = kind === "highlight"
      ? (settings?.highlightTypes?.length ? settings.highlightTypes : ["quote", "method"])
      : kind === "bold" ? (settings?.boldTypes?.length ? settings.boldTypes : ["case", "fact"]) : null;
    showToast(kind === "highlight" ? "正在重新生成高亮…" : kind === "bold" ? "正在重新生成加粗…" : "正在重新标注…");
    try {
      const { appliedHighlights } = types
        ? await regenerateAnnotations({ silent: true, types })
        : await regenerateAnnotations({ silent: true });
      renderTranscript();
      showToast(types ? `已重新生成（${appliedHighlights} 条）` : "已重新生成标注");
    } catch (error) { showToast(friendlyError(error)); }
  }

  async function generateChaptersFromTranscript(groups) {
    const chapterDrafts = [];
    for (let index = 0; index < groups.length; index += 1) {
      updateProgress(`正在整理章节 ${index + 1}/${groups.length}`, "已经完成的章节会保留，不会因后面一段失败而重来。");
      try {
        const result = await callDeepSeek(
          `${CHAPTER_EDITOR_SYSTEM}${configurablePrompt("summaryPrompt")}`,
          `节目：${episode.title}\n${readingPreferenceInstruction()}\n本段位于整期第 ${index + 1}/${groups.length} 部分。\n\n逐字稿：\n${groups[index]}`,
          3000,
        );
        chapterDrafts.push(...(Array.isArray(result?.chapters) ? result.chapters.slice(0, 4) : []));
      } catch (_error) {
        // 单段章节失败时继续处理后面的内容，最后仍能呈现已完成部分。
      }
    }
    return normalizeDigest({ chapters: chapterDrafts }, episode.duration).chapters
      .filter((item) => !/(购买信息|购买方式|售价|早鸟价|优惠活动|订阅引导)/.test(`${item.title} ${item.detail}`))
      .filter((item, index, values) => index === 0 || item.startSeconds !== values[index - 1].startSeconds || item.title !== values[index - 1].title)
      .slice(0, 18);
  }

  async function generateOverviewFromChapters(chapters) {
    updateProgress("正在生成速读总览", "根据已完成章节收束整期脉络。");
    let overview = null;
    try {
      const result = await callDeepSeek(
        `${OVERVIEW_EDITOR_SYSTEM}${configurablePrompt("summaryPrompt")}`,
        `节目：${episode.title}\n${readingPreferenceInstruction()}\n\n章节笔记：\n${JSON.stringify(chapters)}`,
        3200,
      );
      if (Array.isArray(result?.sections) && result.sections.length) {
        overview = { opening: text(result.opening, 600), sections: result.sections.slice(0, 6) };
      }
    } catch (_error) {}
    return overview;
  }

  async function digestFromCurrentTranscript(options = {}) {
    const segments = transcriptSegments;
    if (!segments.length) throw new Error("没有可重新整理的逐字稿。");
    const groups = groupTranscriptForAnnotations(segments);
    let inferredContentStart = 0;
    if (options?.annotate !== false) {
      inferredContentStart = (await regenerateAnnotations()).inferredContentStart;
    } else {
      const marks = segments.flatMap((seg) => (seg.highlights || []).map((m) => ({ ...m, startSeconds: seg.startSeconds })));
      inferredContentStart = Number.isFinite(Number(options?.contentStart)) ? Number(options.contentStart) : inferIntroContentStart(marks, episode.duration);
    }
    const chapters = await generateChaptersFromTranscript(groups);
    if (!chapters.length) throw new Error("章节整理暂时没有完成，请重试；逐字稿缓存不会丢失。");
    const overview = await generateOverviewFromChapters(chapters);
    let quickRead = "";
    if (!overview?.sections?.length) {
      quickRead = chapters.map((chapter) => `## ${chapter.title}\n- ${chapter.detail || chapter.summary}`).join("\n");
    }
    return { quickRead, overview, contentStartSeconds: inferredContentStart, chapters };
  }

  async function regenerateDigestPart(part) {
    if (!transcriptSegments.length) return showToast("还没有原文，先完成转写");
    if (!settings?.aiApiKey) return showToast("先在设置中填写 DeepSeek API Key");
    const savedView = activeSummaryView;
    const isTimeline = part === "chapters";
    try {
      if (isTimeline) {
        if (!currentDigest) throw new Error("还没有摘要，先完整精读");
        const groups = groupTranscriptForAnnotations(transcriptSegments);
        const chapters = await generateChaptersFromTranscript(groups);
        if (!chapters.length) throw new Error("时间轴生成没有完成，请稍后重试");
        currentDigest = { ...currentDigest, chapters };
      } else {
        if (!currentDigest?.chapters?.length) throw new Error("还没有章节，先完整精读");
        const overview = await generateOverviewFromChapters(currentDigest.chapters);
        if (!overview?.sections?.length) throw new Error("摘要生成没有完成，请稍后重试");
        currentDigest = { ...currentDigest, overview };
      }
      renderDigest(currentDigest);
      await persistDigestToStorage(currentDigest);
      switchView(savedView === "timeline" ? "timeline" : "summary");
      showToast(isTimeline ? "已重新生成时间轴" : "已重新生成摘要");
    } catch (error) { showError(error); }
  }

  // L1+L2：确保已有可用的精修逐字稿。只在逐字稿为空或强制转写时才跑转写+精修。
  async function ensureTranscript(forceAsr = false) {
    if (transcriptSegments.length && !forceAsr) return transcriptSegments;
    const platformId = currentPlatformId();
    // 只有「必须整段音频 ASR」的平台（小宇宙等）才要求 audioUrl；
    // YouTube 走字幕（captions），无需音频地址。
    if (platformId !== "youtube" && !episode?.audioUrl) throw new Error("没有读取到这一集的音频地址，请重新打开单集后重试。");
    updateProgress("正在获取逐字稿", platformId === "youtube"
      ? "正在读取视频字幕。"
      : settings?.asrProvider === "supadata"
        ? "Supadata 正在处理整期音频。"
        : "百炼正在识别时间戳并区分说话人。");
    let rawSegments = await requestTranscript(episode.audioUrl, (message) => updateProgress("正在转写音频", message), forceAsr);
    if (!rawSegments.length) throw new Error("没有取得可用的逐字稿。");
    if (settings?.asrProvider === "aliyun") rawSegments = await refineTranscriptWithAgents(rawSegments);
    await setTranscript(rawSegments, true);
    await seedBackendTranscriptCache();
    return transcriptSegments;
  }

  // L3：只从逐字稿生成摘要（章节提炼 + 速读总览），不碰精修。
  async function generateDigest() {
    return digestFromCurrentTranscript();
  }

  async function fullDigest(forceAsr = false) {
    await ensureTranscript(forceAsr);
    return generateDigest();
  }

  function setHidden(id, hidden) { byId(id).hidden = hidden; }
  function showOnlyMain(name) {
    for (const id of ["setupState", "actions", "progressCard", "errorCard", "digest"]) setHidden(id, id !== name);
  }

  // ---- 书写动画 loader（Appllama #15 Orbital Calligraphy 移植）----

  // ---- 阶段耗时埋点 ----
  const PROGRESS_METRICS_KEY = "xyd_progress_metrics";
  let progressStageStartedAt = 0;
  let progressStageName = "";

  async function recordProgressStage() {
    if (!progressStageName || !progressStageStartedAt) return;
    const elapsedMs = Math.max(0, Date.now() - progressStageStartedAt);
    if (elapsedMs < 500) return;
    try {
      const stored = await chrome.storage.local.get(PROGRESS_METRICS_KEY);
      const list = Array.isArray(stored[PROGRESS_METRICS_KEY]) ? stored[PROGRESS_METRICS_KEY] : [];
      list.push({ stage: progressStageName, elapsedMs, at: Date.now() });
      await chrome.storage.local.set({ [PROGRESS_METRICS_KEY]: list.slice(-200) });
    } catch (_error) {}
  }

  function updateProgress(title, detail) {
    switchView("summary");
    showOnlyMain("progressCard");
    byId("progressTitle").textContent = title;
    byId("progressText").textContent = detail;
    updateProgressBar(title, detail);
    if (title !== progressStageName) {
      recordProgressStage();
      progressStageName = title;
      progressStageStartedAt = Date.now();
    }
  }

  function updateProgressBar(title, detail) {
    const fill = byId("progressFill");
    const track = byId("progressTrack");
    if (!fill || !track) return;
    const combined = `${title} ${detail || ""}`;
    const chunkMatch = combined.match(/已完成\s*(\d+)\s*\/\s*(\d+)/);
    const stepMatch = combined.match(/(\d+)\s*\/\s*(\d+)/);
    const total = chunkMatch ? Number(chunkMatch[2]) : stepMatch ? Number(stepMatch[2]) : 0;
    const current = chunkMatch ? Number(chunkMatch[1]) : stepMatch ? Number(stepMatch[1]) : 0;
    if (total > 0 && current >= 0) {
      const pct = Math.min(100, Math.round((current / total) * 100));
      fill.classList.remove("indeterminate");
      fill.style.width = `${pct}%`;
    } else {
      fill.classList.add("indeterminate");
      fill.style.width = "";
    }
  }
  function friendlyError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Receiving end does not exist|Could not establish connection/.test(message)) {
      return "页面里没有播放器，请先在小宇宙或 YouTube 页面打开侧边栏，再重新生成或跳转。";
    }
    return message;
  }

  function showError(error) {
    switchView("summary");
    showOnlyMain("errorCard");
    recordProgressStage();
    progressStageName = "";
    const isTranscriptLimit = error?.service === "Supadata" && error?.status === 429;
    byId("errorSettingsBtn").hidden = !isTranscriptLimit;
    byId("retryBtn").hidden = isTranscriptLimit;
    byId("errorText").textContent = isTranscriptLimit
      ? `Supadata 账户的套餐额度不足。这期 ${formatTime(episode?.duration)} 的音频预计需要约 ${Math.ceil((episode?.duration || 0) / 60) * 2} credits。请升级套餐、启用 Auto Recharge，或等待额度重置后再试。`
      : friendlyError(error);
  }

  function transcriptCacheKey() {
    return `xyd_transcript_${episode?.id || "unknown"}`;
  }

  function notesCacheKey() {
    return `xyd_notes_${episode?.id || "unknown"}`;
  }

  async function touchHistory(extra = {}) {
    if (!episode?.id || !chrome.storage?.local) return;
    const stored = await chrome.storage.local.get(HISTORY_INDEX_KEY);
    const history = Array.isArray(stored[HISTORY_INDEX_KEY]) ? stored[HISTORY_INDEX_KEY] : [];
    const previous = history.find((item) => item?.episodeId === episode.id) || {};
    const entry = {
      ...previous,
      episodeId: episode.id,
      title: episode.title || previous.title || "未命名单集",
      podcast: episode.podcast || previous.podcast || "小宇宙播客",
      pageUrl: episode.pageUrl || previous.pageUrl || `https://www.xiaoyuzhoufm.com/episode/${episode.id}`,
      transcriptCount: transcriptSegments.length,
      hasDigest: Boolean(currentDigest || previous.hasDigest),
      noteCount: readerNotes.length,
      duration: Math.max(0, Number(episode.duration) || previous.duration || 0),
      source: previous.source || currentPlatformId(),
      favorite: Boolean(previous.favorite),
      updatedAt: Date.now(),
      ...extra,
    };
    const next = [entry, ...history.filter((item) => item?.episodeId && item.episodeId !== episode.id)]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 80);
    await chrome.storage.local.set({ [HISTORY_INDEX_KEY]: next });
  }

  function normalizeReaderNotes(value) {
    return (Array.isArray(value) ? value : []).slice(0, 500).map((note) => ({
      id: text(note?.id, 100) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: ["quote", "summary", "personal"].includes(note?.kind) ? note.kind : "personal",
      title: text(note?.title, 180) || "随手记",
      sourceText: text(note?.sourceText, 12000),
      body: text(note?.body, 12000),
      color: /^#[0-9a-f]{6}$/i.test(String(note?.color || "")) ? note.color : "",
      sourceId: text(note?.sourceId, 220),
      startSeconds: note?.startSeconds === null || note?.startSeconds === undefined || !Number.isFinite(Number(note.startSeconds)) ? null : Math.max(0, Number(note.startSeconds)),
      createdAt: Math.max(0, Number(note?.createdAt) || Date.now()),
    })).filter((note) => note.sourceText || note.body);
  }

  async function persistReaderNotes() {
    if (!episode || !chrome.storage?.local) return;
    await chrome.storage.local.set({ [notesCacheKey()]: readerNotes });
    await touchHistory({ noteCount: readerNotes.length });
  }

  function showToast(message) {
    const toast = byId("toast");
    toast.textContent = message;
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 1700);
  }

  async function copyText(value) {
    const content = text(value, 20000);
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      showToast("已复制");
    } catch (_error) {
      const fallback = document.createElement("textarea");
      fallback.value = content;
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand("copy");
      fallback.remove();
      showToast("已复制");
    }
  }

  function jumpToTranscript(seconds) {
    const target = Math.max(0, Number(seconds) || 0);
    switchView("transcript");
    highlightActiveEntry(target, true);
    seekTo(target).catch(() => {});
  }

  async function addReaderNote(note) {
    const normalized = normalizeReaderNotes([{ ...note, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now() }])[0];
    if (!normalized) return false;
    if (normalized.sourceId && readerNotes.some((item) => item.sourceId === normalized.sourceId)) {
      showToast("已经在笔记里了");
      return false;
    }
    readerNotes.unshift(normalized);
    renderNotes();
    await persistReaderNotes();
    showToast("已加入笔记");
    return true;
  }

  function renderNotes() {
    const root = byId("notesList");
    root.replaceChildren();
    byId("notesEmpty").hidden = readerNotes.length > 0;
    byId("notesCount").hidden = readerNotes.length === 0;
    byId("notesCount").textContent = String(readerNotes.length);
    const kindLabel = { quote: "原文摘录", summary: "摘要", personal: "随手记" };
    for (const note of readerNotes) {
      const card = document.createElement("article");
      card.className = "note-card";
      if (note.color) card.style.setProperty("--note-color", note.color);
      card.dataset.noteId = note.id;
      const header = document.createElement("div");
      header.className = "note-card-header";
      const meta = document.createElement("span");
      meta.className = "note-card-meta";
      meta.textContent = kindLabel[note.kind] || "笔记";
      if (note.startSeconds !== null) meta.append(document.createTextNode(` · ${formatTime(note.startSeconds)}`));
      const actions = document.createElement("div");
      actions.className = "note-card-actions";
      if (note.startSeconds !== null) {
        const source = document.createElement("button");
        source.type = "button";
        source.append(createActionIcon("source"), document.createTextNode("看原文"));
        source.addEventListener("click", () => jumpToTranscript(note.startSeconds));
        actions.appendChild(source);
      }
      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "复制";
      copy.addEventListener("click", () => copyText(note.sourceText || note.body));
      actions.appendChild(copy);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "note-delete";
      remove.setAttribute("aria-label", "删除这条笔记");
      remove.append(createActionIcon("delete"), document.createTextNode("删除"));
      remove.addEventListener("click", async () => {
        readerNotes = readerNotes.filter((item) => item.id !== note.id);
        renderNotes();
        await persistReaderNotes();
        showToast("已删除笔记");
      });
      actions.appendChild(remove);
      header.append(meta, actions);
      const title = document.createElement("h3");
      title.textContent = note.title;
      card.append(header, title);
      if (note.sourceText) {
        const source = document.createElement("p");
        source.className = "note-source";
        source.textContent = note.sourceText;
        card.appendChild(source);
      }
      const reflection = document.createElement("textarea");
      reflection.className = "note-reflection";
      reflection.maxLength = 12000;
      reflection.placeholder = note.kind === "personal" ? "继续编辑这条笔记…" : "写下你的想法…";
      reflection.value = note.body;
      reflection.addEventListener("change", async () => {
        note.body = text(reflection.value, 12000);
        await persistReaderNotes();
      });
      card.appendChild(reflection);
      root.appendChild(card);
    }
  }

  function detectedContentStart() {
    if (currentDigest) return Math.max(0, Number(currentDigest.contentStartSeconds) || 0);
    const demo = globalThis.XYD_DEMO_DATA;
    return demo?.episodeId === episode?.id ? Math.max(0, Number(demo.contentStartSeconds) || 0) : 0;
  }

  function syncRegenerateDigestLabel() {
    const el = byId("regenerateDigestBtn");
    if (!el) return;
    const label = activeView === "timeline" ? "重新生成时间轴" : "重新生成摘要";
    el.textContent = label;
  }

  function switchView(name) {
    const target = ["transcript", "summary", "timeline", "notes"].includes(name) ? name : "summary";
    activeView = target;
    activeSummaryView = target === "timeline" ? "timeline" : target === "summary" ? "insights" : activeSummaryView;
    const showSummaryContainer = target === "summary" || target === "timeline";
    byId("summaryView").hidden = !showSummaryContainer;
    byId("summaryInsightsPanel").hidden = target !== "summary";
    byId("summaryTimelinePanel").hidden = target !== "timeline";
    if (byId("digestToolbar")) byId("digestToolbar").hidden = target === "timeline";
    byId("transcriptView").hidden = target !== "transcript";
    byId("notesView").hidden = target !== "notes";
    document.querySelectorAll(".tab").forEach((button) => {
      const active = button.dataset.tab === target;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    byId("readingDock").hidden = target !== "transcript" || !transcriptSegments.length;
    syncRegenerateDigestLabel();
    hideSelectionToolbar();
    if (target === "transcript") {
      startPlaybackTracking();
      playbackTrackingTick();
    } else stopPlaybackTracking();
  }

  async function seekTo(seconds) {
    highlightActiveEntry(Number(seconds) || 0, true);
    let response;
    try {
      response = await chrome.tabs.sendMessage(activeTabId, { action: "seek", seconds });
    } catch (_error) {
      throw new Error("页面里没有播放器，请先在小宇宙或 YouTube 页面打开侧边栏再跳转。");
    }
    if (!response?.success) throw new Error("没有找到页面里的播放器，请刷新小宇宙页面后重试。");
  }

  function renderTranscript() {
    const root = byId("transcriptList");
    root.replaceChildren();
    const hasTranscript = transcriptSegments.length > 0;
    byId("transcriptWorkspace").classList.toggle("empty-state", !hasTranscript);
    const contentStart = detectedContentStart();
    const indexedSegments = transcriptSegments.map((segment, index) => ({ segment, index }));
    const introSegments = contentStart ? indexedSegments.filter((item) => item.segment.startSeconds < contentStart) : [];
    const bodySegments = contentStart ? indexedSegments.filter((item) => item.segment.startSeconds >= contentStart) : indexedSegments;
    const segmentsForHighlights = showIntro ? indexedSegments : bodySegments;
    setHidden("transcriptEmpty", hasTranscript);
    byId("readingDock").hidden = !hasTranscript || activeView !== "transcript";

    const appendSegment = ({ segment, index }, extraClass = "") => {
      const button = document.createElement("div");
      button.className = "transcript-entry";
      button.tabIndex = 0;
      button.setAttribute("role", "button");
      if (extraClass) button.classList.add(...extraClass.split(" "));
      if (segment.annotation?.type === "case") button.classList.add("case-highlight");
      button.dataset.index = String(index);
      button.dataset.seconds = String(segment.startSeconds);
      button.setAttribute("aria-label", `${formatTime(segment.startSeconds)}，${segment.text}`);
      const time = document.createElement("span");
      time.className = "transcript-time";
      time.textContent = formatTime(segment.startSeconds);
      const copy = document.createElement("span");
      copy.className = "transcript-text";
      if (segment.annotation?.type === "case") {
        const caseLabel = document.createElement("span");
        caseLabel.className = "case-label";
        caseLabel.textContent = segment.annotation.title || "Case";
        copy.appendChild(caseLabel);
      }
      const speaker = document.createElement("span");
      speaker.className = "speaker-label";
      speaker.textContent = segment.speaker || "";
      const showTranslation = transcriptLang !== "source";
      const translated = showTranslation ? segment.translatedText || "" : "";
      if (showTranslation && translated) {
        const trans = document.createElement("div");
        trans.className = "transcript-translation";
        appendHighlightedText(trans, translated, segment.highlights?.length ? [] : [], {});
        copy.appendChild(trans);
        if (transcriptLang === "zh-en" && segment.text) {
          const orig = document.createElement("div");
          orig.className = "transcript-original";
          appendHighlightedText(orig, segment.text, segment.highlights, { onPendingClick: (mark, spec) => openHighlightConfirm(mark, spec, segment, index) });
          copy.appendChild(orig);
        }
      } else {
        appendHighlightedText(copy, segment.text, segment.highlights, { onPendingClick: (mark, spec) => openHighlightConfirm(mark, spec, segment, index) });
      }
      button.append(time, speaker, copy);
      button.addEventListener("click", () => {
        if (String(window.getSelection?.() || "").trim()) return;
        seekTo(segment.startSeconds).catch(() => showToast("页面里没有播放器，请在小宇宙或 YouTube 页面打开侧边栏"));
      });
      button.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        seekTo(segment.startSeconds).catch(() => showToast("页面里没有播放器，请在小宇宙或 YouTube 页面打开侧边栏"));
      });
      root.appendChild(button);
    };

    const appendSkipDivider = () => {
      const divider = document.createElement("div");
      divider.className = "skip-divider";
      divider.setAttribute("role", "note");
      const label = document.createElement("span");
      label.textContent = "已自动跳过片头和广告";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = showIntro ? "收起" : "展开";
      toggle.dataset.expanded = String(showIntro);
      toggle.setAttribute("aria-label", showIntro ? "收起片头和广告" : "展开片头和广告");
      toggle.addEventListener("click", toggleIntro);
      divider.append(label, toggle);
      root.appendChild(divider);
    };

    if (contentStart && introSegments.length) {
      if (showIntro) introSegments.forEach((item) => appendSegment(item, "intro-segment"));
      else introSegments.slice(-2).forEach((item, index) => appendSegment(item, `intro-fade intro-fade-${index + 1}`));
      appendSkipDivider();
    }
    bodySegments.forEach((item) => appendSegment(item));
    if (isTranscribing) {
      const tail = document.createElement("div");
      tail.className = "transcript-loading-tail";
      tail.textContent = "正在继续转写，新的段落会自动出现在这里…";
      root.appendChild(tail);
    }
    renderChapterRail();
  }

  function renderChapterRail() {
    const root = byId("chapterRailList");
    root.replaceChildren();
    const chapters = currentDigest?.chapters || [];
    const visible = chapters.length > 0;
    setHidden("chapterRail", !visible);
    byId("transcriptWorkspace").classList.toggle("rail-collapsed", !visible);
    root.onpointerleave = () => {
      root.classList.remove("dismissed");
      applyChapterValley(-1);
    };
    for (const [chapterIndex, chapter] of chapters.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chapter-rail-item";
      button.dataset.index = String(chapterIndex);
      button.dataset.chapterIndex = String(chapterIndex);
      button.dataset.seconds = String(chapter.startSeconds);
      button.setAttribute("aria-label", `${formatTime(chapter.startSeconds)}，${chapter.title}，${chapter.summary}`);
      const mark = document.createElement("span");
      mark.className = "chapter-rail-mark";
      mark.setAttribute("aria-hidden", "true");
      const peek = document.createElement("span");
      peek.className = "chapter-peek";
      const meta = document.createElement("span");
      meta.className = "chapter-peek-meta";
      meta.textContent = formatTime(chapter.startSeconds);
      const title = document.createElement("strong");
      title.textContent = chapter.title;
      const summary = document.createElement("span");
      summary.className = "chapter-peek-summary";
      summary.textContent = chapter.summary || chapter.points[0] || chapter.title;
      peek.append(meta, title, summary);
      button.append(mark, peek);
      button.addEventListener("pointerenter", () => {
        root.classList.remove("dismissed");
        applyChapterValley(chapterIndex);
      });
      button.addEventListener("focus", () => applyChapterValley(chapterIndex));
      button.addEventListener("blur", () => applyChapterValley(-1));
      button.addEventListener("click", () => {
        root.classList.add("dismissed");
        applyChapterValley(-1);
        jumpToTranscript(chapter.startSeconds);
      });
      root.appendChild(button);
    }
    applyChapterValley(-1);
  }

  function applyChapterValley(index) {
    byId("chapterRailList").querySelectorAll(".chapter-rail-item").forEach((button, itemIndex) => {
      button.classList.remove("active", "near-1", "near-2", "near-3");
      const distance = Math.abs(itemIndex - index);
      if (distance === 0) button.classList.add("active");
      else if (distance > 0 && distance <= 3) button.classList.add(`near-${distance}`);
    });
  }

  function highlightActiveChapter(currentSeconds) {
    const chapters = currentDigest?.chapters || [];
    let index = -1;
    for (let i = 0; i < chapters.length; i += 1) {
      const nextStart = chapters[i + 1]?.startSeconds ?? Number.POSITIVE_INFINITY;
      if (currentSeconds >= chapters[i].startSeconds && currentSeconds < nextStart) { index = i; break; }
    }
    const railIndex = index;
    if (index === activeChapterIndex && railIndex === activeRailIndex) return;
    const current = railIndex >= 0 ? byId("chapterRailList").querySelector(`[data-index="${railIndex}"]`) : null;
    byId("chapterRailList").querySelector("[aria-current]")?.removeAttribute("aria-current");
    current?.setAttribute("aria-current", "true");
    activeChapterIndex = index;
    activeRailIndex = railIndex;
  }

  function toggleIntro() {
    showIntro = !showIntro;
    activeTranscriptIndex = -1;
    renderTranscript();
    const cachedCompanionColor = transcriptSegments.flatMap((segment) => segment.highlights || []).find((mark) => mark.type === "companion")?.color;
    if (cachedCompanionColor) setCompanionDockColor(cachedCompanionColor, true);
  }

  function hideSelectionToolbar(clearSelection = false) {
    const toolbar = byId("selectionToolbar");
    if (toolbar) toolbar.hidden = true;
    activeSelection = null;
    if (clearSelection) window.getSelection?.()?.removeAllRanges();
  }

  function showSelectionToolbar() {
    if (activeView !== "transcript") return hideSelectionToolbar();
    const selection = window.getSelection?.();
    const selectedText = text(String(selection || ""), 12000);
    if (!selection || selection.rangeCount === 0 || !selectedText) return hideSelectionToolbar();
    const range = selection.getRangeAt(0);
    const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
    const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement;
    const startEntry = startElement?.closest?.(".transcript-entry");
    const endEntry = endElement?.closest?.(".transcript-entry");
    if (!startEntry || !endEntry || !byId("transcriptList").contains(startEntry) || !byId("transcriptList").contains(endEntry)) return hideSelectionToolbar();
    const startIndex = Math.min(Number(startEntry.dataset.index) || 0, Number(endEntry.dataset.index) || 0);
    const segment = transcriptSegments[startIndex];
    activeSelection = { text: selectedText, startSeconds: segment?.startSeconds || 0, title: `原文摘录 · ${formatTime(segment?.startSeconds || 0)}`, segmentIndex: startIndex, charStart: selectionRangeInSegment(segment, range, startEntry, "start"), charEnd: selectionRangeInSegment(segment, range, startEntry, "end") };
    const rect = range.getBoundingClientRect();
    const toolbar = byId("selectionToolbar");
    toolbar.style.left = `${Math.min(window.innerWidth - 72, Math.max(72, rect.left + rect.width / 2))}px`;
    toolbar.style.top = `${Math.max(48, rect.top - 8)}px`;
    toolbar.hidden = false;
  }

  // 计算某段选择在 segment.text 内的字符偏移（跨节点拼接成一个字符串再定位）。
  function selectionRangeInSegment(segment, range, entry, which) {
    const textNode = entry.querySelector(".transcript-text");
    if (!textNode) return 0;
    const probe = document.createRange();
    probe.selectNodeContents(textNode);
    const target = document.createRange();
    if (which === "start") { target.setStart(range.startContainer, range.startOffset); target.setEnd(range.startContainer, range.startOffset); }
    else { target.setStart(range.endContainer, range.endOffset); target.setEnd(range.endContainer, range.endOffset); }
    try {
      const prior = document.createRange();
      prior.selectNodeContents(textNode);
      prior.setEnd(target.startContainer, target.startOffset);
      return prior.toString().length;
    } catch (_error) {
      const full = probe.toString();
      const idx = full.lastIndexOf(String(range.startContainer.textContent || "").slice(0, range.startOffset));
      return Math.max(0, idx);
    }
  }

  function applyFormatToSelection(type) {
    if (!activeSelection || activeSelection.segmentIndex == null) return;
    let start = activeSelection.charStart;
    let end = activeSelection.charEnd;
    if (start > end) [start, end] = [end, start];
    const segment = transcriptSegments[activeSelection.segmentIndex];
    if (!segment || !segment.text || end <= start) return;
    if (type === "clear") {
      segment.highlights = (segment.highlights || []).filter((mark) => !(mark.type?.startsWith("user-") && mark.start < end && mark.end > start));
    } else {
      const typeForMark = type === "bold" ? "user-bold" : type === "green" ? "user-highlight--green" : "user-highlight";
      const existing = segment.highlights || [];
      if (!existing.some((mark) => mark.type === typeForMark && mark.start === start && mark.end === end)) {
        segment.highlights = [...existing, { id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: typeForMark, start, end, pending: false, accepted: true }];
      }
    }
    persistTranscriptHighlights().catch(() => {});
    renderTranscript();
    hideSelectionToolbar(true);
    showToast(type === "clear" ? "已清除选中格式" : "已应用到选中文字");
  }

  async function noteCurrentSelection() {
    if (!activeSelection?.text) return;
    const selectionNote = { ...activeSelection };
    await addReaderNote({
      kind: "quote",
      title: selectionNote.title,
      sourceText: selectionNote.text,
      body: "",
      startSeconds: selectionNote.startSeconds,
      sourceId: `quote:${selectionNote.startSeconds}:${selectionNote.text}`,
    });
    hideSelectionToolbar(true);
  }

  function visualClassNameFor(markType) {
    // 类别 → 视觉：金句/数据默认黄荧光笔，方法论/事件默认加粗；用户可在「高亮/加粗」下拉里调整。
    if (["quote", "fact", "method", "case"].includes(markType)) {
      const isBold = (settings?.boldTypes || ["case", "fact"]).includes(markType);
      const isHighlighted = (settings?.highlightTypes || ["quote", "method"]).includes(markType);
      if (isBold && !isHighlighted) return "fact";
      return "quote";
    }
    return markType;
  }

  function appendHighlightedText(root, value, highlights = [], options = {}) {
    const safeMarks = (Array.isArray(highlights) ? highlights : [])
      .map((mark) => ({
        id: text(mark?.id, 64),
        type: ["case", "fact", "companion", "user-bold", "user-highlight", "user-highlight--green", "quote", "method"].includes(mark?.type) ? mark.type : "quote",
        start: Math.max(0, Number(mark?.start) || 0),
        end: Math.min(value.length, Number(mark?.end) || 0),
        color: /^#[0-9a-f]{6}$/i.test(String(mark?.color || "")) ? mark.color : "",
        pending: Boolean(mark?.pending),
        accepted: Boolean(mark?.accepted),
        rejected: Boolean(mark?.rejected),
      }))
      .filter((mark) => mark.end > mark.start && !mark.rejected)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const boundaries = [...new Set([0, value.length, ...safeMarks.flatMap((mark) => [mark.start, mark.end])])].sort((a, b) => a - b);
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const start = boundaries[index];
      const end = boundaries[index + 1];
      if (end <= start) continue;
      const active = safeMarks.filter((mark) => mark.start <= start && mark.end >= end);
      if (!active.length) {
        root.appendChild(document.createTextNode(value.slice(start, end)));
        continue;
      }
      const mark = document.createElement("mark");
      mark.className = [...new Set(active.map((item) => visualClassNameFor(item.type)).concat(active.some((item) => item.pending && !item.accepted) ? ["pending"] : []))].join(" ");
      const companionMark = active.find((item) => item.type === "companion" && item.color);
      if (companionMark) mark.style.setProperty("--companion-color", companionMark.color);
      if (active.some((item) => item.pending && !item.accepted)) mark.classList.add("pending");
      if (options.onPendingClick && active.some((item) => item.pending && !item.accepted)) {
        mark.setAttribute("role", "button");
        mark.tabIndex = 0;
        mark.addEventListener("click", (event) => {
          if (String(window.getSelection?.() || "").trim()) return;
          event.stopPropagation();
          options.onPendingClick(mark, active.find((item) => item.pending && !item.accepted));
        });
      }
      const focus = active.slice().sort((a, b) => (b.type === "companion" ? 1 : 0) - (a.type === "companion" ? 1 : 0))[0];
      if (focus?.type === "user-bold") mark.classList.add("user-bold");
      if (focus?.type === "user-highlight") mark.classList.add("user-highlight");
      if (focus?.type === "user-highlight--green") mark.classList.add("user-highlight", "user-highlight--green");
      mark.textContent = value.slice(start, end);
      root.appendChild(mark);
    }
  }

  let activeHighlightConfirm = null;
  function hideHighlightConfirm() {
    byId("highlightConfirm").hidden = true;
    activeHighlightConfirm = null;
  }

  function openHighlightConfirm(markEl, spec, segment, segmentIndex) {
    activeHighlightConfirm = { markEl, spec, segment, segmentIndex };
    const confirm = byId("highlightConfirm");
    const rect = markEl.getBoundingClientRect();
    confirm.style.left = `${Math.min(window.innerWidth - 60, Math.max(60, rect.left + rect.width / 2))}px`;
    confirm.style.top = `${Math.max(48, rect.top - 6)}px`;
    confirm.hidden = false;
  }

  function resolvePendingHighlight(accept) {
    if (!activeHighlightConfirm) return;
    const { spec, segment, segmentIndex } = activeHighlightConfirm;
    if (!segment || !segment.highlights) return hideHighlightConfirm();
    const target = segment.highlights.find((mark) => mark && ((mark.id && mark.id === spec?.id) || (mark.type === spec?.type && mark.start === spec?.start && mark.end === spec?.end)));
    if (!target) return hideHighlightConfirm();
    target.pending = false;
    target.accepted = Boolean(accept);
    if (!accept) target.rejected = true;
    persistTranscriptHighlights().catch(() => {});
    renderTranscript();
    hideHighlightConfirm();
    showToast(accept ? "已接受这条高亮" : "已取消这条高亮");
  }

  async function persistTranscriptHighlights() {
    if (!episode) return;
    try {
      if (chrome.storage?.local) await chrome.storage.local.set({ [transcriptCacheKey()]: transcriptSegments });
      if (chrome.storage?.session) await chrome.storage.session.set({ [transcriptCacheKey()]: transcriptSegments });
    } catch (_error) {}
  }

  function applyGeneratedHighlights(notes, types = null) {
    let applied = 0;
    const allowed = new Set(types || ["case", "quote", "fact", "method"]);
    const limits = { case: 64, quote: 24, fact: 100, method: 30 };
    const selected = [];
    for (const type of Object.keys(limits)) {
      if (!allowed.has(type)) continue;
      const candidates = (Array.isArray(notes) ? notes : [])
        .filter((note) => note?.type === type)
        .sort((a, b) => (Number(a?.startSeconds) || 0) - (Number(b?.startSeconds) || 0));
      const picked = candidates.length <= limits[type]
        ? candidates
        : Array.from({ length: limits[type] }, (_, index) => {
            const start = Math.floor(index * candidates.length / limits[type]);
            const end = Math.max(start + 1, Math.floor((index + 1) * candidates.length / limits[type]));
            return candidates.slice(start, end).sort((a, b) => (Number(b?.importance) || 3) - (Number(a?.importance) || 3))[0];
          });
      selected.push(...picked);
    }
    selected.sort((a, b) => (Number(a?.startSeconds) || 0) - (Number(b?.startSeconds) || 0));
    for (const note of selected) {
      const phrase = text(note?.highlightText, note?.type === "case" ? 400 : 140);
      const minLength = note?.type === "case" ? 8 : note?.type === "quote" ? 8 : 4;
      if (phrase.length < minLength) continue;
      const targetTime = Math.max(0, Number(note?.startSeconds) || 0);
      const requestedIndex = Number(note?.segmentIndex);
      const indexedCandidate = Number.isInteger(requestedIndex) && transcriptSegments[requestedIndex]
        ? [{ segment: transcriptSegments[requestedIndex], index: requestedIndex, distance: 0 }]
        : [];
      const candidates = [...indexedCandidate, ...transcriptSegments
        .map((segment, index) => ({ segment, index, distance: Math.abs(segment.startSeconds - targetTime) }))
        .filter((item) => item.index !== requestedIndex)
        .filter((item) => item.distance <= 180)
        .sort((a, b) => a.distance - b.distance)];
      for (const candidate of candidates) {
        const range = locatePhrase(candidate.segment.text, phrase);
        if (!range) continue;
        if (note.type === "case") {
          if (!candidate.segment.annotation) {
            candidate.segment.annotation = { type: "case", label: "", title: text(note?.title, 160) || "案例" };
            applied += 1;
          }
        } else {
          const highlights = Array.isArray(candidate.segment.highlights) ? candidate.segment.highlights : [];
          const { start, end } = range;
          if (!highlights.some((mark) => mark.start === start && mark.end === end)) {
            candidate.segment.highlights = [...highlights, { id: `hl-${candidate.index}-${start}-${end}-${note.type}`, type: note.type, start, end, pending: true }];
            applied += 1;
          }
        }
        break;
      }
    }
    return applied;
  }

  function isLowValueOrPromotionalText(value) {
    const phrase = text(value, 500);
    if (!phrase) return true;
    const promotion = /(售价|定价|早鸟价|优惠价|打包价|每集.{0,8}(元|块)|[购买订阅收听获取].{0,12}(链接|渠道|客户端|banner|页面)|点击.{0,12}(购买|下载|获取)|扫码|下单|限时优惠|会员价|首档付费|付费专题|单集购买|喜马拉雅客户端|网易云音乐)/i;
    const scheduleOnly = /(?:第[一二三四五六七八九十\d]+[季期集]|一共[一二三四五六七八九十\d]+[期集]|完成了?[一二三四五六七八九十\d]+[期集]|已经完成[一二三四五六七八九十\d]+[期集])/;
    const knowledgeSignal = /(增长|下降|提升|降低|融资|估值|收入|成本|用户|日活|月活|转化|留存|市场份额|亏损|盈利|上线|推出|投放|关闭|收购|转型|改版|结果|导致|因此|意味着|验证|超过|达到|从.+到)/;
    if (promotion.test(phrase)) return true;
    return scheduleOnly.test(phrase) && !knowledgeSignal.test(phrase);
  }

  function ensureAnnotationDensity(target = .25, contentStartSeconds = 0) {
    const body = transcriptSegments.filter((segment) => segment.startSeconds >= contentStartSeconds);
    const totalChars = body.reduce((sum, segment) => sum + segment.text.length, 0);
    const coveredLength = (segment) => {
      if (segment.annotation?.type === "case") return segment.text.length;
      const ranges = (segment.highlights || [])
        .map((mark) => [Math.max(0, Number(mark.start) || 0), Math.min(segment.text.length, Number(mark.end) || 0)])
        .filter(([start, end]) => end > start)
        .sort((a, b) => a[0] - b[0]);
      let covered = 0;
      let end = 0;
      for (const [start, nextEnd] of ranges) {
        if (nextEnd <= end) continue;
        covered += nextEnd - Math.max(start, end);
        end = nextEnd;
      }
      return covered;
    };
    let annotatedChars = body.reduce((sum, segment) => sum + coveredLength(segment), 0);
    const targetChars = Math.round(totalChars * target);
    if (!totalChars || annotatedChars >= targetChars) return 0;
    const candidates = [];
    const actionPattern = /(上线|推出|投放|融资|转型|关闭|下架|收购|加入|创办|成立|发布|改版|决定|承诺|增长|下降|拆分|合并|开放|停止|改成|延长|超过|达到)/;
    const evidencePattern = /(\d|一亿|千万|百万|十万|万名|万用户|日活|月活|估值|收入|成本|比例|倍)/;
    const insightPattern = /(核心|本质|关键|差异化|不等于|不是.+而是|意味着|就在于|真正|只懂|不懂)/;
    for (const segment of body) {
      if (segment.annotation?.type === "case") continue;
      const matcher = /[^。！？!?]+[。！？!?]?/g;
      let match;
      while ((match = matcher.exec(segment.text))) {
        const leading = match[0].search(/\S/);
        if (leading < 0) continue;
        const phrase = match[0].trim();
        if (phrase.length < 12 || phrase.length > 150) continue;
        if (isLowValueOrPromotionalText(phrase)) continue;
        const start = match.index + leading;
        const end = start + phrase.length;
        if ((segment.highlights || []).some((mark) => start < mark.end && end > mark.start)) continue;
        const hasAction = actionPattern.test(phrase);
        const hasEvidence = evidencePattern.test(phrase);
        const hasInsight = insightPattern.test(phrase);
        const score = (hasAction ? 5 : 0) + (hasEvidence ? 4 : 0) + (hasInsight ? 4 : 0);
        if (score < 4) continue;
        if (hasEvidence && !hasAction && !hasInsight) continue;
        candidates.push({ segment, start, end, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.segment.startSeconds - b.segment.startSeconds);
    let added = 0;
    for (const candidate of candidates) {
      if (annotatedChars >= targetChars) break;
      candidate.segment.highlights = [...(candidate.segment.highlights || []), { id: `hl-fact-${Math.round(candidate.segment.startSeconds)}-${candidate.start}-${candidate.end}`, type: "fact", start: candidate.start, end: candidate.end, pending: true }];
      annotatedChars += candidate.end - candidate.start;
      added += 1;
    }
    return added;
  }

  async function setTranscript(segments, persist = false) {
    const isCurated = segments.some((segment) => segment?.speaker || segment?.annotation || Array.isArray(segment?.highlights));
    const isDemoEpisode = globalThis.XYD_DEMO_DATA?.episodeId === episode?.id;
    transcriptSegments = isCurated
      ? segments.map((segment) => ({
          startSeconds: Math.max(0, Number(segment?.startSeconds) || 0),
          durationSeconds: Math.max(0, Number(segment?.durationSeconds) || 0),
          speakerId: text(segment?.speakerId ?? segment?.speaker_id, 30),
          speaker: text(segment?.speaker, 50),
          text: text(segment?.text, 50000),
          ...(text(segment?.rawText, 50000) && text(segment?.rawText, 50000) !== text(segment?.text, 50000) ? { rawText: text(segment.rawText, 50000) } : {}),
          highlights: (Array.isArray(segment?.highlights) ? segment.highlights : [])
            .filter((mark) => !isDemoEpisode || mark?.type !== "quote" || DEMO_GOLDEN_QUOTES.has(String(segment?.text || "").slice(mark.start, mark.end)))
            .slice(0, 20)
            .map((mark) => mark?.type === "companion" ? { ...mark, color: appleCompanionColor(mark.color) } : mark),
          annotation: segment?.annotation?.type === "case" ? { type: "case", label: text(segment.annotation.label, 30), title: text(segment.annotation.title, 160) } : null,
        })).filter((segment) => segment.text)
      : paragraphizeTranscript(segments);
    if (isDemoEpisode) {
      for (const [seconds, title] of DEMO_EXTRA_CASES) {
        const segment = transcriptSegments.find((item) => Math.abs(item.startSeconds - seconds) <= 3);
        if (segment && !segment.annotation) segment.annotation = { type: "case", label: "", title };
      }
      for (const [seconds, phrase] of DEMO_KEY_FACTS) {
        const candidates = transcriptSegments
          .filter((item) => Math.abs(item.startSeconds - seconds) <= 4)
          .sort((a, b) => Math.abs(a.startSeconds - seconds) - Math.abs(b.startSeconds - seconds));
        const segment = candidates.find((item) => item.text.includes(phrase));
        if (!segment) continue;
        const start = segment.text.indexOf(phrase);
        const end = start + phrase.length;
        if (!(segment.highlights || []).some((mark) => mark.start === start && mark.end === end)) {
          segment.highlights = [...(segment.highlights || []), { type: "fact", start, end }];
        }
      }
      for (const phrase of DEMO_GOLDEN_QUOTES) {
        const segment = transcriptSegments.find((item) => item.text.includes(phrase));
        if (!segment) continue;
        const start = segment.text.indexOf(phrase);
        const end = start + phrase.length;
        if (!(segment.highlights || []).some((mark) => mark.start === start && mark.end === end)) {
          segment.highlights = [...(segment.highlights || []), { type: "quote", start, end }];
        }
      }
      ensureAnnotationDensity(.25, Math.max(0, Number(globalThis.XYD_DEMO_DATA?.contentStartSeconds) || 0));
    }
    activeTranscriptIndex = -1;
    transcriptLang = "source";
    updateLangButton();
    renderTranscript();
    const companionColor = transcriptSegments.flatMap((segment) => segment.highlights || []).find((mark) => mark.type === "companion")?.color;
    if (companionColor) setCompanionDockColor(companionColor, true);
    if (persist && episode) {
      try {
        if (chrome.storage?.local) await chrome.storage.local.set({ [transcriptCacheKey()]: transcriptSegments });
        if (chrome.storage?.session) await chrome.storage.session.set({ [transcriptCacheKey()]: transcriptSegments });
        await touchHistory({ transcriptCount: transcriptSegments.length });
      } catch (_error) {}
    }
  }

  function highlightActiveEntry(currentSeconds, forceScroll = false) {
    highlightActiveChapter(currentSeconds);
    if (!transcriptSegments.length) return;
    let index = -1;
    for (let i = 0; i < transcriptSegments.length; i += 1) {
      const nextStart = transcriptSegments[i + 1]?.startSeconds ?? Number.POSITIVE_INFINITY;
      if (currentSeconds >= transcriptSegments[i].startSeconds && currentSeconds < nextStart) { index = i; break; }
    }
    if (index < 0 || index === activeTranscriptIndex) return;
    const previous = byId("transcriptList").querySelector(".active-playback");
    previous?.classList.remove("active-playback");
    previous?.removeAttribute("aria-current");
    const current = byId("transcriptList").querySelector(`[data-index="${index}"]`);
    current?.classList.add("active-playback");
    current?.setAttribute("aria-current", "true");
    activeTranscriptIndex = index;
    if (current && activeView === "transcript" && (Date.now() >= autoFollowPausedUntil || forceScroll)) {
      lastAutoScrollAt = Date.now();
      current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function playbackTrackingTick() {
    try {
      const response = await chrome.tabs.sendMessage(activeTabId, { action: "getPlaybackState" });
      if (response?.available) highlightActiveEntry(Number(response.currentTime) || 0);
    } catch (_error) {}
  }

  function startPlaybackTracking() {
    if (playbackTimer || !transcriptSegments.length) return;
    playbackTimer = setInterval(playbackTrackingTick, 650);
  }

  function stopPlaybackTracking() {
    if (playbackTimer) clearInterval(playbackTimer);
    playbackTimer = null;
  }

  function jumpToAnnotation(type, direction = 1) {
    const matches = transcriptSegments
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) => type === "case" ? segment.annotation?.type === "case" : (segment.highlights || []).some((mark) => mark.type === type));
    if (!matches.length) return;
    const next = direction > 0
      ? matches.find((item) => item.index > activeTranscriptIndex) || matches[0]
      : [...matches].reverse().find((item) => item.index < activeTranscriptIndex) || matches[matches.length - 1];
    switchView("transcript");
    // Scrolling through a cached transcript must not depend on the page player.
    // Audio seeking remains best-effort when the content script is connected.
    highlightActiveEntry(next.segment.startSeconds, true);
    seekTo(next.segment.startSeconds).catch(() => {});
  }

  function setAnnotationVisibility(type, visible) {
    annotationVisibility[type] = Boolean(visible);
    const className = type === "case" ? "hide-cases" : type === "quote" ? "hide-quotes" : "hide-companion";
    byId("transcriptList").classList.toggle(className, !annotationVisibility[type]);
    const button = byId(type === "case" ? "toggleCaseBtn" : type === "quote" ? "toggleQuoteBtn" : "toggleCompanionBtn");
    button?.setAttribute("aria-pressed", String(annotationVisibility[type]));
    if (type === "companion") {
      if (button) button.textContent = annotationVisibility.companion ? "隐藏划线" : "显示划线";
      const color = transcriptSegments.flatMap((segment) => segment.highlights || []).find((mark) => mark.type === "companion")?.color;
      setCompanionDockColor(color, Boolean(color) && annotationVisibility.companion);
    }
  }

  function setCompanionSheet(open) {
    byId("companionSheet").hidden = !open;
  }

  function setCompanionDockColor(color, active = true) {
    const dock = byId("readingDock");
    if (!dock) return;
    dock.classList.toggle("has-companion", Boolean(active));
    if (/^#[0-9a-f]{6}$/i.test(String(color || ""))) dock.style.setProperty("--active-companion-color", color);
  }

  function toggleMarkDockPanel(kind) {
    const panel = byId("markDockPanel");
    if (!panel) return;
    const button = kind === "highlight" ? byId("markHighlightBtn") : kind === "bold" ? byId("markBoldBtn") : kind === "custom" ? byId("markCustomBtn") : byId("transcriptLangBtn");
    const isOpen = panel.dataset.kind === kind && !panel.hidden;
    hideMarkDockPanel();
    if (isOpen) return;
    renderMarkDockPanel(kind);
    panel.dataset.kind = kind;
    panel.hidden = false;
    if (button?.getBoundingClientRect && window.innerWidth) {
      const rect = button.getBoundingClientRect();
      panel.style.left = `${Math.max(2, rect.left)}px`;
    }
    button?.setAttribute("aria-expanded", "true");
  }

  function hideMarkDockPanel() {
    const panel = byId("markDockPanel");
    if (panel) panel.hidden = true;
    byId("markHighlightBtn")?.setAttribute("aria-expanded", "false");
    byId("markBoldBtn")?.setAttribute("aria-expanded", "false");
    byId("markCustomBtn")?.setAttribute("aria-expanded", "false");
    byId("transcriptLangBtn")?.setAttribute("aria-expanded", "false");
  }

  function renderMarkDockPanel(kind) {
    const panel = byId("markDockPanel");
    panel.replaceChildren();
    const fourTypes = ["quote", "method", "case", "fact"];
    const fourLabels = { quote: "核心观点", method: "方法论", case: "案例分析", fact: "数据事实" };
    if (kind === "highlight" || kind === "bold") {
      const checks = document.createElement("span"); checks.className = "mdp-checks";
      const field = kind === "highlight" ? "highlightTypes" : "boldTypes";
      const current = settings?.[field]?.length ? settings[field] : (kind === "highlight" ? ["quote", "method"] : ["case", "fact"]);
      for (const cat of fourTypes) {
        checks.appendChild(buildDockCheck(cat, cat, fourLabels[cat], current.includes(cat)));
      }
      panel.append(checks);
      const regen = document.createElement("button");
      regen.type = "button";
      regen.className = "mdp-apply";
      regen.textContent = "重新生成";
      regen.addEventListener("click", () => { hideMarkDockPanel(); regenerateAnnotationsFromDock(kind); });
      panel.append(regen);
      return;
    }
    if (kind === "lang") {
      const langOptions = [["source", "原文"], ["zh-CN", "中文"], ["en", "英文"], ["zh-en", "双语"]];
      for (const [value, label] of langOptions) panel.append(buildLangOption(value, label));
      if (transcriptLang !== "source") {
        const regen = document.createElement("button");
        regen.type = "button";
        regen.className = "mdp-apply";
        regen.textContent = "重新生成译文";
        regen.addEventListener("click", () => { hideMarkDockPanel(); regenerateTranslation(); });
        panel.append(regen);
      }
      return;
    }
    const customLabels = { ai: "AI知识", product: "产品设计", business: "商业化思维", custom: "自定义" };
    const dir = settings?.customDirection || "";
    const checks = document.createElement("span"); checks.className = "mdp-checks";
    for (const item of ["ai", "product", "business"]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mdp-check" + (dir === item ? " selected" : "");
      btn.textContent = customLabels[item];
      if (customMarkResult?.key === item) btn.style.color = customMarkResult.color;
      btn.addEventListener("click", () => {
        settings = XYD_SETTINGS.normalize({ ...settings, customDirection: item });
        persistSettingsPatch().catch(() => {});
        renderMarkDockPanel("custom");
      });
      checks.appendChild(btn);
    }
    const customBtn = document.createElement("button");
    customBtn.type = "button";
    customBtn.className = "mdp-check mdp-custom" + (dir === "custom" ? " selected" : "");
    customBtn.textContent = "自定义";
    if (customMarkResult?.key === "custom") customBtn.style.color = customMarkResult.color;
    customBtn.addEventListener("click", () => {
      settings = XYD_SETTINGS.normalize({ ...settings, customDirection: "custom" });
      persistSettingsPatch().catch(() => {});
      renderMarkDockPanel("custom");
    });
    checks.appendChild(customBtn);
    const goalInput = document.createElement("input");
    goalInput.type = "text";
    goalInput.className = "mdp-goal";
    goalInput.value = settings?.customGoal || "";
    goalInput.placeholder = "自定义方向";
    goalInput.addEventListener("input", () => {
      const hasText = Boolean(goalInput.value.trim());
      settings = XYD_SETTINGS.normalize({ ...settings, customGoal: goalInput.value, customDirection: hasText ? "custom" : (settings?.customDirection === "custom" ? "" : settings.customDirection) });
      persistSettingsPatch().catch(() => {});
      renderMarkDockPanel("custom");
    });
    const colors = document.createElement("span"); colors.className = "mdp-colors";
    const colorVal = settings?.customColor || "#ff9500";
    for (const c of ["#ff9500", "#34c759", "#007aff", "#ff2d55", "#af52de"]) {
      const swatch = document.createElement("button"); swatch.type = "button"; swatch.style.setProperty("--swatch", c); swatch.dataset.color = c; swatch.className = colorVal === c ? "selected" : ""; swatch.setAttribute("aria-label", c);
      swatch.addEventListener("click", () => {
        settings = XYD_SETTINGS.normalize({ ...settings, customColor: c });
        persistSettingsPatch().catch(() => {});
        markCustomColor = c;
        setCompanionDockColor(c, true);
        renderMarkDockPanel("custom");
      });
      colors.appendChild(swatch);
    }
    panel.append(checks, goalInput, colors);
    const result = customMarkResult && customMarkResult.key === dir ? customMarkResult : null;
    if (result) {
      const row = document.createElement("div"); row.className = "mdp-result";
      const dot = document.createElement("span"); dot.className = "mdp-result-dot"; dot.style.setProperty("--swatch", result.color);
      const label = document.createElement("span"); label.className = "mdp-result-label"; label.textContent = result.label; label.style.color = result.color;
      const regen = document.createElement("button"); regen.type = "button"; regen.className = "mdp-result-icon"; regen.title = "重新生成"; regen.setAttribute("aria-label", "重新生成");
      regen.append(createActionIcon("refresh"));
      regen.addEventListener("click", () => regenerateCustomMark());
      const del = document.createElement("button"); del.type = "button"; del.className = "mdp-result-icon"; del.title = "删除"; del.setAttribute("aria-label", "删除");
      del.append(createActionIcon("delete"));
      del.addEventListener("click", () => removeCustomMark());
      row.append(dot, label, regen, del);
      panel.append(row);
    } else {
      const apply = document.createElement("button");
      apply.type = "button";
      apply.className = "mdp-apply";
      apply.textContent = "开始分析";
      apply.disabled = !dir;
      apply.addEventListener("click", () => runCustomMark());
      panel.append(apply);
    }
  }

  function buildLangOption(value, label) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mdp-check" + (transcriptLang === value ? " selected" : "");
    btn.textContent = label;
    btn.setAttribute("data-lang", value);
    btn.addEventListener("click", () => {
      translateTranscript(value);
      hideMarkDockPanel();
    });
    return btn;
  }

  function updateLangButton() {
    const label = ({ source: "原文", "zh-CN": "中文", en: "英文", "zh-en": "双语" })[transcriptLang] || "原文";
    const el = byId("transcriptLangLabel");
    if (el) el.textContent = label;
  }

  function buildDockCheck(dotClass, value, text, selected) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mdp-check" + (selected ? " selected" : "");
    const dot = document.createElement("span");
    dot.className = "mdp-dot " + dotClass;
    dot.style.setProperty("--swatch", dotClass === "quote" || dotClass === "fact" ? "#ffc928" : "#1d1d1f");
    btn.append(dot, document.createTextNode(text));
    btn.addEventListener("click", () => {
      const next = !selected;
      btn.classList.toggle("selected", next);
      // 判断当前展开的是哪个下拉：根据 value 属于哪类字段
      const panel = byId("markDockPanel");
      const kind = panel?.dataset?.kind || "highlight";
      const cfgKey = kind === "highlight" ? "highlightTypes" : kind === "bold" ? "boldTypes" : "customItems";
      const cur = new Set(settings?.[cfgKey]?.length ? settings[cfgKey] : (cfgKey === "customItems" ? [] : cfgKey === "highlightTypes" ? ["quote", "method"] : ["case", "fact"]));
      if (next) cur.add(value); else cur.delete(value);
      settings = XYD_SETTINGS.normalize({ ...settings, [cfgKey]: [...cur] });
      persistSettingsPatch().catch(() => {});
      renderTranscript();
      renderMarkDockPanel(kind);
    });
    return btn;
  }

  async function persistSettingsPatch() {
    if (episode) await chrome.storage.local.set({ [XYD_SETTINGS.STORAGE_KEY]: settings });
  }

  function historyTimestamp(value) {
    const date = new Date(Number(value) || Date.now());
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return sameDay
      ? `今天 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`
      : date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  }

  function renderHistoryEntries() {
    const root = byId("historyList");
    root.replaceChildren();
    const query = text(byId("historySearch").value, 100).toLocaleLowerCase("zh-CN");
    const visible = historyEntries.filter((item) => {
      if (historySourceFilter !== "all" && (item.source || "xiaoyuzhou") !== historySourceFilter) return false;
      if (historyFavoriteOnly && !item.favorite) return false;
      return !query || `${item.title || ""} ${item.podcast || ""}`.toLocaleLowerCase("zh-CN").includes(query);
    });
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      const title = document.createElement("strong");
      title.textContent = query || historySourceFilter !== "all" || historyFavoriteOnly ? "没找到匹配的记录" : "还没有阅读记录";
      const detail = document.createElement("span");
      detail.textContent = query || historySourceFilter !== "all" || historyFavoriteOnly ? "试试其他关键词或取消筛选" : "打开一期节目开始精读吧";
      empty.append(title, detail);
      root.appendChild(empty);
      return;
    }
    for (const value of visible) {
      const item = document.createElement("article");
      item.className = "history-item";
      item.dataset.episodeId = value.episodeId;
      const icon = document.createElement("span");
      icon.className = "history-item-icon";
      icon.setAttribute("aria-hidden", "true");
      const open = document.createElement("button");
      open.type = "button";
      open.className = "history-item-open";
      const title = document.createElement("strong");
      title.textContent = value.title || `已保存单集 ${value.episodeId.slice(0, 8)}…`;
      const meta = document.createElement("small");
      const metadata = [historyTimestamp(value.updatedAt)];
      if (value.duration) metadata.push(formatTime(value.duration));
      metadata.push(`${Math.max(0, Number(value.noteCount) || 0)} 条笔记`);
      meta.textContent = metadata.join(" · ");
      open.append(title, meta);
      open.addEventListener("click", async () => {
        const url = value.pageUrl || `https://www.xiaoyuzhoufm.com/episode/${value.episodeId}`;
        setHistoryPage(false);
        if (activeTabId) await chrome.tabs.update(activeTabId, { url });
        else await chrome.tabs.create({ url });
      });
      const actions = document.createElement("span");
      actions.className = "history-actions";
      const favorite = document.createElement("button");
      favorite.type = "button";
      favorite.className = "history-favorite";
      favorite.setAttribute("aria-label", value.favorite ? `取消收藏 ${title.textContent}` : `收藏 ${title.textContent}`);
      favorite.setAttribute("aria-pressed", String(Boolean(value.favorite)));
      const renderFavoriteIcon = () => {
        const star = createActionIcon("star");
        star.classList.add("history-action-svg");
        star.classList.toggle("filled", Boolean(value.favorite));
        favorite.replaceChildren(star);
      };
      renderFavoriteIcon();
      favorite.addEventListener("click", async (event) => {
        event.stopPropagation();
        value.favorite = !value.favorite;
        favorite.setAttribute("aria-pressed", String(value.favorite));
        favorite.setAttribute("aria-label", value.favorite ? `取消收藏 ${title.textContent}` : `收藏 ${title.textContent}`);
        renderFavoriteIcon();
        await chrome.storage.local.set({ [HISTORY_INDEX_KEY]: historyEntries });
        if (historyFavoriteOnly && !value.favorite) renderHistoryEntries();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "history-remove-icon";
      remove.setAttribute("aria-label", `删除 ${title.textContent}`);
      remove.title = "删除记录";
      const deleteIcon = createActionIcon("delete");
      deleteIcon.classList.add("history-action-svg");
      remove.appendChild(deleteIcon);
      remove.addEventListener("click", async (event) => {
        event.stopPropagation();
        const next = historyEntries.filter((entry) => entry.episodeId !== value.episodeId);
        const entryPlatform = (value?.source && value.source !== "xiaoyuzhou" && value.source) || XYD_PLATFORM?.episodeIdPlatform?.(value?.pageUrl || "") || "xiaoyuzhou";
        await chrome.storage.local.remove([
          XYD_PLATFORM.storageKey(entryPlatform, value.episodeId),
          `xyd_transcript_${value.episodeId}`,
          `xyd_notes_${value.episodeId}`,
        ]);
        await chrome.storage.local.set({ [HISTORY_INDEX_KEY]: next });
        historyEntries = next;
        renderHistoryEntries();
        showToast("已删除记录");
      });
      actions.append(favorite, remove);
      item.append(icon, open, actions);
      root.appendChild(item);
    }
  }

  async function loadHistoryEntries() {
    const all = await chrome.storage.local.get(null);
    const entries = new Map();
    const merge = (episodeId, value = {}) => {
      if (!episodeId || episodeId === "unknown") return;
      entries.set(episodeId, { source: "xiaoyuzhou", favorite: false, ...(entries.get(episodeId) || {}), episodeId, ...value });
    };
    for (const item of Array.isArray(all[HISTORY_INDEX_KEY]) ? all[HISTORY_INDEX_KEY] : []) merge(item?.episodeId, item);
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith("xyd_digest_") && value?.digest) merge(key.slice("xyd_digest_".length), { hasDigest: true, updatedAt: value.savedAt || 0 });
      if (key.startsWith("xyd_transcript_") && Array.isArray(value) && value.length) merge(key.slice("xyd_transcript_".length), { transcriptCount: value.length });
      if (key.startsWith("xyd_notes_") && Array.isArray(value) && value.length) merge(key.slice("xyd_notes_".length), { noteCount: value.length });
    }
    if (episode) merge(episode.id, {
      title: episode.title,
      podcast: episode.podcast,
      pageUrl: episode.pageUrl,
      transcriptCount: transcriptSegments.length,
      hasDigest: Boolean(currentDigest),
      noteCount: readerNotes.length,
      updatedAt: entries.get(episode.id)?.updatedAt || Date.now(),
    });
    historyEntries = [...entries.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    renderHistoryEntries();
  }

  async function setHistoryPage(open) {
    if (open) historyReturnView = activeView;
    setProfilePage(open);
    if (open) {
      await loadHistoryEntries();
    } else if (episode) switchView(historyReturnView);
  }

  function setCompanionButtonLabel(label, showArrow = true) {
    const button = byId("startCompanionBtn");
    const title = document.createElement("span");
    title.textContent = label;
    if (!showArrow) {
      button.replaceChildren(title);
      return;
    }
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    button.replaceChildren(title, arrow);
  }

  function selectCompanion(id) {
    selectedCompanion = COMPANIONS[id] ? id : "";
    selectedCompanionColor = COMPANIONS[selectedCompanion]?.color || COMPANIONS.custom.color;
    byId("companionChoices").hidden = false;
    byId("startCompanionBtn").hidden = false;
    byId("companionResultHeader").hidden = true;
    byId("companionNotes").replaceChildren();
    document.querySelectorAll(".companion-choice").forEach((button) => button.classList.toggle("selected", button.dataset.companion === selectedCompanion));
    const persona = COMPANIONS[selectedCompanion];
    const isCustom = selectedCompanion === "custom";
    byId("customCompanionEditor").hidden = !isCustom;
    byId("companionColorPicker").hidden = !selectedCompanion;
    byId("companionColorPicker").querySelectorAll("[data-color]").forEach((button) => button.classList.toggle("selected", button.dataset.color === selectedCompanionColor));
    const customReady = text(byId("customCompanionPrompt").value, 500).length > 0;
    byId("startCompanionBtn").disabled = !selectedCompanion || (isCustom && !customReady);
    byId("companionStatus").hidden = true;
    byId("companionStatus").textContent = "";
    if (isCustom) byId("customCompanionPrompt").focus();
  }

  function resetCompanionResult() {
    selectedCompanion = "";
    companionNotesState = [];
    setAnnotationVisibility("companion", false);
    document.querySelectorAll(".companion-choice").forEach((button) => button.classList.remove("selected"));
    byId("companionChoices").hidden = false;
    byId("customCompanionEditor").hidden = true;
    byId("companionColorPicker").hidden = true;
    byId("startCompanionBtn").hidden = false;
    byId("startCompanionBtn").disabled = true;
    setCompanionButtonLabel("开始共读");
    byId("companionResultHeader").hidden = true;
    byId("companionStatus").hidden = true;
    byId("companionStatus").textContent = "";
    byId("companionNotes").replaceChildren();
  }

  function buildCompanionPreview(id) {
    if (episode?.id !== DEMO_EPISODE_META.id) return [];
    return normalizeCompanionNotes(DEMO_COMPANION_NOTES[id] || [], selectedCompanionColor);
  }

  function normalizeCompanionNotes(notes, color = selectedCompanionColor) {
    return (Array.isArray(notes) ? notes : []).slice(0, 18).map((note) => {
      const fallbackStart = Math.max(0, Number(note?.startSeconds) || 0);
      const rawHighlights = Array.isArray(note?.highlights) && note.highlights.length
        ? note.highlights
        : note?.highlightText ? [{ startSeconds: fallbackStart, text: note.highlightText }] : [];
      const highlights = rawHighlights.slice(0, 3).map((highlight) => ({
        startSeconds: Math.max(0, Number(highlight?.startSeconds) || fallbackStart),
        text: text(highlight?.text, 600),
      })).filter((highlight) => highlight.text.length >= 4);
      return {
        startSeconds: highlights[0]?.startSeconds ?? fallbackStart,
        title: text(note?.title, 100),
        detail: text(note?.detail, 600),
        highlights,
        highlightText: highlights[0]?.text || "",
        color: appleCompanionColor(note?.color || color),
      };
    }).filter((note) => note.title && note.detail && note.highlights.length);
  }

  async function applyCompanionHighlights(notes) {
    for (const segment of transcriptSegments) segment.highlights = (segment.highlights || []).filter((mark) => mark.type !== "companion");
    const normalized = normalizeCompanionNotes(notes);
    for (const note of normalized) {
      const matched = [];
      for (const excerpt of note.highlights) {
        const candidates = transcriptSegments
          .map((segment) => ({ segment, distance: Math.abs(segment.startSeconds - excerpt.startSeconds) }))
          .filter((item) => item.segment.text.includes(excerpt.text))
          .sort((a, b) => (a.distance <= 300 ? 0 : 1) - (b.distance <= 300 ? 0 : 1) || a.distance - b.distance);
        const candidate = candidates[0]?.segment;
        if (!candidate) continue;
        const start = candidate.text.indexOf(excerpt.text);
        const end = start + excerpt.text.length;
        const marks = candidate.highlights || [];
        if (!marks.some((mark) => mark.type === "companion" && mark.start === start && mark.end === end)) {
          candidate.highlights = [...marks, { type: "companion", color: note.color || selectedCompanionColor, start, end }];
        }
        matched.push({ startSeconds: candidate.startSeconds, text: excerpt.text });
      }
      note.highlights = matched;
      note.highlightText = matched[0]?.text || "";
      note.startSeconds = matched[0]?.startSeconds ?? note.startSeconds;
    }
    await setTranscript(transcriptSegments, true);
    return normalized.filter((note) => note.highlights.length);
  }

  function renderCompanionNotes(notes, persona, preview = false) {
    companionNotesState = normalizeCompanionNotes(notes, selectedCompanionColor);
    if (companionNotesState.length) setCompanionDockColor(companionNotesState[0].color || selectedCompanionColor, true);
    const root = byId("companionNotes");
    root.replaceChildren();
    byId("companionChoices").hidden = true;
    byId("customCompanionEditor").hidden = true;
    byId("companionColorPicker").hidden = true;
    byId("startCompanionBtn").hidden = true;
    byId("companionResultHeader").hidden = false;
    byId("companionResultTitle").textContent = persona.name;
    for (const note of companionNotesState) {
      const item = document.createElement("div");
      item.className = preview ? "companion-note preview" : "companion-note";
      item.style.setProperty("--companion-color", note.color || selectedCompanionColor);
      item.tabIndex = 0;
      const time = document.createElement("time");
      time.textContent = formatTime(note.startSeconds);
      const content = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = note.title;
      const detail = document.createElement("p");
      detail.textContent = note.detail;
      content.append(title, detail);
      const actions = document.createElement("span");
      actions.className = "companion-note-actions";
      const save = document.createElement("button");
      save.type = "button";
      save.title = "收藏到笔记";
      save.setAttribute("aria-label", "收藏到笔记");
      save.appendChild(createActionIcon("note"));
      save.addEventListener("click", async (event) => {
        event.stopPropagation();
        await addReaderNote({ kind: "quote", title: `${persona.name} · ${note.title}`, sourceText: note.highlights.map((highlight) => highlight.text).join("\n\n"), body: note.detail, color: note.color || selectedCompanionColor, startSeconds: note.startSeconds, sourceId: `companion:${selectedCompanion}:${note.startSeconds}:${note.title}` });
      });
      const jump = document.createElement("button");
      jump.type = "button";
      jump.title = "回到原文";
      jump.setAttribute("aria-label", "回到原文");
      jump.appendChild(createActionIcon("source"));
      actions.append(save, jump);
      item.append(time, content, actions);
      item.addEventListener("click", () => {
        setCompanionSheet(false);
        jumpToTranscript(note.startSeconds);
      });
      root.appendChild(item);
    }
  }

  async function runCompanion() {
    const basePersona = COMPANIONS[selectedCompanion];
    if (!basePersona || !transcriptSegments.length) return;
    const companionId = selectedCompanion;
    const customGoal = text(byId("customCompanionPrompt").value, 500);
    if (selectedCompanion === "custom" && !customGoal) {
      showToast("先告诉搭子，这次想重点关注什么");
      return;
    }
    const persona = selectedCompanion === "custom"
      ? { ...basePersona, prompt: `${basePersona.prompt}读者本次的关注目标是：${customGoal}` }
      : basePersona;
    if (!settings?.aiApiKey) {
      showToast("先在设置中填写 DeepSeek API Key");
      return;
    }
    const button = byId("startCompanionBtn");
    button.disabled = true;
    setCompanionButtonLabel(`${persona.name}正在阅读…`, false);
    let previewNotes = [];
    try {
      previewNotes = await applyCompanionHighlights(buildCompanionPreview(selectedCompanion));
      if (previewNotes.length) {
        setAnnotationVisibility("companion", true);
        renderCompanionNotes(previewNotes, persona, true);
      }
      else {
        byId("companionResultHeader").hidden = false;
        byId("companionResultTitle").textContent = persona.name;
      }
      byId("companionStatus").classList.add("reading");
      byId("companionStatus").hidden = false;
      byId("companionStatus").textContent = "正在继续阅读…";
      const contentStart = detectedContentStart();
      const material = transcriptSegments
        .filter((segment) => segment.startSeconds >= contentStart)
        .map((segment) => `[${formatTime(segment.startSeconds)}] ${segment.text}`)
        .join("\n")
        .slice(0, 110000);
      const result = await callDeepSeek(
        `你是播客共读编辑。${persona.prompt}\n\n执行规则：\n1. 先通读后按“与角色相关度、信息增量、证据完整度、可复用性”各1–5分在心里排序，只输出总分至少15分的5–12条；不足5条就如实少选。\n2. 笔记要分布在整期正文，但不能为了分布或数量选择广告、名单和空话。\n3. 每条可精确划一句，也可划2–3处相邻或分开的原文。只选支撑旁注的最小充分证据：观点划一句，事件可划完整动作链。\n4. highlights.text 必须是逐字稿中8–400字的连续原文，一字不改；startSeconds 填该原文附近时间。\n5. title 具体、有角色口吻；detail 用2–4句完成“判断—证据—为什么重要”，禁用‘值得关注、很有启发、体现了、揭示了’等空话。\n6. 不得发明人物、数字、因果和立场；广告价格、节目期数、嘉宾名单即使有数字也不得入选。\n只返回 JSON：{"notes":[{"title":"","detail":"","highlights":[{"startSeconds":0,"text":""}]}]}。${configurablePrompt("companionPrompt")}`,
        `节目：${episode.title}\n\n逐字稿：\n${material}`,
        4500,
      );
      if (selectedCompanion !== companionId) return;
      const notes = normalizeCompanionNotes(result?.notes, selectedCompanionColor);
      if (notes.length) {
        const appliedNotes = await applyCompanionHighlights(notes);
        if (appliedNotes.length) renderCompanionNotes(appliedNotes, persona);
        else if (previewNotes.length) {
          const restoredPreview = await applyCompanionHighlights(previewNotes);
          renderCompanionNotes(restoredPreview, persona);
          showToast("新笔记没有精确命中原文，已保留当前笔记");
        }
      } else if (!previewNotes.length) {
        showToast("这次没找到足够相关的内容");
      }
      setAnnotationVisibility("companion", true);
    } catch (error) {
      if (selectedCompanion !== companionId) return;
      showToast(previewNotes.length ? "这次没读完，已保留当前笔记" : error?.message || "这次没读完，请稍后重试");
    } finally {
      if (selectedCompanion === companionId) {
        byId("companionStatus").hidden = true;
        byId("companionStatus").classList.remove("reading");
        byId("companionStatus").textContent = "";
        button.disabled = false;
        setCompanionButtonLabel("重新生成共读笔记");
      }
    }
  }

  let customMarkColor = "#ff9500";
  let customMarkResult = null;
  function customMarkGoal() {
    const dir = settings?.customDirection || "";
    const itemMap = { ai: "AI 前沿知识、模型/数据/Agent 工作机制", product: "产品设计、用户问题与产品动作的取舍", business: "商业化思维、商业模式、收入/成本/增长逻辑" };
    if (dir === "custom") return (settings?.customGoal || "").trim();
    return itemMap[dir] || "";
  }

  async function runCustomMark() {
    if (!transcriptSegments.length) return showToast("还没有原文，先完成转写");
    if (!settings?.aiApiKey) return showToast("先在设置中填写 DeepSeek API Key");
    const dir = settings?.customDirection || "";
    if (!dir) return showToast("请先选择一个分析方向");
    customMarkColor = settings?.customColor || customMarkColor;
    const goal = customMarkGoal();
    if (!goal) return showToast("请先填写自定义方向内容");
    showToast("正在智能分析…");
    const contentStart = detectedContentStart();
    const material = transcriptSegments
      .filter((segment) => segment.startSeconds >= contentStart)
      .map((segment) => `[${formatTime(segment.startSeconds)}] ${segment.text}`)
      .join("\n")
      .slice(0, 110000);
    const result = await callDeepSeek(
      `你是中文播客精读编辑。只返回 JSON：{"notes":[{"title":"","detail":"","highlights":[{"startSeconds":0,"text":""}]}]}。
规则：
1. 只划与目标高度相关、能改变理解的原文，8–400字连续原文，一字不改；startSeconds 填原文附近时间。
2. 目标：${goal}。
3. 不得发明人物、数字、因果；广告价格、节目期数、嘉宾名单即使有数字也不得入选。
4. 只返回 JSON。${configurablePrompt("highlightPrompt")}`,
      `节目：${episode.title}\n\n逐字稿：\n${material}`,
      4500,
    );
    const notes = normalizeCompanionNotes(Array.isArray(result?.notes) ? result.notes : [], customMarkColor);
    const applied = await applyCustomHighlights(notes, dir);
    if (!applied) { showToast("没有精确命中原文的段落，请调整方向后重试"); return; }
    const label = ({ ai: "AI知识", product: "产品设计", business: "商业化思维", custom: (settings?.customGoal || "自定义").trim().slice(0, 10) || "自定义" })[dir];
    customMarkResult = { key: dir, label, color: customMarkColor, appliedCount: applied };
    setAnnotationVisibility("companion", true);
    setCompanionDockColor(customMarkColor, true);
    renderMarkDockPanel("custom");
    renderTranscript();
    showToast(`已按「${label}」分析出 ${applied} 条`);
  }

  async function applyCustomHighlights(notes, key) {
    for (const segment of transcriptSegments) segment.highlights = (segment.highlights || []).filter((mark) => !(mark.type === "companion" && mark.customKey === key));
    const normalized = normalizeCompanionNotes(notes);
    let count = 0;
    for (const note of normalized) {
      for (const excerpt of note.highlights) {
        const candidates = transcriptSegments
          .map((segment) => ({ segment, distance: Math.abs(segment.startSeconds - excerpt.startSeconds) }))
          .filter((item) => item.segment.text.includes(excerpt.text))
          .sort((a, b) => (a.distance <= 300 ? 0 : 1) - (b.distance <= 300 ? 0 : 1) || a.distance - b.distance);
        const candidate = candidates[0]?.segment;
        if (!candidate) continue;
        const start = candidate.text.indexOf(excerpt.text);
        const end = start + excerpt.text.length;
        const marks = candidate.highlights || [];
        if (!marks.some((mark) => mark.type === "companion" && mark.customKey === key && mark.start === start && mark.end === end)) {
          candidate.highlights = [...marks, { type: "companion", color: note.color, customKey: key, custom: true, start, end }];
        }
        count += 1;
      }
    }
    await setTranscript(transcriptSegments, true);
    return count;
  }

  async function regenerateCustomMark() {
    if (!customMarkResult) return;
    settings = XYD_SETTINGS.normalize({ ...settings, customDirection: customMarkResult.key });
    await runCustomMark();
  }

  async function removeCustomMark() {
    if (!customMarkResult) return;
    const key = customMarkResult.key;
    for (const segment of transcriptSegments) segment.highlights = (segment.highlights || []).filter((mark) => !(mark.type === "companion" && mark.customKey === key));
    await setTranscript(transcriptSegments, true);
    customMarkResult = null;
    renderTranscript();
    renderMarkDockPanel("custom");
    showToast("已删除该方向分析");
  }
  function renderList(containerId, items, renderer, emptyText) {
    const root = byId(containerId);
    root.replaceChildren();
    if (!items.length) {
      const p = document.createElement("p"); p.className = "hint"; p.textContent = emptyText; root.appendChild(p); return;
    }
    items.forEach((item, index) => root.appendChild(renderer(item, index)));
  }

  function appendInlineMarkdown(element, content) {
    const parts = String(content || "").split(/(\*\*[^*]+\*\*)/g);
    for (const part of parts) {
      const bold = part.match(/^\*\*(.+)\*\*$/);
      if (bold) {
        const strong = document.createElement("strong");
        strong.textContent = bold[1];
        element.appendChild(strong);
      } else if (part) element.appendChild(document.createTextNode(part));
    }
  }

  function renderDocumentOutline(value) {
    const root = byId("quickRead");
    root.replaceChildren();
    const lists = [];
    const lastItems = [];
    let skipSection = false;
    const resetLists = () => { lists.length = 0; lastItems.length = 0; };
    for (const rawLine of String(value || "").split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (!line.trim()) continue;
      const headingMatch = line.trim().match(/^#{2,4}\s+(.+)$/);
      if (headingMatch) {
        const label = headingMatch[1].trim();
        skipSection = /^(产品设计观察|核心观点|收听线索|阅读建议|可以带走的产品判断)$/.test(label);
        resetLists();
        if (skipSection) continue;
        const heading = document.createElement(headingMatch[0].startsWith("###") ? "h4" : "h3");
        appendInlineMarkdown(heading, label);
        root.appendChild(heading);
        continue;
      }
      if (skipSection) continue;
      const bullet = line.replace(/^\t/, "  ").match(/^(\s*)[-*•·]\s+(.+)$/);
      if (bullet) {
        let level = Math.min(2, Math.floor(bullet[1].replace(/\t/g, "  ").length / 2));
        if (level > 0 && !lastItems[level - 1]) level = 0;
        if (!lists[level]) {
          const nestedList = document.createElement("ul");
          nestedList.className = `outline-level-${level + 1}`;
          if (level === 0) root.appendChild(nestedList);
          else lastItems[level - 1].appendChild(nestedList);
          lists[level] = nestedList;
        }
        lists.splice(level + 1);
        lastItems.splice(level + 1);
        const item = document.createElement("li");
        appendInlineMarkdown(item, bullet[2]);
        lists[level].appendChild(item);
        lastItems[level] = item;
        continue;
      }
      const paragraph = document.createElement("p");
      appendInlineMarkdown(paragraph, line.trim().replace(/^#{1,6}\s*/, ""));
      root.appendChild(paragraph);
      resetLists();
    }
  }

  function renderOverview(overview) {
    const root = byId("quickRead");
    root.replaceChildren();
    if (overview?.opening) {
      const opening = document.createElement("p");
      opening.className = "overview-opening";
      appendInlineMarkdown(opening, overview.opening);
      root.appendChild(opening);
    }
    for (const section of overview?.sections || []) {
      const heading = document.createElement("h3");
      heading.textContent = section.heading;
      root.appendChild(heading);
      const list = document.createElement("ul");
      list.className = "overview-points";
      for (const point of section.points || []) {
        const li = document.createElement("li");
        appendInlineMarkdown(li, point);
        list.appendChild(li);
      }
      root.appendChild(list);
    }
  }

  function summaryMarkdown(view = activeSummaryView) {
    if (!currentDigest) return "";
    if (view === "timeline") {
      return currentDigest.chapters.map((chapter) => [
        `## ${formatTime(chapter.startSeconds)} ${chapter.title}`,
        chapter.summary || chapter.detail || "",
        ...(chapter.points || []).map((point) => `- ${point}`),
      ].filter(Boolean).join("\n")).join("\n\n");
    }
    if (currentDigest.overview?.sections?.length) {
      return [currentDigest.overview.opening, ...currentDigest.overview.sections.flatMap((section) => [
        `## ${section.heading}`,
        ...(section.points || []).map((point) => `- ${point}`),
      ])].filter(Boolean).join("\n\n");
    }
    return currentDigest.quickRead || "";
  }

  function safeFileName(value) {
    return text(value || "小黄笔", 80).replace(/[\\/:*?"<>|]/g, "-");
  }

  function summaryPlainText() {
    return summaryMarkdown().replace(/^#{1,6}\s+/gm, "").replace(/^[-*]\s+/gm, "· ").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\n{3,}/g, "\n\n").trim();
  }

  function downloadSummary(content, extension, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(episode?.title)}-${activeSummaryView === "timeline" ? "时间轴摘要" : "要点精读"}.${extension}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCurrentSummary(format) {
    const markdown = summaryMarkdown();
    if (!markdown) return showToast("还没有可导出的摘要");
    if (format === "txt") return downloadSummary(markdown.replace(/^#{1,6}\s+/gm, "").replace(/^[-*]\s+/gm, "· "), "txt", "text/plain;charset=utf-8");
    if (format === "md") return downloadSummary(markdown, "md", "text/markdown;charset=utf-8");
    const escaped = markdown.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const body = escaped.replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^[-*] (.+)$/gm, "<p>• $1</p>").replace(/\n\n/g, "<br>");
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${safeFileName(episode?.title)}</title><style>body{max-width:760px;margin:56px auto;font:17px/1.75 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;color:#1d1d1f}h1{font-size:30px}h2{margin-top:30px;font-size:21px}p{margin:8px 0}</style><h1>${safeFileName(episode?.title)}</h1>${body}</html>`;
    if (format === "web") return downloadSummary(html, "html", "text/html;charset=utf-8");
    if (format === "doc") return downloadSummary(html, "doc", "application/msword;charset=utf-8");
    const printWindow = window.open("", "_blank");
    if (!printWindow) return showToast("请允许弹窗后再导出 PDF");
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.addEventListener("load", () => printWindow.print(), { once: true });
  }

  function summaryLengthLabel(value) {
    return { short: "简短·2-3分钟", medium: "中等·3-5分钟", long: "详细·6-8分钟" }[value] || "中等·3-5分钟";
  }

  function syncSummaryControls() {
    if (!settings) return;
    byId("summaryAutoGenerateToggle").checked = Boolean(settings.summaryAutoGenerate);
    byId("summaryAutoTranslateToggle").checked = Boolean(settings.summaryAutoTranslate);
    byId("summaryLanguageSelect").value = ["zh-CN", "en", "zh-en"].includes(settings.summaryLanguage) ? settings.summaryLanguage : "zh-CN";
    syncSummaryLengthToolbar();
  }

  function syncSummaryLengthToolbar() {
    const el = byId("summaryLengthLabel");
    if (el) el.textContent = summaryLengthLabel(settings?.summaryLength || "medium");
  }

  function renderSummaryLengthOptions() {
    const panel = byId("summaryLengthPanel");
    if (!panel) return;
    panel.querySelectorAll("[data-length]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.length === (settings?.summaryLength || "medium"));
    });
  }

  async function saveSummaryControls() {
    settings = XYD_SETTINGS.normalize({
      ...settings,
      summaryLength: settings.summaryLength,
      summaryAutoGenerate: byId("summaryAutoGenerateToggle").checked,
      summaryAutoTranslate: byId("summaryAutoTranslateToggle").checked,
      summaryLanguage: byId("summaryLanguageSelect").value,
    });
    await chrome.storage.local.set({ [XYD_SETTINGS.STORAGE_KEY]: settings });
    syncSummaryControls();
    showToast("已保存");
  }

  function renderDigest(value) {
    const digest = normalizeDigest(value, episode.duration);
    currentDigest = digest;
    syncSummaryControls();
    if (digest.overview?.sections?.length) renderOverview(digest.overview);
    else renderDocumentOutline(digest.quickRead);
    byId("addQuickReadNoteBtn").onclick = () => addReaderNote({
      kind: "summary",
      title: "节目笔记",
      sourceText: digest.overview?.sections?.length
        ? [digest.overview.opening, ...digest.overview.sections.flatMap((sec) => [`## ${sec.heading}`, ...sec.points.map((p) => `- ${p}`)])].filter(Boolean).join("\n")
        : digest.quickRead,
      body: "",
      startSeconds: digest.contentStartSeconds,
      sourceId: "summary:quick-read",
    });
    renderList("chapters", digest.chapters, (item, index) => {
      const el = document.createElement("article"); el.className = "chapter-detail";
      const header = document.createElement("div"); header.className = "chapter-detail-header";
      const left = document.createElement("div"); left.className = "chapter-detail-left";
      const indexLabel = document.createElement("span"); indexLabel.className = "chapter-index"; indexLabel.textContent = formatTime(item.startSeconds);
      const strong = document.createElement("h3"); strong.textContent = item.title;
      left.append(indexLabel, strong);
      header.append(left);
      const actions = document.createElement("span"); actions.className = "chapter-actions";
      const source = document.createElement("button"); source.type = "button"; source.className = "chapter-action"; source.title = "跳转原文"; source.setAttribute("aria-label", "跳转原文");
      source.append(createActionIcon("source"));
      source.addEventListener("click", (event) => { event.stopPropagation(); jumpToTranscript(item.startSeconds); });
      actions.appendChild(source);
      const note = document.createElement("button"); note.type = "button"; note.className = "chapter-action"; note.title = "加入笔记"; note.setAttribute("aria-label", "加入笔记");
      note.append(createActionIcon("note"));
      note.addEventListener("click", (event) => {
        event.stopPropagation();
        addReaderNote({ kind: "quote", title: `${item.title}`, sourceText: item.detail || item.summary || "", body: "", startSeconds: item.startSeconds, sourceId: `chapter:${item.startSeconds}:${item.title}` }).catch(() => {});
      });
      actions.appendChild(note);
      const points = Array.isArray(item.points) ? item.points.filter(Boolean) : [];
      let body = null;
      if (points.length) {
        const expand = document.createElement("button"); expand.type = "button"; expand.className = "chapter-expand"; expand.setAttribute("aria-expanded", "false");
        const caret = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        caret.setAttribute("viewBox", "0 0 24 24");
        caret.setAttribute("class", "tabler-icon chapter-expand-caret");
        caret.setAttribute("aria-hidden", "true");
        const caretPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        caretPath.setAttribute("d", "m6 9 6 6 6-6");
        caret.appendChild(caretPath);
        const expandLabel = document.createElement("span"); expandLabel.textContent = "展开";
        expand.append(caret, expandLabel);
        body = document.createElement("div"); body.className = "chapter-detail-body"; body.hidden = true;
        const list = document.createElement("ul"); list.className = "chapter-detail-list chapter-detail-points";
        for (const point of points) {
          const li = document.createElement("li");
          appendInlineMarkdown(li, point);
          list.appendChild(li);
        }
        body.appendChild(list);
        expand.addEventListener("click", (event) => {
          event.stopPropagation();
          const open = body.hidden;
          body.hidden = !open;
          expand.setAttribute("aria-expanded", String(!open));
          expandLabel.textContent = open ? "收起" : "展开";
        });
        actions.appendChild(expand);
      }
      header.append(actions);
      el.append(header);
      if (item.detail) {
        // detail 内若用 markdown 圆点（- / · ）分点，拆成黄色圆点列表；否则整体作为一段正文。
        const detailText = text(item.detail, 3500);
        const lines = detailText.split("\n").map((line) => line.trim()).filter(Boolean);
        const bulletLines = lines.filter((line) => /^[-*•·]\s+/.test(line));
        if (bulletLines.length > 1) {
          const list = document.createElement("ul"); list.className = "chapter-detail-list";
          for (const line of lines) {
            const bullet = line.match(/^[-*•·]\s+(.+)$/);
            const li = document.createElement("li");
            li.textContent = bullet ? bullet[1].trim() : line;
            list.appendChild(li);
          }
          el.appendChild(list);
        } else {
          const pd = document.createElement("p"); pd.className = "chapter-detail-text"; pd.textContent = detailText;
          el.appendChild(pd);
        }
      }
      if (body) el.append(body);
      return el;
    }, "没有可用章节。");
    activeChapterIndex = -1;
    activeRailIndex = -1;
    renderTranscript();
    showOnlyMain("digest");
    switchView("summary");
    return digest;
  }

  async function run(mode = "full", options = {}) {
    lastMode = mode;
    try {
      const latestSettings = await chrome.storage.local.get(XYD_SETTINGS.STORAGE_KEY);
      settings = XYD_SETTINGS.normalize(latestSettings[XYD_SETTINGS.STORAGE_KEY]);
      if (!settings.aiApiKey) throw new Error("请先在设置中填写 DeepSeek API Key。");
      if (mode === "full" && settings.asrProvider === "supadata" && !settings.supadataApiKey) throw new Error("完整精读需要 Supadata API Key。");
      if (mode === "full" && settings.asrProvider === "aliyun" && !settings.dashscopeApiKey) throw new Error("完整精读需要阿里云百炼 DashScope API Key。");
      if (!episode) throw new Error("没有读取到当前单集，请回到小宇宙单集页面后重试。");
      const digest = renderDigest(normalizeDigest(await fullDigest(Boolean(options.forceAsr)), episode.duration));
      await chrome.storage.local.set({ [XYD_PLATFORM.storageKey(currentPlatformId(), episode.id)]: { digest, mode: "full", savedAt: Date.now() } });
      await touchHistory({ hasDigest: true });
        await recordProgressStage();
      progressStageName = "";
    } catch (error) { showError(error); }
  }

  async function persistDigestToStorage(digest) {
    if (!episode || !digest) return;
    await chrome.storage.local.set({ [XYD_PLATFORM.storageKey(currentPlatformId(), episode.id)]: { digest, mode: "full", savedAt: Date.now() } });
    await touchHistory({ hasDigest: true, transcriptCount: transcriptSegments.length });
  }

  function normalizePageEpisode(raw, pageUrl) {
    if (!raw || raw.type !== "EPISODE") return null;
    const audioUrl = String(raw.enclosure?.url || raw.media?.url || raw.media?.source?.url || "").trim();
    if (!/^https:\/\//.test(audioUrl)) return null;
    const podcast = typeof raw.podcast === "string" ? raw.podcast : raw.podcast?.title || raw.podcast?.name || "";
    return {
      id: String(raw.eid || XYD_SETTINGS.episodeIdFromUrl(pageUrl) || ""),
      title: text(raw.title || "未命名单集", 500),
      podcast: text(podcast, 300),
      description: text(raw.description || raw.shownotes || "", 100000),
      duration: Math.max(0, Number(raw.duration) || 0),
      audioUrl,
      pageUrl: String(pageUrl || "").split("?")[0],
    };
  }

  async function fetchEpisodeFromPage(pageUrl) {
    const platform = XYD_PLATFORM?.detectPlatform?.(pageUrl);
    if (!platform) return null;
    const response = await fetch(pageUrl, { credentials: "omit", cache: "no-store" });
    if (!response.ok) return null;
    const html = await response.text();
    if (platform.id === "youtube") {
      const player = XYD_PLATFORM.youtubePlayerResponseFromHtml(html);
      return platform.normalizePageData(player, pageUrl);
    }
    const documentNode = new DOMParser().parseFromString(html, "text/html");
    try {
      const data = JSON.parse(documentNode.getElementById("__NEXT_DATA__")?.textContent || "{}");
      const normalized = normalizePageEpisode(data?.props?.pageProps?.episode, pageUrl);
      if (normalized) return normalized;
    } catch (_error) {}
    for (const node of documentNode.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(node.textContent || "{}");
        if (data?.["@type"] !== "PodcastEpisode") continue;
        const audioUrl = String(data?.associatedMedia?.contentUrl || "").trim();
        if (!/^https:\/\//.test(audioUrl)) continue;
        return {
          id: XYD_SETTINGS.episodeIdFromUrl(pageUrl) || "",
          title: text(data.name || "未命名单集", 500),
          podcast: text(data?.partOfSeries?.name || "", 300),
          description: text(data.description || "", 100000),
          duration: 0,
          audioUrl,
          pageUrl: String(pageUrl).split("?")[0],
        };
      } catch (_error) {}
    }
    return null;
  }

  async function initialize() {
    const identity = await chrome.storage.local.get([XYD_SETTINGS.AUTH_KEY, PROFILE_KEY]);
    cloudAuth = identity[XYD_SETTINGS.AUTH_KEY]?.token ? identity[XYD_SETTINGS.AUTH_KEY] : null;
    const savedProfile = identity[PROFILE_KEY] || {};
    userProfile = {
      nickname: text(savedProfile.nickname || "小澍", 20).trim() || "小澍",
      avatarDataUrl: /^data:image\/(?:png|jpeg|webp);base64,/.test(savedProfile.avatarDataUrl || "") ? savedProfile.avatarDataUrl : "",
    };
    renderAuthState();
    byId("settingsBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());
    byId("loginBtn").addEventListener("click", () => {
      if (!cloudAuth?.token) return setAuthSheet(true);
      setProfilePage(byId("profileView").hidden);
    });
    byId("authBackdrop").addEventListener("click", () => setAuthSheet(false));
    byId("closeAuthBtn").addEventListener("click", () => setAuthSheet(false));
    byId("authForm").addEventListener("submit", (event) => { event.preventDefault(); authenticateCloud("login"); });
    byId("registerBtn").addEventListener("click", () => authenticateCloud("register"));
    byId("togglePasswordBtn").addEventListener("click", () => {
      const input = byId("authPassword");
      const button = byId("togglePasswordBtn");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-pressed", String(show));
      button.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
    });
    byId("logoutBtn").addEventListener("click", logoutCloud);
    byId("profileLogoutBtn").addEventListener("click", logoutCloud);
    byId("profileAvatarBtn").addEventListener("click", () => byId("profileAvatarInput").click());
    byId("profileAvatarInput").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1500000) {
        showToast("请选择 1.5MB 以内的 PNG、JPG 或 WebP 图片");
        event.target.value = "";
        return;
      }
      const avatarDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("头像读取失败"));
        reader.readAsDataURL(file);
      });
      await saveUserProfile({ ...userProfile, avatarDataUrl });
      event.target.value = "";
      showToast("头像已更新");
    });
    byId("saveProfileBtn").addEventListener("click", async () => {
      const nickname = text(byId("profileNickname").value, 20).trim();
      if (!nickname) return showToast("昵称不能为空");
      await saveUserProfile({ ...userProfile, nickname });
      showToast("昵称已保存");
    });
    byId("profileNickname").addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); byId("saveProfileBtn").click(); }
    });
    document.querySelector(".profile-nav").addEventListener("click", (event) => {
      const button = event.target.closest("[data-profile-section]");
      if (button) setProfileSection(button.dataset.profileSection);
    });
    byId("profileSummaryLength").addEventListener("change", saveReadingPreferences);
    byId("profileWritingStyle").addEventListener("change", saveReadingPreferences);
    document.querySelector(".focus-chips").addEventListener("change", saveReadingPreferences);
    ["profileTranscriptPrompt", "profileSummaryPrompt", "profileHighlightPrompt", "profileCompanionPrompt"].forEach((id) => byId(id).addEventListener("input", saveReadingPreferences));
    document.querySelectorAll(".prompt-reveal").forEach((button) => button.addEventListener("click", () => {
      const pre = document.getElementById(button.dataset.prompt);
      if (!pre) return;
      const open = pre.hidden;
      pre.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      button.textContent = open ? "收起完整提示词" : "查看完整提示词";
    }));
    byId("promptPreviewStage").addEventListener("change", () => { byId("promptPreviewResult").hidden = true; });
    byId("promptPreviewBtn").addEventListener("click", runPromptPreview);
    byId("historySearch").addEventListener("input", renderHistoryEntries);
    byId("historyFilterBtn").addEventListener("click", () => {
      const filters = byId("historyFilters");
      filters.hidden = !filters.hidden;
      byId("historyFilterBtn").setAttribute("aria-expanded", String(!filters.hidden));
    });
    document.addEventListener("pointerdown", (event) => {
      const filters = byId("historyFilters");
      if (filters.hidden || filters.contains(event.target) || byId("historyFilterBtn").contains(event.target)) return;
      filters.hidden = true;
      byId("historyFilterBtn").setAttribute("aria-expanded", "false");
    });
    byId("historyFilters").addEventListener("click", (event) => {
      const source = event.target.closest("[data-history-source]");
      const favorite = event.target.closest("[data-history-favorite]");
      if (source) {
        historySourceFilter = source.dataset.historySource;
        byId("historyFilters").querySelectorAll("[data-history-source]").forEach((button) => button.classList.toggle("selected", button === source));
        byId("historyFilterLabel").textContent = source.textContent.trim();
      }
      if (favorite) {
        historyFavoriteOnly = !historyFavoriteOnly;
        favorite.setAttribute("aria-pressed", String(historyFavoriteOnly));
        favorite.textContent = historyFavoriteOnly ? "★ 只看收藏" : "☆ 只看收藏";
      }
      if (source || favorite) {
        renderHistoryEntries();
        byId("historyFilters").hidden = true;
        byId("historyFilterBtn").setAttribute("aria-expanded", "false");
      }
    });
    byId("setupBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());
    byId("fullBtn").addEventListener("click", () => run("full"));
    byId("retryBtn").addEventListener("click", () => run(lastMode));
    byId("errorSettingsBtn").addEventListener("click", () => chrome.tabs.create({ url: "https://supadata.ai/dashboard" }));
    byId("regenerateTranscriptBtn").addEventListener("click", regenerateAllTranscript);
    byId("regenerateDigestBtn").addEventListener("click", () => {
      regenerateDigestPart(activeView === "timeline" ? "chapters" : "overview");
    });
    byId("summaryTab").addEventListener("click", () => switchView("summary"));
    byId("transcriptTab").addEventListener("click", () => switchView("transcript"));
    byId("timelineTab").addEventListener("click", () => switchView("timeline"));
    byId("notesTab").addEventListener("click", () => switchView("notes"));
    byId("copySummaryBtn").addEventListener("click", () => copyText(summaryMarkdown()));
    const toggleSummaryPopover = (id, triggerId) => {
      const panel = byId(id);
      const open = panel.hidden;
      ["summaryExportMenu", "summarySettingsPanel"].forEach((otherId) => { if (otherId !== id) byId(otherId).hidden = true; });
      panel.hidden = !open;
      byId("exportSummaryBtn").setAttribute("aria-expanded", String(id === "summaryExportMenu" && open));
      byId("summarySettingsBtn").setAttribute("aria-expanded", String(id === "summarySettingsPanel" && open));
      if (open && id === "summarySettingsPanel") syncSummaryControls();
    };
    byId("exportSummaryBtn").addEventListener("click", () => toggleSummaryPopover("summaryExportMenu", "exportSummaryBtn"));
    byId("summarySettingsBtn").addEventListener("click", () => toggleSummaryPopover("summarySettingsPanel", "summarySettingsBtn"));
    byId("summaryLengthToolbar").addEventListener("click", () => {
      const panel = byId("summaryLengthPanel");
      const open = panel.hidden;
      byId("summaryExportMenu").hidden = true;
      byId("summarySettingsPanel").hidden = true;
      byId("exportSummaryBtn").setAttribute("aria-expanded", "false");
      byId("summarySettingsBtn").setAttribute("aria-expanded", "false");
      panel.hidden = !open;
      byId("summaryLengthToolbar").setAttribute("aria-expanded", String(open));
      if (open) renderSummaryLengthOptions();
    });
    byId("summaryLengthPanel").addEventListener("click", (event) => {
      const button = event.target.closest("[data-length]");
      if (!button) return;
      settings = XYD_SETTINGS.normalize({ ...settings, summaryLength: button.dataset.length });
      chrome.storage.local.set({ [XYD_SETTINGS.STORAGE_KEY]: settings }).catch(() => {});
      byId("summaryLengthPanel").hidden = true;
      byId("summaryLengthToolbar").setAttribute("aria-expanded", "false");
      syncSummaryLengthToolbar();
      showToast("已保存");
    });
    byId("summaryExportMenu").addEventListener("click", (event) => {
      const button = event.target.closest("[data-export]");
      if (!button) return;
      exportCurrentSummary(button.dataset.export);
      byId("summaryExportMenu").hidden = true;
      byId("exportSummaryBtn").setAttribute("aria-expanded", "false");
    });
    ["summaryAutoGenerateToggle", "summaryAutoTranslateToggle", "summaryLanguageSelect"].forEach((id) => byId(id).addEventListener("change", saveSummaryControls));
    document.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".digest-toolbar")) return;
      byId("summaryExportMenu").hidden = true;
      byId("summarySettingsPanel").hidden = true;
      byId("summaryLengthPanel").hidden = true;
      byId("copySummaryBtn").setAttribute("aria-expanded", "false");
      byId("exportSummaryBtn").setAttribute("aria-expanded", "false");
      byId("summarySettingsBtn").setAttribute("aria-expanded", "false");
      byId("summaryLengthToolbar").setAttribute("aria-expanded", "false");
      if (event.target.closest(".mark-dock")) return;
      hideMarkDockPanel();
    });
    const savePersonalNote = async () => {
      const value = text(byId("noteComposer").value, 4000);
      if (!value) return;
      await addReaderNote({ kind: "personal", title: "随手记", sourceText: "", body: value, startSeconds: null, sourceId: "" });
      byId("noteComposer").value = "";
      byId("saveNoteBtn").disabled = true;
    };
    byId("noteComposer").addEventListener("input", () => { byId("saveNoteBtn").disabled = !text(byId("noteComposer").value, 4000); });
    byId("noteComposer").addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); savePersonalNote(); }
    });
    byId("saveNoteBtn").addEventListener("click", savePersonalNote);
    byId("transcriptGenerateBtn").addEventListener("click", () => run("full"));
    byId("transcriptLangBtn").addEventListener("click", () => toggleMarkDockPanel("lang"));
    byId("markHighlightBtn").addEventListener("click", () => toggleMarkDockPanel("highlight"));
    byId("markBoldBtn").addEventListener("click", () => toggleMarkDockPanel("bold"));
    byId("markCustomBtn").addEventListener("click", () => toggleMarkDockPanel("custom"));
    byId("transcriptList").addEventListener("mouseup", () => setTimeout(showSelectionToolbar, 0));
    byId("transcriptList").addEventListener("keyup", () => setTimeout(showSelectionToolbar, 0));
    byId("selectionToolbar").addEventListener("mousedown", (event) => event.preventDefault());
    byId("copySelectionBtn").addEventListener("click", async () => {
      if (activeSelection?.text) await copyText(activeSelection.text);
      hideSelectionToolbar(true);
    });
    byId("boldSelectionBtn").addEventListener("click", () => applyFormatToSelection("bold"));
    byId("hlYellowSelectionBtn").addEventListener("click", () => applyFormatToSelection("yellow"));
    byId("hlGreenSelectionBtn").addEventListener("click", () => applyFormatToSelection("green"));
    byId("clearFormatSelectionBtn").addEventListener("click", () => applyFormatToSelection("clear"));
    byId("noteSelectionBtn").addEventListener("click", noteCurrentSelection);
    byId("acceptHighlightBtn").addEventListener("click", () => resolvePendingHighlight(true));
    byId("rejectHighlightBtn").addEventListener("click", () => resolvePendingHighlight(false));
    document.addEventListener("pointerdown", (event) => {
      if (!byId("selectionToolbar").hidden && !byId("selectionToolbar").contains(event.target)) hideSelectionToolbar();
      if (!byId("highlightConfirm").hidden && !byId("highlightConfirm").contains(event.target)) hideHighlightConfirm();
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") hideSelectionToolbar(true); });
    byId("transcriptView").addEventListener("wheel", () => {
      hideSelectionToolbar();
      if (activeView === "transcript" && Date.now() - lastAutoScrollAt > 900) autoFollowPausedUntil = Date.now() + 10000;
    }, { passive: true });
    updateLangButton();
    syncSummaryLengthToolbar();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id || 0;
    const parsed = XYD_PLATFORM?.parseId?.(tab?.url || "");
    activePlatformId = parsed ? parsed.platform : "";
    const activeEpisodeId = parsed ? parsed.id : "";
    if (!activeTabId || !activeEpisodeId) { setHidden("emptyState", false); return; }
    try {
      const response = await chrome.tabs.sendMessage(activeTabId, { action: "getEpisode" });
      episode = response?.episode;
    } catch (_error) {}
    if (!episode) {
      try { episode = await fetchEpisodeFromPage(tab?.url); } catch (_error) {}
    }
    if (!episode && activeEpisodeId === DEMO_EPISODE_META.id) {
      episode = { ...DEMO_EPISODE_META, pageUrl: String(tab?.url || "").split("?")[0] };
    }
    if (!episode) { setHidden("emptyState", false); byId("emptyState").querySelector("p").textContent = `无法读取这一集，请刷新${activePlatformId === "youtube" ? " YouTube" : "小宇宙"}页面后重试。`; return; }
    setHidden("episodeCard", false);
    setHidden("viewTabs", false);
    // 缓存检查完成前先不展示空状态，避免已解析节目短暂闪出“还没有原文”。
    setHidden("transcriptEmpty", true);
    byId("podcastName").textContent = episode.podcast || "小宇宙播客";
    byId("episodeTitle").textContent = episode.title;
    const digestCacheKey = XYD_PLATFORM?.storageKey?.(currentPlatformId(), episode.id) || XYD_SETTINGS.digestKey(episode.id);
    const stored = await chrome.storage.local.get([XYD_SETTINGS.STORAGE_KEY, XYD_SETTINGS.AUTH_KEY, digestCacheKey, transcriptCacheKey(), notesCacheKey()]);
    cloudAuth = stored[XYD_SETTINGS.AUTH_KEY]?.token ? stored[XYD_SETTINGS.AUTH_KEY] : null;
    renderAuthState();
    const demo = globalThis.XYD_DEMO_DATA?.episodeId === episode.id ? globalThis.XYD_DEMO_DATA : null;
    settings = XYD_SETTINGS.normalize(stored[XYD_SETTINGS.STORAGE_KEY]);
    const persistentTranscript = stored[transcriptCacheKey()];
    if (Array.isArray(persistentTranscript) && persistentTranscript.length) {
      await setTranscript(persistentTranscript, true);
    } else if (demo?.segments?.length) {
      await setTranscript(demo.segments, true);
    } else {
      if (chrome.storage?.session) {
        try {
          const session = await chrome.storage.session.get(transcriptCacheKey());
          if (Array.isArray(session[transcriptCacheKey()])) await setTranscript(session[transcriptCacheKey()]);
        } catch (_error) {}
      }
      // 不在打开页面时访问 ASR 创建接口。只有用户主动点击“智能生成”后，
      // ensureTranscript/requestTranscript 才能查询缓存或创建可能计费的转录任务。
    }
    if (transcriptSegments.length) await seedBackendTranscriptCache();
    renderTranscript();
    readerNotes = normalizeReaderNotes(stored[notesCacheKey()]);
    renderNotes();
    let cached = stored[digestCacheKey];
    if (demo?.digest) {
      cached = { digest: normalizeDigest(demo.digest, episode.duration), mode: "imported", savedAt: Date.now() };
      await chrome.storage.local.set({ [digestCacheKey]: cached });
    }
    if (cached?.digest) { lastMode = cached.mode || "full"; renderDigest(cached.digest); }
    else if (!settings.aiApiKey) showOnlyMain("setupState");
    else showOnlyMain("actions");
    if (settings.asrProvider === "supadata" && !settings.supadataApiKey) {
      byId("fullBtn").title = "请先在设置中填写 Supadata API Key";
    } else if (settings.asrProvider === "aliyun" && !settings.dashscopeApiKey) {
      byId("fullBtn").title = "请先在设置中填写阿里云百炼 API Key";
    }
    await touchHistory({ hasDigest: Boolean(currentDigest), transcriptCount: transcriptSegments.length, noteCount: readerNotes.length });
    switchView("transcript");
  }

  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => {
    initialize().catch(showError);
  });
  return {
    _tr: { translateTranscript },
    _seg: (s, c=0)=>{ transcriptSegments = s; return detectedContentStart = ()=>c; },
    formatTime,
    normalizeTranscript,
    paragraphizeTranscript,
    formalParagraphizeTranscript,
    safeCorrectedText,
    groupTranscript,
    groupTranscriptForAnnotations,
    locatePhrase,
    normalizeDigest,
    maxAutoSkipSeconds,
    sanitizeContentStart,
    inferIntroContentStart,
    isLowValueOrPromotionalText,
    ANNOTATION_EDITOR_SYSTEM,
    COMPANIONS,
    currentPlatformId,
    requestYoutubeTranscript,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = XYD_APP;
