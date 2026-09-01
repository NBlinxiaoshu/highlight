const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const platform = require(path.join(__dirname, "..", "platform.js"));

test("平台识别：小宇宙、YouTube 与不支持的站点", () => {
  assert.equal(platform.episodeIdPlatform("https://www.xiaoyuzhoufm.com/episode/6a7ab5ac17676351c570146a?s=share"), "xiaoyuzhou");
  assert.equal(platform.episodeIdPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "youtube");
  assert.equal(platform.episodeIdPlatform("https://youtu.be/dQw4w9WgXcQ?t=10s"), "youtube");
  assert.equal(platform.episodeIdPlatform("https://example.com/episode/6a7ab5ac17676351c570146a"), "");
});

test("YouTube ID 解析支持 watch/shorts/embed/短链", () => {
  assert.equal(platform.youtubeIdFromUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s"), "dQw4w9WgXcQ");
  assert.equal(platform.youtubeIdFromUrl("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(platform.youtubeIdFromUrl("https://www.youtube.com/shorts/abc_2345678"), "abc_2345678");
  assert.equal(platform.youtubeIdFromUrl("https://www.youtube.com/embed/abc_2345678"), "abc_2345678");
  assert.equal(platform.youtubeIdFromUrl("https://example.com/watch?v=dQw4w9WgXcQ"), "");
});

test("parseId 返回 {platform,id} 且正确命名空间存储键", () => {
  assert.deepEqual(platform.parseId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), {
    platform: "youtube",
    id: "dQw4w9WgXcQ",
  });
  assert.equal(platform.storageKey("xiaoyuzhou", "6a7ab5ac17676351c570146a"), "xyd_digest_6a7ab5ac17676351c570146a");
  assert.equal(platform.storageKey("youtube", "dQw4w9WgXcQ"), "xyd_digest_yt_dQw4w9WgXcQ");
});

test("小宇宙页面数据被规范化为统一 episode 结构", () => {
  const episode = platform.platforms.xiaoyuzhou.normalizePageData({
    type: "EPISODE",
    eid: "6a7ab5ac17676351c570146a",
    title: "某期节目",
    podcast: { title: "某播客" },
    description: "简介",
    duration: 1800,
    enclosure: { url: "https://cdn.example.com/a.m4a" },
  }, "https://www.xiaoyuzhoufm.com/episode/6a7ab5ac17676351c570146a?s=share");
  assert.equal(episode.id, "6a7ab5ac17676351c570146a");
  assert.equal(episode.channel, "某播客");
  assert.equal(episode.audioUrl, "https://cdn.example.com/a.m4a");
  assert.equal(episode.pageUrl, "https://www.xiaoyuzhoufm.com/episode/6a7ab5ac17676351c570146a");
});

test("YouTube ytInitialPlayerResponse 被规范化为统一 episode 结构", () => {
  const episode = platform.platforms.youtube.normalizePageData({
    videoDetails: { videoId: "dQw4w9WgXcQ", title: "一个视频", lengthSeconds: "600", shortDescription: "描述", author: "某频道" },
    microformat: { playerMicroformatRenderer: { ownerChannelName: "某频道" } },
  }, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(episode.id, "dQw4w9WgXcQ");
  assert.equal(episode.channel, "某频道");
  assert.equal(episode.duration, 600);
  assert.equal(episode.audioUrl, "");
});

test("YouTube oEmbed 兜底也能得到标题与频道", () => {
  const episode = platform.platforms.youtube.normalizePageData({
    title: "oEmbed 标题",
    author_name: "oEmbed 频道",
  }, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(episode.title, "oEmbed 标题");
  assert.equal(episode.channel, "oEmbed 频道");
  assert.equal(episode.id, "dQw4w9WgXcQ");
});

test("取稿方式：小宇宙为整段 ASR，YouTube 优先字幕", () => {
  assert.equal(platform.transcriptDependency("xiaoyuzhou"), "audio_asr");
  assert.equal(platform.transcriptDependency("youtube"), "supadata_youtube_transcript");
});

test("从 YouTube watch 页面 HTML 用平衡括号解析 ytInitialPlayerResponse", () => {
  const html = '<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"dQw4w9WgXcQ","title":"一个视频","lengthSeconds":"600","shortDescription":"描述","author":"某频道"}};</script>';
  const player = platform.youtubePlayerResponseFromHtml(html);
  assert.ok(player);
  const episode = platform.platforms.youtube.normalizePageData(player, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(episode.id, "dQw4w9WgXcQ");
  assert.equal(episode.title, "一个视频");
  assert.equal(episode.duration, 600);
});

test("平衡括号解析能容忍对象内带字符串花括号与转义", () => {
  const html = '<script>var ytInitialPlayerResponse = {"videoDetails":{"title":"a } {  \\" b","lengthSeconds":"30"},"a":"x"};</script>';
  const player = platform.youtubePlayerResponseFromHtml(html);
  assert.ok(player);
  assert.equal(player.videoDetails.title, 'a } {  " b');
});
