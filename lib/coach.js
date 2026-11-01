// GlowGuide Skin Coach.
// Takes the YouCam skin scores and does the job a good beauty advisor does:
//   1. Reads the scores and picks the two concerns that need help most.
//   2. Explains each score in plain words, no jargon, no fear selling.
//   3. Matches products from the seller catalog to those concerns.
//   4. Builds a simple 14 day morning and evening routine from the picks.
// This rule based coach is the agentic layer of the app: it reasons over the
// API output and produces a plan and a ready to send order, not just numbers.

const products = require("../data/products.json");

const CONCERNS = {
  moisture: {
    label: "Moisture",
    low: "Your skin is thirsty. It is not holding enough water, which can make it feel tight after washing.",
    mid: "Your moisture level is fair. A hydrating serum under your moisturiser will lift it.",
    good: "Your moisture level is strong. Keep doing what you are doing."
  },
  oiliness: {
    label: "Oil balance",
    low: "Your skin is producing more oil than it needs, which can mean shine by midday.",
    mid: "Your oil balance is mostly steady, with a little extra shine in the T zone.",
    good: "Your oil balance is well controlled."
  },
  acne: {
    label: "Breakouts",
    low: "Breakouts are active right now. Gentle care and patience will serve you better than harsh scrubbing.",
    mid: "A few breakouts are present. A targeted treatment a few nights a week should help.",
    good: "Your skin is calm, with little sign of breakouts."
  },
  radiance: {
    label: "Radiance",
    low: "Your skin looks tired and dull, often from dead skin buildup, poor sleep, or missing sun protection.",
    mid: "Your glow is there but muted. Vitamin C in the morning is the classic fix.",
    good: "Your skin has a healthy glow."
  },
  texture: {
    label: "Texture",
    low: "Your skin texture is uneven to the touch. Steady hydration and gentle exfoliation help over time.",
    mid: "Your texture is fairly smooth, with a few rough patches.",
    good: "Your skin texture is smooth and even."
  },
  pore: {
    label: "Pores",
    low: "Your pores are very visible, usually where oil is heaviest. They cannot shrink, but they can look cleaner and tighter.",
    mid: "Your pores are somewhat visible in the oily zones.",
    good: "Your pores look clean and refined."
  },
  redness: {
    label: "Redness",
    low: "There is visible redness or irritation. Something in your routine may be too strong for your skin.",
    mid: "There is mild redness in places. Keep new products gentle and introduce them one at a time.",
    good: "Your skin tone looks calm and even."
  },
  wrinkle: {
    label: "Fine lines",
    low: "Fine lines are showing, most often where skin is driest. Hydration and daily sunscreen are the honest first defence.",
    mid: "Early fine lines are present, mostly where the skin is dry.",
    good: "Your skin looks firm, with minimal fine lines."
  }
};

function band(score) {
  if (score < 50) return "low";
  if (score < 70) return "mid";
  return "good";
}

function formatRwf(n) {
  return "RWF " + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function buildPlan(scores) {
  const enriched = scores
    .filter((s) => CONCERNS[s.action])
    .map((s) => ({
      action: s.action,
      label: CONCERNS[s.action].label,
      score: s.score,
      band: band(s.score),
      message: CONCERNS[s.action][band(s.score)]
    }))
    .sort((a, b) => a.score - b.score);

  const focus = enriched.filter((s) => s.band !== "good").slice(0, 2);
  const focusActions = focus.map((f) => f.action);

  // Product picks: cover the focus concerns first, always add sunscreen,
  // cap the basket at 4 items so it stays affordable and believable.
  const picks = [];
  const addPick = (p, reason) => {
    if (!picks.find((x) => x.id === p.id) && picks.length < 4) picks.push({ ...p, reason });
  };
  for (const action of focusActions) {
    const match = products.find((p) => p.helps.includes(action));
    if (match) addPick(match, `Chosen for your ${CONCERNS[action].label.toLowerCase()} score of ${focus.find((f) => f.action === action).score}.`);
  }
  const cleanser = products.find((p) => p.id === "gentle-cleanser");
  addPick(cleanser, "The base of the routine. Everything else works better on clean, calm skin.");
  const spf = products.find((p) => p.id === "spf50");
  addPick(spf, "Daily protection. On deep skin tones this is what stops dark marks from getting darker.");

  const total = picks.reduce((sum, p) => sum + p.price_rwf, 0);

  const morning = [
    "Wash with lukewarm water, or the gentle cleanser if your skin feels oily.",
    picks.find((p) => p.id === "ha-serum") ? "Apply the hyaluronic acid serum on slightly damp skin." : "Pat in your treatment serum for your main concern.",
    "Moisturise with the ceramide moisturiser.",
    "Finish with SPF 50. This step is not optional if you want marks to fade."
  ];
  const evening = [
    "Cleanse with the gentle cleanser to remove the day.",
    focusActions.includes("acne") || focusActions.includes("radiance")
      ? "Apply your targeted treatment (azelaic acid or vitamin C) on the areas that need it."
      : "Apply your treatment serum for your main concern.",
    "Seal everything in with the ceramide moisturiser.",
    "Sleep is part of the routine. Aim for a full night where you can."
  ];

  const orderText =
    "Hello, I just did a GlowGuide skin check. My main concerns are " +
    (focus.length ? focus.map((f) => f.label.toLowerCase()).join(" and ") : "general care") +
    ". I would like to order: " +
    picks.map((p) => p.name).join(", ") +
    `. Total ${formatRwf(total)}.`;

  return {
    scores: enriched,
    focus,
    picks: picks.map((p) => ({ ...p, price_label: formatRwf(p.price_rwf) })),
    total_label: formatRwf(total),
    routine: { days: 14, morning, evening },
    whatsapp_order_text: orderText
  };
}

module.exports = { buildPlan, CONCERNS };
