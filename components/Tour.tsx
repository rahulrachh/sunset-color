"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Steps are located by data-tour attributes so the tour stays purely
// declarative — it points at elements without changing their behavior.
type Placement = "above" | "left";

const STEPS: { target: string; text: string; placement: Placement }[] = [
  {
    target: "days",
    text: "Each circle previews a day's sunset — tap one to see that evening.",
    placement: "above",
  },
  { target: "next", text: "Peek further into the future.", placement: "above" },
  { target: "back", text: "Step back a day.", placement: "above" },
  { target: "today", text: "Jump back to tonight.", placement: "above" },
  {
    target: "share",
    text: "Download tonight's sunset as an image, or share it.",
    placement: "left",
  },
];

const SPOT_PAD = 8; // spotlight padding around the target's bounding box
const GAP = 14; // gap between the spotlight edge and the popup

type Box = { top: number; left: number; width: number; height: number };

export function Tour(props: { onClose: () => void }): JSX.Element {
  const { onClose } = props;
  const [step, setStep] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Measure the current step's target and place both the spotlight cutout and
  // the popup (above strip elements, left of the share button), clamped to
  // the viewport. Runs after render so the popup's size reflects this step's
  // text, and again on every window resize.
  const place = useCallback(() => {
    const s = STEPS[step];
    const el = document.querySelector(`[data-tour="${s.target}"]`);
    const pop = popupRef.current;
    if (!(el instanceof HTMLElement) || !pop) return;
    const r = el.getBoundingClientRect();
    setSpot({
      top: r.top - SPOT_PAD,
      left: r.left - SPOT_PAD,
      width: r.width + SPOT_PAD * 2,
      height: r.height + SPOT_PAD * 2,
    });
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    let top: number;
    let left: number;
    if (s.placement === "above") {
      top = r.top - SPOT_PAD - GAP - ph;
      left = r.left + r.width / 2 - pw / 2;
    } else {
      top = r.top + r.height / 2 - ph / 2;
      left = r.left - SPOT_PAD - GAP - pw;
    }
    setPos({
      top: Math.min(Math.max(top, 12), window.innerHeight - ph - 12),
      left: Math.min(Math.max(left, 12), window.innerWidth - pw - 12),
    });
  }, [step]);

  useLayoutEffect(place, [place]);

  useEffect(() => {
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [place]);

  // Focus moves to the popup when the tour starts and returns to whatever had
  // it once the tour ends.
  useEffect(() => {
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    popupRef.current?.focus();
    return () => restoreRef.current?.focus();
  }, []);

  // Escape skips the tour from any step.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const last = step === STEPS.length - 1;

  return (
    // Full-screen layer: blocks page interaction while the tour runs.
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      {/* Spotlight cutout — the oversized box-shadow dims everything except
          the rounded rect around the target, keeping the gradient visible. */}
      {spot && (
        <div
          data-tour-spotlight=""
          style={{
            position: "fixed",
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            borderRadius: "12px",
            boxShadow: "0 0 0 200vmax rgba(0, 0, 0, 0.45)",
            transition:
              "top 450ms ease-in-out, left 450ms ease-in-out, width 450ms ease-in-out, height 450ms ease-in-out",
            pointerEvents: "none",
          }}
        />
      )}

      <div
        ref={popupRef}
        role="dialog"
        aria-label={`Guided tour, step ${step + 1} of ${STEPS.length}`}
        tabIndex={-1}
        style={{
          position: "fixed",
          top: pos ? pos.top : 0,
          left: pos ? pos.left : 0,
          width: "min(280px, calc(100vw - 24px))",
          boxSizing: "border-box",
          padding: "0.85rem 1rem 0.75rem",
          borderRadius: "14px",
          background: "rgba(255, 248, 239, 0.9)",
          color: "#2a1810",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.18)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          fontFamily: "var(--font-sans), system-ui, sans-serif",
          opacity: pos ? 1 : 0,
          transition:
            "top 450ms ease-in-out, left 450ms ease-in-out, opacity 300ms ease",
          outline: "none",
        }}
      >
        <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5 }}>
          {STEPS[step].text}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginTop: "0.7rem",
          }}
        >
          <span style={{ fontSize: "11px", opacity: 0.5 }}>
            {step + 1} / {STEPS.length}
          </span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              padding: "0.25rem 0",
              color: "#2a1810",
              opacity: 0.55,
              fontSize: "12px",
              textDecoration: "underline",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={() => (last ? onClose() : setStep(step + 1))}
            style={{
              background: "#2a1810",
              border: "none",
              borderRadius: "9999px",
              padding: "0.35rem 1rem",
              color: "#fff8ef",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
