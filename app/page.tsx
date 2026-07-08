"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LocationSearch, type LocationSelection } from "../components/LocationSearch";
import { CloudLayer } from "../components/CloudLayer";
import { MultiDayStrip } from "../components/MultiDayStrip";
import { Tour } from "../components/Tour";
import { forecastToColor, type ColorResult } from "../lib/colorMap";
import { pickInk, INK_DARK } from "../lib/contrast";
import type { ForecastResult } from "../lib/forecast";
import {
  decideSunsetDate,
  formatFullDate,
  formatSunsetTime,
  labelForDate,
} from "../lib/time";

// Consolation lines for grey evenings. Indexed deterministically from the
// score so the same forecast always shows the same line across re-renders.
const LOW_SCORE_LINES = [
  "stay in tonight",
  "tomorrow then",
  "the sky is resting",
  "muted but yours",
  "soft grey",
  "no fireworks tonight",
] as const;

function lowScoreLine(score: number): string {
  // Hash the score's digits rather than scaling it — scaling clusters common
  // scores onto the same index.
  const s = score.toString();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return LOW_SCORE_LINES[Math.abs(h) % LOW_SCORE_LINES.length];
}

// First-visit flag lives in localStorage, not a cookie: it is only ever read
// client-side after a user interaction, so no server needs it, there are no
// cookie-consent implications, and nothing is sent on every request. A cookie
// would only be justified if the server had to know. Access is guarded
// because Safari private mode can throw on localStorage use.
const TOUR_DONE_KEY = "sunset-tour-done";

function hasSeenTour(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(TOUR_DONE_KEY) === "1";
  } catch {
    return true; // storage unavailable - better no tour than a crash
  }
}

function markTourDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOUR_DONE_KEY, "1");
  } catch {
    // Nothing to do; the tour just won't be remembered as seen.
  }
}

type View = {
  selection: LocationSelection;
  forecast: ForecastResult;
  color: ColorResult;
  label: string; // "tonight" | "tomorrow" | "on Tuesday" ...
  // The date (YYYY-MM-DD) the default view shows for this location — today's
  // sunset, or tomorrow's if today's already passed. Navigation can't go
  // earlier than this.
  defaultDate: string;
};

async function fetchForecast(
  lat: number,
  lng: number,
  date?: string
): Promise<ForecastResult> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (date) params.set("date", date);
  const r = await fetch(`/api/forecast?${params.toString()}`);
  if (!r.ok) throw new Error(`forecast ${r.status}`);
  return (await r.json()) as ForecastResult;
}

export default function Page() {
  const [view, setView] = useState<View | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  // Once the tour has been scheduled this session it never rearms, even if
  // the view changes, so finishing/skipping is final for the session too.
  const tourScheduled = useRef(false);

  const onSelect = useCallback(async (loc: LocationSelection) => {
    setLoading(true);
    try {
      let forecast = await fetchForecast(loc.lat, loc.lng);
      const decision = decideSunsetDate(forecast.sunset_iso, forecast.timezone);
      if (decision.dateForApi) {
        forecast = await fetchForecast(loc.lat, loc.lng, decision.dateForApi);
      }
      const color = forecastToColor(forecast);
      setView({
        selection: loc,
        forecast,
        color,
        label: decision.label,
        defaultDate: forecast.sunset_iso.slice(0, 10),
      });
    } catch {
      // Leave previous view in place on failure.
    } finally {
      setLoading(false);
    }
  }, []);

  // A day picked from the strip: refetch that date and swap the main view.
  const onSelectDate = useCallback(
    async (date: string) => {
      if (!view) return;
      const loc = view.selection;
      setLoading(true);
      try {
        const forecast = await fetchForecast(loc.lat, loc.lng, date);
        const color = forecastToColor(forecast);
        setView({
          selection: loc,
          forecast,
          color,
          label: labelForDate(date, forecast.timezone),
          defaultDate: view.defaultDate,
        });
      } catch {
        // Leave previous view in place on failure.
      } finally {
        setLoading(false);
      }
    },
    [view]
  );

  // Fetch the share PNG for the current view, then hand it to the native
  // share sheet when available (mobile) or download it otherwise.
  const onShare = useCallback(async () => {
    if (!view || sharing) return;
    setSharing(true);
    try {
      const params = new URLSearchParams({
        lat: String(view.selection.lat),
        lng: String(view.selection.lng),
        name: view.selection.name,
        date: view.forecast.sunset_iso.slice(0, 10),
      });
      const r = await fetch(`/api/share?${params.toString()}`);
      if (!r.ok) throw new Error(`share ${r.status}`);
      const blob = await r.blob();
      const filename = `sunset-${view.selection.name
        .toLowerCase()
        .replace(/\s+/g, "-")}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: "sunset-color" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Cancelled share sheets and fetch failures both land here; the page
      // state is untouched either way.
    } finally {
      setSharing(false);
    }
  }, [view, sharing]);

  // Push gradient stops into CSS variables on <main> so the transition runs.
  useEffect(() => {
    const stage = document.getElementById("sunset-stage");
    if (!stage) return;
    if (!view) {
      stage.style.setProperty("--g-top", "#fefcf8");
      stage.style.setProperty("--g-mid", "#fefcf8");
      stage.style.setProperty("--g-bottom", "#fefcf8");
      return;
    }
    const [t, m, b] = view.color.gradient.stops;
    stage.style.setProperty("--g-top", t.color);
    stage.style.setProperty("--g-mid", m.color);
    stage.style.setProperty("--g-bottom", b.color);
  }, [view]);

  // First-visit tour: fires once, the first time a view exists and the flag
  // isn't set. The 1.5s delay lets the gradient transition settle and the
  // strip paint its swatch placeholders before anything gets spotlighted.
  const hasView = view !== null;
  useEffect(() => {
    if (!hasView || tourScheduled.current || hasSeenTour()) return;
    tourScheduled.current = true;
    const t = setTimeout(() => setTourActive(true), 1500);
    return () => clearTimeout(t);
  }, [hasView]);

  const endTour = useCallback(() => {
    markTourDone();
    setTourActive(false);
  }, []);

  const heroInk = view ? pickInk(view.color.gradient.stops, 0.5) : INK_DARK;
  // The selected pill has a warm semi-opaque backdrop, so dark ink is always
  // the more legible choice against it.
  const searchInk = INK_DARK;
  const selected = view !== null;

  return (
    <main
      id="sunset-stage"
      className="sunset-stage"
      style={{
        position: "relative",
        minHeight: "100dvh",
        width: "100%",
        overflow: "hidden",
      }}
    >
      {view && (
        <CloudLayer
          highCloudPct={view.forecast.high_cloud_pct}
          midCloudPct={view.forecast.mid_cloud_pct}
          lowCloudPct={view.forecast.low_cloud_pct}
          windKph={view.forecast.wind_high_kph}
        />
      )}

      {/* Search — centered when empty, pill at top-left when selected. */}
      <div
        aria-busy={loading}
        style={{
          position: "absolute",
          top: selected ? "20px" : "50%",
          left: selected ? "20px" : "50%",
          transform: selected
            ? "translate(0, 0) scale(0.7)"
            : "translate(-50%, -50%) scale(1)",
          transformOrigin: "top left",
          width: "min(480px, calc(100vw - 2rem))",
          // The search always lives in a rounded pill (the input itself has
          // no underline); empty vs selected only changes size and warmth.
          padding: selected ? "0.4rem 0.9rem" : "0.55rem 1.5rem",
          borderRadius: "9999px",
          background: selected
            ? "rgba(255, 248, 239, 0.55)"
            : "rgba(255, 255, 255, 0.8)",
          boxShadow: selected
            ? "0 2px 12px rgba(0, 0, 0, 0.08)"
            : "0 6px 24px rgba(0, 0, 0, 0.07)",
          backdropFilter: "blur(10px) saturate(1.1)",
          WebkitBackdropFilter: "blur(10px) saturate(1.1)",
          transition:
            "transform 600ms cubic-bezier(0.4, 0, 0.2, 1), top 600ms cubic-bezier(0.4, 0, 0.2, 1), left 600ms cubic-bezier(0.4, 0, 0.2, 1), background 600ms ease, padding 600ms ease, box-shadow 600ms ease",
          // Above the whisper text (z 5) so the dropdown panel covers it.
          zIndex: 6,
        }}
      >
        <LocationSearch onSelect={onSelect} inkColor={searchInk} />
      </div>

      {/* Empty-state whisper text */}
      {!selected && (
        <p
          style={{
            position: "absolute",
            top: "calc(50% + 56px)",
            left: "50%",
            transform: "translate(-50%, 0)",
            margin: 0,
            color: "#999",
            fontSize: "0.75rem",
            fontFamily: "var(--font-sans), system-ui, sans-serif",
            zIndex: 5,
            textAlign: "center",
            width: "min(480px, calc(100vw - 2rem))",
          }}
        >
          where do you want to watch tonight&rsquo;s sunset?
        </p>
      )}

      {/* Hero block */}
      {view && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            color: heroInk,
            padding: "0 1.5rem",
            width: "min(900px, calc(100vw - 2rem))",
            zIndex: 4,
            pointerEvents: "none",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontWeight: 300,
              fontSize: "clamp(40px, 8vw, 64px)",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {view.selection.name}
            {view.selection.state ? (
              <span
                style={{
                  fontSize: "0.55em",
                  opacity: 0.75,
                  marginLeft: "0.4em",
                  fontStyle: "italic",
                  whiteSpace: "nowrap",
                }}
              >
                {view.selection.state}
              </span>
            ) : null}
          </h1>
          <p
            style={{
              fontFamily: "var(--font-sans), system-ui, sans-serif",
              fontWeight: 400,
              fontSize: "clamp(18px, 2.6vw, 22px)",
              margin: "0.75rem 0 0",
            }}
          >
            {formatSunsetTime(view.forecast.sunset_iso)} {view.label}
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans), system-ui, sans-serif",
              fontWeight: 400,
              fontSize: "clamp(11px, 1.3vw, 13px)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              opacity: 0.65,
              margin: "0.6rem 0 0",
            }}
          >
            {formatFullDate(view.forecast.sunset_iso)}
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans), system-ui, sans-serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "clamp(14px, 1.8vw, 16px)",
              opacity: 0.8,
              margin: "0.5rem 0 0",
            }}
          >
            — {view.color.descriptor} —
          </p>
          {view.color.score < 0.3 && (
            <p
              style={{
                fontFamily: "var(--font-sans), system-ui, sans-serif",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: "clamp(12px, 1.5vw, 14px)",
                opacity: 0.6,
                margin: "0.35rem 0 0",
              }}
            >
              {lowScoreLine(view.color.score)}
            </p>
          )}
        </div>
      )}

      {/* Share button — bottom-right, only once a location is selected */}
      {view && (
        <button
          type="button"
          onClick={onShare}
          disabled={sharing}
          aria-label="Share this sunset"
          title="Share this sunset"
          data-tour="share"
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            width: "40px",
            height: "40px",
            borderRadius: "9999px",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // 15% ink over the gradient keeps it visible on both light and
            // dark evenings without adding chrome.
            background: `${heroInk}26`,
            color: heroInk,
            cursor: sharing ? "wait" : "pointer",
            opacity: sharing ? 0.5 : 1,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            transition: "background 600ms ease, color 600ms ease, opacity 300ms ease",
            zIndex: 5,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v13" />
            <path d="M7 8l5-5 5 5" />
            <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
          </svg>
        </button>
      )}

      {/* Three-day preview strip */}
      {view && (
        <MultiDayStrip
          lat={view.selection.lat}
          lng={view.selection.lng}
          baseDate={view.forecast.sunset_iso.slice(0, 10)}
          defaultDate={view.defaultDate}
          onSelectDate={onSelectDate}
          inkColor={heroInk}
        />
      )}

      {/* First-visit guided tour */}
      {view && tourActive && <Tour onClose={endTour} />}
    </main>
  );
}
