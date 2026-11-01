// Shared GlowGuide API handler for Vercel (not a route itself; the
// endpoint files balance.js, analyze.js and result.js all delegate here).
//   POST /api/analyze   body { image: "<data URL>" }   returns { task_id }
//   GET  /api/result?task_id=...                      returns { status, plan }
//   GET  /api/balance                                 returns unit balance
// Mock mode is automatic when YOUCAM_API_KEY is not set.

const youcam = require("../lib/youcam");
const { buildPlan } = require("../lib/coach");

function sendJson(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 12 * 1024 * 1024) { reject(new Error("Image too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/balance") {
      return sendJson(res, 200, await youcam.getBalance());
    }
    if (url.pathname === "/api/analyze" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (!body.image || !body.image.startsWith("data:image")) {
        return sendJson(res, 400, { error: "Please provide an image as a data URL." });
      }
      const comma = body.image.indexOf(",");
      const header = body.image.slice(0, comma);
      const buffer = Buffer.from(body.image.slice(comma + 1), "base64");
      const taskId = await youcam.startAnalysis(buffer, header);
      return sendJson(res, 200, { task_id: taskId, mock: youcam.MOCK });
    }
    if (url.pathname === "/api/result") {
      const taskId = url.searchParams.get("task_id");
      if (!taskId) return sendJson(res, 400, { error: "task_id is required" });
      const result = await youcam.getResult(taskId);
      if (result.status !== "success") return sendJson(res, 200, { status: result.status });
      const plan = buildPlan(result.scores);
      return sendJson(res, 200, { status: "success", mock: result.mock, plan });
    }
    return sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: err.message || "Something went wrong" });
  }
};
