'use client';

import { useState, useRef } from 'react';

interface DataPoint {
  date: string;          // YYYY-MM-DD
  totalValueSGD: number;
}

interface Props {
  data: DataPoint[];
  /** Controlled range — when provided the internal range selector is hidden */
  range?: Range;
}

type Range = '1D' | 'YTD' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

const RANGES: Range[] = ['1D', 'YTD', '1M', '3M', '6M', '1Y', 'ALL'];

const RANGE_DAYS: Record<Range, number | null> = {
  '1D': 1,
  'YTD': null,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  'ALL': null,
};

// SVG layout — y-axis labels and x-axis labels live in HTML; SVG has minimal padding
const VIEW_W = 600;
const VIEW_H = 210;
const PAD = { top: 10, right: 16, bottom: 4, left: 68 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;
const GRID_LINES = 5;
const MAX_X_LABELS = 6;

// Percentages used to position HTML overlays to match SVG coordinate space
const LEFT_PCT  = (PAD.left  / VIEW_W) * 100; // ~11.3%
const RIGHT_PCT = (PAD.right / VIEW_W) * 100; // ~2.7%

function filterByRange(data: DataPoint[], range: Range): DataPoint[] {
  if (range === 'ALL' || data.length === 0) return data;
  if (range === '1D') return data.slice(-2);
  if (range === 'YTD') {
    const jan1 = `${new Date().getFullYear()}-01-01`;
    return data.filter((d) => d.date >= jan1);
  }
  const days = RANGE_DAYS[range]!;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return data.filter((d) => d.date >= cutoff.toISOString().slice(0, 10));
}

function formatSGD(value: number): string {
  return 'S$' + value.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatSGDFull(value: number): string {
  return 'S$' + value.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMonthLabel(date: string, showYear: boolean): string {
  const d = new Date(date + 'T00:00:00');
  return showYear
    ? d.toLocaleDateString('en-SG', { month: 'short', year: '2-digit' })
    : d.toLocaleDateString('en-SG', { month: 'short' });
}

function formatDayLabel(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

function getXLabels(filtered: DataPoint[]): { i: number; label: string }[] {
  const n = filtered.length;
  if (n === 0) return [];
  if (n <= 2) return filtered.map((d, i) => ({ i, label: formatDayLabel(d.date) }));

  const spanDays = Math.round(
    (new Date(filtered[n - 1].date).getTime() - new Date(filtered[0].date).getTime()) / 86400000
  );

  if (spanDays <= 45) {
    const step = Math.max(1, Math.floor((n - 1) / (MAX_X_LABELS - 1)));
    const labels: { i: number; label: string }[] = [];
    for (let i = 0; i < n; i += step) labels.push({ i, label: formatDayLabel(filtered[i].date) });
    return labels;
  }

  const spansMultipleYears = filtered[0].date.slice(0, 4) !== filtered[n - 1].date.slice(0, 4);
  const seen = new Set<string>();
  const labels: { i: number; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const month = filtered[i].date.slice(0, 7);
    if (!seen.has(month)) {
      seen.add(month);
      const isNewYear = i === 0 || filtered[i].date.slice(0, 4) !== filtered[i - 1]?.date.slice(0, 4);
      labels.push({ i, label: formatMonthLabel(filtered[i].date, spansMultipleYears || isNewYear) });
    }
  }
  if (labels.length > MAX_X_LABELS) {
    const step = Math.ceil(labels.length / MAX_X_LABELS);
    return labels.filter((_, i) => i % step === 0);
  }
  return labels;
}

function formatTooltipDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface TooltipState {
  x: number;           // pixels from SVG left edge (scaled to rendered size)
  y: number;
  containerW: number;  // rendered SVG width — used to decide which side to show tooltip
  date: string;
  value: number;
}

export function ValueHistoryChart({ data, range: controlledRange }: Props) {
  const [internalRange, setInternalRange] = useState<Range>('1Y');
  const range = controlledRange ?? internalRange;
  const isControlled = controlledRange !== undefined;
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const filtered = filterByRange(data, range);

  const rangeSelector = !isControlled ? (
    <div className="flex gap-1 mb-4">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => setInternalRange(r)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            r === range ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
          style={r === range ? { backgroundColor: '#0f766e' } : undefined}
        >
          {r}
        </button>
      ))}
    </div>
  ) : null;

  if (filtered.length < 2) {
    return (
      <div className="flex flex-col h-full">
        {rangeSelector}
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm border border-slate-100 rounded-lg bg-slate-50">
          {data.length === 0
            ? 'No snapshots yet — run the snapshot script or visit your dashboard'
            : 'Not enough data for this range — try a wider range'}
        </div>
      </div>
    );
  }

  // — Compute scales —
  const minVal = Math.min(...filtered.map((d) => d.totalValueSGD));
  const maxVal = Math.max(...filtered.map((d) => d.totalValueSGD));
  const valPad = (maxVal - minVal) * 0.08 || maxVal * 0.05;
  const yMin = minVal - valPad;
  const yMax = maxVal + valPad;
  const yRange = yMax - yMin;

  const xScale = (i: number) => PAD.left + (i / (filtered.length - 1)) * PLOT_W;
  const yScale = (v: number) => PAD.top + (1 - (v - yMin) / yRange) * PLOT_H;

  const points = filtered.map((d, i) => `${xScale(i)},${yScale(d.totalValueSGD)}`).join(' ');
  const areaPath =
    `M ${xScale(0)},${PAD.top + PLOT_H} ` +
    filtered.map((d, i) => `L ${xScale(i)},${yScale(d.totalValueSGD)}`).join(' ') +
    ` L ${xScale(filtered.length - 1)},${PAD.top + PLOT_H} Z`;

  const yTicks = Array.from({ length: GRID_LINES }, (_, i) => ({
    v: yMin + (i / (GRID_LINES - 1)) * yRange,
    py: yScale(yMin + (i / (GRID_LINES - 1)) * yRange),
  }));

  const xLabels = getXLabels(filtered);

  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const ratio = Math.max(0, Math.min(1, (svgX - PAD.left) / PLOT_W));
    const idx = Math.round(ratio * (filtered.length - 1));
    const d = filtered[idx];
    setTooltip({
      x: (xScale(idx) / VIEW_W) * rect.width,
      y: (yScale(d.totalValueSGD) / VIEW_H) * rect.height,
      containerW: rect.width,
      date: d.date,
      value: d.totalValueSGD,
    });
  }

  const activeIdx = tooltip ? filtered.findIndex((d) => d.date === tooltip.date) : -1;

  // X-label positions as % of SVG width (correct because preserveAspectRatio="none" scales x linearly)
  const labelPct = (i: number) => (xScale(i) / VIEW_W) * 100;

  // Tooltip: flip to left side when cursor is in the right 40% to avoid overflow
  const tooltipOnRight = tooltip ? tooltip.x < tooltip.containerW * 0.6 : true;

  return (
    <div className="flex flex-col h-full">
      {rangeSelector}

      {/* Outer: positions tooltip; no overflow so tooltip never triggers scroll */}
      <div className="flex-1 min-h-0 relative">

        {/* SVG — stretches to fill; overflow hidden prevents any stray scroll */}
        <div className="w-full h-full overflow-hidden" style={{ minHeight: 120 }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            className="block"
          >
            {/* Grid lines only — no text (text lives in HTML overlay) */}
            {yTicks.map(({ py }, i) => (
              <line key={i} x1={PAD.left} x2={PAD.left + PLOT_W} y1={py} y2={py} stroke="#f3f4f6" strokeWidth="1" />
            ))}

            {/* Area fill */}
            <path d={areaPath} fill="#0f766e" fillOpacity="0.08" />

            {/* Line */}
            <polyline
              points={points}
              fill="none"
              stroke="#0f766e"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Hover dot */}
            {activeIdx >= 0 && (
              <circle
                cx={xScale(activeIdx)}
                cy={yScale(filtered[activeIdx].totalValueSGD)}
                r="4"
                fill="#0f766e"
                stroke="white"
                strokeWidth="2"
              />
            )}

            {/* Transparent hover overlay */}
            <rect
              x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H}
              fill="transparent"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'crosshair' }}
            />
          </svg>
        </div>

        {/* Y-axis labels — HTML overlay so they're not stretched by preserveAspectRatio="none" */}
        <div className="absolute inset-0 pointer-events-none">
          {yTicks.map(({ v, py }, i) => (
            <span
              key={i}
              className="absolute text-[10px] text-slate-400 pr-1.5 text-right"
              style={{
                top: `${(py / VIEW_H) * 100}%`,
                left: 0,
                width: `${LEFT_PCT}%`,
                transform: 'translateY(-50%)',
              }}
            >
              {formatSGD(v)}
            </span>
          ))}
        </div>

        {/* Tooltip — sibling of overflow div, won't cause scroll; flips side near right edge */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs"
            style={tooltipOnRight
              ? { left: tooltip.x + 12, top: Math.max(0, tooltip.y - 36) }
              : { right: tooltip.containerW - tooltip.x + 12, top: Math.max(0, tooltip.y - 36) }
            }
          >
            <p className="text-slate-500">{formatTooltipDate(tooltip.date)}</p>
            <p className="font-semibold text-slate-800">{formatSGDFull(tooltip.value)}</p>
          </div>
        )}
      </div>

      {/* X-axis labels — HTML, below the SVG, border-t matches breakdown footer */}
      <div className="relative border-t border-gray-100 pt-1.5" style={{ height: 20, paddingLeft: `${LEFT_PCT}%`, paddingRight: `${RIGHT_PCT}%` }}>
        {xLabels.map(({ i, label }) => {
          const pct = ((xScale(i) - PAD.left) / PLOT_W) * 100;
          const anchor = pct < 4 ? 'left-0' : pct > 96 ? 'right-0' : undefined;
          return (
            <span
              key={i}
              className={`absolute text-[10px] text-slate-400 whitespace-nowrap ${anchor ?? ''}`}
              style={anchor ? undefined : { left: `${pct}%`, transform: 'translateX(-50%)' }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
