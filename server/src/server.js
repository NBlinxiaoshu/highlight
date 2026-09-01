import { createServer } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dashscopeTaskState, fetchDashscopeJob, fetchTranscriptionResult, normalizeDashscopeTranscript, submitDashscopeJob } from "./asr.js";

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.XYD_DATABASE_PATH || resolve(here, "../data/xyd.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS library (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, episode_id TEXT NOT NULL,
    title TEXT NOT NULL, podcast TEXT NOT NULL, page_url TEXT NOT NULL, duration INTEGER NOT NULL,
    payload TEXT NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, episode_id)
  );
  CREATE TABLE IF NOT EXISTS asr_cache (
    cache_key TEXT PRIMARY KEY, episode_id TEXT NOT NULL, model TEXT NOT NULL,
    status TEXT NOT NULL, remote_task_id TEXT NOT NULL DEFAULT '', segments TEXT NOT NULL DEFAULT '[]',
    error TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS library_recent ON library(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS asr_cache_episode ON asr_cache(episode_id, model);
`);

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const asrJobs = new Map();
const allowedOrigin = (origin) => !origin || origin.startsWith("chrome-extension://") || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

function send(res, status, value, origin = "") {
  const headers = { ...jsonHeaders };
  if (origin && allowedOrigin(origin)) headers["access-control-allow-origin"] = origin;
  res.writeHead(status, headers);
  res.end(JSON.stringify(value));
}

async function body(req, limit = 24 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("请求内容过大"), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw Object.assign(new Error("JSON 格式错误"), { status: 400 }); }
}

function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function validPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tokenHash(token) { return createHash("sha256").update(token).digest("hex"); }

function userFromRequest(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return db.prepare(`SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?`).get(tokenHash(token), Date.now()) || null;
}

function createSession(user) {
  const token = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)")
    .run(tokenHash(token), user.id, Date.now() + 30 * 24 * 3600 * 1000, Date.now());
  return { token, user: { id: user.id, email: user.email } };
}

function cleanEmail(value) { return String(value || "").trim().toLowerCase().slice(0, 254); }

const allowedAsrModels = new Set(["qwen-audio-3.0-asr-flash-filetrans", "paraformer-v2"]);
function normalizeAsrModel(value) {
  return allowedAsrModels.has(String(value || "")) ? String(value) : "qwen-audio-3.0-asr-flash-filetrans";
}
function asrCacheKey(episodeId, audioUrl, model) {
  const stableSource = /^[a-f0-9]{24}$/i.test(String(episodeId || "")) ? String(episodeId).toLowerCase() : createHash("sha256").update(audioUrl).digest("hex");
  return createHash("sha256").update(`${stableSource}|${model}`).digest("hex");
}
function cacheAsrState(job) {
  if (!job?.cacheKey) return;
  db.prepare(`INSERT INTO asr_cache(cache_key,episode_id,model,status,remote_task_id,segments,error,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET status=excluded.status,remote_task_id=excluded.remote_task_id,segments=excluded.segments,error=excluded.error,updated_at=excluded.updated_at`)
    .run(job.cacheKey, job.episodeId, job.model, job.status, job.remoteTaskId || "", JSON.stringify(job.segments || []), job.error || "", job.createdAt || Date.now(), Date.now());
}

const server = createServer(async (req, res) => {
  const origin = String(req.headers.origin || "");
  if (origin && !allowedOrigin(origin)) return send(res, 403, { error: "不允许的来源" });
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, content-type, x-dashscope-key, x-dashscope-base-url",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "access-control-max-age": "86400",
    });
    return res.end();
  }
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true }, origin);

    if (req.method === "PUT" && url.pathname === "/v1/asr/cache") {
      const input = await body(req);
      const episodeId = String(input.episodeId || "").trim().slice(0, 100);
      if (!/^[a-f0-9]{24}$/i.test(episodeId)) return send(res, 400, { error: "节目 ID 无效" }, origin);
      const model = normalizeAsrModel(input.model);
      const audioUrl = String(input.audioUrl || "").trim();
      const segments = (Array.isArray(input.segments) ? input.segments : []).slice(0, 20000).map((segment) => ({
        startSeconds: Math.max(0, Number(segment?.startSeconds) || 0),
        durationSeconds: Math.max(0, Number(segment?.durationSeconds) || 0),
        text: String(segment?.text || "").trim().slice(0, 50000),
        speakerId: String(segment?.speakerId || "").slice(0, 30),
        speaker: String(segment?.speaker || "").slice(0, 80),
      })).filter((segment) => segment.text);
      if (!segments.length) return send(res, 400, { error: "逐字稿为空" }, origin);
      const cacheKey = asrCacheKey(episodeId, audioUrl, model);
      cacheAsrState({ cacheKey, episodeId, model, status: "completed", remoteTaskId: "", segments, error: "", createdAt: Date.now() });
      return send(res, 200, { ok: true, cachedSegments: segments.length }, origin);
    }

    if (req.method === "POST" && url.pathname === "/v1/asr/jobs") {
      const input = await body(req, 128 * 1024);
      const audioUrl = String(input.audioUrl || "").trim();
      let parsedAudioUrl;
      try { parsedAudioUrl = new URL(audioUrl); } catch { return send(res, 400, { error: "没有取得有效的音频地址" }, origin); }
      if (parsedAudioUrl.protocol !== "https:") return send(res, 400, { error: "音频地址必须使用 HTTPS" }, origin);
      const episodeId = String(input.episodeId || "").trim().slice(0, 100);
      const model = normalizeAsrModel(input.model);
      const cacheKey = asrCacheKey(episodeId, audioUrl, model);
      if (!input.force) {
        const cached = db.prepare("SELECT segments FROM asr_cache WHERE cache_key = ? AND status = 'completed'").get(cacheKey);
        if (cached) {
          let segments = [];
          try { segments = JSON.parse(cached.segments); } catch {}
          if (Array.isArray(segments) && segments.length) {
            const jobId = randomBytes(18).toString("base64url");
            asrJobs.set(jobId, { cacheKey, episodeId, model, status: "completed", segments, error: "", createdAt: Date.now() });
            return send(res, 200, { jobId, status: "completed", completedChunks: 1, totalChunks: 1, cached: true }, origin);
          }
        }
        const active = [...asrJobs.entries()].find(([, job]) => job.cacheKey === cacheKey && job.status === "processing");
        if (active) return send(res, 202, { jobId: active[0], status: "processing", completedChunks: 0, totalChunks: 1, cached: true }, origin);
      }
      const apiKey = String(req.headers["x-dashscope-key"] || "").trim();
      if (!/^sk-[A-Za-z0-9._-]{12,512}$/.test(apiKey)) return send(res, 400, { error: "请在设置中保存正确的百炼 DashScope API Key" }, origin);
      const baseUrl = String(req.headers["x-dashscope-base-url"] || "").trim();
      const metadata = { title: input.title, podcast: input.podcast, description: input.description };
      const remote = await submitDashscopeJob({ apiKey, audioUrl, metadata, model, baseUrl });
      const jobId = randomBytes(18).toString("base64url");
      const job = { apiKey, baseUrl, cacheKey, episodeId, model, remoteTaskId: remote.taskId, status: "processing", segments: [], error: "", createdAt: Date.now() };
      asrJobs.set(jobId, job);
      cacheAsrState(job);
      return send(res, 202, { jobId, status: "processing", completedChunks: 0, totalChunks: 1 }, origin);
    }

    const asrMatch = url.pathname.match(/^\/v1\/asr\/jobs\/([A-Za-z0-9_-]{12,80})$/);
    if (req.method === "GET" && asrMatch) {
      const job = asrJobs.get(asrMatch[1]);
      if (!job) return send(res, 404, { error: "转写任务已失效，请重新生成" }, origin);
      if (job.status === "completed" || job.status === "failed") {
        return send(res, 200, { status: job.status, error: job.error, segments: job.segments, completedChunks: job.status === "completed" ? 1 : 0, totalChunks: 1 }, origin);
      }
      const remotePayload = await fetchDashscopeJob({ apiKey: job.apiKey, taskId: job.remoteTaskId, baseUrl: job.baseUrl });
      const state = dashscopeTaskState(remotePayload);
      if (state.status === "completed") {
        const result = await fetchTranscriptionResult(state.transcriptionUrl);
        job.segments = normalizeDashscopeTranscript(result);
        job.status = job.segments.length ? "completed" : "failed";
        job.error = job.segments.length ? "" : "百炼完成了任务，但没有识别出文字";
        job.apiKey = "";
        cacheAsrState(job);
      } else if (state.status === "failed") {
        job.status = "failed";
        job.error = state.error;
        job.apiKey = "";
        cacheAsrState(job);
      }
      return send(res, 200, { status: job.status, error: job.error, segments: job.segments, completedChunks: job.status === "completed" ? 1 : 0, totalChunks: 1 }, origin);
    }

    if (req.method === "POST" && ["/v1/auth/register", "/v1/auth/login"].includes(url.pathname)) {
      const input = await body(req, 16 * 1024);
      const email = cleanEmail(input.email);
      const password = String(input.password || "");
      if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 200) return send(res, 400, { error: "邮箱或密码格式不正确" }, origin);
      let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (url.pathname.endsWith("register")) {
        if (user) return send(res, 409, { error: "邮箱已注册" }, origin);
        user = { id: randomBytes(16).toString("hex"), email };
        db.prepare("INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)").run(user.id, email, passwordHash(password), Date.now());
      } else if (!user || !validPassword(password, user.password_hash)) {
        return send(res, 401, { error: "邮箱或密码不正确" }, origin);
      }
      return send(res, 200, createSession(user), origin);
    }

    const user = userFromRequest(req);
    if (!user) return send(res, 401, { error: "请先登录" }, origin);

    if (req.method === "GET" && url.pathname === "/v1/library") {
      const items = db.prepare("SELECT episode_id AS episodeId,title,podcast,page_url AS pageUrl,duration,updated_at AS updatedAt FROM library WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200").all(user.id);
      return send(res, 200, { items }, origin);
    }

    const match = url.pathname.match(/^\/v1\/library\/([a-f0-9]{24})$/i);
    if (match && req.method === "GET") {
      const row = db.prepare("SELECT payload FROM library WHERE user_id = ? AND episode_id = ?").get(user.id, match[1]);
      return row ? send(res, 200, JSON.parse(row.payload), origin) : send(res, 404, { error: "没有找到" }, origin);
    }
    if (match && req.method === "PUT") {
      const input = await body(req);
      const episode = input.episode || {};
      const payload = JSON.stringify({ episode, digest: input.digest || null, transcript: Array.isArray(input.transcript) ? input.transcript : [], notes: Array.isArray(input.notes) ? input.notes : [], updatedAt: Date.now() });
      db.prepare(`INSERT INTO library(user_id,episode_id,title,podcast,page_url,duration,payload,updated_at)
        VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,episode_id) DO UPDATE SET title=excluded.title,podcast=excluded.podcast,page_url=excluded.page_url,duration=excluded.duration,payload=excluded.payload,updated_at=excluded.updated_at`)
        .run(user.id, match[1], String(episode.title || "未命名单集").slice(0, 500), String(episode.podcast || "").slice(0, 300), String(episode.pageUrl || "").slice(0, 1000), Number(episode.duration) || 0, payload, Date.now());
      return send(res, 200, { ok: true }, origin);
    }
    if (match && req.method === "DELETE") {
      db.prepare("DELETE FROM library WHERE user_id = ? AND episode_id = ?").run(user.id, match[1]);
      return send(res, 200, { ok: true }, origin);
    }

    send(res, 404, { error: "接口不存在" }, origin);
  } catch (error) {
    console.error("request failed", { method: req.method, path: url.pathname, status: error?.status || 500, message: error?.message || String(error), cause: error?.cause?.message || "" });
    send(res, error.status || 500, { error: error.status ? error.message : "服务器内部错误" }, origin);
  }
});

const port = Number(process.env.PORT) || 8787;
server.listen(port, "127.0.0.1", () => console.log(`highlight server listening on http://127.0.0.1:${port}`));

export { server };
