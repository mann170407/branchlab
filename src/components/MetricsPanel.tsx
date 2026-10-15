import { formatCpi, formatInt, formatPercent } from '../core/format';
import type { CycleModel, Metrics } from '../core/metrics';

interface Props {
  metrics: Metrics;
  model: CycleModel;
  label: string;
}

function Row({ name, value, detail }: { name: string; value: string; detail?: string }) {
  return (
    <tr>
      <th scope="row">{name}</th>
      <td className="num mono metric-value">{value}</td>
      <td className="metric-detail">{detail}</td>
    </tr>
  );
}

export function MetricsPanel({ metrics: m, model, label }: Props) {
  const empty = m.processed === 0;
  const c = m.cycles;
  return (
    <div className="metrics">
      {empty ? (
        <p className="notice notice--plain">No branches processed yet, so accuracy and penalties are not defined. Step or run the simulation to see results.</p>
      ) : !m.complete ? (
        <p className="notice notice--plain">
          Partial run: these figures cover {m.processed} of {m.total} branches. Cycle estimates include only the mispredictions resolved so far.
        </p>
      ) : null}

      <table className="data-table metrics-table">
        <caption className="caption">Prediction results for the {label}</caption>
        <tbody>
          <Row name="Branches processed" value={`${m.processed} / ${m.total}`} />
          <Row name="Correct predictions" value={empty ? '—' : formatInt(m.correct)} />
          <Row name="Mispredictions (M)" value={empty ? '—' : formatInt(m.mispredictions)} />
          <Row
            name="Prediction accuracy"
            value={formatPercent(m.accuracy)}
            detail={empty ? undefined : `${m.correct} / ${m.processed} × 100`}
          />
          <Row
            name="Misprediction rate"
            value={formatPercent(m.mispredictionRate)}
            detail={empty ? undefined : `${m.mispredictions} / ${m.processed} × 100`}
          />
        </tbody>
      </table>

      <table className="data-table metrics-table">
        <caption className="caption">Estimated pipeline cycles (simplified model, not a hardware measurement)</caption>
        <tbody>
          {c === null ? (
            <tr>
              <td colSpan={3} className="trace__empty">
                Fix the cycle model parameters to see cycle and CPI estimates.
              </td>
            </tr>
          ) : (
            <>
              <Row name="Penalty cycles" value={empty ? '—' : formatInt(c.penaltyCycles)} detail={empty ? undefined : `M × P = ${m.mispredictions} × ${model.penalty}`} />
              <Row name="Base cycles" value={formatInt(c.baseCycles)} detail={`I + (L − 1) = ${formatInt(model.instructions)} + ${model.pipelineDepth - 1}`} />
              <Row
                name="Estimated total cycles"
                value={empty ? '—' : formatInt(c.estimatedCycles)}
                detail={empty ? undefined : `${formatInt(c.baseCycles)} + ${formatInt(c.penaltyCycles)}`}
              />
              <Row
                name="Estimated CPI"
                value={empty ? '—' : formatCpi(c.cpi)}
                detail={empty ? undefined : `${formatInt(c.estimatedCycles)} / ${formatInt(model.instructions)}; ideal ${formatCpi(c.idealCpi)}`}
              />
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
