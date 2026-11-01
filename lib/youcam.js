// YouCam API client for GlowGuide.
//
// Real integration follows the documented YouCam API v2 flow, verified
// against Perfect Corp docs and a working hackathon entry:
//   1. POST /s2s/v2.0/file                 -> file_id plus a presigned upload URL
//   2. PUT  the image bytes to that URL
//   3. POST /s2s/v2.0/task/skin-analysis   -> task_id
//   4. GET  /s2s/v2.0/task/skin-analysis/:id  (poll until success)
//   5. GET  /s2s/v1.0/client/credit        -> remaining API units (free call)
//
// Auth is a Bearer token: "Authorization: Bearer <YOUCAM_API_KEY>".
// When YOUCAM_API_KEY is not set, the client runs in MOCK mode and returns
// the sample result from lib/mock.js, so the whole app works end to end
// before the real key arrives.

const { MOCK_RESULT } = require("./mock");

const BASE = process.env.YOUCAM_API_BASE || "https://yce-api-01.makeupar.com";
const KEY = process.env.YOUCAM_API_KEY || "";
const MOCK = !KEY;

// The 8 concern panel. A full panel costs roughly 36 API units, so the
// 1,000 free hackathon units cover about 25 full checks. Plenty for judging.
const PANEL = ["wrinkle", "pore", "texture", "acne", "moisture", "oiliness", "redness", "radiance"];

async function api(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok) {
    const e = new Error(json.error || `YouCam API error: HTTP ${r.status}`);
    e.detail = json;
    throw e;
  }
  return json;
}

// imageBuffer: Buffer of a PNG or JPEG selfie. Returns a task_id string.
async function startAnalysis(imageBuffer, contentType) {
  if (MOCK) return MOCK_RESULT.data.task_id;
  const ct = contentType && contentType.includes("png") ? "image/png" : "image/jpeg";
  const init = await api("POST", "/s2s/v2.0/file", {
    files: [{ content_type: ct, file_name: `glowguide_${Date.now()}.${ct === "image/png" ? "png" : "jpg"}`, file_size: imageBuffer.length }]
  });
  const f = init.data.files[0];
  const put = f.requests[0];
  const up = await fetch(put.url, { method: "PUT", headers: put.headers, body: imageBuffer });
  if (!up.ok) throw new Error(`Image upload failed: HTTP ${up.status}`);
  const task = await api("POST", "/s2s/v2.0/task/skin-analysis", {
    src_file_id: f.file_id,
    dst_actions: PANEL,
    format: "json"
  });
  return task.data.task_id;
}

// Pull the per-concern scores out of a task response, whatever exact
// wrapper the API returns, into a flat list: [{ action, score }, ...].
function extractScores(taskJson) {
  const d = (taskJson && taskJson.data) || {};
  // Verified live format (2026-11-01): data.results.output is an array of
  // { type, ui_score, raw_score } items, plus type "all" and "skin_age".
  const out = d.results && d.results.output;
  if (Array.isArray(out) && out.length) {
    return out
      .filter((item) => PANEL.includes(item.type))
      .map((item) => ({ action: item.type, score: Math.round(Number(item.ui_score != null ? item.ui_score : item.score)) }))
      .filter((x) => Number.isFinite(x.score));
  }
  const lists = [d.results, d.outputs, d.actions, taskJson.results];
  for (const list of lists) {
    if (Array.isArray(list) && list.length) {
      return list
        .map((item) => {
          const action = item.action || item.name || item.key;
          const raw = item.score != null ? item.score : item.value;
          const score = Math.round(Number(raw));
          return action && Number.isFinite(score) ? { action, score } : null;
        })
        .filter(Boolean);
    }
  }
  // Some responses nest scores as an object keyed by action name.
  const obj = d.scores || d.result || null;
  if (obj && typeof obj === "object") {
    return Object.keys(obj)
      .filter((k) => PANEL.includes(k))
      .map((k) => ({ action: k, score: Math.round(Number(obj[k].score != null ? obj[k].score : obj[k])) }))
      .filter((x) => Number.isFinite(x.score));
  }
  return [];
}

async function getResult(taskId) {
  if (MOCK) {
    return { status: "success", scores: extractScores(MOCK_RESULT), mock: true };
  }
  const json = await api("GET", `/s2s/v2.0/task/skin-analysis/${taskId}`);
  const status = (json.data && json.data.task_status) || json.status || "running";
  if (status !== "success") return { status, scores: [], mock: false };
  return { status: "success", scores: extractScores(json), mock: false };
}

async function getBalance() {
  if (MOCK) return { mock: true, balance: null, note: "Mock mode. Add YOUCAM_API_KEY to see real units." };
  const json = await api("GET", "/s2s/v1.0/client/credit");
  return { mock: false, balance: json.data || json };
}

module.exports = { startAnalysis, getResult, getBalance, PANEL, MOCK };
