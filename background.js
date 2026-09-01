importScripts("settings.js", "platform.js");

chrome.storage.local
  .setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
  .catch(() => {});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.sidePanel
    .setOptions({ tabId: tab.id, path: "sidepanel.html", enabled: true })
    .then(() => chrome.sidePanel.open({ tabId: tab.id }));
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.action !== "openDigest" || !sender.tab?.id) return;
  chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
});

function isEpisodeUrl(url) {
  return typeof XYD_PLATFORM !== "undefined"
    ? XYD_PLATFORM.detectPlatform(url) !== null
    : XYD_SETTINGS.episodeIdFromUrl(url) !== "";
}

function updatePanel(tabId, url) {
  chrome.sidePanel
    .setOptions({ tabId, path: "sidepanel.html", enabled: isEpisodeUrl(url) })
    .catch(() => {});
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    updatePanel(tabId, changeInfo.url || tab.url || "");
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    updatePanel(tabId, tab.url || "");
  } catch (_error) {}
});
