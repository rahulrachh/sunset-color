---
name: verify
description: Build/launch/drive recipe for verifying sunset-color changes in a real browser.
---

# Verifying sunset-color

Surface: browser page at `/` (Next.js App Router, client-rendered).

## Launch

```powershell
npm run dev   # run_in_background; check output — falls back to 3001+ if 3000 is taken
```

## Drive (Playwright, no browser download needed)

Install the `playwright` npm package in the scratchpad and launch with
`channel: "msedge"` (system Edge works headless on this machine).

Key facts for driving the page:
- Geocoding is fetched client-side directly from
  `https://geocoding-api.open-meteo.com/v1/search` — intercept with
  `page.route("**/geocoding-api.open-meteo.com/**", ...)` and return
  `{ results: [{ id, name, admin1, latitude, longitude, country_code: "US" }] }`.
- Forecast data comes from `/api/forecast?lat&lng[&date]` — intercept
  `**/api/forecast*` to feed a mocked `ForecastResult` (see `lib/forecast.ts`
  for the shape; `sunset_iso` must parse, `pm25_ugm3` may be null).
- Flow: fill `getByRole("combobox")`, wait for `getByRole("option")`, press
  Enter, wait for the `h1`. Gradient lands in CSS vars `--g-top/--g-mid/--g-bottom`
  on `#sunset-stage`.
- Day-strip labels look uppercase ("TUE") but that's CSS `text-transform`;
  match text case-insensitively.
- Hero block is not a stable nth child of `<main>` (CloudLayer shifts order);
  select text by content, not position.

## Gotchas

- Watch for a stale dev server already squatting on port 3000 serving old code —
  always read the dev-server output for the actual port.
