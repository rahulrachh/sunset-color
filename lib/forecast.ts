export type ForecastResult = {
  sunset_iso: string;
  timezone: string;
  high_cloud_pct: number;
  mid_cloud_pct: number;
  low_cloud_pct: number;
  humidity_pct: number;
  visibility_km: number;
  pm25_ugm3: number | null;
  wind_high_kph: number;
  pressure_hpa: number;
};

type Hourly = {
  time: string[];
  cloud_cover_high: number[];
  cloud_cover_mid: number[];
  cloud_cover_low: number[];
  relative_humidity_2m: number[];
  visibility: number[];
  pressure_msl: number[];
  wind_speed_500hPa: number[];
};

type MeteoResponse = {
  timezone?: string;
  daily: { time: string[]; sunset: string[] };
  hourly: Hourly;
};

type AirNowEntry = {
  ParameterName: string;
  AQI?: number;
  Value?: number;
};

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const AIRNOW_URL = "https://www.airnowapi.org/aq/forecast/latLong/";
const DEFAULT_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithRetry<T>(url: string, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetchWithTimeout(url, ms);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}

// Open-Meteo returns naive local times like "2026-06-30T20:34" (no offset).
// All hourly + daily values share the location's timezone, so treating these
// strings as UTC gives a consistent relative ordering for interpolation.
function parseLocalIso(iso: string): number {
  const withSeconds = iso.length === 16 ? `${iso}:00` : iso;
  return Date.parse(`${withSeconds}Z`);
}

export function interpolateAtSunset(
  hourly: { time: string[] } & Record<string, unknown>,
  field: string,
  sunsetIso: string
): number {
  const times = hourly.time;
  const values = hourly[field] as number[];
  if (!Array.isArray(times) || !Array.isArray(values) || times.length === 0) {
    throw new Error(`missing hourly data for ${field}`);
  }
  const target = parseLocalIso(sunsetIso);

  let beforeIdx = -1;
  let afterIdx = -1;
  for (let i = 0; i < times.length; i++) {
    const t = parseLocalIso(times[i]);
    if (t <= target) beforeIdx = i;
    if (t >= target) {
      afterIdx = i;
      break;
    }
  }

  if (beforeIdx === -1) return values[afterIdx];
  if (afterIdx === -1) return values[beforeIdx];
  if (beforeIdx === afterIdx) return values[beforeIdx];

  const before = parseLocalIso(times[beforeIdx]);
  const after = parseLocalIso(times[afterIdx]);
  const span = after - before;
  if (span === 0) return values[beforeIdx];
  const ratio = (target - before) / span;
  return values[beforeIdx] + ratio * (values[afterIdx] - values[beforeIdx]);
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

async function fetchAirNowPm25(lat: number, lng: number, date: string): Promise<number | null> {
  const apiKey = process.env.AIRNOW_API_KEY;
  if (!apiKey) return null;
  const params = new URLSearchParams({
    format: "application/json",
    latitude: String(lat),
    longitude: String(lng),
    date,
    distance: "25",
    API_KEY: apiKey,
  });
  const url = `${AIRNOW_URL}?${params.toString()}`;
  try {
    const data = await fetchJsonWithRetry<AirNowEntry[]>(url);
    if (!Array.isArray(data) || data.length === 0) return null;
    const pm25 = data.find((d) => d.ParameterName === "PM2.5");
    if (!pm25) return null;
    if (typeof pm25.Value === "number" && pm25.Value >= 0) return pm25.Value;
    if (typeof pm25.AQI === "number" && pm25.AQI >= 0) return pm25.AQI;
    return null;
  } catch {
    return null;
  }
}

export async function getSunsetForecast(
  lat: number,
  lng: number,
  date?: string
): Promise<ForecastResult> {
  const hourlyFields = [
    "cloud_cover_high",
    "cloud_cover_mid",
    "cloud_cover_low",
    "relative_humidity_2m",
    "visibility",
    "pressure_msl",
    "wind_speed_500hPa",
  ].join(",");

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: hourlyFields,
    daily: "sunset",
    timezone: "auto",
    wind_speed_unit: "kmh",
  });
  if (date) {
    params.set("start_date", date);
    params.set("end_date", date);
  }

  const meteoUrl = `${OPEN_METEO_URL}?${params.toString()}`;
  const meteo = await fetchJsonWithRetry<MeteoResponse>(meteoUrl);

  if (!meteo.daily?.sunset?.length || !meteo.hourly?.time?.length) {
    throw new Error("upstream returned incomplete forecast");
  }

  let sunsetIso: string;
  if (date) {
    const idx = meteo.daily.time.indexOf(date);
    if (idx === -1) throw new Error("date not in forecast range");
    sunsetIso = meteo.daily.sunset[idx];
  } else {
    sunsetIso = meteo.daily.sunset[0];
  }
  const sunsetDate = sunsetIso.slice(0, 10);

  const high_cloud_pct = clampPct(interpolateAtSunset(meteo.hourly, "cloud_cover_high", sunsetIso));
  const mid_cloud_pct = clampPct(interpolateAtSunset(meteo.hourly, "cloud_cover_mid", sunsetIso));
  const low_cloud_pct = clampPct(interpolateAtSunset(meteo.hourly, "cloud_cover_low", sunsetIso));
  const humidity_pct = clampPct(interpolateAtSunset(meteo.hourly, "relative_humidity_2m", sunsetIso));
  const visibility_m = interpolateAtSunset(meteo.hourly, "visibility", sunsetIso);
  const wind_high_kph = interpolateAtSunset(meteo.hourly, "wind_speed_500hPa", sunsetIso);
  const pressure_hpa = interpolateAtSunset(meteo.hourly, "pressure_msl", sunsetIso);

  const pm25_ugm3 = await fetchAirNowPm25(lat, lng, sunsetDate);

  return {
    sunset_iso: sunsetIso,
    timezone: meteo.timezone ?? "UTC",
    high_cloud_pct,
    mid_cloud_pct,
    low_cloud_pct,
    humidity_pct,
    visibility_km: Math.max(0, visibility_m / 1000),
    pm25_ugm3,
    wind_high_kph: Math.max(0, wind_high_kph),
    pressure_hpa,
  };
}
