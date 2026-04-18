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

type Range = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const RANGES: Range[] = ['1M', '3M', '6M', '1Y', 'ALL'];

const RANGE_DAYS: Record<Range, number | null> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  'ALL': null,
};

// SVG layout
const VIEW_W = 600;
const VIEW_H = 160;
const PAD = { top: 10, right: 16, bottom: 28, left: 68 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;
const GRID_LINES = 5;
const MAX_X_LABELS = 6;

function filterByRange(data: DataPoint[], range: Range): DataPoint[] {
  if (range === 'ALL' || data.length === 0) return data;
  const days = RANGE_DAYS[range]!;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

function formatSGD(value: number): string {
  return 'S$' + value.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatSGDFull(value: number): string {
  return 'S$' + value.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatXLabel(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-SG', { month: 'short', year: '2-digit' });
}

function formatTooltipDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface TooltipState {
  x: number;   // pixel offset from SVG left edge
  y: number;   // pixel offset from SVG top edge
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

  // — Range selector — only shown in uncontrolled (standalone) mode
  const rangeSelector = !isControlled ? (
    <div className="flex gap-1 mb-4">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => setInternalRange(r)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            r === range
              ? 'bg-primary text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
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
      <div>
        {rangeSelector}
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm border border-slate-100 rounded-lg bg-slate-50">
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

  // — Polyline points —
  const points = filtered.map((d, i) => `${xScale(i)},${yScale(d.totalValueSGD)}`).join(' ');

  // — Area fill path —
  const areaPath =
    `M ${xScale(0)},${PAD.top + PLOT_H} ` +
    filtered.map((d, i) => `L ${xScale(i)},${yScale(d.totalValueSGD)}`).join(' ') +
    ` L ${xScale(filtered.length - 1)},${PAD.top + PLOT_H} Z`;

  // — Y-axis grid lines —
  const yTicks = Array.from({ length: GRID_LINES }, (_, i) => {
    const v = yMin + (i / (GRID_LINES - 1)) * yRange;
    const py = yScale(v);
    return { v, py };
  });

  // — X-axis labels (sparse) —
  const xLabelStep = Math.max(1, Math.floor(filtered.length / MAX_X_LABELS));
  const xLabels: { i: number; label: string }[] = [];
  for (let i = 0; i < filtered.length; i += xLabelStep) {
    xLabels.push({ i, label: formatXLabel(filtered[i].date) });
  }
  // Always include last point
  const lastIdx = filtered.length - 1;
  if (xLabels[xLabels.length - 1]?.i !== lastIdx) {
    xLabels.push({ i: lastIdx, label: formatXLabel(filtered[lastIdx].date) });
  }

  // — Hover handling —
  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const plotX = svgX - PAD.left;
    const ratio = Math.max(0, Math.min(1, plotX / PLOT_W));
    const idx = Math.round(ratio * (filtered.length - 1));
    const d = filtered[idx];
    setTooltip({
      x: (xScale(idx) / VIEW_W) * rect.width,
      y: (yScale(d.totalValueSGD) / VIEW_H) * rect.height,
      date: d.date,
      value: d.totalValueSGD,
    });
  }

  // Active point (for hover dot)
  const activeIdx = tooltip
    ? filtered.findIndex((d) => d.date === tooltip.date)
    : -1;

  return (
    <div>
      {rangeSelector}
      <div className="relative w-full overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          width="100%"
          className="block"
          style={{ minWidth: 320 }}
        >
          {/* Grid lines + Y labels */}
          {yTicks.map(({ v, py }, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={PAD.left + PLOT_W}
                y1={py}
                y2={py}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={py + 4}
                textAnchor="end"
                fontSize="10"
                fill="#94a3b8"
              >
                {formatSGD(v)}
              </text>
            </g>
          ))}

          {/* X labels */}
          {xLabels.map(({ i, label }) => (
            <text
              key={i}
              x={xScale(i)}
              y={PAD.top + PLOT_H + 18}
              textAnchor="middle"
              fontSize="10"
              fill="#94a3b8"
            >
              {label}
            </text>
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
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
            style={{ cursor: 'crosshair' }}
          />
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs"
            style={{
              left: tooltip.x + 12,
              top: Math.max(0, tooltip.y - 36),
            }}
          >
            <p className="text-slate-500">{formatTooltipDate(tooltip.date)}</p>
            <p className="font-semibold text-slate-800">{formatSGDFull(tooltip.value)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
