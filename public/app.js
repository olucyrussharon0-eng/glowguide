const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const analyzeBtn = document.getElementById("analyzeBtn");
const sampleBtn = document.getElementById("sampleBtn");
const statusEl = document.getElementById("status");
let imageDataUrl = null;

fetch("/api/balance").then(r => r.json()).then(b => {
  const el = document.getElementById("units");
  if (b && b.mock) el.textContent = "Demo mode: sample analysis. Connect the YouCam API key for live checks.";
}).catch(() => {});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    // Shrink the photo before anything is sent: full-size phone photos
    // are several megabytes and crawl or fail on mobile networks. A
    // 1024px JPEG is plenty for skin analysis and sends in seconds.
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1024;
        let w = img.width;
        let h = img.height;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        imageDataUrl = canvas.toDataURL("image/jpeg", 0.85);
      } catch (e) {
        imageDataUrl = reader.result;
      }
      preview.src = imageDataUrl;
      preview.hidden = false;
      analyzeBtn.disabled = false;
      statusEl.textContent = "Photo ready. Tap Check my skin when you are.";
    };
    img.onerror = () => {
      imageDataUrl = reader.result;
      preview.src = imageDataUrl;
      preview.hidden = false;
      analyzeBtn.disabled = false;
      statusEl.textContent = "Photo ready. Tap Check my skin when you are.";
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

sampleBtn.addEventListener("click", () => {
  // A 1x1 placeholder image. In live mode this button is only a preview
  // shortcut; the analysis falls back to the sample result on the server
  // when no API key is configured.
  imageDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
  preview.hidden = true;
  analyzeBtn.disabled = false;
  statusEl.textContent = "Sample mode ready. Tap Check my skin to see a full example result.";
});

analyzeBtn.addEventListener("click", async () => {
  if (!imageDataUrl) return;
  analyzeBtn.disabled = true;
  statusEl.textContent = "Sending your photo to the YouCam Skin Analysis API...";
  try {
    const start = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl })
    }).then(r => r.json());
    if (start.error) throw new Error(start.error);
    try { localStorage.setItem("gg_task", JSON.stringify({ task_id: start.task_id, at: Date.now() })); } catch (e) {}
    statusEl.textContent = "Analysing your skin. This can take several minutes. Please stay on this page and keep it open.";
    const plan = await pollResult(start.task_id);
    renderPlan(plan);
    statusEl.textContent = plan.mock ? "Done. This is a sample result in demo mode." : "Done. Here is your skin, in plain words.";
  } catch (err) {
    try { localStorage.removeItem("gg_task"); } catch (e) {}
    statusEl.textContent = "Something went wrong: " + err.message;
    analyzeBtn.disabled = false;
  }
});

// If the page was closed or refreshed while an analysis was running,
// pick the same task back up instead of starting (and paying) again.
try {
  const saved = JSON.parse(localStorage.getItem("gg_task") || "null");
  if (saved && saved.task_id && Date.now() - saved.at < 20 * 60 * 1000) {
    statusEl.textContent = "Reconnecting to your skin analysis. Please keep this page open.";
    analyzeBtn.disabled = true;
    pollResult(saved.task_id).then(plan => {
      renderPlan(plan);
      statusEl.textContent = plan.mock ? "Done. This is a sample result in demo mode." : "Done. Here is your skin, in plain words.";
    }).catch(err => {
      try { localStorage.removeItem("gg_task"); } catch (e) {}
      statusEl.textContent = "Something went wrong: " + err.message;
      analyzeBtn.disabled = false;
    });
  }
} catch (e) {}

async function pollResult(taskId) {
  // The YouCam analysis itself can take several minutes when their
  // servers are busy (measured at about 7 minutes on 2026-11-02).
  // Wait patiently for up to 15 minutes, ride out brief network or
  // server hiccups instead of dying on the first one, and keep the
  // user told how long it has been.
  const started = Date.now();
  const deadline = started + 15 * 60 * 1000;
  let lastUpdate = 0;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`/api/result?task_id=${encodeURIComponent(taskId)}`).then(x => x.json());
      if (r.status === "success") {
        try { localStorage.removeItem("gg_task"); } catch (e) {}
        return r;
      }
      if (r.status === "failed" || r.status === "error") {
        throw new Error("The analysis could not be completed. Please try again with a clearer photo in good light.");
      }
      // Any other response (still running, or a transient server
      // error body) simply means: keep waiting.
    } catch (e) {
      if (e && e.message && e.message.indexOf("could not be completed") !== -1) throw e;
      // Transient network or server hiccup: keep waiting.
    }
    const now = Date.now();
    if (now - lastUpdate > 20000) {
      lastUpdate = now;
      const mins = Math.max(1, Math.round((now - started) / 60000));
      statusEl.textContent = "Still analysing, about " + mins + (mins > 1 ? " minutes" : " minute") + " so far. The AI reads eight skin concerns one by one. Please keep this page open, your result is coming.";
    }
    await new Promise(res => setTimeout(res, 3000));
  }
  throw new Error("The analysis is taking longer than usual. Please check your connection and try again.");
}

function renderPlan(result) {
  const plan = result.plan;
  const scoresEl = document.getElementById("scores");
  const focusLine = document.getElementById("focusLine");
  scoresEl.innerHTML = "";
  plan.scores.forEach(s => {
    const row = document.createElement("div");
    row.className = "score-row";
    row.innerHTML = `
      <div class="score-head"><span class="score-label">${s.label}</span><span class="score-num">${s.score} / 100</span></div>
      <div class="bar"><div class="fill band-${s.band}" style="width:${s.score}%"></div></div>
      <p class="score-msg">${s.message}</p>`;
    scoresEl.appendChild(row);
  });
  focusLine.textContent = plan.focus.length
    ? "Your coach is focusing on " + plan.focus.map(f => f.label.toLowerCase()).join(" and ") + " first. Two things at a time is how skin actually improves."
    : "Good news. No concern is scoring low. Your plan is about keeping this balance.";

  const fill = (id, items) => {
    const ol = document.getElementById(id);
    ol.innerHTML = "";
    items.forEach(t => { const li = document.createElement("li"); li.textContent = t; ol.appendChild(li); });
  };
  fill("morningList", plan.routine.morning);
  fill("eveningList", plan.routine.evening);

  const picksEl = document.getElementById("picks");
  picksEl.innerHTML = "";
  plan.picks.forEach(p => {
    const card = document.createElement("div");
    card.className = "pick";
    card.innerHTML = `<p class="pick-name">${p.name}</p><p class="pick-note">${p.note}</p><p class="pick-reason">${p.reason}</p><p class="pick-price">${p.price_label}</p>`;
    picksEl.appendChild(card);
  });
  document.getElementById("totalLine").textContent = "Basket total: " + plan.total_label;
  const wa = document.getElementById("waBtn");
  wa.href = "https://wa.me/?text=" + encodeURIComponent(plan.whatsapp_order_text);

  document.getElementById("step-results").hidden = false;
  document.getElementById("step-plan").hidden = false;
  document.getElementById("step-results").scrollIntoView({ behavior: "smooth" });
}
