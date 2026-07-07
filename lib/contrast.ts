import type { GradientStop } from './colorMap';

export const INK_LIGHT = '#fff8ef';
export const INK_DARK = '#2a1810';

type Ink = typeof INK_LIGHT | typeof INK_DARK;

type Rgb = { r: number; g: number; b: number };

function parseHex(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toHex2(v: number): string {
  return Math.round(Math.max(0, Math.min(255, v)))
    .toString(16)
    .padStart(2, '0');
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

function srgbChannelToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const R = srgbChannelToLinear(r);
  const G = srgbChannelToLinear(g);
  const B = srgbChannelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function pickInkFor(bgHex: string): Ink {
  const lum = relativeLuminance(parseHex(bgHex));
  return lum > 0.45 ? INK_DARK : INK_LIGHT;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpHex(aHex: string, bHex: string, t: number): string {
  const a = parseHex(aHex);
  const b = parseHex(bHex);
  return rgbToHex({
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  });
}

function sampleGradient(stops: GradientStop[], position: number): string {
  if (stops.length === 0) {
    throw new Error('pickInk: stops array is empty');
  }
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const p = Math.max(0, Math.min(1, position));

  if (p <= sorted[0].position) return sorted[0].color;
  const last = sorted[sorted.length - 1];
  if (p >= last.position) return last.color;

  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (p >= lo.position && p <= hi.position) {
      const span = hi.position - lo.position;
      const t = span === 0 ? 0 : (p - lo.position) / span;
      return lerpHex(lo.color, hi.color, t);
    }
  }
  return last.color;
}

export function pickInk(stops: GradientStop[], position: number): Ink {
  return pickInkFor(sampleGradient(stops, position));
}
