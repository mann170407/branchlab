import { buildTimeline, type PipelineRow, type PipelineTimeline } from '../core/pipeline';

const ROLE_TEXT: Record<PipelineRow['role'], string> = {
  branch: 'branch',
  'predicted-path': 'predicted path (correct)',
  'wrong-path': 'wrong path, flushed',
  'correct-path': 'correct path (refetched)',
};

export function TimelineGrid({ timeline: t, caption }: { timeline: PipelineTimeline; caption: string }) {
  const cycles = Array.from({ length: t.cycles }, (_, i) => i + 1);
  return (
    <div className="table-scroll">
      <table className="pipeline">
        <caption className="caption">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Instruction</th>
            {cycles.map((c) => (
              <th scope="col" key={c} className={c === t.resolveCycle ? 'pipeline__resolve' : ''}>
                <span className="sr-only">Cycle </span>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.label} className={`pipeline__row pipeline__row--${r.role}`}>
              <th scope="row">
                <span className="pipeline__label">{r.label}</span>
                <span className="pipeline__role">{ROLE_TEXT[r.role]}</span>
              </th>
              {cycles.map((c) => {
                const stage = r.cells[c - 1] ?? null;
                const flushedHere = r.flushedAfterCycle !== null && c === r.flushedAfterCycle + 1;
                return (
                  <td key={c} className={`${c === t.resolveCycle ? 'pipeline__resolve' : ''} ${stage ? 'pipeline__cell' : ''}`}>
                    {stage}
                    {flushedHere && <span className="pipeline__flush">flush</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function timelineSummary(t: PipelineTimeline): string {
  if (!t.mispredicted) {
    return `The branch resolves in ${t.resolveStage} (cycle ${t.resolveCycle}) and confirms the prediction. The instructions fetched behind it were the right ones, so the pipeline keeps completing one instruction per cycle: 0 cycles lost.`;
  }
  const flushed = t.rows.filter((r) => r.role === 'wrong-path').length;
  return `The branch resolves in ${t.resolveStage} at the end of cycle ${t.resolveCycle} and reveals the misprediction. ${flushed} wrong-path instruction${flushed === 1 ? ' is' : 's are'} flushed, fetch restarts on the correct path in cycle ${t.resolveCycle + 1}, and the next useful instruction completes in cycle ${t.firstUsefulComplete} instead of ${t.firstUsefulComplete - t.lostCycles}: ${t.lostCycles} cycle${t.lostCycles === 1 ? '' : 's'} lost.`;
}

interface Props {
  depth: number;
  penalty: number;
  /** The trace row shown: its prediction decides which case is drawn. */
  step: { step: number; address: string; predicted: 'T' | 'N'; actual: 'T' | 'N'; correct: boolean; predictorLabel: string } | null;
}

export function PipelineView({ depth, penalty, step }: Props) {
  if (!step) {
    return <p className="notice notice--plain">Step through the simulation to see how the selected branch flows through the pipeline.</p>;
  }
  const result = buildTimeline({ depth, penalty, mispredicted: !step.correct, predictedTaken: step.predicted === 'T' });
  const heading = `Step ${step.step}, branch ${step.address} (${step.predictorLabel}): predicted ${step.predicted === 'T' ? 'TAKEN' : 'NOT TAKEN'}, actual ${step.actual === 'T' ? 'TAKEN' : 'NOT TAKEN'}, ${step.correct ? 'correct prediction' : 'misprediction'}.`;
  if (!result.ok) {
    return (
      <>
        <p className="pipeline-heading">{heading}</p>
        <p className="notice notice--warn">{result.reason}</p>
      </>
    );
  }
  return (
    <>
      <p className="pipeline-heading">{heading}</p>
      <TimelineGrid
        timeline={result.timeline}
        caption={`${depth}-stage pipeline, branch resolved ${penalty} cycle${penalty === 1 ? '' : 's'} after fetch (P = ${penalty}). Highlighted column: resolution cycle.`}
      />
      <p className="pipeline-summary">{timelineSummary(result.timeline)}</p>
    </>
  );
}
