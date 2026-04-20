'use client';

interface Segment {
  ticker: string;
  allocationPct: number;
}

interface Props {
  data: Segment[];
}

// Logo-gradient palette: indigo → cyan → green → teal → purple → sky
const EQUITY_COLORS = ['#4338ca', '#0e7490', '#22c55e', '#0891b2', '#7c3aed', '#0d9488'];
const CASH_COLOR = '#94a3b8'; // slate-400 — always neutral/grey for cash

const SIZE = 120;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 48;
const R_INNER = 28;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  return { x: round(cx + r * Math.cos(rad)), y: round(cy + r * Math.sin(rad)) };
}

function donutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number) {
  const sweep = Math.min(endDeg - startDeg, 359.999);
  const largeArc = sweep > 180 ? 1 : 0;
  const end = startDeg + sweep;

  const o1 = polarToCartesian(cx, cy, rOuter, startDeg);
  const o2 = polarToCartesian(cx, cy, rOuter, end);
  const i1 = polarToCartesian(cx, cy, rInner, end);
  const i2 = polarToCartesian(cx, cy, rInner, startDeg);

  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ');
}

export function AllocationChart({ data }: Props) {
  const filtered = data.filter((d) => d.allocationPct > 0);

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        No allocation data available
      </div>
    );
  }

  // Normalise so segments always sum to exactly 360°
  const total = filtered.reduce((s, d) => s + d.allocationPct, 0);
  const normalised = filtered.map((d) => ({ ...d, pct: (d.allocationPct / total) * 100 }));

  // Compute cumulative start angles without mutation
  const slices = normalised.map((d, i) => {
    const startDeg = normalised.slice(0, i).reduce((s, x) => s + (x.pct / 100) * 360, 0);
    const endDeg = startDeg + (d.pct / 100) * 360;
    const color = d.ticker === 'CASH' ? CASH_COLOR : EQUITY_COLORS[i % EQUITY_COLORS.length];
    return { ...d, startDeg, endDeg, color };
  });

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-40 h-40 drop-shadow-sm" style={{ overflow: 'visible' }}>
        {slices.map((s) => (
          <path
            key={s.ticker}
            d={donutSlicePath(CX, CY, R_OUTER, R_INNER, s.startDeg, s.endDeg)}
            fill={s.color}
            stroke="white"
            strokeWidth="1.5"
          />
        ))}
        <text x={CX} y={CY - 3} textAnchor="middle" fontSize="11" fill="#374151" fontWeight="600">
          {filtered.length}
        </text>
        <text x={CX} y={CY + 8} textAnchor="middle" fontSize="7" fill="#9ca3af">
          holdings
        </text>
      </svg>

      <ul className="w-full space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.ticker} className="flex items-center gap-2.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="font-medium text-gray-700 w-16">{s.ticker}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
            </div>
            <span className="text-gray-500 w-10 text-right tabular-nums">{s.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
