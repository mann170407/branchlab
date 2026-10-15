import { useEffect, useRef } from 'react';
import type { SimulationState } from '../core/simulator';
import type { PredictorKind, StepRecord } from '../core/types';
import { OutcomeTag, ResultTag, StateValue } from './common';

interface SelectProps {
  selectedStep: number | null;
  onSelectStep: (step: number) => void;
}

/** Keep the newest row in view inside the scroll container (not the page). */
function useFollowLatest(length: number) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef(length);
  useEffect(() => {
    const el = ref.current;
    if (el && length > prev.current) el.scrollTop = el.scrollHeight;
    prev.current = length;
  }, [length]);
  return ref;
}

function StepButton({ step, selected, onSelect }: { step: number; selected: boolean; onSelect: (s: number) => void }) {
  return (
    <button
      type="button"
      className="step-btn"
      aria-pressed={selected}
      aria-label={`Step ${step}${selected ? ' (shown in pipeline view)' : ''}: show in pipeline view`}
      onClick={() => onSelect(step)}
    >
      {step}
    </button>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="trace__empty">
        No branches processed yet. Press <strong>Step Forward</strong> to resolve one branch or <strong>Run Simulation</strong> to process them all.
      </td>
    </tr>
  );
}

export function TraceTable({ sim, selectedStep, onSelectStep }: { sim: SimulationState } & SelectProps) {
  const kind: PredictorKind = sim.kind;
  const ref = useFollowLatest(sim.trace.length);
  const stateHeading = kind === 'one-bit' ? 'bit' : 'counter';
  return (
    <div className="table-scroll trace" ref={ref} tabIndex={0} aria-label="Execution trace (scrollable)">
      <table className="data-table">
        <caption className="sr-only">
          Execution trace for the {kind === 'one-bit' ? '1-bit' : '2-bit'} predictor. Select a step number to show it in the pipeline view.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="num">Step</th>
            <th scope="col">Branch</th>
            <th scope="col">Actual</th>
            <th scope="col">Predicted</th>
            <th scope="col">Result</th>
            <th scope="col">State before ({stateHeading})</th>
            <th scope="col">State after ({stateHeading})</th>
            <th scope="col" className="num">Cum. mispredictions</th>
          </tr>
        </thead>
        <tbody>
          {sim.trace.length === 0 && <EmptyRow colSpan={8} />}
          {sim.trace.map((r: StepRecord) => (
            <tr key={r.step} className={`${r.correct ? '' : 'row--miss'} ${selectedStep === r.step ? 'row--selected' : ''}`}>
              <td className="num">
                <StepButton step={r.step} selected={selectedStep === r.step} onSelect={onSelectStep} />
              </td>
              <td className="mono">{r.address}</td>
              <td>
                <OutcomeTag outcome={r.actual} />
              </td>
              <td>
                <OutcomeTag outcome={r.predicted} />
              </td>
              <td>
                <ResultTag correct={r.correct} />
              </td>
              <td>
                <StateValue kind={kind} state={r.stateBefore} showName={kind === 'two-bit'} />
                {r.firstEncounter && <span className="init-note" title="First execution of this branch: the configured initial state was used">init</span>}
              </td>
              <td>
                <StateValue kind={kind} state={r.stateAfter} showName={kind === 'two-bit'} />
              </td>
              <td className="num mono">{r.cumulativeMispredictions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompareTraceTable({ oneBit, twoBit, selectedStep, onSelectStep }: { oneBit: SimulationState; twoBit: SimulationState } & SelectProps) {
  const ref = useFollowLatest(oneBit.trace.length);
  return (
    <div className="table-scroll trace" ref={ref} tabIndex={0} aria-label="Comparison execution trace (scrollable)">
      <table className="data-table data-table--compare">
        <caption className="sr-only">
          Execution trace of both predictors on the same branch events. Select a step number to show it in the pipeline view.
        </caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className="num">Step</th>
            <th scope="col" rowSpan={2}>Branch</th>
            <th scope="col" rowSpan={2}>Actual</th>
            <th scope="colgroup" colSpan={4} className="group group--one">1-bit predictor</th>
            <th scope="colgroup" colSpan={4} className="group group--two">2-bit predictor</th>
          </tr>
          <tr>
            <th scope="col" className="group-start">Pred.</th>
            <th scope="col">Result</th>
            <th scope="col">Before → after</th>
            <th scope="col" className="num">Cum. miss</th>
            <th scope="col" className="group-start">Pred.</th>
            <th scope="col">Result</th>
            <th scope="col">Before → after</th>
            <th scope="col" className="num">Cum. miss</th>
          </tr>
        </thead>
        <tbody>
          {oneBit.trace.length === 0 && <EmptyRow colSpan={11} />}
          {oneBit.trace.map((a, i) => {
            const b = twoBit.trace[i];
            return (
              <tr key={a.step} className={selectedStep === a.step ? 'row--selected' : ''}>
                <td className="num">
                  <StepButton step={a.step} selected={selectedStep === a.step} onSelect={onSelectStep} />
                </td>
                <td className="mono">{a.address}</td>
                <td>
                  <OutcomeTag outcome={a.actual} />
                </td>
                <td className={`group-start ${a.correct ? '' : 'cell--miss'}`}>
                  <OutcomeTag outcome={a.predicted} />
                </td>
                <td className={a.correct ? '' : 'cell--miss'}>
                  <ResultTag correct={a.correct} />
                </td>
                <td className="nowrap">
                  <StateValue kind="one-bit" state={a.stateBefore} showName={false} /> → <StateValue kind="one-bit" state={a.stateAfter} showName={false} />
                </td>
                <td className="num mono">{a.cumulativeMispredictions}</td>
                <td className={`group-start ${b.correct ? '' : 'cell--miss'}`}>
                  <OutcomeTag outcome={b.predicted} />
                </td>
                <td className={b.correct ? '' : 'cell--miss'}>
                  <ResultTag correct={b.correct} />
                </td>
                <td className="nowrap">
                  <StateValue kind="two-bit" state={b.stateBefore} showName={false} /> → <StateValue kind="two-bit" state={b.stateAfter} />
                </td>
                <td className="num mono">{b.cumulativeMispredictions}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
