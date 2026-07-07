"use client";

import { useState } from "react";
import { LocationSearch, type LocationSelection } from "../../components/LocationSearch";

export default function SearchDemoPage() {
  const [selected, setSelected] = useState<LocationSelection | null>(null);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#5a1414",
        color: "#fff8ef",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "8rem 1.5rem 2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <LocationSearch onSelect={setSelected} inkColor="#fff8ef" />

      <div style={{ marginTop: "2.5rem", maxWidth: 480, width: "100%" }}>
        {selected ? (
          <pre
            style={{
              margin: 0,
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.9rem",
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(selected, null, 2)}
          </pre>
        ) : (
          <p style={{ opacity: 0.7, margin: 0 }}>No location selected yet.</p>
        )}
      </div>
    </main>
  );
}
