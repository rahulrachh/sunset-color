import { ImageResponse } from "next/og";
import { getSunsetForecast } from "@/lib/forecast";
import { forecastToColor } from "@/lib/colorMap";
import { pickInk } from "@/lib/contrast";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const SIZE = 1080;
const LAT_MIN = 24;
const LAT_MAX = 50;
const LNG_MIN = -125;
const LNG_MAX = -66;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FOOTER_DOMAIN = "sunset-color.vercel.app";

const GOOGLE_FONT_UA =
  "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko";

async function loadGoogleFont(cssUrl: string): Promise<ArrayBuffer> {
  const css = await (
    await fetch(cssUrl, { headers: { "User-Agent": GOOGLE_FONT_UA } })
  ).text();
  const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?(truetype|opentype|woff)['"]?\)/);
  if (!match) throw new Error("font url not found");
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

function formatSunsetTime(iso: string): string {
  // iso is naive local time like "2026-06-30T20:34"
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return iso;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${period}`;
}

function errorResponse(status: number): Response {
  return new Response(JSON.stringify({ error: "invalid params" }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const name = searchParams.get("name");
  const date = searchParams.get("date") ?? undefined;

  if (!latStr || !lngStr || !name) return errorResponse(400);
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return errorResponse(400);
  if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) {
    return errorResponse(400);
  }
  if (date !== undefined && !DATE_RE.test(date)) return errorResponse(400);
  if (name.length > 120) return errorResponse(400);

  let forecast;
  try {
    forecast = await getSunsetForecast(lat, lng, date);
  } catch {
    return new Response(JSON.stringify({ error: "upstream failure" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const color = forecastToColor(forecast);
  const stops = color.gradient.stops;
  const sunsetText = formatSunsetTime(forecast.sunset_iso);

  // Text block is centered vertically; sample ink at ~0.5
  const ink = pickInk([...stops], 0.5);
  const footerInk = pickInk([...stops], 0.95);

  const [frauncesRegular, frauncesItalic, inter] = await Promise.all([
    loadGoogleFont(
      "https://fonts.googleapis.com/css2?family=Fraunces:wght@700&display=swap"
    ),
    loadGoogleFont(
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@1,500&display=swap"
    ),
    loadGoogleFont(
      "https://fonts.googleapis.com/css2?family=Inter:wght@500&display=swap"
    ),
  ]);

  const gradientCss = `linear-gradient(to bottom, ${stops[0].color} 0%, ${stops[1].color} ${
    stops[1].position * 100
  }%, ${stops[2].color} 100%)`;

  return new ImageResponse(
    (
      <div
        style={{
          width: SIZE,
          height: SIZE,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: gradientCss,
          color: ink,
          padding: 80,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              fontFamily: "Fraunces",
              fontSize: 120,
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: -2,
              maxWidth: 900,
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontFamily: "Inter",
              fontSize: 54,
              fontWeight: 500,
              opacity: 0.9,
            }}
          >
            {sunsetText}
          </div>
          <div
            style={{
              fontFamily: "FrauncesItalic",
              fontSize: 44,
              fontStyle: "italic",
              opacity: 0.85,
            }}
          >
            {color.descriptor}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontFamily: "Inter",
            fontSize: 24,
            color: footerInk,
            opacity: 0.7,
            letterSpacing: 1,
          }}
        >
          {FOOTER_DOMAIN}
        </div>
      </div>
    ),
    {
      width: SIZE,
      height: SIZE,
      headers: {
        "Cache-Control": "public, immutable, max-age=3600",
      },
      fonts: [
        { name: "Fraunces", data: frauncesRegular, style: "normal", weight: 700 },
        {
          name: "FrauncesItalic",
          data: frauncesItalic,
          style: "italic",
          weight: 500,
        },
        { name: "Inter", data: inter, style: "normal", weight: 500 },
      ],
    }
  );
}
