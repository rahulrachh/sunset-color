import { NextResponse } from "next/server";
import { REGION_TO_STATE } from "@/lib/usStates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One visitor's city must never be cached and served to another, so every
// response - locatable or not - is no-store.
const NO_STORE = { "Cache-Control": "no-store" };

function notLocated() {
  return NextResponse.json({ location: null }, { headers: NO_STORE });
}

// Coarse IP-based location from Vercel's geo headers. "Not locatable" (local
// dev, non-US visitor, missing data) is the normal case, not an error: it
// answers 200 with { location: null } and the page keeps its centered search.
export async function GET(req: Request) {
  const h = req.headers;
  const country = h.get("x-vercel-ip-country");
  const latStr = h.get("x-vercel-ip-latitude");
  const lngStr = h.get("x-vercel-ip-longitude");
  const city = h.get("x-vercel-ip-city");
  const region = h.get("x-vercel-ip-country-region");

  if (country !== "US" || !latStr || !lngStr || !city) {
    return notLocated();
  }
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return notLocated();
  }

  // The city header is URL-encoded (e.g. "New%20York"); a malformed encoding
  // should not 500, so fall back to the raw value.
  let name: string;
  try {
    name = decodeURIComponent(city);
  } catch {
    name = city;
  }

  // Unknown region codes (territories, missing header) still locate - the
  // hero just renders without a state, same as a stateless search result.
  const state = region ? REGION_TO_STATE[region] ?? "" : "";

  return NextResponse.json(
    { location: { name, state, lat, lng } },
    { headers: NO_STORE }
  );
}
