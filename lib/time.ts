// Helpers for the "today vs tomorrow" sunset decision and formatting in a
// location's IANA timezone. Open-Meteo's sunset_iso is a naive local time
// (no offset). To compare with "now", we project the current wall clock into
// that same timezone via Intl.DateTimeFormat.

function parseLocalIso(iso: string): number {
  const withSeconds = iso.length === 16 ? `${iso}:00` : iso;
  return Date.parse(`${withSeconds}Z`);
}

function partsInTz(now: Date, tz: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out;
}

function nowAsLocalIsoMs(tz: string, now: Date = new Date()): number {
  const p = partsInTz(now, tz);
  // Intl "hour12: false" can emit "24" at midnight; normalize to "00".
  const hour = p.hour === "24" ? "00" : p.hour;
  const iso = `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}`;
  return parseLocalIso(iso);
}

export type SunsetDecision = {
  label: "tonight" | "tomorrow";
  // YYYY-MM-DD to pass to the forecast API, or undefined to keep today's data.
  dateForApi: string | undefined;
};

// Given today's sunset (already fetched), decide whether to keep showing it
// or to switch to tomorrow's.
export function decideSunsetDate(
  todaySunsetIso: string,
  tz: string,
  now: Date = new Date()
): SunsetDecision {
  const sunsetMs = parseLocalIso(todaySunsetIso);
  const nowMs = nowAsLocalIsoMs(tz, now);
  if (nowMs < sunsetMs) {
    return { label: "tonight", dateForApi: undefined };
  }
  // Tomorrow's date as YYYY-MM-DD in the location's timezone.
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const p = partsInTz(tomorrow, tz);
  return { label: "tomorrow", dateForApi: `${p.year}-${p.month}-${p.day}` };
}

// Hero label for an explicitly selected YYYY-MM-DD: "tonight" / "tomorrow" /
// "yesterday" when the date is today/tomorrow/yesterday in the location's
// timezone, "last Tuesday" for the past week, otherwise the weekday
// ("on Tuesday").
export function labelForDate(
  date: string,
  tz: string,
  now: Date = new Date()
): string {
  const today = partsInTz(now, tz);
  const todayMs = Date.parse(
    `${today.year}-${today.month}-${today.day}T00:00:00Z`
  );
  const dateMs = Date.parse(`${date}T00:00:00Z`);
  const diffDays = Math.round((dateMs - todayMs) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "tonight";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";

  const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  if (diffDays < 0 && diffDays >= -6) return `last ${weekday}`;
  return `on ${weekday}`;
}

// "July 6, 2026" — full date for the hero dateline under the time.
export function formatFullDate(dateOrIso: string): string {
  const date = dateOrIso.slice(0, 10);
  const d = new Date(`${date}T00:00:00Z`);
  const month = d.toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  return `${month} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// "8:34 PM" style — sunset_iso is naive local time, so render its HH:mm
// directly without redoing a timezone conversion.
export function formatSunsetTime(sunsetIso: string): string {
  const m = sunsetIso.match(/T(\d{2}):(\d{2})/);
  if (!m) return sunsetIso;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${period}`;
}
