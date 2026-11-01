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
    imageDataUrl = reader.result;
    preview.src = imageDataUrl;
    preview.hidden = false;
    analyzeBtn.disabled = false;
    statusEl.textContent = "Photo ready. Tap Check my skin when you are.";
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
    statusEl.textContent = "Analysing your skin. This can take two or three minutes. Please stay on this page.";
    const plan = await pollResult(start.task_id);
    renderPlan(plan);
    statusEl.textContent = plan.mock ? "Done. This is a sample result in demo mode." : "Done. Here is your skin, in plain words.";
  } catch (err) {
    statusEl.textContent = "Something went wrong: " + err.message;
    analyzeBtn.disabled = false;
  }
});

async function pollResult(taskId) {
  for (let i = 0; i < 200; i++) {
    const r = await fetch(`/api/result?task_id=${encodeURIComponent(taskId)}`).then(x => x.json());
    if (r.error) throw new Error(r.error);
    if (r.status === "success") return r;
    if (i === 25) statusEl.textContent = "Still analysing. This is normal, the AI reads eight skin concerns one by one. Please keep this page open.";
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error("The analysis is taking too long. Please try again.");
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
