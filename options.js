(() => {
  "use strict";
  const form = document.getElementById("settingsForm");
  const asrProvider = document.getElementById("asrProvider");
  const dashscope = document.getElementById("dashscopeApiKey");
  const dashscopeBaseUrl = document.getElementById("dashscopeBaseUrl");
  const supadata = document.getElementById("supadataApiKey");
  const ai = document.getElementById("aiApiKey");
  const syncBaseUrl = document.getElementById("syncBaseUrl");
  const status = document.getElementById("status");
  let currentSettings = XYD_SETTINGS.normalize();

  async function load() {
    const stored = await chrome.storage.local.get(XYD_SETTINGS.STORAGE_KEY);
    const value = XYD_SETTINGS.normalize(stored[XYD_SETTINGS.STORAGE_KEY]);
    currentSettings = value;
    asrProvider.value = value.asrProvider;
    dashscope.value = value.dashscopeApiKey;
    dashscopeBaseUrl.value = value.dashscopeBaseUrl;
    supadata.value = value.supadataApiKey;
    ai.value = value.aiApiKey;
    syncBaseUrl.value = value.syncBaseUrl;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = XYD_SETTINGS.normalize({ ...currentSettings, asrProvider: "aliyun", dashscopeApiKey: dashscope.value, dashscopeBaseUrl: dashscopeBaseUrl.value, supadataApiKey: supadata.value, aiApiKey: ai.value, syncBaseUrl: syncBaseUrl.value });
    currentSettings = value;
    await chrome.storage.local.set({ [XYD_SETTINGS.STORAGE_KEY]: value });
    status.textContent = "已保存到本机";
    setTimeout(() => { status.textContent = ""; }, 2500);
  });

  document.querySelectorAll("[data-reveal]").forEach((button) => button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.reveal);
    input.type = input.type === "password" ? "text" : "password";
  }));

  document.querySelector(".back-button").addEventListener("click", () => history.length > 1 ? history.back() : window.close());

  document.getElementById("clearBtn").addEventListener("click", async () => {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((key) => key.startsWith("xyd_digest_"));
    if (keys.length) await chrome.storage.local.remove(keys);
    status.textContent = `已清除 ${keys.length} 条摘要`;
  });

  load().catch((error) => { status.textContent = `读取失败：${error.message}`; });
})();
