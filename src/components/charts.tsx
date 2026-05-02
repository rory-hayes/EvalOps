function polylinePoints(data: number[], width: number, height: number, min = 0, max = 100) {
  const range = max - min || 1;
  return data
    .map((value, index) => {
      const x = (index / Math.max(1, data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 24) - 12;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function Sparkline({
  data,
  color = "#2563eb",
}: {
  data: number[];
  color?: string;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);

  return (
    <svg className="h-9 w-full" viewBox="0 0 120 36" role="img" aria-label="Trend">
      <polyline
        points={polylinePoints(data, 120, 36, min, max)}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

export function PassRateChart({
  data,
}: {
  data: Array<{
    day: string;
    overall: number;
    support: number;
    billing: number;
    refunds: number;
  }>;
}) {
  const width = 720;
  const height = 250;
  const plotLeft = 42;
  const plotTop = 12;
  const plotWidth = width - 56;
  const plotHeight = height - 48;
  const series = [
    { key: "overall", label: "Overall", color: "#2563eb", dash: "" },
    { key: "support", label: "Support QA", color: "#f97316", dash: "7 6" },
    { key: "billing", label: "Billing", color: "#16a34a", dash: "7 6" },
    { key: "refunds", label: "Refunds", color: "#7c3aed", dash: "7 6" },
  ] as const;
  const toPoints = (key: (typeof series)[number]["key"]) =>
    data
      .map((row, index) => {
        const x = plotLeft + (index / Math.max(1, data.length - 1)) * plotWidth;
        const y = plotTop + plotHeight - (row[key] / 100) * plotHeight;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

  return (
    <div className="h-64 w-full">
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
        {series.map((item) => (
          <span key={item.key} className="flex items-center gap-2">
            <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <svg className="h-[220px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Eval pass rate over time">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = plotTop + plotHeight - (tick / 100) * plotHeight;
          return (
            <g key={tick}>
              <line x1={plotLeft} x2={plotLeft + plotWidth} y1={y} y2={y} stroke="#e2e8f0" />
              <text x={8} y={y + 4} fontSize="12" fill="#64748b">
                {tick}%
              </text>
            </g>
          );
        })}
        {data.map((row, index) => {
          const x = plotLeft + (index / Math.max(1, data.length - 1)) * plotWidth;
          const labelX = Math.max(34, Math.min(width - 48, x));
          return (
            <text
              key={row.day}
              x={labelX}
              y={height - 12}
              textAnchor="middle"
              fontSize="12"
              fill="#64748b"
            >
              {row.day}
            </text>
          );
        })}
        {series.map((item) => (
          <polyline
            key={item.key}
            points={toPoints(item.key)}
            fill="none"
            stroke={item.color}
            strokeDasharray={item.dash}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={item.key === "overall" ? 3 : 2.5}
          />
        ))}
      </svg>
    </div>
  );
}

export function MetricComparisonChart({
  data,
}: {
  data: Array<{ metric: string; current: number; candidateA: number; candidateB: number }>;
}) {
  const max = 100;
  return (
    <div className="h-64 w-full">
      <div className="flex h-52 items-end gap-5 border-b border-l border-slate-200 px-4 pt-4">
        {data.map((row) => (
          <div key={row.metric} className="flex h-full flex-1 flex-col justify-end gap-2">
            <div className="flex h-40 items-end justify-center gap-2">
              <span
                className="w-4 rounded-t-[3px] bg-slate-300"
                style={{ height: `${(row.current / max) * 100}%` }}
              />
              <span
                className="w-4 rounded-t-[3px] bg-blue-600"
                style={{ height: `${(row.candidateA / max) * 100}%` }}
              />
              <span
                className="w-4 rounded-t-[3px] bg-emerald-400"
                style={{ height: `${(row.candidateB / max) * 100}%` }}
              />
            </div>
            <span className="min-h-8 text-center text-[11px] leading-4 text-slate-500">{row.metric}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-5 text-xs text-slate-600">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
          Current
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
          Candidate A
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
          Candidate B
        </span>
      </div>
    </div>
  );
}

export function CacheTrendChart({ data }: { data: Array<{ day: string; value: number }> }) {
  return (
    <div className="h-36 w-full">
      <svg className="h-full w-full" viewBox="0 0 420 140" role="img" aria-label="Cacheable prefix trend">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = 110 - tick;
          return (
            <g key={tick}>
              <line x1={34} x2={405} y1={y} y2={y} stroke="#e2e8f0" />
              <text x={0} y={y + 4} fontSize="11" fill="#64748b">
                {tick}%
              </text>
            </g>
          );
        })}
        <polyline
          points={data
            .map((row, index) => {
              const x = 34 + (index / Math.max(1, data.length - 1)) * 371;
              const y = 110 - row.value;
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(" ")}
          fill="none"
          stroke="#2563eb"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
}

export function CalibrationHeatmap({ values }: { values: number[][] }) {
  const labels = ["0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"];
  const max = Math.max(...values.flat());
  return (
    <div className="grid gap-1 text-[11px]">
      <div className="grid grid-cols-[70px_repeat(5,1fr)] gap-1 text-center text-slate-500">
        <span />
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      {values.map((row, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-[70px_repeat(5,1fr)] gap-1">
          <span className="flex items-center text-slate-500">{labels[rowIndex]}</span>
          {row.map((cell, cellIndex) => {
            const normalized = cell / max;
            const color =
              cellIndex === rowIndex
                ? `rgba(34, 197, 94, ${0.18 + normalized * 0.5})`
                : `rgba(249, 115, 22, ${0.12 + normalized * 0.45})`;
            return (
              <span
                key={`${rowIndex}-${cellIndex}`}
                className="flex h-9 items-center justify-center rounded-[4px] font-semibold text-slate-700"
                style={{ backgroundColor: color }}
              >
                {cell}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ScoreScatter() {
  const data = Array.from({ length: 70 }, (_, index) => {
    const x = (index % 10) / 10 + 0.05 + (index % 3) * 0.012;
    const y = Math.min(1, Math.max(0.05, x * 0.82 + 0.08 + ((index * 17) % 21) / 100));
    return { x, y };
  });

  return (
    <div className="h-56 w-full">
      <svg className="h-full w-full" viewBox="0 0 300 220" role="img" aria-label="Score correlation">
        <line x1="34" x2="286" y1="186" y2="186" stroke="#cbd5e1" />
        <line x1="34" x2="34" y1="14" y2="186" stroke="#cbd5e1" />
        <line x1="34" x2="286" y1="186" y2="24" stroke="#60a5fa" strokeWidth="2" />
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <text x={34 + tick * 252 - 5} y="206" fontSize="11" fill="#64748b">
              {tick.toFixed(1)}
            </text>
            <text x="5" y={190 - tick * 172} fontSize="11" fill="#64748b">
              {tick.toFixed(1)}
            </text>
          </g>
        ))}
        {data.map((point, index) => (
          <circle
            key={index}
            cx={34 + point.x * 252}
            cy={186 - point.y * 172}
            r="2.4"
            fill="#2563eb"
            opacity="0.88"
          />
        ))}
        <text x="118" y="218" fontSize="11" fill="#64748b">
          Human score
        </text>
        <text x="0" y="12" fontSize="11" fill="#64748b">
          LLM judge score
        </text>
      </svg>
    </div>
  );
}

export function TinyComparisonBars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
