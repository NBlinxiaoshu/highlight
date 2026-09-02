var XYD_DEMOS = (() => {
  "use strict";

  const demos = [
    {
      episodeId: "6a7ab5ac17676351c570146a",
      source: "xiaoyuzhou",
      title: "No.214 寻找同类：小红书、bilibili，以及五花八门的那些社区",
      podcast: "半拿铁｜商业沉浮录",
      pageUrl: "https://www.xiaoyuzhoufm.com/episode/6a7ab5ac17676351c570146a",
      duration: 11056,
      demoLabel: "商业化动态",
    },
    {
      episodeId: "96jN2OCOfLs",
      source: "youtube",
      title: "Andrej Karpathy: From Vibe Coding to Agentic Engineering",
      podcast: "Sequoia Capital",
      pageUrl: "https://www.youtube.com/watch?v=96jN2OCOfLs&t=967s",
      duration: 1740,
      demoLabel: "英文原声 · 双语",
      segments: [
        { startSeconds: 2, durationSeconds: 38, text: "We are moving from traditional coding toward a workflow where people specify intent and agents carry out more of the implementation.", translatedText: "我们正在从传统编码转向一种新工作流：人负责明确意图，智能体承担更多实现工作。", translatedLang: "zh-en:zh-CN", highlights: [{ type: "quote", start: 7, end: 47 }] },
        { startSeconds: 41, durationSeconds: 45, text: "The surprising feeling is not that programmers are obsolete. It is that the tools are changing fast enough that even experienced programmers can feel behind.", translatedText: "真正令人意外的不是程序员会过时，而是工具变化如此之快，连经验丰富的程序员也会感到落后。", translatedLang: "zh-en:zh-CN", highlights: [{ type: "fact", start: 88, end: 135 }] },
        { startSeconds: 286, durationSeconds: 54, text: "Software 1.0 is explicit code. Software 2.0 is neural network weights learned from data. Software 3.0 is programming increasingly expressed through natural-language prompts.", translatedText: "软件 1.0 是显式代码，软件 2.0 是从数据中学习出的神经网络权重，软件 3.0 则越来越多地通过自然语言提示进行编程。", translatedLang: "zh-en:zh-CN", highlights: [{ type: "method", start: 0, end: 158 }] },
        { startSeconds: 607, durationSeconds: 55, text: "Vibe coding raises the floor: many more people can make useful software. Agentic engineering keeps the professional quality bar while using the same powerful tools.", translatedText: "Vibe coding 抬高了能力下限，让更多人能做出有用的软件；Agentic engineering 则是在使用同样强大工具时仍守住专业质量标准。", translatedLang: "zh-en:zh-CN", annotation: { type: "case", title: "从 Vibe Coding 到 Agentic Engineering" } },
        { startSeconds: 967, durationSeconds: 49, text: "An agent is closer to a very fast intern than an autonomous senior engineer. You still need to specify the task, inspect the work, run checks, and own the result.", translatedText: "智能体更像一个速度很快的实习生，而不是自主的资深工程师。你仍需定义任务、检查工作、运行验证，并对结果负责。", translatedLang: "zh-en:zh-CN", highlights: [{ type: "companion", color: "#007aff", customKey: "ai", start: 0, end: 148 }] },
        { startSeconds: 1260, durationSeconds: 52, text: "The largest gains come when the environment gives the model feedback: tests, executable tools, clear constraints, and a loop that makes errors visible.", translatedText: "当环境能给模型反馈时，收益最大：测试、可执行工具、清晰约束，以及一个能让错误暴露出来的闭环。", translatedLang: "zh-en:zh-CN", highlights: [{ type: "method", start: 31, end: 137 }] },
      ],
      digest: {
        contentStartSeconds: 2,
        overview: { opening: "Karpathy 讨论编程从 Vibe Coding 走向 ==可验证的 Agentic Engineering==。", sections: [
          { heading: "软件的第三种编程界面", points: ["**范式变化：** 从写显式代码、训练权重，走向用自然语言描述意图。", "**人的位置：** 人不再只负责敲代码，而是定义任务、环境和验收标准。"] },
          { heading: "Vibe Coding 与工程化的分界", points: ["**能力下限：** Vibe Coding 让更多人能快速做出原型。", "**质量上限：** Agentic Engineering 要求测试、审查与对结果负责。"] },
          { heading: "反馈闭环决定智能体上限", points: ["**可验证性：** 测试、工具和明确约束能让错误及时显现。", "**使用心法：** 把智能体当作速度极快但需要管理的实习生。"] },
        ] },
        chapters: [
          { startSeconds: 2, title: "为什么资深程序员也会觉得落后", detail: "工具变化的速度本身成为新的学习压力。", points: ["能力没有失效，工作界面却在快速重构。"] },
          { startSeconds: 286, title: "从 Software 1.0 到 3.0", detail: "编程对象从显式代码、模型权重进一步扩展到自然语言。", points: ["每一层并不会完全替代上一层。"] },
          { startSeconds: 607, title: "Vibe Coding 和 Agentic Engineering", detail: "前者扩大参与面，后者保留专业质量要求。", points: ["速度与质量需要通过工程闭环统一。"] },
          { startSeconds: 967, title: "把智能体当作需要管理的实习生", detail: "人仍要说明任务、检查输出并承担责任。", points: ["清晰约束比盲目放权更重要。"] },
        ],
      },
    },
    {
      episodeId: "BV1gt411g7RU",
      source: "bilibili",
      title: "清华大学《经济学原理》｜什么是经济学 1",
      podcast: "国家级精品课",
      pageUrl: "https://www.bilibili.com/video/BV1gt411g7RU/",
      duration: 2537,
      demoLabel: "课程学习 · 字幕修复",
      segments: [
        { startSeconds: 18, durationSeconds: 42, text: "经济学研究社会如何管理自己的稀缺资源。这里的稀缺，不是说资源绝对没有，而是人的欲望相对于可支配资源总是更多。", highlights: [{ type: "quote", start: 0, end: 18 }, { type: "fact", start: 23, end: 54 }] },
        { startSeconds: 92, durationSeconds: 51, text: "学习经济学首先要理解取舍。个人、企业和政府作出一个选择，也就同时放弃了其他可行选择带来的收益。", highlights: [{ type: "method", start: 0, end: 47 }] },
        { startSeconds: 168, durationSeconds: 58, text: "机会成本不是会计账面上已经支付的钱，而是为了得到某种东西所放弃的最好选择的价值。", highlights: [{ type: "quote", start: 0, end: 40 }] },
        { startSeconds: 322, durationSeconds: 64, text: "理性人通常在边际上作决策：比较一个行动额外增加的收益与额外增加的成本，而不是只看总量。", highlights: [{ type: "method", start: 0, end: 43 }], annotation: { type: "case", title: "用边际变化判断是否继续行动" } },
        { startSeconds: 521, durationSeconds: 60, text: "当某种行为的成本或收益发生变化，人们会改变自己的行为，这就是激励。公共政策必须把这种反应考虑进去。", highlights: [{ type: "fact", start: 30, end: 49 }] },
        { startSeconds: 810, durationSeconds: 66, text: "贸易不是简单地分出赢家和输家。专业化与交换能让不同的人在自己更擅长的事情上投入，从而扩大整体可获得的商品和服务。", highlights: [{ type: "companion", color: "#34c759", customKey: "custom", start: 13, end: 56 }] },
      ],
      digest: {
        contentStartSeconds: 18,
        overview: { opening: "这节课用稀缺、取舍和激励搭起微观经济学的 ==基本分析框架==。", sections: [
          { heading: "稀缺迫使每个人作出选择", points: ["**研究对象：** 经济学关心社会如何配置有限资源。", "**关键前提：** 人的需求多于可支配资源，因此选择无法避免。"] },
          { heading: "真正的成本是放弃的最好选择", points: ["**机会成本：** 不能只看已经花出去的钱，还要看被放弃方案的价值。", "**边际判断：** 决策应比较额外收益与额外成本。"] },
          { heading: "激励改变行为", points: ["**政策影响：** 成本或收益变化后，人会调整选择。", "**分析要求：** 评价政策时必须把行为反应纳入推演。"] },
        ] },
        chapters: [
          { startSeconds: 18, title: "经济学从稀缺开始", detail: "资源有限而需求更多，社会必须回答如何配置资源。", points: ["稀缺是一种相对关系，不等于资源绝对不存在。"] },
          { startSeconds: 92, title: "每个选择都有机会成本", detail: "作出选择意味着同时放弃其他可能性。", points: ["机会成本取决于被放弃的最好方案。"] },
          { startSeconds: 322, title: "理性决策发生在边际上", detail: "继续或停止行动，应比较额外收益与额外成本。", points: ["总量不能直接回答下一步是否值得。"] },
          { startSeconds: 521, title: "激励会改变人的行为", detail: "制度与政策改变成本收益，也会改变选择。", points: ["忽略行为反应会误判政策结果。"] },
        ],
      },
    },
  ];

  function find(episodeId) {
    const meta = demos.find((item) => item.episodeId === episodeId) || null;
    if (globalThis.XYD_DEMO_DATA?.episodeId === episodeId) return { ...meta, ...globalThis.XYD_DEMO_DATA };
    return meta;
  }

  return { entries: demos, find };
})();

if (typeof module !== "undefined" && module.exports) module.exports = XYD_DEMOS;
