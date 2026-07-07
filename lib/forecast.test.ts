import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSunsetForecast, interpolateAtSunset } from "./forecast";

const HOURLY_FIXTURE = {
  time: [
    "2026-06-30T18:00",
    "2026-06-30T19:00",
    "2026-06-30T20:00",
    "2026-06-30T21:00",
  ],
  cloud_cover_high: [10, 30, 50, 70],
  cloud_cover_mid: [0, 20, 40, 60],
};

describe("interpolateAtSunset", () => {
  it("returns the exact value when sunset lands on an hour boundary", () => {
    expect(interpolateAtSunset(HOURLY_FIXTURE, "cloud_cover_high", "2026-06-30T20:00")).toBe(50);
  });

  it("linearly interpolates between the two surrounding hours", () => {
    // 20:30 is halfway between 20:00 (50) and 21:00 (70) → 60
    expect(interpolateAtSunset(HOURLY_FIXTURE, "cloud_cover_high", "2026-06-30T20:30")).toBeCloseTo(60, 5);
  });

  it("interpolates with non-half offsets", () => {
    // 19:15 is 25% from 19:00 (30) toward 20:00 (50) → 30 + 0.25*20 = 35
    expect(interpolateAtSunset(HOURLY_FIXTURE, "cloud_cover_high", "2026-06-30T19:15")).toBeCloseTo(35, 5);
  });

  it("clamps to the first value when sunset is before all hours", () => {
    expect(interpolateAtSunset(HOURLY_FIXTURE, "cloud_cover_high", "2026-06-30T17:00")).toBe(10);
  });

  it("clamps to the last value when sunset is after all hours", () => {
    expect(interpolateAtSunset(HOURLY_FIXTURE, "cloud_cover_high", "2026-06-30T22:30")).toBe(70);
  });

  it("works for any field name in the hourly object", () => {
    expect(interpolateAtSunset(HOURLY_FIXTURE, "cloud_cover_mid", "2026-06-30T20:30")).toBeCloseTo(50, 5);
  });

  it("throws when the requested field is missing", () => {
    expect(() => interpolateAtSunset(HOURLY_FIXTURE, "nope", "2026-06-30T20:00")).toThrow();
  });
});

describe("getSunsetForecast", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.AIRNOW_API_KEY = "test-key";
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  function mockResponse(body: unknown, ok = true, status = 200): Response {
    return {
      ok,
      status,
      json: async () => body,
    } as unknown as Response;
  }

  const meteoBody = {
    daily: { time: ["2026-06-30"], sunset: ["2026-06-30T20:30"] },
    hourly: {
      time: [
        "2026-06-30T19:00",
        "2026-06-30T20:00",
        "2026-06-30T21:00",
      ],
      cloud_cover_high: [20, 40, 60],
      cloud_cover_mid: [10, 30, 50],
      cloud_cover_low: [0, 10, 20],
      relative_humidity_2m: [50, 60, 70],
      visibility: [20000, 24000, 28000],
      pressure_msl: [1010, 1012, 1014],
      wind_speed_500hPa: [80, 100, 120],
    },
  };

  it("picks closest-hour values via interpolation and merges PM2.5 from AirNow", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes("open-meteo")) return mockResponse(meteoBody);
      if (u.includes("airnowapi")) {
        return mockResponse([
          { ParameterName: "O3", AQI: 30 },
          { ParameterName: "PM2.5", Value: 12.4, AQI: 50 },
        ]);
      }
      throw new Error(`unexpected fetch: ${u}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getSunsetForecast(37.77, -122.42);

    // sunset at 20:30 -> halfway between 20:00 and 21:00
    expect(result.sunset_iso).toBe("2026-06-30T20:30");
    expect(result.high_cloud_pct).toBeCloseTo(50, 5);
    expect(result.mid_cloud_pct).toBeCloseTo(40, 5);
    expect(result.low_cloud_pct).toBeCloseTo(15, 5);
    expect(result.humidity_pct).toBeCloseTo(65, 5);
    expect(result.visibility_km).toBeCloseTo(26, 5);
    expect(result.pressure_hpa).toBeCloseTo(1013, 5);
    expect(result.wind_high_kph).toBeCloseTo(110, 5);
    expect(result.pm25_ugm3).toBe(12.4);
  });

  it("returns pm25_ugm3 = null when AirNow returns an empty array", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes("open-meteo")) return mockResponse(meteoBody);
      if (u.includes("airnowapi")) return mockResponse([]);
      throw new Error(`unexpected fetch: ${u}`);
    }) as unknown as typeof fetch;

    const result = await getSunsetForecast(37.77, -122.42);
    expect(result.pm25_ugm3).toBeNull();
  });

  it("returns pm25_ugm3 = null when AirNow fails outright", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes("open-meteo")) return mockResponse(meteoBody);
      if (u.includes("airnowapi")) throw new Error("network down");
      throw new Error(`unexpected fetch: ${u}`);
    }) as unknown as typeof fetch;

    const result = await getSunsetForecast(37.77, -122.42);
    expect(result.pm25_ugm3).toBeNull();
    expect(result.sunset_iso).toBe("2026-06-30T20:30");
  });
});
