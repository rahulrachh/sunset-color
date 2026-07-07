// Pure mapping from a ForecastResult to a 3-stop vertical gradient + descriptor + score.
//
// Four physics ingredients drive sunset color (and how each maps below):
//   1. High clouds present (the canvas) — `high_cloud_factor` peaks at ~50% high cloud cover.
//   2. Clear lower atmosphere — `low_cloud_penalty` knocks score down when low clouds block the show.
//   3. Moderate humidity — `humidity_penalty` activates above 60% RH (haze near the ground).
//   4. Narrow aerosol range — `aerosol_factor` is a bell curve over PM2.5 (small amount deepens reds,
//      too much mutes everything); falls back to `visibility_km` when PM2.5 is unavailable.
//
// score = high_cloud_factor * low_cloud_penalty * aerosol_factor * humidity_penalty
//
// The dominant hue family is then chosen from (humidity, PM2.5, low_cloud_pct, score), and the
// gradient is built in HSL with a pale top, saturated middle, and red-shifted deep bottom.

import type { ForecastResult } from './forecast';

export type GradientStop = { color: string; position: number };
export type ColorResult = {
  gradient: { stops: [GradientStop, GradientStop, GradientStop] };
  descriptor: string;
  score: number;
};

type HueFamily = 'orange' | 'pink' | 'magenta' | 'blood' | 'grey' | 'slate';

type Hsl = { h: number; s: number; l: number };

const BASE_HSL: Record<HueFamily, Hsl> = {
  orange: { h: 22, s: 100, l: 62 },
  pink: { h: 348, s: 100, l: 71 },
  magenta: { h: 320, s: 55, l: 45 },
  blood: { h: 4, s: 60, l: 30 },
  grey: { h: 0, s: 0, l: 54 },
  slate: { h: 210, s: 8, l: 46 },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function highCloudFactor(highPct: number): number {
  // Tent peaks at 50% high cloud and broadens across the 20–80% sweet spot.
  // A 0.25 floor keeps a clear sky from collapsing the entire score to zero —
  // cloudless evenings still get some warmth instead of being graded as "pale".
  const x = clamp(highPct, 0, 100) / 100;
  const d = Math.abs(0.5 - x) * 2;
  return 0.25 + 0.75 * Math.max(0, 1 - Math.pow(d, 2.4));
}

function lowCloudPenalty(lowPct: number): number {
  return 1 - (clamp(lowPct, 0, 100) / 100) * 0.7;
}

function aerosolFactor(pm25: number | null, visibilityKm: number): number {
  if (pm25 == null) {
    if (visibilityKm > 15) return 0.9;
    if (visibilityKm < 5) return 0.3;
    return 0.6;
  }
  // Bell peaking at ~8 µg/m³, dropping sharply past 35.
  if (pm25 <= 8) {
    const t = pm25 / 8;
    return 0.6 + 0.4 * t;
  }
  if (pm25 <= 35) {
    const t = (pm25 - 8) / 27;
    return 1 - 0.5 * t;
  }
  const t = clamp((pm25 - 35) / 45, 0, 1);
  return Math.max(0.05, 0.5 - 0.45 * t);
}

function humidityPenalty(humidityPct: number): number {
  return 1 - Math.max(0, (clamp(humidityPct, 0, 100) - 60) / 100);
}

function pickFamily(f: ForecastResult, score: number): HueFamily {
  if (f.low_cloud_pct > 80) return 'slate';
  const pm25 = f.pm25_ugm3;
  // Heavy smoke tanks the score, but the sky reads muted red, not grey —
  // so it must win over the low-score grey fallback.
  if (pm25 != null && pm25 > 50) return 'blood';
  if (f.visibility_km < 2) return 'grey';
  if (score < 0.12) return 'grey';
  if (pm25 != null && pm25 >= 15) return 'magenta';
  if (f.humidity_pct < 50) return 'orange';
  return 'pink';
}

function hslToHex({ h, s, l }: Hsl): string {
  const hh = ((h % 360) + 360) % 360 / 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;

  let r: number, g: number, b: number;
  if (ss === 0) {
    r = g = b = ll;
  } else {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    const hue2rgb = (t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = hue2rgb(hh + 1 / 3);
    g = hue2rgb(hh);
    b = hue2rgb(hh - 1 / 3);
  }
  const to2 = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function buildStops(base: Hsl): [GradientStop, GradientStop, GradientStop] {
  const top: Hsl = {
    h: base.h,
    s: Math.max(8, base.s * 0.45),
    l: clamp(base.l + 28, 0, 95),
  };
  const middle: Hsl = base;
  const bottom: Hsl = {
    h: base.h - 6,
    s: clamp(base.s + 5, 0, 100),
    l: clamp(base.l - 30, 8, 100),
  };
  return [
    { color: hslToHex(top), position: 0 },
    { color: hslToHex(middle), position: 0.55 },
    { color: hslToHex(bottom), position: 1 },
  ];
}

function pickDescriptor(family: HueFamily, score: number, f: ForecastResult): string {
  if (family === 'slate' || f.low_cloud_pct > 80) {
    return score < 0.15 ? 'still' : 'overcast';
  }
  const smoky = f.pm25_ugm3 != null && f.pm25_ugm3 > 50;

  let core: string;
  if (family === 'grey') {
    if (f.visibility_km < 2) return 'fog';
    core = score < 0.1 ? 'pale' : 'muted';
  } else if (family === 'blood') {
    // pickFamily only chooses blood when PM2.5 > 50, so smoky is always true
    // here; "smoky red" reads better than "smoky blood red".
    core = smoky ? 'red' : 'blood red';
  } else if (family === 'magenta') {
    core = score >= 0.5 ? 'magenta' : 'muted magenta';
  } else if (family === 'orange') {
    if (score >= 0.75) core = 'fiery peach';
    else if (score >= 0.5) core = 'amber';
    else core = 'faded amber';
  } else {
    // pink
    if (score >= 0.75) core = 'rose';
    else if (score >= 0.5) core = 'lilac';
    else core = 'dusty rose';
  }
  return smoky ? `smoky ${core}` : core;
}

export function forecastToColor(f: ForecastResult): ColorResult {
  // Sanity: very high visibility (>=25 km) contradicts moderate PM2.5. When
  // optics disagree with a site-specific AirNow forecast, trust the sky — a
  // stale monitor reading shouldn't repaint the whole sunset. Above 50 µg/m³
  // is real wildfire-smoke territory and gets to stand.
  const pm25Effective =
    f.pm25_ugm3 != null && f.visibility_km >= 25 && f.pm25_ugm3 < 50
      ? null
      : f.pm25_ugm3;
  const sanitized: ForecastResult = { ...f, pm25_ugm3: pm25Effective };

  const hcf = highCloudFactor(sanitized.high_cloud_pct);
  const lcp = lowCloudPenalty(sanitized.low_cloud_pct);
  const af = aerosolFactor(sanitized.pm25_ugm3, sanitized.visibility_km);
  const hp = humidityPenalty(sanitized.humidity_pct);
  const score = clamp(hcf * lcp * af * hp, 0, 1);

  const family = pickFamily(sanitized, score);
  const base = BASE_HSL[family];
  const stops = buildStops(base);
  const descriptor = pickDescriptor(family, score, sanitized);

  return {
    gradient: { stops },
    descriptor,
    score,
  };
}
