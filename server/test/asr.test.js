import test from "node:test";
import assert from "node:assert/strict";
import { dashscopeTaskState, normalizeDashscopeBaseUrl, normalizeDashscopeTranscript } from "../src/asr.js";

test("只接受阿里云官方的 DashScope API 地址", () => {
  assert.equal(normalizeDashscopeBaseUrl("https://ws-37mwgpdpfsnksueh.ap-southeast-1.maas.aliyuncs.com/api/v1/"), "https://ws-37mwgpdpfsnksueh.ap-southeast-1.maas.aliyuncs.com/api/v1");
  assert.equal(normalizeDashscopeBaseUrl("https://dashscope.aliyuncs.com/api/v1"), "https://dashscope.aliyuncs.com/api/v1");
  assert.equal(normalizeDashscopeBaseUrl("https://dashscope-intl.aliyuncs.com/api/v1/"), "https://dashscope-intl.aliyuncs.com/api/v1");
  assert.throws(() => normalizeDashscopeBaseUrl("https://example.com/api/v1"), /API 地址无效/);
  assert.throws(() => normalizeDashscopeBaseUrl("http://dashscope.aliyuncs.com/api/v1"), /API 地址无效/);
});

test("把百炼句子、时间戳和说话人编号转换为前端段落", () => {
  assert.deepEqual(normalizeDashscopeTranscript({
    transcripts: [{ sentences: [{ begin_time: 1250, end_time: 4800, text: "欢迎收听。", speaker_id: 1 }] }],
  }), [{
    startSeconds: 1.25,
    durationSeconds: 3.55,
    text: "欢迎收听。",
    speakerId: "1",
    speaker: "说话人 2",
    words: [],
  }]);
});

test("百炼句子缺句内标点时用 words 的 punctuation 重建文本", () => {
  const result = normalizeDashscopeTranscript({
    transcripts: [{
      sentences: [{
        begin_time: 1000,
        end_time: 4000,
        text: "欢迎来到知行小酒馆这是一档有知有行出品的播客节目。",
        speaker_id: 0,
        words: [
          { begin_time: 1000, end_time: 1500, text: "欢迎", punctuation: "" },
          { begin_time: 1500, end_time: 2000, text: "来到", punctuation: "" },
          { begin_time: 2000, end_time: 2500, text: "知行小酒馆", punctuation: "，" },
          { begin_time: 2500, end_time: 3000, text: "这是一档", punctuation: "" },
          { begin_time: 3000, end_time: 3500, text: "播客节目", punctuation: "。" },
        ],
      }],
    }],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].text, "欢迎来到知行小酒馆，这是一档播客节目。");
  assert.equal(result[0].words.length, 5);
  assert.equal(result[0].words[2].text, "知行小酒馆，");
});

test("百炼句子已带标点时保持原样不重建", () => {
  const result = normalizeDashscopeTranscript({
    transcripts: [{
      sentences: [{
        begin_time: 1000,
        end_time: 3000,
        text: "你好，世界。",
        speaker_id: 0,
        words: [{ begin_time: 1000, end_time: 3000, text: "你好，世界。", punctuation: "" }],
      }],
    }],
  });
  assert.equal(result[0].text, "你好，世界。");
});

test("读取百炼异步任务的结果地址", () => {
  assert.deepEqual(dashscopeTaskState({ output: { task_status: "RUNNING" } }), { status: "processing" });
  assert.deepEqual(dashscopeTaskState({ output: { task_status: "SUCCEEDED", results: [{ subtask_status: "SUCCEEDED", transcription_url: "https://example.aliyuncs.com/result.json" }] } }), {
    status: "completed",
    transcriptionUrl: "https://example.aliyuncs.com/result.json",
  });
});
