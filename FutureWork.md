# Future Work

## The big one: replace the hand-tuned physics with a neural network

The current color model ([Algorithm.md](Algorithm.md)) is a hand-tuned physics heuristic - four factors, a multiplication, and some taste. It's honest and explainable, but every constant in it (the 50% cirrus peak, the 8 µg/m³ aerosol sweet spot, the 60% humidity threshold) is an educated guess. Nature did not agree to our constants.

The plan for v2: **train a neural network to predict the actual sunset color from the same measurements**, and let the data tell us where our guesses were wrong.

### Step 1 - Collect ground truth

You can't train a model on vibes. We need pairs of *(what the forecast said, what the sky actually did)*:

- **Features:** the exact `ForecastResult` we already compute - high/mid/low cloud cover, humidity, visibility, PM2.5, wind, pressure - logged at sunset time for a set of locations.
- **Labels:** the real sunset. Sources, in increasing order of ambition:
  1. Public webcam frames captured at sunset time (extract the dominant sky palette from the top third of the image)
  2. User-submitted photos via a "was it actually like this?" button on the site
  3. Satellite imagery, if we're feeling fancy

A small cron job logging forecasts + webcam palettes for ~50 US cities would quietly build a real dataset in a few months. Patience. Wax on, wax off.

### Step 2 - Train the model

Nothing exotic: a small MLP (the dataset will be thousands of rows, not millions) mapping the forecast feature vector to:

- the three gradient stops (as HSL values), and
- the quality score (as measured colorfulness/saturation of the real sky)

The physics heuristic stays in the repo as the baseline to beat - if a neural network can't outperform four multiplied numbers, it doesn't ship. This is Rocky vs. the heavyweight champ, except the champ is a 200-line TypeScript file and the montage is a training loop.

### Step 3 - Evaluate honestly

- Color distance (ΔE) between predicted and actual palettes, on a held-out test set
- Human eval: show people both predictions next to the real photo - which one lied less?
- Per-condition breakdown: the model must not be worse on the weird cases (smoke, fog, overcast) that the heuristic handles with explicit rules

### Step 4 - Ship carefully

Run the network in shadow mode first - predict alongside the heuristic, log both, ship nothing. Promote it only when it wins. And to be clear about scope: it predicts *sunset colors*. That's it. That's the whole neural network. Nobody is becoming self-aware here; the machines' takeover of Earth remains, at most, a v3 stretch goal.

## Smaller ideas on the shelf

- **Worldwide support** - the algorithm doesn't care about borders; only the AirNow aerosol source is US-only (needs a global fallback like Open-Meteo's air-quality API)
- **"Notify me before a good one"** - push notification when tonight's score crosses 0.75
- **Sunrise mode** - same physics, worse hour
