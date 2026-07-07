"use client";

import { useEffect, useState } from "react";
import { forecastToColor } from "../lib/colorMap";
import type { ForecastResult } from "../lib/forecast";

type DayStatus = "loading" | "ready" | "failed";

type Day = {
  date: string; // YYYY-MM-DD
  label: string; // "Tue"
  dateLabel: string; // "7th Jul"
  color: string | null; // middle gradient stop, null until fetched
  status: DayStatus;
};

// Date math on naive YYYY-MM-DD strings is done in UTC so the browser's
// timezone can't shift the day.
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function shortWeekday(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  const suffix = ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

// "3rd Jun" — ordinal day + first three letters of the month.
function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const month = d.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  return `${ordinal(d.getUTCDate())} ${month}`;
}

function localToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function placeholderDay(date: string): Day {
  return {
    date,
    label: shortWeekday(date),
    dateLabel: shortDate(date),
    color: null,
    status: "loading",
  };
}

async function fetchDayColor(
  lat: number,
  lng: number,
  date: string
): Promise<string> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    date,
  });
  const r = await fetch(`/api/forecast?${params.toString()}`);
  if (!r.ok) throw new Error(`forecast ${r.status}`);
  const forecast = (await r.json()) as ForecastResult;
  return forecastToColor(forecast).gradient.stops[1].color;
}

// A column in the strip: a 32px circle, a tiny caps label, and a small date
// line. Swatches fill the circle with the forecast color; the navigation
// controls draw an outlined ring instead.
function StripButton(props: {
  circle: React.ReactNode;
  label: string;
  date: string;
  ariaLabel: string;
  inkColor: string;
  disabled?: boolean;
  hovered: boolean;
  onClick: () => void;
  onHover: (on: boolean) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      onMouseEnter={() => props.onHover(true)}
      onMouseLeave={() => props.onHover(false)}
      onFocus={() => props.onHover(true)}
      onBlur={() => props.onHover(false)}
      aria-label={props.ariaLabel}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: props.disabled ? "default" : "pointer",
        opacity: props.disabled ? 0.3 : 1,
        transform: props.hovered && !props.disabled ? "scale(1.1)" : "scale(1)",
        transition: "transform 200ms ease, opacity 300ms ease",
      }}
    >
      {props.circle}
      <span
        style={{
          fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
          fontSize: "10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: props.inkColor,
          opacity: 0.6,
          lineHeight: 1,
        }}
      >
        {props.label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
          fontSize: "9px",
          letterSpacing: "0.04em",
          color: props.inkColor,
          opacity: 0.45,
          lineHeight: 1,
        }}
      >
        {props.date}
      </span>
    </button>
  );
}

export function MultiDayStrip(props: {
  lat: number;
  lng: number;
  onSelectDate: (date: string) => void; // YYYY-MM-DD
  inkColor: string;
  // The date currently shown in the main view. The preview window starts on
  // the day after it and can then be paged freely with the arrows.
  baseDate?: string;
  // The location's default ("tonight") date, used by the Today button.
  defaultDate?: string;
}): JSX.Element {
  const { lat, lng, baseDate, defaultDate } = props;
  const shown = baseDate ?? localToday();
  // First of the three preview days. The arrows page this window without
  // touching the main view; clicking a swatch is what commits a date.
  const [windowStart, setWindowStart] = useState(() => addDays(shown, 1));
  const [days, setDays] = useState<Day[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  // Re-center the window whenever the shown day or the location changes.
  useEffect(() => {
    setWindowStart(addDays(baseDate ?? localToday(), 1));
  }, [lat, lng, baseDate]);

  useEffect(() => {
    let cancelled = false;
    const dates = [windowStart, addDays(windowStart, 1), addDays(windowStart, 2)];
    // Show all three buttons immediately as placeholder rings; the colors
    // fill in together once every fetch has settled.
    setDays(dates.map(placeholderDay));

    Promise.allSettled(dates.map((d) => fetchDayColor(lat, lng, d))).then(
      (results) => {
        if (cancelled) return;
        setDays(
          dates.map((date, i) => {
            const r = results[i];
            return {
              ...placeholderDay(date),
              color: r.status === "fulfilled" ? r.value : null,
              status: r.status === "fulfilled" ? "ready" : "failed",
            };
          })
        );
      }
    );

    return () => {
      cancelled = true;
    };
  }, [lat, lng, windowStart]);

  const homeWindow = defaultDate ? addDays(defaultDate, 1) : null;
  const atHome =
    defaultDate !== undefined &&
    shown === defaultDate &&
    windowStart === homeWindow;

  const hoverProps = (key: string) => ({
    hovered: hovered === key,
    onHover: (on: boolean) => setHovered(on ? key : null),
  });

  const ring: React.CSSProperties = {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: `1.5px solid ${props.inkColor}`,
    opacity: 0.55,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: props.inkColor,
    fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "48px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "24px",
        alignItems: "flex-start",
        zIndex: 5,
      }}
    >
      <StripButton
        circle={
          <span style={ring}>
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: props.inkColor,
              }}
            />
          </span>
        }
        label="Today"
        date={defaultDate ? shortDate(defaultDate) : shortDate(shown)}
        ariaLabel={`Back to today's sunset (${defaultDate ?? shown})`}
        inkColor={props.inkColor}
        disabled={atHome}
        onClick={() => {
          if (!defaultDate) return;
          if (shown !== defaultDate) {
            props.onSelectDate(defaultDate); // window re-centers via baseDate
          } else {
            setWindowStart(addDays(defaultDate, 1));
          }
        }}
        {...hoverProps("today")}
      />
      <StripButton
        circle={
          <span style={{ ...ring, fontSize: "16px", lineHeight: 1 }}>
            <span style={{ transform: "translateY(-1px)" }}>&#8249;</span>
          </span>
        }
        label="Back"
        date={shortDate(addDays(windowStart, -1))}
        ariaLabel={`Show earlier days (from ${addDays(windowStart, -1)})`}
        inkColor={props.inkColor}
        onClick={() => setWindowStart(addDays(windowStart, -1))}
        {...hoverProps("back")}
      />
      {days.map((d) => (
        <StripButton
          key={d.date}
          circle={
            <span
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: d.color ?? "transparent",
                border: d.color ? "none" : `1.5px dashed ${props.inkColor}`,
                opacity: d.color ? 1 : 0.35,
                boxShadow:
                  d.date === shown && d.color
                    ? `0 0 0 2px ${props.inkColor}, 0 1px 6px rgba(0, 0, 0, 0.15)`
                    : d.color
                      ? "0 1px 6px rgba(0, 0, 0, 0.15)"
                      : "none",
                boxSizing: "border-box",
                transition: "background 300ms ease, opacity 300ms ease",
              }}
            />
          }
          label={d.label}
          date={d.dateLabel}
          ariaLabel={
            d.status === "failed"
              ? `No forecast available for ${d.label} (${d.date})`
              : `Show sunset forecast for ${d.label} (${d.date})`
          }
          inkColor={props.inkColor}
          disabled={d.status === "failed"}
          onClick={() => props.onSelectDate(d.date)}
          {...hoverProps(d.date)}
        />
      ))}
      <StripButton
        circle={
          <span style={{ ...ring, fontSize: "16px", lineHeight: 1 }}>
            <span style={{ transform: "translateY(-1px)" }}>&#8250;</span>
          </span>
        }
        label="Next"
        date={shortDate(addDays(windowStart, 3))}
        ariaLabel={`Show later days (to ${addDays(windowStart, 3)})`}
        inkColor={props.inkColor}
        onClick={() => setWindowStart(addDays(windowStart, 1))}
        {...hoverProps("next")}
      />
    </div>
  );
}
