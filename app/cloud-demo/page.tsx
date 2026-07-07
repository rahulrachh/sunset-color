"use client";

import { useState } from "react";
import { CloudLayer } from "../../components/CloudLayer";

export default function CloudDemoPage() {
  const [high, setHigh] = useState(50);
  const [mid, setMid] = useState(50);
  const [low, setLow] = useState(30);
  const [wind, setWind] = useState(15);

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background:
          "linear-gradient(to bottom, #ff8a3d 0%, #d94e2a 55%, #4a1a3a 100%)",
        color: "#fff8ef",
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <CloudLayer
        highCloudPct={high}
        midCloudPct={mid}
        lowCloudPct={low}
        windKph={wind}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "1.5rem",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          background: "rgba(0,0,0,0.25)",
          backdropFilter: "blur(4px)",
          borderRadius: "8px",
          margin: "1.5rem",
          width: "fit-content",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.2rem" }}>cloud demo</h1>
        <Slider label="High cloud %" value={high} onChange={setHigh} />
        <Slider label="Mid cloud %" value={mid} onChange={setMid} />
        <Slider label="Low cloud %" value={low} onChange={setLow} />
        <Slider label="Wind kph" value={wind} onChange={setWind} max={80} />
      </div>
    </main>
  );
}

function Slider(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}): JSX.Element {
  const max = props.max ?? 100;
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span>
        {props.label}: {props.value}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}
