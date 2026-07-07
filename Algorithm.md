# The Algorithm

*How six weather numbers become a sunset.*

Everything described here lives in one pure function: [`lib/colorMap.ts`](lib/colorMap.ts) → `forecastToColor(forecast)`. It takes a normalized weather forecast and returns three things: a 3-stop gradient, a descriptor word, and a quality score between 0 and 1. Same function everywhere - the page background, the 3-day preview swatches, and the share image all call it, so they can never disagree.

In the words of a great fictional botanist stranded on Mars: we're going to science the heck out of this sky.

## The inputs

From [Open-Meteo](https://open-meteo.com/), sampled at the hour of sunset:

| Input | Why it matters |
|---|---|
| `high_cloud_pct` | Cirrus - the canvas the sunset gets painted on |
| `low_cloud_pct` | The curtain that can block the whole show |
| `humidity_pct` | Near-ground haze that washes color out |
| `visibility_km` | Backup aerosol signal, and the fog detector |
| `wind_kph` | Drives how fast the rendered clouds drift (cosmetic, not color) |

From [AirNow](https://docs.airnowapi.org/): `pm25_ugm3` - particulate matter, the secret ingredient.

## The four factors

A good sunset needs four things to go right *at the same time*, so the score is a straight product - any one factor going to zero kills the evening, exactly like real life:

```
score = high_cloud_factor × low_cloud_penalty × aerosol_factor × humidity_penalty
```

**1. High clouds are the canvas** (`high_cloud_factor`). Sunset color is mostly sunlight bouncing off high cirrus. A tent-shaped curve peaks at ~50% high-cloud cover: 0% means nothing to paint on, 100% means the sky is sealed shut. A floor of 0.25 keeps a perfectly clear evening from scoring zero - cloudless skies still glow, they're just not dramatic.

**2. The lower atmosphere must be clear** (`low_cloud_penalty`). Low clouds sit between you and the light. The penalty scales linearly down to 0.3 at full low-cloud cover - a 70% haircut for a fully drawn curtain.

**3. A little smoke is seasoning, a lot is a house fire** (`aerosol_factor`). PM2.5 follows a bell curve peaking around 8 µg/m³. A pinch of aerosol deepens the reds; past 35 µg/m³ everything goes muddy. When AirNow has no data, visibility stands in as a proxy (>15 km good, <5 km bad).

**4. Humidity is the fog machine nobody asked for** (`humidity_penalty`). Above 60% relative humidity, near-ground moisture starts scattering the color away. Linear penalty past the threshold.

## Picking the hue family

The score says *how good*; the hue family says *what kind*. Six families, chosen by priority rules - first match wins:

| Rule | Family | The sky you get |
|---|---|---|
| low cloud > 80% | **slate** | Overcast lid. Winter is coming, and so is nothing else. |
| PM2.5 > 50 µg/m³ | **blood** | Wildfire smoke. Terrible score, unforgettable color - the sky goes full Blade Runner 2049 Las Vegas. |
| visibility < 2 km | **grey** | Fog. The sunset is happening; you're just not invited. |
| score < 0.12 | **grey** | Nothing came together tonight. |
| PM2.5 ≥ 15 µg/m³ | **magenta** | Hazy particulate purples. |
| humidity < 50% | **orange** | Dry, crisp air → classic fiery sunset. |
| otherwise | **pink** | Soft, humid-evening pastels. |

Note the ordering: **blood beats grey on purpose.** Heavy smoke tanks the score, but a smoke sky reads muted red, not grey - honesty means showing what you'd actually see.

## Building the gradient

Each family has a base HSL color. The three stops are derived from it:

- **Top (0%):** desaturated (×0.45) and much lighter (+28 L) - the pale upper sky
- **Middle (55%):** the base color at full strength - the main event
- **Bottom (100%):** darker (−30 L), slightly more saturated, hue nudged 6° toward red - the horizon glow

That red-shift at the bottom is the whole trick: real sunsets get redder near the horizon because the light travels through more atmosphere. Three stops, one hue nudge, and your eye fills in the rest.

## The descriptor

The family and score pick a small italic word - the vibe, in one or two words: `fiery peach`, `amber`, `rose`, `lilac`, `dusty rose`, `muted magenta`, `smoky red`, `overcast`, `fog`, `still`. Scores under 0.3 also earn a consolation line ("no fireworks tonight", "the sky is resting"). All those moments deserve words - otherwise they'd be lost in time, like tears in rain.

## Two honesty rules

1. **Grey days are shown grey.** No fake gradients on overcast days. The page goes slate, the descriptor goes melancholy, and you're told to stay in tonight. Honesty is the design principle everything else answers to.
2. **Optics beat stale sensors.** If AirNow claims moderate PM2.5 but visibility is ≥ 25 km, the code trusts the sky over the sensor and ignores the PM2.5 reading. Only genuine wildfire levels (> 50 µg/m³) are allowed to overrule what your eyes would tell you.

## Text on top of all this

Ink color isn't hardcoded - [`lib/contrast.ts`](lib/contrast.ts) computes WCAG relative luminance at the text's position on the gradient and picks warm white (`#fff8ef`) or warm near-black (`#2a1810`), whichever actually reads. The gradient is the boss; the text adapts.
