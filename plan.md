# Sunset Color — Build Plan (Index)

A website that predicts the sky color at sunset for a US location and renders the prediction as the page background. The forecast *is* the design: gradient = predicted color, drifting cloud shapes = predicted cloud cover, descriptor word = predicted vibe.

Each task lives in its own self-contained file under `tasks/`. Each file has the shared project context inlined at the top so a fresh Claude Code session can run it without reading anything else.

## How to run a task

1. Open a new Claude Code session in this directory.
2. Paste the contents of the task file (e.g. `tasks/T1.md`).
3. Add: *"Execute this task. Stop when all acceptance criteria are met."*
4. After the session finishes, commit and push so the next session sees the new state on disk.

## Task DAG

```
T0 (scaffold)
 ├── T1 (forecast service)
 │    ├── T2 (color map)         depends on T1's ForecastResult type
 │    └── T6 (share image)       depends on T1 + T2
 ├── T3 (location search)
 ├── T4 (cloud rendering)
 └── T5 (contrast + fonts)

T7 (main page assembly)          depends on T1, T2, T3, T4, T5
 ├── T8 (3-day preview)          depends on T7
 ├── T9 (grey/edge polish)       depends on T7
 └── T10 (share button + deploy) depends on T6, T7
```

Tasks T1, T2, T3, T4, T5 can run in parallel sessions once T0 is merged. T7 is the integration bottleneck. T8/T9/T10 can run in parallel once T7 is merged.

## Tasks

- [`tasks/T0.md`](tasks/T0.md) — Project scaffolding (Next.js, Tailwind, env file, first Vercel deploy).
- [`tasks/T1.md`](tasks/T1.md) — Forecast service + API route (Open-Meteo + AirNow → normalized `ForecastResult`).
- [`tasks/T2.md`](tasks/T2.md) — Color & gradient mapping (pure function: forecast → gradient + descriptor + score).
- [`tasks/T3.md`](tasks/T3.md) — Location search component (autocompleting US-only input).
- [`tasks/T4.md`](tasks/T4.md) — Cloud rendering component (drifting cirrus/altocumulus/low-haze SVG layer).
- [`tasks/T5.md`](tasks/T5.md) — Contrast utility + typography (WCAG ink picker + Fraunces/Inter fonts).
- [`tasks/T6.md`](tasks/T6.md) — Share image endpoint (`@vercel/og` PNG generator).
- [`tasks/T7.md`](tasks/T7.md) — Main page assembly (wires everything; this is the integration step).
- [`tasks/T8.md`](tasks/T8.md) — 3-day preview swatch strip.
- [`tasks/T9.md`](tasks/T9.md) — Grey/overcast edge cases + descriptor polish.
- [`tasks/T10.md`](tasks/T10.md) — Share button + production deploy + meta tags.

## AirNow key reminder

Local: `.env.local` at project root → `AIRNOW_API_KEY=your_key_here` (gitignored by `create-next-app`).
Production: Vercel dashboard → Project → Settings → Environment Variables → add `AIRNOW_API_KEY` for Production / Preview / Development.
Accessed only from server-side code via `process.env.AIRNOW_API_KEY`.
