(() => {
  const BUTTON_ID = "xyd-digest-button";
  const YT_ID_PATTERN = /(?:^|[?&#])v=([A-Za-z0-9_-]{11})(?:[&#]|$)/;
  const BILI_BV = /bilibili\.com\/video\/(BV[0-9A-Za-z]{10})(?:[/?#]|$)/i;
  const BILI_AV = /bilibili\.com\/video\/av(\d+)(?:[/?#]|$)/i;

  function sanitizeEpisode(raw) {
    if (!raw || raw.type !== "EPISODE") return null;
    const audioUrl = raw.enclosure?.url || raw.media?.url || raw.media?.source?.url || "";
    if (!/^https:\/\//.test(audioUrl)) return null;
    const podcast = typeof raw.podcast === "string"
      ? raw.podcast
      : raw.podcast?.title || raw.podcast?.name || "";
    return {
      id: String(raw.eid || ""),
      title: String(raw.title || "未命名单集").slice(0, 500),
      podcast: String(podcast).slice(0, 300),
      description: String(raw.description || "").slice(0, 100000),
      duration: Math.max(0, Number(raw.duration) || 0),
      audioUrl,
      pageUrl: location.href.split("?")[0],
    };
  }

  function isXiaoyuzhouEpisode() {
    return /^https:\/\/www\.xiaoyuzhoufm\.com\/episode\//.test(location.href);
  }

  function youtubeVideoId() {
    const match = String(location.href).match(YT_ID_PATTERN);
    return match ? match[1] : "";
  }

  function isBilibiliVideo() {
    return BILI_BV.test(location.href) || BILI_AV.test(location.href);
  }

  function bilibiliBvid() {
    const match = String(location.href).match(BILI_BV);
    return match ? match[1] : "";
  }

  function bilibiliAv() {
    const match = String(location.href).match(BILI_AV);
    return match ? Number(match[1]) || 0 : 0;
  }

  function bilibiliPageNumber() {
    const page = Number(new URL(location.href).searchParams.get("p")) || 1;
    return Math.max(1, Math.floor(page));
  }

  // 从 B 站官方 view 接口拿视频元数据（content script 隔离世界读不到页面里的
  // window.__INITIAL_STATE__，所以直接调接口，带 Cookie）；支持 bvid / av 两种。
  async function bilibiliViewEpisode(bvid) {
    try {
      const av = bilibiliAv();
      const qs = av ? `aid=${encodeURIComponent(av)}` : `bvid=${encodeURIComponent(bvid)}`;
      const res = await fetch(`${BILI_VIEW_URL}?${qs}`, { credentials: "include", headers: { Accept: "application/json" } });
      const data = await res.json();
      const info = data?.data;
      if (!info?.bvid && !info?.aid) return null;
      const pages = Array.isArray(info.pages) ? info.pages : [];
      const page = bilibiliPageNumber();
      const targetPage = pages.find((item) => Number(item?.page) === page) || pages[0] || {};
      return {
        id: `${String(info.bvid || `av${info.aid}`) || String(bvid)}${page > 1 ? `:p${page}` : ""}`,
        title: String(page > 1 && targetPage.part ? `${info.title || "未命名的视频"} · ${targetPage.part}` : info.title || "未命名的视频").slice(0, 500),
        channel: String(info.owner?.name || "B站UP主").slice(0, 300),
        podcast: String(info.owner?.name || "B站UP主").slice(0, 300),
        description: String(info.desc || "").slice(0, 100000),
        duration: Math.max(0, Number(targetPage.duration ?? info.duration) || 0),
        audioUrl: "",
        bvid: String(info.bvid || ""),
        aid: Number(info.aid || 0),
        cid: Number(targetPage.cid || info.cid || 0),
        page,
        pageUrl: location.href,
      };
    } catch (_error) {
      return null;
    }
  }

  function getEpisode() {
    if (isXiaoyuzhouEpisode()) {
      try {
        const node = document.getElementById("__NEXT_DATA__");
        const data = JSON.parse(node?.textContent || "{}");
        return sanitizeEpisode(data?.props?.pageProps?.episode);
      } catch (_error) {
        return null;
      }
    }
    return null;
  }

  function seekTo(seconds) {
    const player = document.querySelector("video") || document.querySelector("audio");
    if (!player) return false;
    player.currentTime = Math.max(0, Number(seconds) || 0);
    player.play().catch(() => {});
    return true;
  }

  function getPlaybackState() {
    const player = document.querySelector("video") || document.querySelector("audio");
    return {
      available: Boolean(player),
      currentTime: player ? Math.max(0, Number(player.currentTime) || 0) : 0,
      duration: player ? Math.max(0, Number(player.duration) || 0) : 0,
      paused: player ? player.paused : true,
    };
  }

  /* ---------------- B 站字幕引擎（官方接口 + WBI 签名，免费） ---------------- */
  // WBI 签名：B 站对部分 Web 接口要求 md5(query + mixin_key)。
  const BILI_WBI = (() => {
    const MIXIN_KEY_ENC_TAB = [
      46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
      33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
      61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
      36, 20, 34, 44, 52,
    ];
    const MD5_SHIFTS = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
      9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
      16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
      15, 21,
    ];
    const MD5_SINE = new Int32Array(64);
    for (let i = 0; i < 64; i += 1) MD5_SINE[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
    const rotateLeft = (value, bits) => ((value << bits) | (value >>> (32 - bits))) | 0;

    function md5(input) {
      const message = new TextEncoder().encode(String(input));
      const bitLength = message.length * 8;
      const paddedLength = (((message.length + 8) >> 6) + 1) << 6;
      const padded = new Uint8Array(paddedLength);
      padded.set(message);
      padded[message.length] = 0x80;
      const view = new DataView(padded.buffer);
      view.setUint32(paddedLength - 8, bitLength >>> 0, true);
      view.setUint32(paddedLength - 4, Math.floor(bitLength / 4294967296), true);
      let a0 = 0x67452301 | 0;
      let b0 = 0xefcdab89 | 0;
      let c0 = 0x98badcfe | 0;
      let d0 = 0x10325476 | 0;
      const words = new Int32Array(16);
      for (let offset = 0; offset < paddedLength; offset += 64) {
        for (let i = 0; i < 16; i += 1) words[i] = view.getInt32(offset + i * 4, true);
        let a = a0; let b = b0; let c = c0; let d = d0;
        for (let i = 0; i < 64; i += 1) {
          let f; let g;
          if (i < 16) { f = (b & c) | (~b & d); g = i; }
          else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
          else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
          else { f = c ^ (b | ~d); g = (7 * i) % 16; }
          f = (f + a + MD5_SINE[i] + words[g]) | 0;
          a = d; d = c; c = b; b = (b + rotateLeft(f, MD5_SHIFTS[i])) | 0;
        }
        a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
      }
      const out = new DataView(new ArrayBuffer(16));
      out.setInt32(0, a0, true); out.setInt32(4, b0, true); out.setInt32(8, c0, true); out.setInt32(12, d0, true);
      let hex = "";
      for (let i = 0; i < 16; i += 1) hex += out.getUint8(i).toString(16).padStart(2, "0");
      return hex;
    }

    const keyFromUrl = (url) => {
      const name = String(url || "").split("/").pop().split("?")[0];
      const dot = name.lastIndexOf(".");
      return dot === -1 ? name : name.slice(0, dot);
    };
    const getMixinKey = (imgKey, subKey) => {
      const raw = `${imgKey || ""}${subKey || ""}`;
      if (raw.length < 64) throw new Error("WBI 密钥长度不足");
      let mixin = "";
      for (const index of MIXIN_KEY_ENC_TAB) mixin += raw[index];
      return mixin.slice(0, 32);
    };
    const buildQuery = (params) => Object.keys(params).sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key] ?? "").replace(/[!'()*]/g, ""))}`)
      .join("&");
    const signParams = (params, keys) => {
      const mixinKey = getMixinKey(keys.imgKey, keys.subKey);
      const wts = Math.floor(Date.now() / 1000);
      const signed = { ...params, wts };
      return { ...signed, w_rid: md5(buildQuery(signed) + mixinKey) };
    };
    const signedUrl = (baseUrl, params, keys) => {
      const signed = signParams(params, keys);
      return `${baseUrl}?${buildQuery(signed)}`;
    };
    return { md5, keyFromUrl, getMixinKey, buildQuery, signParams, signedUrl };
  })();

  const BILI_VIEW_URL = "https://api.bilibili.com/x/web-interface/view";
  const BILI_PLAYER_URL = "https://api.bilibili.com/x/player/wbi/v2";
  const BILI_PLAYER_FALLBACK_URL = "https://api.bilibili.com/x/player/v2";
  const BILI_PLAY_URL = "https://api.bilibili.com/x/player/playurl";
  const BILI_NAV_URL = "https://api.bilibili.com/x/web-interface/nav";

  let cachedWbiKeys = null;
  async function fetchWbiKeys() {
    try {
      const res = await fetch(BILI_NAV_URL, { credentials: "include", headers: { Accept: "application/json" } });
      const data = await res.json();
      const img = BILI_WBI.keyFromUrl(data?.data?.wbi_img?.img_url);
      const sub = BILI_WBI.keyFromUrl(data?.data?.wbi_img?.sub_url);
      if (!img || !sub) return cachedWbiKeys;
      cachedWbiKeys = { imgKey: img, subKey: sub };
    } catch (_error) { /* 保留缓存 */ }
    return cachedWbiKeys;
  }

  async function bilibiliViewInfo(bvid) {
    const res = await fetch(`${BILI_VIEW_URL}?bvid=${encodeURIComponent(bvid)}`, { credentials: "include", headers: { Accept: "application/json" } });
    const data = await res.json();
    return data?.data || null;
  }

  // 选字幕轨：UP 主中文字幕 > AI 中文 > 英文；同语种优先人工字幕。
  // aiScore 越低越优先（0=人工/缺省，1=AI），且用 NaN 安全比较，避免 ai_type 缺失导致排序不稳定。
  function pickSubtitle(subtitles) {
    const order = (lan) => {
      if (lan === "zh-CN") return 0;
      if (lan === "zh-Hans" || lan === "zh") return 1;
      if (lan === "ai-zh") return 2;
      if (lan === "zh-Hant") return 3;
      if (lan === "en-US" || lan === "en") return 4;
      if (lan === "ai-en") return 5;
      return 9;
    };
    const aiScore = (item) => {
      const type = Number(item?.ai_type);
      if (Number.isFinite(type)) return type;
      const status = Number(item?.ai_status);
      return Number.isFinite(status) ? status : 0;
    };
    return (subtitles || []).slice().sort((a, b) => order(a.lan) - order(b.lan) || aiScore(a) - aiScore(b))[0] || null;
  }

  async function bilibiliTranscript(bvid, cid, aid) {
    let view;
    try { view = await bilibiliViewInfo(bvid); }
    catch (error) { throw new Error(`获取视频信息失败：${error?.message || "网络异常"}`); }
    const keys = await fetchWbiKeys();
    const resolvedCid = Number(cid) || Number(view?.cid || view?.pages?.[0]?.cid) || 0;
    const resolvedAid = Number(aid) || Number(view?.aid) || 0;
    if (!resolvedCid) throw new Error("未能拿到该视频的 cid");
    const playerUrl = keys
      ? BILI_WBI.signedUrl(BILI_PLAYER_URL, { aid: resolvedAid, cid: resolvedCid, bvid }, keys)
      : `${BILI_PLAYER_FALLBACK_URL}?aid=${encodeURIComponent(resolvedAid)}&cid=${encodeURIComponent(resolvedCid)}&bvid=${encodeURIComponent(bvid)}`;
    const player = await (await fetch(playerUrl, { credentials: "include", headers: { Accept: "application/json" } })).json();
    if (player?.code !== 0) throw new Error(`字幕列表获取失败（${player?.code}）`);
    if (player?.data?.need_login_subtitle) throw new Error("该视频字幕需要登录 B 站后可见，请登录后重试");
    const track = pickSubtitle(player?.data?.subtitle?.subtitles);
    if (!track?.subtitle_url) throw new Error("该视频暂无字幕");
    let sub;
    try {
      // 字幕 CDN 的鉴权在 subtitle_url 参数里；带 Cookie 反而触发跨域限制，故不传 credentials。
      const subtitleUrl = String(track.subtitle_url).startsWith("//") ? `https:${track.subtitle_url}` : String(track.subtitle_url).replace(/^http:/, "https:");
      const subRes = await fetch(subtitleUrl, { credentials: "omit", headers: { Accept: "application/json" } });
      if (!subRes.ok) throw new Error(`HTTP ${subRes.status}`);
      sub = await subRes.json();
    } catch (error) {
      throw new Error(`字幕下载失败：${error?.message || "网络异常"}`);
    }
    const body = Array.isArray(sub?.body) ? sub.body : [];
    return body.map((line) => ({
      startSeconds: Math.max(0, Number(line.from) || 0),
      durationSeconds: Math.max(0, Number(line.to) - Number(line.from) || 0),
      text: String(line.content || "").trim(),
    })).filter((segment) => segment.text.length >= 2);
  }

  async function bilibiliAudioUrl(bvid, cid) {
    const resolvedBvid = bvid || bilibiliBvid();
    const resolvedCid = Number(cid) || Number((await bilibiliViewInfo(resolvedBvid))?.cid) || 0;
    if (!resolvedBvid || !resolvedCid) throw new Error("未能读取课程音频信息");
    const query = new URLSearchParams({ bvid: resolvedBvid, cid: String(resolvedCid), fnval: "16", qn: "16", fourk: "0" });
    const response = await fetch(`${BILI_PLAY_URL}?${query}`, { credentials: "include", headers: { Accept: "application/json" } });
    const payload = await response.json();
    const audio = payload?.data?.dash?.audio?.slice()?.sort((a, b) => Number(b?.bandwidth || 0) - Number(a?.bandwidth || 0))?.[0];
    const url = audio?.baseUrl || audio?.base_url || audio?.backupUrl?.[0] || audio?.backup_url?.[0] || payload?.data?.durl?.[0]?.url || "";
    if (!/^https?:\/\//.test(url)) throw new Error("该视频没有可用于转写的公开音频");
    return String(url).replace(/^http:/, "https:");
  }

  function isSupportedPage() {
    return isXiaoyuzhouEpisode() || youtubeVideoId() !== "" || isBilibiliVideo();
  }

  function installButton() {
    if (document.getElementById(BUTTON_ID) || !isSupportedPage()) return;
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "精读这期";
    button.setAttribute("aria-label", "打开小黄笔侧边栏");
    Object.assign(button.style, {
      position: "fixed", right: "24px", bottom: "24px", zIndex: "2147483647",
      border: "0", borderRadius: "999px", padding: "12px 18px", background: "#ff6b35",
      color: "white", font: "600 14px system-ui, sans-serif",
      boxShadow: "0 8px 24px rgba(0,0,0,.18)", cursor: "pointer",
    });
    button.addEventListener("click", () => { chrome.runtime.sendMessage({ action: "openDigest" }); });
    document.body.appendChild(button);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === "getEpisode") {
      if (isBilibiliVideo()) {
        bilibiliViewEpisode(bilibiliBvid()).then((episode) => sendResponse({ episode })).catch(() => sendResponse({ episode: null }));
        return true; // 异步响应
      }
      sendResponse({ episode: getEpisode() });
    }
    if (message?.action === "getBilibiliTranscript") {
      bilibiliTranscript(message.bvid, message.cid, message.aid)
        .then((segments) => sendResponse({ segments }))
        .catch((error) => sendResponse({ error: error?.message || "字幕获取失败" }));
      return true; // 异步响应
    }
    if (message?.action === "getBilibiliAudioUrl") {
      bilibiliAudioUrl(message.bvid, message.cid)
        .then((audioUrl) => sendResponse({ audioUrl }))
        .catch((error) => sendResponse({ error: error?.message || "课程音频读取失败" }));
      return true;
    }
    if (message?.action === "seek") sendResponse({ success: seekTo(message.seconds) });
    if (message?.action === "getPlaybackState") sendResponse(getPlaybackState());
  });

  installButton();
  new MutationObserver(installButton).observe(document.documentElement, { childList: true, subtree: true });

  if (typeof globalThis !== "undefined") {
    globalThis.__XYD_CONTENT_TESTING__ = { sanitizeEpisode, youtubeVideoId, isSupportedPage, bilibiliBvid, isBilibiliVideo, pickSubtitle };
  }
})();
