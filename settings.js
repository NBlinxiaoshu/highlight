var XYD_SETTINGS = (() => {
  const STORAGE_KEY = "xyd_settings";
  const AUTH_KEY = "xyd_cloud_auth";
  const DEFAULTS = Object.freeze({
    asrProvider: "aliyun",
    dashscopeApiKey: "",
    dashscopeBaseUrl: "https://ws-37mwgpdpfsnksueh.ap-southeast-1.maas.aliyuncs.com/api/v1",
    supadataApiKey: "",
    aiApiKey: "",
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

  function normalize(input = {}) {
    return {
      asrProvider: input.asrProvider === "aliyun" ? "aliyun" : "supadata",
      dashscopeApiKey: typeof input.dashscopeApiKey === "string" ? input.dashscopeApiKey.trim() : "",
      dashscopeBaseUrl: /^https:\/\/(?:[a-z0-9-]+\.)*(?:dashscope|dashscope-intl)\.aliyuncs\.com(?:\/|$)|^https:\/\/ws-[a-z0-9]+\.ap-[a-z0-9-]+\.maas\.aliyuncs\.com(?:\/|$)/i.test(String(input.dashscopeBaseUrl || ""))
        ? String(input.dashscopeBaseUrl).trim().replace(/\/+$/, "")
        : DEFAULTS.dashscopeBaseUrl,
      supadataApiKey:
        typeof input.supadataApiKey === "string"
          ? input.supadataApiKey.trim()
          : "",
      aiApiKey:
        typeof input.aiApiKey === "string"
          ? input.aiApiKey.trim()
          : "",
      aiBaseUrl: DEFAULTS.aiBaseUrl,
      aiModel: DEFAULTS.aiModel,
      syncBaseUrl: /^https?:\/\//i.test(String(input.syncBaseUrl || ""))
        ? String(input.syncBaseUrl).trim().replace(/\/+$/, "")
        : DEFAULTS.syncBaseUrl,
      summaryLength: ["short", "medium", "long"].includes(input.summaryLength) ? input.summaryLength : DEFAULTS.summaryLength,
      writingStyle: ["concise", "conversational", "academic"].includes(input.writingStyle) ? input.writingStyle : DEFAULTS.writingStyle,
      focusPreferences: Array.from(new Set(Array.isArray(input.focusPreferences) ? input.focusPreferences : DEFAULTS.focusPreferences))
        .filter((value) => ["viewpoint", "method", "case", "fact", "funny", "controversy"].includes(value)).slice(0, 4),
      summaryFormat: ["list", "qa"].includes(input.summaryFormat) ? input.summaryFormat : DEFAULTS.summaryFormat,
      summaryFeatures: {
        emoji: Boolean(input.summaryFeatures?.emoji),
        highlights: input.summaryFeatures?.highlights !== false,
        grouped: input.summaryFeatures?.grouped !== false,
      },
      highlightLevels: Array.from(new Set(Array.isArray(input.highlightLevels) ? input.highlightLevels.map(Number) : DEFAULTS.highlightLevels))
        .filter((level) => [1, 2, 3, 4].includes(level)).sort((a, b) => a - b),
      boldLevels: Array.from(new Set(Array.isArray(input.boldLevels) ? input.boldLevels.map(Number) : DEFAULTS.boldLevels))
        .filter((level) => [1, 2, 3, 4].includes(level)).sort((a, b) => a - b),
      markTypes: Array.from(new Set(Array.isArray(input.markTypes) ? input.markTypes : DEFAULTS.markTypes))
        .filter((value) => ["quote", "case", "method", "fact", "custom"].includes(value)),
      highlightTypes: ((filtered) => filtered.length ? filtered : DEFAULTS.highlightTypes)(Array.from(new Set(Array.isArray(input.highlightTypes) ? input.highlightTypes : DEFAULTS.highlightTypes))
        .filter((value) => ["quote", "fact", "method", "case"].includes(value))),
      boldTypes: ((filtered) => filtered.length ? filtered : DEFAULTS.boldTypes)(Array.from(new Set(Array.isArray(input.boldTypes) ? input.boldTypes : DEFAULTS.boldTypes))
        .filter((value) => ["quote", "fact", "method", "case"].includes(value))),
      customItems: (Array.isArray(input.customItems) && !input.customItems.includes("custom"))
        ? Array.from(new Set(input.customItems)).filter((value) => ["ai", "product", "business"].includes(value))
        : [],
      customColor: /^#[0-9a-f]{6}$/i.test(String(input.customColor || "")) ? input.customColor : DEFAULTS.customColor,
      customGoal: typeof input.customGoal === "string" ? input.customGoal.trim().slice(0, 500) : "",
      customDirection: ["ai", "product", "business", "custom"].includes(input.customDirection) ? input.customDirection : "",
      summaryAutoGenerate: Boolean(input.summaryAutoGenerate),
      summaryAutoTranslate: Boolean(input.summaryAutoTranslate),
      summaryLanguage: ["zh-CN", "en", "zh-en"].includes(input.summaryLanguage) ? input.summaryLanguage : DEFAULTS.summaryLanguage,
      transcriptPrompt: typeof input.transcriptPrompt === "string" ? input.transcriptPrompt.trim().slice(0, 2000) : "",
      summaryPrompt: typeof input.summaryPrompt === "string" ? input.summaryPrompt.trim().slice(0, 2000) : "",
      highlightPrompt: typeof input.highlightPrompt === "string" ? input.highlightPrompt.trim().slice(0, 2000) : "",
    };
  }

  function episodeIdFromUrl(url) {
    const match = String(url || "").match(
      /^https:\/\/www\.xiaoyuzhoufm\.com\/episode\/([a-f0-9]{24})(?:[/?#]|$)/i,
    );
    return match ? match[1] : "";
  }

  function digestKey(episodeId) {
    if (!/^[a-f0-9]{24}$/i.test(String(episodeId || ""))) {
      throw new Error("无效的小宇宙单集 ID");
    }
    return `xyd_digest_${episodeId}`;
  }

  function chatCompletionsUrl() {
    return `${DEFAULTS.aiBaseUrl}/chat/completions`;
  }

  return { STORAGE_KEY, AUTH_KEY, DEFAULTS, normalize, episodeIdFromUrl, digestKey, chatCompletionsUrl };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = XYD_SETTINGS;
}
