// GlowGuide server. Zero dependencies, plain Node.
// Keeps the YouCam API key on the server side. Serves the app from /public
// and exposes three small endpoints:
//   POST /api/analyze   body { image: "<data URL>" }   returns { task_id }
//   GET  /api/result?task_id=...                      returns { status, plan }
//   GET  /api/balance                                 returns unit balance
// Run:  node server.js        (PORT env optional, default 3456)
// Mock mode is automatic when YOUCAM_API_KEY is not set.

const http = require("http");
const fs = require("fs");
const path = require("path");
const youcam = require("./lib/youcam");
const { buildPlan } = require("./lib/coach");

const PORT = process.env.PORT || 3456;
const PUBLIC = path.join(__dirname, "public");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(body);
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/api/balance") {
      return sendJson(res, 200, await youcam.getBalance());
    }
    if (url.pathname === "/api/analyze" && req.method === "POST") {
      const body = JSON.parse(await readBody(req) || "{}");
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
    // Static files
    let file = url.pathname === "/" ? "/index.html" : url.pathname;
    const full = path.join(PUBLIC, path.normalize(file).replace(/^(\.\.[/\\])+/, ""));
    if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(full)] || "application/octet-stream" });
    return res.end(fs.readFileSync(full));
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: err.message || "Something went wrong" });
  }
});

server.listen(PORT, () => {
  console.log(`GlowGuide running at http://localhost:${PORT} (${youcam.MOCK ? "MOCK mode, no API key set" : "LIVE YouCam API mode"})`);
});
