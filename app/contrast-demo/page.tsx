import { pickInkFor } from '../../lib/contrast';

const swatches: { label: string; hex: string }[] = [
  { label: 'pale yellow', hex: '#fff1b8' },
  { label: 'fiery peach', hex: '#ff8a3d' },
  { label: 'deep red', hex: '#7a1f15' },
  { label: 'blood', hex: '#3a0c08' },
  { label: 'lilac', hex: '#c89cd6' },
  { label: 'magenta', hex: '#b13a8a' },
  { label: 'slate', hex: '#5a6a78' },
  { label: 'mid grey', hex: '#8a8a8a' },
];

export default function ContrastDemoPage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="font-serif text-3xl mb-6">contrast demo</h1>
      <p className="mb-8 text-sm opacity-80">
        Each swatch picks its ink (warm white or warm near-black) by WCAG luminance.
        All sample text should remain legible.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {swatches.map((s) => {
          const ink = pickInkFor(s.hex);
          return (
            <div
              key={s.hex}
              className="rounded-lg p-6 min-h-[160px] flex flex-col justify-between"
              style={{ backgroundColor: s.hex, color: ink }}
            >
              <div>
                <div className="font-serif text-2xl leading-tight">{s.label}</div>
                <div className="text-sm opacity-90 mt-1">Sample sunset descriptor</div>
              </div>
              <div className="text-xs mt-4 font-mono">
                bg {s.hex} · ink {ink}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
