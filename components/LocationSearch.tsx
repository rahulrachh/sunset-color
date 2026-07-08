"use client";

import { useEffect, useId, useRef, useState } from "react";

export type LocationSelection = {
  name: string;
  state: string;
  lat: number;
  lng: number;
};

type GeoResult = {
  id: number;
  name: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  country_code: string;
};

const DEBOUNCE_MS = 250;
const MIN_QUERY_LEN = 2;
// The API ignores its country filter, so US results only survive if we ask
// for far more than we show: fetch the API max, filter down, display a few.
const FETCH_COUNT = 100;
const MAX_SUGGESTIONS = 8;

export function LocationSearch(props: {
  onSelect: (loc: LocationSelection) => void;
  inkColor?: string;
  // Underline the input. On when the search stands bare (empty state); off
  // when it sits inside the rounded pill, where an underline looks odd.
  underline?: boolean;
  // Seed the committed place ("Seattle, Washington") when a selection was
  // made outside this component (auto-locate). Read once on mount - the page
  // remounts the component (key bump) to apply it.
  initialCommitted?: string;
  // Fires on every user keystroke; lets the page know the user has taken
  // over (e.g. to discard a late auto-locate response).
  onUserType?: () => void;
}): JSX.Element {
  const ink = props.inkColor ?? "#fff8ef";
  const listboxId = useId();
  const optionIdPrefix = useId();

  const [query, setQuery] = useState(props.initialCommitted ?? "");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // True only after a search completed successfully with zero US matches —
  // network errors stay silent rather than claiming the place doesn't exist.
  const [noResults, setNoResults] = useState(false);
  // The label of the last selected place ("Portland, Oregon"). It fills the
  // input after a selection; focusing again empties the input and shows it
  // as the placeholder instead, so a new search needs no backspacing.
  const [committed, setCommitted] = useState<string | null>(
    props.initialCommitted ?? null
  );
  // Set when query changes for non-typing reasons (selection, blur restore)
  // so the search effect below doesn't fire a pointless fetch for it.
  const skipSearchRef = useRef(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    // The committed label sitting in the input is display state, not a
    // search. This also keeps the initialCommitted mount quiet (the skip
    // flag can't cover it: strict-mode re-runs effects but not ref inits).
    if (committed !== null && query === committed) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      if (abortRef.current) abortRef.current.abort();
      setResults([]);
      setOpen(false);
      setActiveIndex(-1);
      setNoResults(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const url =
        "https://geocoding-api.open-meteo.com/v1/search?name=" +
        encodeURIComponent(trimmed) +
        `&count=${FETCH_COUNT}`;

      fetch(url, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("geo " + r.status))))
        .then((data: { results?: GeoResult[] }) => {
          // Keep the API's relevance order; drop entries that would render
          // identically (same name + state) in the dropdown.
          const seen = new Set<string>();
          const filtered: GeoResult[] = [];
          for (const r of data.results ?? []) {
            if (r.country_code !== "US") continue;
            const label = `${r.name}|${r.admin1 ?? ""}`;
            if (seen.has(label)) continue;
            seen.add(label);
            filtered.push(r);
            if (filtered.length >= MAX_SUGGESTIONS) break;
          }
          setResults(filtered);
          setNoResults(filtered.length === 0);
          setOpen(true);
          setActiveIndex(filtered.length > 0 ? 0 : -1);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          setResults([]);
          setOpen(false);
          setActiveIndex(-1);
          setNoResults(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, committed]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function commit(r: GeoResult) {
    props.onSelect({
      name: r.name,
      state: r.admin1 ?? "",
      lat: r.latitude,
      lng: r.longitude,
    });
    // Replace whatever was typed with the chosen place. Kill the debounce
    // and any in-flight fetch so a stale search for the old text can't
    // reopen the dropdown after selection.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    const label = r.admin1 ? `${r.name}, ${r.admin1}` : r.name;
    setCommitted(label);
    // If label === query, React bails out of the update and the effect never
    // runs - don't arm the skip flag or it would swallow the next search.
    skipSearchRef.current = label !== query;
    setQuery(label);
    setOpen(false);
    setResults([]);
    setActiveIndex(-1);
    setNoResults(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (results.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      if (results.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        commit(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const activeId =
    open && activeIndex >= 0 ? `${optionIdPrefix}-${activeIndex}` : undefined;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom:
      props.underline === false ? "none" : `1px solid ${withAlpha(ink, 0.4)}`,
    color: ink,
    outline: "none",
    fontSize: "1.25rem",
    padding: "0.5rem 0",
    caretColor: ink,
    fontFamily: "inherit",
  };

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 480 }}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && results.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        placeholder={committed ?? "where are you watching sunset tonight?"}
        value={query}
        onChange={(e) => {
          props.onUserType?.();
          setQuery(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          // A committed place clears out of the way on focus - it stays
          // visible as the placeholder while the user types a new search
          // from an empty input (no backspacing needed).
          if (committed && query === committed) {
            skipSearchRef.current = true;
            setQuery("");
            return;
          }
          if (results.length > 0 || noResults) setOpen(true);
        }}
        onBlur={() => {
          // Nothing new typed: put the committed place back in the pill.
          if (committed && query.trim() === "") {
            skipSearchRef.current = true;
            setQuery(committed);
          }
        }}
        style={inputStyle}
      />
      <style>{`
        input::placeholder { color: ${withAlpha(ink, 0.5)}; }
      `}</style>
      {open && noResults && results.length === 0 && (
        <p
          role="status"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            margin: "4px 0 0",
            padding: "0.5rem 0",
            color: ink,
            opacity: 0.6,
            fontStyle: "italic",
            fontSize: "0.9rem",
            zIndex: 10,
          }}
        >
          no places found - try another spelling or a nearby city
        </p>
      )}
      {open && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            marginTop: 4,
            padding: 0,
            listStyle: "none",
            color: ink,
            zIndex: 10,
          }}
        >
          {results.map((r, i) => {
            const isActive = i === activeIndex;
            return (
              <li
                key={r.id}
                id={`${optionIdPrefix}-${i}`}
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(r);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  padding: "0.5rem 0",
                  cursor: "pointer",
                  background: isActive ? withAlpha(ink, 0.12) : "transparent",
                  fontSize: "1rem",
                }}
              >
                {r.name}
                {r.admin1 ? `, ${r.admin1}` : ""}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function withAlpha(color: string, alpha: number): string {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return color;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
