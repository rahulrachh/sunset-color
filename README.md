# sunset-color

A one-page website that predicts the color of the sky at sunset for any US location — and renders the prediction as the page itself. The forecast *is* the design: the background gradient shows the predicted sunset colors, drifting SVG shapes show forecast cloud cover at three altitudes, and a small italic descriptor ("fiery peach", "muted", "overcast") captures the predicted vibe.

**Live:** https://sunset-color.vercel.app

Built with Next.js 14 (App Router), TypeScript, and Tailwind CSS. Deployed on Vercel.

---

## How AI built this website

This project was built almost entirely by [Claude Code](https://claude.com/claude-code), Anthropic's coding agent, using a **task-file workflow** designed so that no single AI session needed to hold the whole project in its head:

1. **Plan first.** The project began as a single design conversation that produced [`plan.md`](plan.md) — a build plan that breaks the site into 11 tasks (T0–T10) arranged in a dependency DAG:

   ```
   T0 (scaffold)
    ├── T1 (forecast service) ──┬── T2 (color map)
    │                           └── T6 (share image)
    ├── T3 (location search)
    ├── T4 (cloud rendering)
    └── T5 (contrast + fonts)
   T7 (main page assembly)  ← integration bottleneck
    ├── T8 (3-day preview)
    ├── T9 (grey/edge polish)
    └── T10 (share button + deploy)
   ```

2. **Self-contained task files.** Each task lives in its own file under [`tasks/`](tasks/) with the full shared project context inlined at the top — concept, stack, data sources, design principles, and target repo structure. A fresh Claude Code session could execute any task without reading anything else first.

3. **One session per task.** Each task was run in a new Claude Code session, given only its task file and told: *"Execute this task. Stop when all acceptance criteria are met."* Sessions handed work to each other purely through files on disk. A small `nextTask` file at the repo root acted as a baton, telling each new session which task was next.

4. **Explicit acceptance criteria.** Every task file ends with concrete acceptance criteria (e.g. "the share button on production downloads a PNG that matches the on-screen gradient"), so a session knew when it was done rather than when it felt done.

5. **AI-verified in a real browser.** The repo contains a project-specific skill ([`.claude/skills/verify/`](.claude/skills/verify/SKILL.md)) that teaches sessions how to launch the dev server and drive the page with Playwright — including how to mock the geocoding and forecast APIs. Later tasks used it to verify their own work: asserting meta tags, clicking the share button headlessly, and checking that the download fired with the right query parameters.

Humans supplied the idea, the API key, taste-level feedback, and the browser clicks for OAuth device logins. The code, the color model, the tests-in-browser, and this README were written by the AI.

## How the sunset color is predicted

The prediction lives in one pure function, [`lib/colorMap.ts`](lib/colorMap.ts), which maps a normalized weather forecast to a 3-stop gradient, a descriptor word, and a quality score. It is built on four physical ingredients of a good sunset:

1. **High clouds are the canvas.** Sunset color mostly comes from light reflecting off high cirrus. A tent-shaped factor peaks at ~50% high-cloud cover and falls off toward 0% (nothing to paint on) and 100% (sky sealed shut).
2. **The lower atmosphere must be clear.** Low clouds sit between you and the show; a penalty scales down the score by up to 70% as low-cloud cover approaches 100%.
3. **Moderate humidity.** Above 60% relative humidity, near-ground haze washes colors out, so a linear penalty kicks in past that threshold.
4. **A little aerosol helps, a lot hurts.** PM2.5 follows a bell curve peaking around 8 µg/m³ — a small amount of particulate deepens the reds, while heavy smoke (>35) mutes everything. When PM2.5 is unavailable, visibility stands in as a proxy.

The score is simply the product of these four factors:

```
score = high_cloud_factor × low_cloud_penalty × aerosol_factor × humidity_penalty
```

The score and raw inputs then select a **hue family** — orange, pink, magenta, blood red, grey, or slate — via priority rules (e.g. >80% low cloud always reads slate; PM2.5 over 50 µg/m³ reads wildfire "blood red" even though the score is terrible; low visibility reads fog). Each family has a base HSL color from which the 3-stop vertical gradient is derived: a desaturated pale top, the saturated base in the middle, and a darker, slightly red-shifted bottom near the horizon.

Two honesty rules are worth calling out:

- **Grey days are shown grey.** An overcast forecast gets a melancholy grey/slate page and a descriptor like "still" or "muted" — never a faked pretty gradient.
- **Optics beat stale sensors.** If AirNow reports moderate PM2.5 but visibility is ≥25 km, the code trusts the sky and ignores the PM2.5 reading; only genuine wildfire-smoke levels (>50 µg/m³) are allowed to repaint the sunset.

The same function drives the on-screen background, the 3-day preview swatches, and the 1080×1080 share image generated at the edge by [`app/api/share/route.tsx`](app/api/share/route.tsx).

## Data sources (all free)

| Source | Used for | Key required |
|---|---|---|
| [Open-Meteo Forecast](https://open-meteo.com/) | Cloud cover by altitude, humidity, visibility, wind, sunset time | No |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | US-only location search | No |
| [AirNow](https://docs.airnowapi.org/) | PM2.5 / aerosol forecast | Yes (server-side only) |

## Local setup

```bash
npm install
cp .env.local.example .env.local   # then paste your AirNow API key
npm run dev                        # http://localhost:3000
```

Get a free AirNow key at https://docs.airnowapi.org/. The key is only ever read server-side (`process.env.AIRNOW_API_KEY`) and never appears in any HTTP response. In production it is set through Vercel's environment variables — no secrets are committed to this repo.

## Project structure

```
app/
  page.tsx                 # main page: gradient, hero, clouds, share button
  layout.tsx               # fonts (Fraunces + Inter), social meta tags
  api/forecast/route.ts    # Open-Meteo + AirNow → normalized ForecastResult
  api/share/route.tsx      # 1080×1080 share PNG (@vercel/og, edge runtime)
components/
  LocationSearch.tsx       # autocompleting US-only search
  CloudLayer.tsx           # drifting cirrus / altocumulus / low-haze SVG
  MultiDayStrip.tsx        # 3-day preview swatches
lib/
  forecast.ts              # data fetching + normalization
  colorMap.ts              # forecast → gradient + descriptor + score
  contrast.ts              # WCAG-luminance ink picker (warm white / warm black)
  time.ts                  # sunset-time / date helpers
plan.md                    # the AI build plan (task DAG)
tasks/                     # the 11 self-contained task files given to the AI
```
