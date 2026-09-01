const DASHSCOPE_BASE_URL = String(
  process.env.DASHSCOPE_BASE_URL ||
    "https://ws-37mwgpdpfsnksueh.ap-southeast-1.maas.aliyuncs.com/api/v1"
).replace(/\/$/, "");

export function normalizeDashscopeBaseUrl(value) {
  const candidate = String(value || DASHSCOPE_BASE_URL).trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || !(parsed.hostname === "dashscope.aliyuncs.com" || parsed.hostname === "dashscope-intl.aliyuncs.com" || parsed.hostname.endsWith(".maas.aliyuncs.com"))) {
      throw new Error();
    }
    return `${parsed.origin}${parsed.pathname === "/" ? "" : parsed.pathname}`.replace(/\/$/, "");
  } catch {
    throw Object.assign(new Error("百炼 API 地址无效，请使用百炼控制台显示的 DashScope 地址"), { status: 400 });
  }
}

async function dashscopeFetch(url, options, fallback) {
  try {
    return await fetch(url, options);
  } catch (cause) {
    throw Object.assign(new Error(`${fallback}：同步服务无法连接百炼，请检查服务网络和 API 地址`), { status: 502, cause });
  }
}

function safeText(value, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dashscopeError(response, payload, fallback) {
  const message = safeText(payload?.message || payload?.code || fallback, 500);
  const error = new Error(message || fallback);
  error.status = response.status >= 400 && response.status < 500 ? 400 : 502;
  return error;
}

async function readJson(response, fallback) {
  const raw = await response.text();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { throw dashscopeError(response, {}, fallback); }
  if (!response.ok) throw dashscopeError(response, payload, fallback);
  return payload;
}

function buildContext(metadata = {}) {
  const title = safeText(metadata.title, 300);
  const podcast = safeText(metadata.podcast, 150);
  const description = safeText(metadata.description, 1800);
  const prompt = [podcast && `播客：${podcast}`, title && `单集：${title}`, description && `节目简介：${description}`]
    .filter(Boolean).join("\n").slice(0, 2000);
  if (!prompt) return undefined;
  return [{ role: "user", content: [{ type: "input_text", text: prompt }] }];
}

export async function submitDashscopeJob({ apiKey, audioUrl, metadata = {}, model = "qwen-audio-3.0-asr-flash-filetrans", baseUrl }) {
  const endpoint = normalizeDashscopeBaseUrl(baseUrl);
  const context = buildContext(metadata);
  const response = await dashscopeFetch(`${endpoint}/services/audio/asr/transcription`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model,
      input: { file_urls: [audioUrl], ...(context ? { context } : {}) },
      parameters: {
        channel_id: [0],
        language_hints: ["zh", "en"],
        diarization_enabled: true,
      },
    }),
  }, "提交百炼转写任务失败");
  const payload = await readJson(response, "百炼没有接受转写任务");
  const taskId = safeText(payload?.output?.task_id, 200);
  if (!taskId) throw Object.assign(new Error("百炼没有返回任务 ID"), { status: 502 });
  return { taskId, status: safeText(payload?.output?.task_status, 50) || "PENDING" };
}

export async function fetchDashscopeJob({ apiKey, taskId, baseUrl }) {
  const endpoint = normalizeDashscopeBaseUrl(baseUrl);
  const response = await dashscopeFetch(`${endpoint}/tasks/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }, "查询百炼转写任务失败");
  return readJson(response, "查询百炼转写任务失败");
}

export async function fetchTranscriptionResult(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("aliyuncs.com")) {
    throw Object.assign(new Error("百炼返回了不可信的结果地址"), { status: 502 });
  }
  const response = await dashscopeFetch(parsed, undefined, "下载百炼转写结果失败");
  return readJson(response, "下载百炼转写结果失败");
}

export function normalizeDashscopeTranscript(payload) {
  const segments = [];
  for (const transcript of Array.isArray(payload?.transcripts) ? payload.transcripts : []) {
    for (const sentence of Array.isArray(transcript?.sentences) ? transcript.sentences : []) {
      const startMs = Math.max(0, Number(sentence?.begin_time) || 0);
      const endMs = Math.max(startMs, Number(sentence?.end_time) || startMs);
      const rawText = safeText(sentence?.text, 50000);
      const words = (Array.isArray(sentence?.words) ? sentence.words : []).map((word) => ({
        startSeconds: Math.max(0, Number(word?.begin_time) || 0) / 1000,
        endSeconds: Math.max(0, Number(word?.end_time) || 0) / 1000,
        text: `${safeText(word?.text, 200)}${safeText(word?.punctuation, 20)}`,
      })).filter((word) => word.text);
      // 百炼长音频常只给句尾标点、句内缺少停顿标点，标点位于 words[].punctuation；
      // 若 words 存在且句子文本缺少句内停顿标点，则用 words 重建带标点的文本。
      let text = rawText;
      if (words.length && !/[，、；：,;]/.test(rawText)) {
        const rebuilt = words.map((word) => word.text).join("").trim();
        if (rebuilt && rebuilt.length >= rawText.length * 0.6) text = rebuilt;
      }
      if (!text) continue;
      const speakerId = Number.isFinite(Number(sentence?.speaker_id)) ? String(Number(sentence.speaker_id)) : "";
      segments.push({
        startSeconds: startMs / 1000,
        durationSeconds: (endMs - startMs) / 1000,
        text,
        speakerId,
        speaker: speakerId ? `说话人 ${Number(speakerId) + 1}` : "",
        words,
      });
    }
  }
  return segments.sort((a, b) => a.startSeconds - b.startSeconds);
}

export function dashscopeTaskState(payload) {
  const output = payload?.output || {};
  const state = safeText(output.task_status, 50).toUpperCase();
  if (["FAILED", "CANCELED", "CANCELLED", "UNKNOWN"].includes(state)) {
    return { status: "failed", error: safeText(output.message || output.code, 500) || "百炼转写失败" };
  }
  if (state !== "SUCCEEDED") return { status: "processing" };
  const result = (Array.isArray(output.results) ? output.results : [])[0] || {};
  if (String(result.subtask_status || "").toUpperCase() === "FAILED") {
    return { status: "failed", error: safeText(result.message || result.code, 500) || "百炼无法读取音频" };
  }
  const transcriptionUrl = safeText(result.transcription_url, 4000);
  return transcriptionUrl ? { status: "completed", transcriptionUrl } : { status: "failed", error: "百炼任务完成但没有返回结果地址" };
}
