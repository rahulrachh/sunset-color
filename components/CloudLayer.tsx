"use client";

type CloudLayerProps = {
  highCloudPct: number;
  midCloudPct: number;
  lowCloudPct: number;
  windKph: number;
};

function driftPeriodSec(windKph: number): number {
  const raw = 60 * (10 / Math.max(windKph, 1));
  return Math.max(20, Math.min(120, raw));
}

function seeded(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function CloudLayer(props: CloudLayerProps): JSX.Element {
  const highCount = Math.floor(props.highCloudPct / 15);
  const midCount = Math.floor(props.midCloudPct / 25);
  const lowOpacity = Math.min(0.45, Math.max(0, props.lowCloudPct) / 100 * 0.45);

  const highPeriod = driftPeriodSec(props.windKph);
  const midPeriod = highPeriod * 2;

  const wisps = [];
  for (let i = 0; i < highCount; i++) {
    const vSeed = seeded(i + 1);
    const startSeed = seeded(i + 17);
    const lengthSeed = seeded(i + 31);
    const opacitySeed = seeded(i + 47);
    const top = 1 + vSeed * 28;
    const initialOffset = startSeed * highPeriod;
    const widthVw = 32 + lengthSeed * 26;
    const opacity = 0.4 + opacitySeed * 0.3;
    wisps.push(
      <div
        key={`high-${i}`}
        className="cl-drift-high"
        style={{
          position: "absolute",
          top: `${top}%`,
          left: 0,
          width: `${widthVw}vw`,
          height: "32px",
          opacity,
          filter: "blur(2px)",
          animationDuration: `${highPeriod}s`,
          animationDelay: `-${initialOffset}s`,
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 40"
          preserveAspectRatio="none"
        >
          <path
            d="M 0 22 Q 80 6 160 22 T 320 22 T 400 22"
            stroke="#fff8ef"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>,
    );
  }

  const puffs = [];
  for (let i = 0; i < midCount; i++) {
    const vSeed = seeded(i + 101);
    const startSeed = seeded(i + 117);
    const sizeSeed = seeded(i + 131);
    const opacitySeed = seeded(i + 147);
    const top = 30 + vSeed * 26;
    const initialOffset = startSeed * midPeriod;
    const widthVw = 18 + sizeSeed * 14;
    const opacity = 0.5 + opacitySeed * 0.3;
    puffs.push(
      <div
        key={`mid-${i}`}
        className="cl-drift-mid"
        style={{
          position: "absolute",
          top: `${top}%`,
          left: 0,
          width: `${widthVw}vw`,
          height: "70px",
          opacity,
          filter: "blur(3px)",
          animationDuration: `${midPeriod}s`,
          animationDelay: `-${initialOffset}s`,
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 200 80"
          preserveAspectRatio="none"
        >
          <ellipse cx="60" cy="44" rx="52" ry="22" fill="#fff8ef" />
          <ellipse cx="105" cy="38" rx="46" ry="26" fill="#fff8ef" />
          <ellipse cx="148" cy="46" rx="40" ry="20" fill="#fff8ef" />
        </svg>
      </div>,
    );
  }

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes cl-drift-high {
          from { transform: translate3d(-60vw, 0, 0); }
          to   { transform: translate3d(160vw, 0, 0); }
        }
        @keyframes cl-drift-mid {
          from { transform: translate3d(-40vw, 0, 0); }
          to   { transform: translate3d(140vw, 0, 0); }
        }
        .cl-drift-high {
          animation-name: cl-drift-high;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        .cl-drift-mid {
          animation-name: cl-drift-mid;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }
      `}</style>
      {wisps}
      {puffs}
      {lowOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: "70%",
            left: 0,
            right: 0,
            bottom: 0,
            opacity: lowOpacity,
            mixBlendMode: "multiply",
            background:
              "linear-gradient(to bottom, rgba(70,70,80,0) 0%, rgba(70,70,80,1) 45%, rgba(70,70,80,0.75) 100%)",
          }}
        />
      )}
    </div>
  );
}
