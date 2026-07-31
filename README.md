# Mixbook Gift Guides — Prototype

An internal prototype exploring a **personalized, Spotify-Wrapped-style gift guide** for
Mixbook app users, powered by Juniper memory episodes and the Mixbook product catalog.

The user drops in a zip of their memory episodes (simulating the memory data we already
hold for app users). The prototype analyzes it **entirely in the browser** — no server, no
upload — and builds a gifting profile: people, places, trips, holidays, milestones,
emotional tone, best moments per month. That profile drives three demo presentations of
the same personalized gift guide.

## The three experiences

| Experience | What it demos |
|---|---|
| **💬 Story Mode** | A conversational gift assistant that *opens* the conversation already knowing your year. Chips + free-text, gift cards inline in the thread. |
| **🎬 Your Year, Wrapped** | A full-screen, tap/swipe cinematic journey — stats, top moments, mood, cast — crescendoing into gift reveals. |
| **🎁 The Classic Guide** | A practical, editorial page: every recommendation grouped by recipient with its memory-grounded "why," plus a browse-the-catalog strip. |

Every experience ends the same way: **Create & Gift** puts a real product (with
mixbook.com-derived pricing) into a cart to demonstrate the end state. Checkout shows the
"end of prototype" marker where the real flow would hand off to the Mixbook editor.

All product visuals are CSS mockups **personalized with the user's own photos** (loaded
from their `media.mixbook.com` URLs in the export) — a photo book wears their cover photo,
the calendar shows their best month, the cards fan out their holiday shots.

## Running it

It's a fully static site — no build step, no dependencies.

```bash
cd giftguides
python3 -m http.server 8000
# open http://localhost:8000
```

Then drop a memory export zip (folders like `memory-episode-12345/` containing
`memory-episode-12345.json` + `-photos.json`) on the front door and hit
**Build my gift guide**.

## How it works

```
index.html
css/style.css        design system (Mixbook-inspired: cream / ink / coral / plum)
js/zip.js            dependency-free zip reader (native DecompressionStream)
js/analyzer.js       memory export → gifting profile (people, places, clusters, tone…)
js/gifts.js          gifting profile → gift ideas matched to catalog products + prices
js/mockups.js        CSS product mockups personalized with the user's photos
js/story.js          Story Mode (deterministic dialog engine for the prototype)
js/wrapped.js        Wrapped (slide engine: progress bars, tap/swipe/keys, count-ups)
js/guide.js          Classic guide page
js/app.js            hash router, front door, hub, cart, shared gift card
```

Nothing is hard-coded to a particular export — recipients (partner, kids by name,
grandparents, friends, pets), trips, holidays and milestones are all detected from
whatever zip is provided, and the gift list adapts (e.g. no travel → no travel book).

## Notes & known limits

- **Pricing** is prototype-approximate, anchored to mixbook.com list prices
  (books from $16.99, layflat from $74.99, calendar $24.99, canvas from $49.99…).
- **Story Mode** is a scripted dialog engine — in production it would be an
  LLM-backed assistant grounded in the same memory profile.
- Photos hotlink to `media.mixbook.com` thumbnails from the export; offline they
  degrade to styled placeholders.
- Analysis state lives in `sessionStorage`; "Start over" on the hub resets it.

## Ideas for the next iteration

- More presentations: shareable "gift reel" video, email/push variants, seasonal reskins.
- Occasion targeting (Mother's Day, anniversaries detected from the timeline).
- Real handoff: deep-link "Create & Gift" into the editor with the project pre-built.
