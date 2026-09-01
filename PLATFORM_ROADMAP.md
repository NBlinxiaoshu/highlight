# 跨平台 + Agent/Skill 深化路线图

> 文档版本：1.0 · 2026-09-01
> 当前状态：已加入共性核心 `platform.js` 与 YouTube 数据取稿路径，可复用能力验证通过（31 个单测全绿）。
> 本页回答两件事：① 能不能看 YouTube / Bilibili，能复用多少；② 作为完整 agent 产品，怎么深化 harness / skill 能力。

## 0. 一句话结论

- **跨平台可行，且复用率约 60–70%**。能搬的是「摘要大脑 + 后处理 + 渲染 + 后端 + 缓存 + 设置」；必须新建的是每个平台的「来源层」。
- **优先级建议：YouTube > Bilibili。** YouTube 有官方字幕，可跳过最贵、最脆的整段 ASR；Bilibili 反爬 + AI 字幕要登录 + 音视分离，成本最高、应后置。
- **要变成 agent 产品，最大杠杆是「核心搬 server + skill 注册表/编排层」**，否则推荐、定时、批量这些能力在 Chrome 扩展里跑不动。

## 1. 共性核心（可复用，约 60–70%）

这些只认「`TranscriptSegment[]` + 节目标题/时长」，与来源无关，已在本仓库验证：

- 逐字稿处理：`normalizeTranscript` `paragraphizeTranscript` `formalParagraphizeTranscript` `groupTranscript` `groupTranscriptForAnnotations` `splitTranscriptSegment` `locatePhrase`
- LLM 层：`callDeepSeek` `extractJson` 与各 Prompt
- Map-Reduce 摘要管线：`digestFromCurrentTranscript` `fullDigest` `generateDigest`
- 后处理：`identifySpeakerNames` `correctTranscriptWithAgent` `refineTranscriptWithAgents`
- 标注引擎：`ensureAnnotationDensity` `applyGeneratedHighlights` `isLowValueOrPromotionalText`（Case / 金句 / 关键事实）
- 渲染层：双栏原文/摘要、章节山谷目录、播放跟随、搭子、笔记、工具栏
- 后端：auth / library / asr cache、`/v1/asr/jobs`（submit/poll/normalize）
- 设置与本地优先缓存、安全渲染（只走 `textContent`）

## 2. 平台适配层（必须新建，每个 10–25%）

已落地 `platform.js`，定义每个平台提供四件事：

```js
{
  id,                     // 'xiaoyuzhou' | 'youtube'
  idFromUrl(url),         // 稳定 ID
  normalizePageData(raw, pageUrl), // 统一 episode 元数据
  transcript,             // 'asr' | 'captions'
}
```

### 2.1 YouTube（已接入，优先）

- 取 ID：`watch?v=`、`youtu.be/`、`shorts/`、`embed/`（`platform.youtubeIdFromUrl`）。
- 取元数据：sidepanel 抓取 watch 页 HTML，用平衡括号解析 `ytInitialPlayerResponse`（`platform.youtubePlayerResponseFromHtml`），无需 MAIN-world 桥，且已在 Node 单测覆盖。
- 取稿：`requestYoutubeTranscript(videoId)` → `https://api.supadata.ai/v1/youtube/transcript`，复用 `normalizeTranscript`（`content[].offset/duration` 毫秒自动换算秒）。**无 ASR，便宜且快**。
- 播放/seek：content.js 统一兜底查 `video`/`audio` 元素（`seekTo`/`getPlaybackState`）。
- manifest 已加 `https://www.youtube.com/*` host 权限与 content_scripts `watch/shorts` 匹配；background 通过 `XYD_PLATFORM.detectPlatform` 开启面板；sidepanel 已按平台取存储键（`xyd_digest_yt_<id>`）。

### 2.2 Bilibili（未接入，建议后置，先给设计）

- 取 ID：`BV...` / `av...` 解析。
- 取内容：`window.__INITIAL_STATE__` 是**全局变量，不在 DOM 节点里**，isolated-world content script 读不到。方案：`world: "MAIN"` 注入 + `postMessage`/CustomEvent 回传，或由后端拉页面自己解析。比 `__NEXT_DATA__` 难一截。
- 取稿：AI 字幕接口需登录态 + cookie + WBI 签名（见 [bilibili-API-collect](https://deepwiki.com/SocialSisterYi/bilibili-API-collect/4.1.6-ai-summary-and-features#1) / [bili_ai_subtitle](https://github.com/wnma3mz/bili_ai_subtitle#1)）；音频也是分离流，后端需额外下载。
- 建议：复用相同 `platform` 契约，新增 `bilibili` 实现 + 「后端音频下载/字幕取稿」步骤。

## 3. 落地清单（当前位置）

| 项 | 状态 |
|---|---|
| `platform.js` 共性核心（xiaoyuzhou + youtube） | ✅ 已落 |
| `tests/platform.test.js`（URL/识别/存储键/页面归一/字幕复用） | ✅ 已落 |
| sidepanel：按平台取稿（Supadata captions）、存储键、`currentPlatformId` | ✅ 已落 |
| content.js：双平台 host 识别 + `video`/`audio` seek | ✅ 已落 |
| manifest：youtube host 权限 + content_scripts | ✅ 已落 |
| background：`importScripts(platform.js)` + 面板开启 | ✅ 已落 |
| `npm test` / `npm run check` | ✅ 31 全绿 |

### 需在浏览器手动验证（本环境无法跑扩展端到端）

1. 打开一个 YouTube 视频页，点「精读这期」→ 面板应显示标题/频道/时长；若显示「无法读取…」，通常是地区 consent 页未含 `ytInitialPlayerResponse`，需刷新或换账号。
2. 点「智能生成」→ 应走 Supadata YouTube 字幕（设置里填 Supadata Key），逐字稿出现、可跳转、进度/章节正常。
3. 在设置里确认平台为 YouTube 时，`requestTranscript` 走的是字幕而非 ASR。

## 4. Agent / Skill 深化

现状是**事件驱动工具**（打开单集→消化）。要成为 agent，加四层：

### 4.1 Skill 注册表（声明式）
每个 skill = 参数化可复用能力 + 确定性部分。示例：

| Skill | 说明 | 复用来源 |
|---|---|---|
| `digest_episode(url, mode)` | 已存在 | 现管线 |
| `answer_from_transcript(episodeId, question)` | RAG 于逐字稿，高价值 | transcript 存储 |
| `recommend_top_podcasts(topics, source, window)` | 你举例的「Top 播放推荐」 | 见 4.3 边界 |
| `daily_briefing()` / `weekly_digest()` | 组合 + 定时 | 编排层 |
| `export_markdown(episodeId, fmt)` | 摘要导出 | renderDigest |
| `search_library(query)` / `compare_episodes(...)` | 检索/对比 | 后端 library |

### 4.2 编排层
读上下文 → 挑 skill → 链式执行（`recommend → digest → annotate → export → note`）。这部分需要 **server 侧 agent core**（Chrome service worker 无 cron、页面绑定、沙箱，跑不了通用 agent）。

### 4.3 重要边界
「爬播放量 Top10 播客」涉及批量抓取，播放量接口对 YouTube/B站都难稳定拿到，也有 ToS 风险。稳妥做法是让 skill 的来源可配置（关注列表 / 官方榜单 / 关键词搜索），排序由产品控制，不硬爬全库播放量。推荐结果再走摘要大脑生成“是否值得听”的理由。

### 4.4 记忆/个性化
已有关注偏好、搭子、阅读偏好；扩成「消费历史 + 个人主题画像」，让推荐与摘要针对个人而非通用。

## 5. 建议下一步

1. 浏览器端验证 YouTube 端到端（见 §3 清单）。
2. 若确认可行，再补 Bilibili `platform` 实现（最重，单独评估）。
3. 若走 agent 方向：把摘要核心搬到 server（agent core + job runner）→ 定义 skill 注册表 → 加定时/主动推荐。

## 6. 参考实现

- [zarazhangrui/youtube-digest](https://github.com/zarazhangrui/youtube-digest)：客户端形态 + Supadata 字幕 + DeepSeek 摘要，非商城、无 server。
- Digesto for Bilibili（Chrome 商店，基于同思路的 B 站版）：[安装链接](https://chromewebstore.google.com/detail/digest-for-bilibili/cfndfabkpfgihcgknbgfnkjlmndhhmfc) · [开源来源参考](https://github.com/c617550400-pixel/bilibili-digest)。
