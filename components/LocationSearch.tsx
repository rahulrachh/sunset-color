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

export function LocationSearch(props: {
  onSelect: (loc: LocationSelection) => void;
  inkColor?: string;
}): JSX.Element {
  const ink = props.inkColor ?? "#fff8ef";
  const listboxId = useId();
  const optionIdPrefix = useId();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // True only after a search completed successfully with zero US matches —
  // network errors stay silent rather than claiming the place doesn't exist.
  const [noResults, setNoResults] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
        "&count=8&country=US";

      fetch(url, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("geo " + r.status))))
        .then((data: { results?: GeoResult[] }) => {
          const filtered = (data.results ?? []).filter((r) => r.country_code === "US");
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
  }, [query]);

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
    setOpen(false);
    setResults([]);
    setActiveIndex(-1);
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
    borderBottom: `1px solid ${withAlpha(ink, 0.4)}`,
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
        placeholder="where are you watching tonight?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (results.length > 0 || noResults) setOpen(true);
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
