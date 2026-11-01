# GlowGuide: a skin check that speaks plainly

GlowGuide turns one selfie into a skin check that a first time buyer can actually understand, and then into a small, honest shopping basket she can order from a local beauty seller in one tap.

Built for the YouCam API Skin AI and eCommerce VTO Hackathon (Perfect Corp, on Devpost, 2026).

## The problem

Beauty advice and skin tools are mostly built and tested around lighter skin. On deep skin tones, the questions are different: dark marks that deepen without sun protection, products that leave a grey cast, advice written in jargon, and prices that make no sense locally. At the same time, thousands of small beauty sellers across Africa sell through WhatsApp with no way to give a customer personal advice before she buys. She guesses, buys the wrong thing, and does not come back.

## What GlowGuide does

1. **Skin check.** The user takes or uploads a selfie. GlowGuide sends it to the **YouCam AI Skin Analysis API** and scores eight concerns: moisture, oil balance, breakouts, radiance, texture, pores, redness, and fine lines.
2. **Plain words.** A built in Skin Coach reads the scores and explains each one in everyday language. No jargon, no fear selling, no bleaching talk.
3. **A 14 day routine.** The coach picks the two concerns that need help most and builds a simple morning and evening routine around them.
4. **A basket that fits the place.** Products come from a small local seller catalog priced in Rwandan francs, chosen for the user's actual scores, including sunscreen selected for deep skin tones with no white cast.
5. **One tap ordering.** The basket becomes a ready written WhatsApp message to the seller. Advice becomes a sale, which is the eCommerce point.

Photo guidance is written for deep skin tones on purpose: even, front light matters more when shadows can hide detail, and the app says so up front.

## Tech

- Static frontend in `public/` (no build step, no framework).
- Zero dependency Node server (`server.js`) that keeps the API key server side:
  - `POST /api/analyze` accepts an image data URL, uploads it through the YouCam File API, and starts a skin analysis task.
  - `GET /api/result?task_id=` polls the task and returns scores plus the coach plan.
  - `GET /api/balance` returns remaining API units (a free endpoint).
- The YouCam integration follows the documented v2 flow: `POST /s2s/v2.0/file`, presigned PUT upload, `POST /s2s/v2.0/task/skin-analysis`, then poll `GET /s2s/v2.0/task/skin-analysis/:id`, against `https://yce-api-01.makeupar.com` with a Bearer API key.
- An 8 concern panel costs roughly 36 API units, so the 1,000 free hackathon units cover about 25 full live checks.
- History and settings are not stored. The photo goes only to the YouCam API.

## Run it locally

```
node server.js
# open http://localhost:3456
```

With no API key set, the app runs in demo mode with a sample analysis, so the full experience works end to end. For live analysis:

```
export YOUCAM_API_KEY=<your key from the YouCam API console>
node server.js
```

## Going live with the real key (about 10 minutes)

1. Register for the hackathon on Devpost and note the redeem code sent by email.
2. Create the free YouCam API account at https://yce.perfectcorp.com/ai-api and verify the email.
3. In the YouCam console, open Account, then Redeem Code, and enter the code. 1,000 units land immediately.
4. Copy the API key from the console. Share it only through a secure route, never in chat screenshots or in the repo.
5. Set `YOUCAM_API_KEY` where the server runs, restart, and do one live check with a real selfie to confirm scores return.
6. Deploy anywhere that runs Node (a small VPS, Render, Railway, or Vercel style hosting with the server adapted). Judges need a public link that stays up until judging ends on 20 November 2026.

## Photo tips (from the API requirements)

Front facing selfie, face filling most of the frame, hair off the face, even lighting, no makeup or filters.

## License

MIT. Built by Sharon, a solo entrant in Kigali, Rwanda, working with an AI assistant. AI tools used are listed in the Devpost submission, as the hackathon encourages.
