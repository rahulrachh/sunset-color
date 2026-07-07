# sunset-color

**What color will tonight's sunset be?** This site answers that question by *becoming* the answer.

Search any US city and the page repaints itself as the predicted sunset: a full-screen gradient of the forecast colors, wispy SVG clouds drifting at the forecast cloud cover, the sunset time, and a small italic mood word - "fiery peach", "dusty rose", or on bad days, just "still".

**Live:** https://sunset-color.vercel.app

![Searching for Phoenix, AZ and watching the page turn into tonight's predicted sunset](demo.gif)

No dashboards, no charts, no numbers. The forecast *is* the design. And it's honest: if tomorrow looks grey, you get a grey page and a gentle "stay in tonight". We don't fake sunsets here - this isn't The Truman Show, we can't just cue the sun.

## Features

- 🌅 **Predicted sunset gradient** as the page background, for any US location
- ☁️ **Live cloud rendering** - high, mid, and low clouds drift at forecast coverage and wind speed
- 📅 **3-day preview strip** to plan your golden hour
- 📤 **Share button** - downloads a 1080×1080 image of tonight's prediction (or opens the native share sheet on mobile)
- 🔗 Link previews (og:image) show the actual predicted sunset for San Francisco

## Run it locally

```bash
git clone https://github.com/rahulrachh/sunset-color.git
cd sunset-color
npm install
cp .env.local.example .env.local   # paste your AirNow API key inside
npm run dev                        # → http://localhost:3000
```

The only key you need is a free [AirNow API key](https://docs.airnowapi.org/) (aerosol/PM2.5 data). Everything else - [Open-Meteo forecast](https://open-meteo.com/) and [geocoding](https://open-meteo.com/en/docs/geocoding-api) - is keyless. The AirNow key is read server-side only and never appears in any HTTP response.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Vercel

## Read more

| Doc | What's inside |
|---|---|
| [Algorithm.md](Algorithm.md) | How six weather numbers become a sunset - the color model, explained |
| [Plan.md](Plan.md) | How this site was built almost entirely by AI, from plan to production |
| [FutureWork.md](FutureWork.md) | What's next: teaching a neural network to out-predict our hand-tuned physics |
