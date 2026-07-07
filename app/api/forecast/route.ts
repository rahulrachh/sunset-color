import { NextResponse } from "next/server";
import { getSunsetForecast } from "@/lib/forecast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LAT_MIN = 24;
const LAT_MAX = 50;
const LNG_MIN = -125;
const LNG_MAX = -66;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const date = searchParams.get("date") ?? undefined;

  if (!latStr || !lngStr) {
    return NextResponse.json({ error: "missing lat/lng" }, { status: 400 });
  }
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "missing lat/lng" }, { status: 400 });
  }
  if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) {
    return NextResponse.json({ error: "missing lat/lng" }, { status: 400 });
  }
  if (date !== undefined && !DATE_RE.test(date)) {
    return NextResponse.json({ error: "missing lat/lng" }, { status: 400 });
  }

  try {
    const result = await getSunsetForecast(lat, lng, date);
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "public, max-age=900, s-maxage=900" },
    });
  } catch {
    return NextResponse.json({ error: "upstream failure" }, { status: 502 });
  }
}
