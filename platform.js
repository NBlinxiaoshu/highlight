/**
 * 共性核心：跨平台「来源适配层」。
 *
 * 摘要大脑（Map-Reduce 客户端）、逐字稿归一化、标注、渲染、本地缓存、后端都只依赖
 * 「包含 startSeconds/durationSeconds/text 的 TranscriptSegment[]」与一个规范化的
 * 「episode 元数据对象」。本模块把这些平台差异收敛成统一的接口，让同一套产品能力
 * 可以用在小宇宙、YouTube（后续还有 Bilibili）上。
 *
 * 每个平台提供：
 *   - idFromUrl(url)        -> 稳定 ID（小宇宙 24 位 hex / YouTube 11 位视频 ID）
 *   - normalizePageData(raw, pageUrl) -> 统一的 episode 元数据对象（或 null）
 *   - transcript            -> 取稿方式：'asr'（需整段音频转写）| 'captions'（优先字幕）
 *
 * 这个文件是纯函数、无副作用，可在 Node 中直接 require 做单元测试，也可在扩展里加载。
 */
var XYD_PLATFORM = (() => {
  "use strict";

  const XIAOYUZHOU_ID = /^https:\/\/www\.xiaoyuzhoufm\.com\/episode\/([a-f0-9]{24})(?:[/?#]|$)/i;
  const BILI_BV = /bilibili\.com\/video\/(BV[0-9A-Za-z]{10})(?:[/?#]|$)/i;
  const BILI_AV = /bilibili\.com\/video\/av(\d+)(?:[/?#]|$)/i;
  const BILI_SHORT = /b23\.tv\/([A-Za-z0-9]+)(?:[/?#]|$)/i;
  const YT_ID = (() => {
    // 匹配常见的 YouTube 短视频 URL：watch?v=、youtu.be/、shorts/、embed/
    const patterns = [
      /https:\/\/(?:www\.)?youtube\.com\/watch[?&#][^#]*\bv=([A-Za-z0-9_-]{11})(?:[&#]|$)/i,
      /https:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/i,
      /https:\/\/(?:www\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/i,
      /https:\/\/(?:www\.)?youtube\.com\/embed\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/i,
    ];
    return patterns;
  })();

  function xiaoyuzhouIdFromUrl(url) {
    const match = String(url || "").match(XIAOYUZHOU_ID);
    return match ? String(match[1]) : "";
  }

  function youtubeIdFromUrl(url) {
    const value = String(url || "");
    for (const pattern of YT_ID) {
      const match = value.match(pattern);
      if (match) return String(match[1]);
    }
    return "";
  }

  function bilibiliIdFromUrl(url) {
    const value = String(url || "");
    const bv = value.match(BILI_BV);
    const page = (() => { try { return Math.max(1, Number(new URL(value).searchParams.get("p")) || 1); } catch (_error) { return 1; } })();
    if (bv) return `${String(bv[1])}${page > 1 ? `:p${page}` : ""}`;
    const av = value.match(BILI_AV);
    if (av) return `av${av[1]}${page > 1 ? `:p${page}` : ""}`;
    return "";
  }

  function text(value, max = 500) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
  }

  function episodeIdPlatform(url) {
    if (xiaoyuzhouIdFromUrl(url)) return "xiaoyuzhou";
    if (youtubeIdFromUrl(url)) return "youtube";
    if (bilibiliIdFromUrl(url)) return "bilibili";
    return "";
  }

  // 从 YouTube watch 页面 HTML 里用平衡括号抠出 ytInitialPlayerResponse 对象。
  // 该对象在页面里以内联脚本 var ytInitialPlayerResponse = {...}; 存在，并非 JSON 节点，
  // 因此用字符级平衡匹配比正则更稳，可容忍内部任意嵌套字符串与转义。
  function extractBalancedObject(source, marker) {
    const value = String(source || "");
    const index = value.indexOf(marker);
    if (index === -1) return null;
    const start = value.indexOf("{", index + marker.length);
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < value.length; i += 1) {
      const ch = value[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(value.slice(start, i + 1));
          } catch (_error) {
            return null;
          }
        }
      }
    }
    return null;
  }

  function youtubePlayerResponseFromHtml(html) {
    return (
      extractBalancedObject(html, "ytInitialPlayerResponse =") ||
      extractBalancedObject(html, "ytInitialPlayerResponse=")
    );
  }

  const platforms = {
    xiaoyuzhou: {
      id: "xiaoyuzhou",
      label: "小宇宙",
      idFromUrl: xiaoyuzhouIdFromUrl,
      transcript: "asr", // 没有字幕，必须整段音频 ASR
      normalizePageData(raw, pageUrl) {
        if (!raw || raw.type !== "EPISODE") return null;
        const audioUrl = String(
          raw.enclosure?.url || raw.media?.url || raw.media?.source?.url || "",
        ).trim();
        if (!/^https:\/\//.test(audioUrl)) return null;
        const podcast = typeof raw.podcast === "string"
          ? raw.podcast
          : raw.podcast?.title || raw.podcast?.name || "";
        return {
          id: String(raw.eid || ""),
          title: text(raw.title || "未命名单集", 500),
          channel: text(podcast, 300),
          podcast: text(podcast, 300), // 兼容现有 episode.podcast 字段
          description: text(raw.description || raw.shownotes || "", 100000),
          duration: Math.max(0, Number(raw.duration) || 0),
          audioUrl,
          pageUrl: String(pageUrl || "").split("?")[0],
        };
      },
    },
    youtube: {
      id: "youtube",
      label: "YouTube",
      idFromUrl: youtubeIdFromUrl,
      transcript: "captions", // 优先从官方字幕取稿（Supadata），无需 ASR
      normalizePageData(raw, pageUrl) {
        // raw 可为 ytInitialPlayerResponse，或 oEmbed 的 {title, author_name}，或
        // 仅 {videoId,title,channel,duration} 的轻量对象；逐字段带兜底。
        if (!raw || typeof raw !== "object") return null;
        const details = raw.videoDetails || {};
        const micro = raw.microformat?.playerMicroformatRenderer || {};
        const title =
          text(details.title, 500) ||
          text(micro.title, 500) ||
          text(raw.title, 500);
        const channel =
          text(details.author, 300) ||
          text(micro.ownerChannelName, 300) ||
          text(raw.channel || raw.author_name, 300);
        if (!title && !channel) return null;
        const duration = Math.max(
          0,
          Number(details.lengthSeconds || raw.duration || micro.lengthSeconds || 0),
        );
        const videoId = text(raw.videoId || details.videoId || "", 20);
        return {
          id: videoId || youtubeIdFromUrl(pageUrl),
          title: title || "未命名的视频",
          channel,
          podcast: channel, // 兼容现有 episode.podcast 字段
          description: text(
            details.shortDescription || raw.description || "",
            100000,
          ),
          duration,
          audioUrl: "",
          pageUrl: String(pageUrl || "").split("?")[0],
        };
      },
    },
    bilibili: {
      id: "bilibili",
      label: "B站",
      idFromUrl: bilibiliIdFromUrl,
      transcript: "captions", // 官方字幕接口（页面上下文 + WBI + Cookie）
      normalizePageData(raw, pageUrl) {
        if (!raw || typeof raw !== "object") return null;
        const info = raw?.data || raw; // 兼容 view 接口的 {data:{...}} 或轻量对象
        const baseId = text(raw?.bvid || info?.bvid, 20) || bilibiliIdFromUrl(pageUrl).split(":p")[0];
        const page = (() => { try { return Math.max(1, Number(new URL(pageUrl).searchParams.get("p")) || Number(raw?.page) || 1); } catch (_error) { return 1; } })();
        const pages = Array.isArray(info?.pages) ? info.pages : [];
        const targetPage = pages.find((item) => Number(item?.page) === page) || pages[0] || {};
        const id = `${baseId}${page > 1 ? `:p${page}` : ""}`;
        if (!id && !text(raw?.title, 20)) return null;
        return {
          id: id || `av${Number(info?.aid || raw?.aid || 0) || 0}`,
          title: text(page > 1 && targetPage?.part ? `${raw?.title || info?.title || "未命名的视频"} · ${targetPage.part}` : raw?.title || info?.title || "未命名的视频", 500),
          channel: text(raw?.owner || info?.owner?.name || "B站UP主", 300),
          podcast: text(raw?.owner || info?.owner?.name || "B站UP主", 300),
          description: text(raw?.desc || info?.desc || "", 100000),
          duration: Math.max(0, Number(targetPage?.duration || raw?.duration || info?.duration || 0)),
          audioUrl: "",
          cid: Math.max(0, Number(raw?.cid || targetPage?.cid || info?.cid || 0)),
          page,
          bvid: baseId,
          aid: Math.max(0, Number(raw?.aid || info?.aid || 0)),
          pageUrl: String(pageUrl || ""),
        };
      },
    },
  };

  function detectPlatform(url) {
    const id = episodeIdPlatform(url);
    return id ? platforms[id] : null;
  }

  function parseId(url) {
    const platform = detectPlatform(url);
    if (!platform) return null;
    return { platform: platform.id, id: platform.idFromUrl(url) };
  }

  function storageKey(platformId, id) {
    if (platformId === "youtube") return `xyd_digest_yt_${id}`;
    if (platformId === "bilibili") return `xyd_digest_bili_${id}`;
    if (platformId === "xiaoyuzhou") return `xyd_digest_${id}`;
    throw new Error("未知平台");
  }

  // Supadata 的 YouTube 字幕与播客转写共享同一 {content:[{text,offset,duration}]} 结构，
  // 归一化逻辑已在 sidepanel.normalizeTranscript 内，这里只描述来源，避免重复判定。
  function transcriptDependency(platformId) {
    if (platformId === "youtube") return "supadata_youtube_transcript";
    if (platformId === "bilibili") return "bilibili_subtitle";
    if (platformId === "xiaoyuzhou") return "audio_asr";
    return "";
  }

  return {
    platforms,
    detectPlatform,
    parseId,
    storageKey,
    episodeIdPlatform,
    xiaoyuzhouIdFromUrl,
    youtubeIdFromUrl,
    bilibiliIdFromUrl,
    transcriptDependency,
    youtubePlayerResponseFromHtml,
    // 供现有 settings/episodeIdFromUrl 逻辑复用
    XIAOYUZHOU_ID,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = XYD_PLATFORM;
