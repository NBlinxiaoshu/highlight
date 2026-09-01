(() => {
  const BUTTON_ID = "xyd-digest-button";
  const YT_ID_PATTERN = /(?:^|[?&#])v=([A-Za-z0-9_-]{11})(?:[&#]|$)/;

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

  // YouTube 无 __NEXT_DATA__：交给 sidepanel 走 fetchEpisodeFromPage(platform) 取完整元数据。
  // 这里返回 null，让面板在获取到稳定 ID 后自行抓取标题/频道/时长。
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
    // 小宇宙用 audio，YouTube/Bilibili 用视频播放器，统一兜底查找。
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

  function installButton() {
    if (document.getElementById(BUTTON_ID) || !isSupportedPage()) return;
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "精读这期";
    button.setAttribute("aria-label", "打开小黄笔侧边栏");
    Object.assign(button.style, {
      position: "fixed",
      right: "24px",
      bottom: "24px",
      zIndex: "2147483647",
      border: "0",
      borderRadius: "999px",
      padding: "12px 18px",
      background: "#ff6b35",
      color: "white",
      font: "600 14px system-ui, sans-serif",
      boxShadow: "0 8px 24px rgba(0,0,0,.18)",
      cursor: "pointer",
    });
    button.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "openDigest" });
    });
    document.body.appendChild(button);
  }

  function isSupportedPage() {
    return isXiaoyuzhouEpisode() || youtubeVideoId() !== "";
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === "getEpisode") sendResponse({ episode: getEpisode() });
    if (message?.action === "seek") {
      sendResponse({ success: seekTo(message.seconds) });
    }
    if (message?.action === "getPlaybackState") sendResponse(getPlaybackState());
  });

  installButton();
  new MutationObserver(installButton).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  if (typeof globalThis !== "undefined") {
    globalThis.__XYD_CONTENT_TESTING__ = { sanitizeEpisode, youtubeVideoId, isSupportedPage };
  }
})();
