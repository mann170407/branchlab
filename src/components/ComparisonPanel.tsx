import type { Comparison } from '../core/analysis';
import { formatCpi, formatInt, formatPercent, formatPoints } from '../core/format';

function diffInt(a: number | null, b: number | null): string {
  if (a === null || b === null) return '—';
  const d = b - a;
  return d === 0 ? '0' : `${d > 0 ? '+' : '−'}${formatInt(Math.abs(d))}`;
}

function diffCpi(a: number | null, b: number | null): string {
  if (a === null || b === null) return '—';
  const d = b - a;
  return d === 0 ? '0' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(3)}`;
}

interface BarDatum {
  label: string;
  value: number;
  display: string;
  className: string;
}

/** Horizontal bars on a single shared axis [0, max]. */
function BarGroup({ title, data, max, axisLabel }: { title: string; data: BarDatum[]; max: number; axisLabel: (v: number) => string }) {
  const W = 360;
  const LABEL_W = 52;
  const VALUE_W = 64;
  const plotW = W - LABEL_W - VALUE_W;
  const barH = 22;
  const gap = 10;
  const top = 6;
  const h = top + data.length * (barH + gap) + 18;
  const ticks = [0, 0.5, 1].map((f) => f * max);
  return (
    <figure className="bar-chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${d.display}`).join(', ')}`}>
        {ticks.map((t, i) => {
          const x = LABEL_W + (max === 0 ? 0 : (t / max) * plotW);
          return (
            <g key={i} className="bar-chart__tick">
              <line x1={x} x2={x} y1={top - 2} y2={h - 16} />
              <text x={x} y={h - 4} textAnchor="middle">
                {axisLabel(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const y = top + i * (barH + gap);
          const w = max === 0 ? 0 : Math.max(0, (d.value / max) * plotW);
          return (
            <g key={d.label}>
              <title>{`${d.label}: ${d.display}`}</title>
              <text x={LABEL_W - 8} y={y + barH / 2 + 4} textAnchor="end" className="bar-chart__label">
                {d.label}
              </text>
              <rect x={LABEL_W} y={y} width={plotW} height={barH} className="bar-chart__hit" />
              {w > 0 && <path className={`bar-chart__bar ${d.className}`} d={roundedRight(LABEL_W, y, w, barH, Math.min(4, w))} />}
              <text x={LABEL_W + w + 6} y={y + barH / 2 + 4} className="bar-chart__value">
                {d.display}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Bar anchored square at the baseline, rounded at the data end. */
function roundedRight(x: number, y: number, w: number, h: number, r: number): string {
  return `M ${x} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x} Z`;
}

export function ComparisonPanel({ comparison: c }: { comparison: Comparison }) {
  const a = c.oneBit.metrics;
  const b = c.twoBit.metrics;
  const empty = c.processed === 0;
  const val = (v: number | null, f: (x: number | null) => string) => (empty ? '—' : f(v));

  const rows: { name: string; one: string; two: string; diff: string }[] = [
    { name: 'Branches processed', one: `${a.processed} / ${a.total}`, two: `${b.processed} / ${b.total}`, diff: '' },
    { name: 'Correct predictions', one: val(a.correct, formatInt), two: val(b.correct, formatInt), diff: empty ? '—' : diffInt(a.correct, b.correct) },
    { name: 'Mispredictions', one: val(a.mispredictions, formatInt), two: val(b.mispredictions, formatInt), diff: empty ? '—' : diffInt(a.mispredictions, b.mispredictions) },
    { name: 'Accuracy', one: formatPercent(a.accuracy), two: formatPercent(b.accuracy), diff: formatPoints(c.accuracyDifference) },
    { name: 'Misprediction rate', one: formatPercent(a.mispredictionRate), two: formatPercent(b.mispredictionRate), diff: formatPoints(b.mispredictionRate !== null && a.mispredictionRate !== null ? b.mispredictionRate - a.mispredictionRate : null) },
    {
      name: 'Penalty cycles (est.)',
      one: val(a.cycles?.penaltyCycles ?? null, formatInt),
      two: val(b.cycles?.penaltyCycles ?? null, formatInt),
      diff: empty ? '—' : diffInt(a.cycles?.penaltyCycles ?? null, b.cycles?.penaltyCycles ?? null),
    },
    {
      name: 'Total cycles (est.)',
      one: val(a.cycles?.estimatedCycles ?? null, formatInt),
      two: val(b.cycles?.estimatedCycles ?? null, formatInt),
      diff: empty ? '—' : diffInt(a.cycles?.estimatedCycles ?? null, b.cycles?.estimatedCycles ?? null),
    },
    {
      name: 'CPI (est.)',
      one: val(a.cycles?.cpi ?? null, formatCpi),
      two: val(b.cycles?.cpi ?? null, formatCpi),
      diff: empty ? '—' : diffCpi(a.cycles?.cpi ?? null, b.cycles?.cpi ?? null),
    },
  ];

  return (
    <div className="comparison">
      <div className="comparison__grid">
        <div className="table-scroll">
          <table className="data-table compare-table">
            <caption className="caption">Same branch events, separate predictor tables</caption>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col" className="num">
                  <span className="swatch swatch--one" aria-hidden="true" />
                  1-bit
                </th>
                <th scope="col" className="num">
                  <span className="swatch swatch--two" aria-hidden="true" />
                  2-bit
                </th>
                <th scope="col" className="num">2-bit − 1-bit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <th scope="row">{r.name}</th>
                  <td className="num mono">{r.one}</td>
                  <td className="num mono">{r.two}</td>
                  <td className="num mono">{r.diff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="comparison__charts">
          {empty ? (
            <p className="notice notice--plain">The charts appear once at least one branch has been processed.</p>
          ) : (
            <>
              <div className="legend" aria-hidden="true">
                <span>
                  <span className="swatch swatch--one" />
                  1-bit
                </span>
                <span>
                  <span className="swatch swatch--two" />
                  2-bit
                </span>
              </div>
              <BarGroup
                title="Prediction accuracy (%)"
                max={100}
                axisLabel={(v) => `${v}%`}
                data={[
                  { label: '1-bit', value: a.accuracy ?? 0, display: formatPercent(a.accuracy, 1), className: 'bar--one' },
                  { label: '2-bit', value: b.accuracy ?? 0, display: formatPercent(b.accuracy, 1), className: 'bar--two' },
                ]}
              />
              <BarGroup
                title={`Mispredictions (of ${c.processed} processed)`}
                max={c.processed}
                axisLabel={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
                data={[
                  { label: '1-bit', value: a.mispredictions, display: String(a.mispredictions), className: 'bar--one' },
                  { label: '2-bit', value: b.mispredictions, display: String(b.mispredictions), className: 'bar--two' },
                ]}
              />
            </>
          )}
        </div>
      </div>
      <div className="findings">
        <h3>Analysis of the current results</h3>
        <ul>
          {c.findings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
