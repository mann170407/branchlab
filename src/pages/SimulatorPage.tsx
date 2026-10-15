import { useMemo, useReducer, useRef, useState } from 'react';
import { comparePredictors } from '../core/analysis';
import { EXPERIMENTS, findExperiment } from '../core/experiments';
import { computeMetrics, DEFAULT_CYCLE_MODEL, hasErrors, validateCycleModel, type CycleModel } from '../core/metrics';
import { DEFAULT_ADDRESS, parseSequence, sameEvents } from '../core/parser';
import { getPredictor, outcomeWord } from '../core/predictors';
import { initialSession, isFinished, isStale, progress, sessionReducer } from '../core/session';
import { entryFor } from '../core/simulator';
import type { OneBitState, TwoBitState } from '../core/types';
import { OutcomeTag, Panel } from '../components/common';
import { ComparisonPanel } from '../components/ComparisonPanel';
import { MetricsPanel } from '../components/MetricsPanel';
import { PipelineView } from '../components/PipelineView';
import { PredictorStatePanel, type ViewMode } from '../components/PredictorStatePanel';
import { CompareTraceTable, TraceTable } from '../components/TraceTable';

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'one-bit', label: '1-bit' },
  { value: 'two-bit', label: '2-bit' },
  { value: 'compare', label: 'Compare both' },
];

const ONE_BIT_INIT_TEXT: Record<OneBitState, string> = {
  0: 'Every branch starts with bit 0: its first execution is predicted NOT TAKEN. One TAKEN outcome sets the bit to 1.',
  1: 'Every branch starts with bit 1: its first execution is predicted TAKEN. One NOT TAKEN outcome clears the bit to 0.',
};

const TWO_BIT_INIT_TEXT: Record<TwoBitState, string> = {
  0: 'Every branch starts at 00 (Strongly Not Taken): predicted NOT TAKEN, and two TAKEN outcomes in a row are needed before it predicts TAKEN.',
  1: 'Every branch starts at 01 (Weakly Not Taken): predicted NOT TAKEN, but a single TAKEN outcome moves it to 10 and flips the prediction.',
  2: 'Every branch starts at 10 (Weakly Taken): predicted TAKEN, but a single NOT TAKEN outcome moves it to 01 and flips the prediction.',
  3: 'Every branch starts at 11 (Strongly Taken): predicted TAKEN, and two NOT TAKEN outcomes in a row are needed before it predicts NOT TAKEN.',
};

type ModelText = Record<keyof CycleModel, string>;

function toModel(text: ModelText): CycleModel {
  const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
  return { instructions: num(text.instructions), pipelineDepth: num(text.pipelineDepth), penalty: num(text.penalty) };
}

export function SimulatorPage() {
  const [session, dispatch] = useReducer(sessionReducer, undefined, () =>
    initialSession({ text: EXPERIMENTS[0].sequence, initOneBit: 0, initTwoBit: 1 }),
  );
  const [view, setView] = useState<ViewMode>('one-bit');
  const [experimentId, setExperimentId] = useState(EXPERIMENTS[0].id);
  const [modelText, setModelText] = useState<ModelText>({
    instructions: String(DEFAULT_CYCLE_MODEL.instructions),
    pipelineDepth: String(DEFAULT_CYCLE_MODEL.pipelineDepth),
    penalty: String(DEFAULT_CYCLE_MODEL.penalty),
  });
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [pipelinePredictor, setPipelinePredictor] = useState<'one-bit' | 'two-bit'>('two-bit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { draft, loaded } = session;
  const parsed = useMemo(() => parseSequence(draft.text), [draft.text]);
  const stale = isStale(session);
  const finished = isFinished(loaded);
  const position = progress(loaded);
  const total = loaded?.events.length ?? 0;

  const model = toModel(modelText);
  const modelErrors = validateCycleModel(model, total);
  const modelValid = !hasErrors(modelErrors);

  const experiment = findExperiment(experimentId) ?? EXPERIMENTS[0];
  const loadedExperiment = loaded
    ? EXPERIMENTS.find((e) => {
        if (!e.sequence) return false;
        const r = parseSequence(e.sequence);
        return r.ok && sameEvents(r.events, loaded.events);
      })
    : undefined;
  const addresses = useMemo(() => (loaded ? [...new Set(loaded.events.map((e) => e.address))] : []), [loaded]);

  const canStartFresh = parsed.ok;
  const canStep = stale ? canStartFresh : loaded !== null && !finished;
  const canRun = stale ? canStartFresh : loaded !== null;
  const canReset = (stale && canStartFresh) || position > 0;
  const runLabel = !stale && finished ? 'Re-run Simulation' : 'Run Simulation';

  const staleReasons: string[] = [];
  if (loaded && stale) {
    if (!parsed.ok || !sameEvents(parsed.events, loaded.events)) staleReasons.push('branch sequence');
    if (draft.initOneBit !== loaded.initOneBit) staleReasons.push('1-bit initial state');
    if (draft.initTwoBit !== loaded.initTwoBit) staleReasons.push('2-bit initial state');
  }

  const keepAddress = (events: readonly { address: string }[]) => {
    if (selectedAddress && !events.some((e) => e.address === selectedAddress)) setSelectedAddress(null);
  };

  const act = (type: 'step' | 'run' | 'reset') => {
    if (stale && parsed.ok) keepAddress(parsed.events);
    setSelectedStep(null);
    dispatch({ type });
  };

  const loadExperiment = () => {
    setSelectedStep(null);
    if (!experiment.sequence) {
      dispatch({ type: 'clearInput' });
      textareaRef.current?.focus();
      return;
    }
    const r = parseSequence(experiment.sequence);
    if (r.ok) keepAddress(r.events);
    dispatch({ type: 'loadSequence', text: experiment.sequence });
  };

  const comparison = loaded ? comparePredictors(loaded.oneBit, loaded.twoBit, model) : null;
  const activeSim = loaded ? (view === 'one-bit' ? loaded.oneBit : view === 'two-bit' ? loaded.twoBit : null) : null;

  const shownStep = selectedStep !== null && selectedStep <= position ? selectedStep : position > 0 ? position : null;
  const pipelineKind = view === 'compare' ? pipelinePredictor : view;
  const pipelineRecord = loaded && shownStep ? (pipelineKind === 'one-bit' ? loaded.oneBit : loaded.twoBit).trace[shownStep - 1] : null;

  const nextEvent = loaded && !finished ? loaded.events[position] : null;
  const instructionsNote =
    modelValid && total > 0
      ? model.instructions === total
        ? `I equals the number of branches (${total}), so this run assumes every instruction is a branch.`
        : `The sequence holds ${total} branch executions. The other ${(model.instructions - total).toLocaleString('en-US')} of the I = ${model.instructions.toLocaleString('en-US')} instructions are non-branch instructions, assumed never to stall.`
      : null;

  return (
    <div className="sim-layout">
      <div className="sim-toolbar">
        <section className="control-bar" aria-label="Simulation controls">
          <div className="control-bar__buttons">
            <button type="button" className="btn btn--primary" onClick={() => act('step')} disabled={!canStep}>
              Step Forward
            </button>
            <button type="button" className="btn" onClick={() => act('run')} disabled={!canRun}>
              {runLabel}
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => act('reset')} disabled={!canReset}>
              Reset
            </button>
          </div>
          <div className="control-bar__status" aria-live="polite">
            {loaded ? (
              <>
                <span className="mono">
                  {position} / {total}
                </span>{' '}
                branches resolved{finished ? ' · complete' : ''}
                <span className="control-bar__source">
                  {loadedExperiment ? `Experiment ${loadedExperiment.letter}: ${loadedExperiment.title}` : 'Custom sequence'}
                </span>
              </>
            ) : (
              'Enter a valid sequence to begin.'
            )}
          </div>
          <div className="progress" aria-hidden="true">
            <div className="progress__bar" style={{ width: total ? `${(position / total) * 100}%` : '0%' }} />
          </div>
        </section>

        {loaded && stale && (
          <div className="notice notice--warn" role="status">
            <p>
              You changed the {staleReasons.join(', ') || 'input'}. The results below still show the previous input.{' '}
              {parsed.ok
                ? 'Step Forward, Run Simulation or Reset will start over with your edits.'
                : 'Fix the problems in the sequence to run it, or revert your edits.'}
            </p>
            <button type="button" className="btn btn--quiet btn--small" onClick={() => dispatch({ type: 'revert' })}>
              Revert edits
            </button>
          </div>
        )}
      </div>

      <div className="sim-setup">
        <Panel title="Experiment" id="experiment">
          <div className="field">
            <label htmlFor="experiment-select">Built-in workload</label>
            <select id="experiment-select" value={experimentId} onChange={(e) => setExperimentId(e.target.value)}>
              {EXPERIMENTS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.letter}. {e.title}
                </option>
              ))}
            </select>
          </div>
          <dl className="experiment-info">
            {experiment.sequence && (
              <>
                <dt>Sequence</dt>
                <dd className="mono">{experiment.sequence}</dd>
              </>
            )}
            <dt>Represents</dt>
            <dd>{experiment.represents}</dd>
            <dt>Objective</dt>
            <dd>{experiment.objective}</dd>
            <dt>What to observe</dt>
            <dd>{experiment.observe}</dd>
          </dl>
          <button type="button" className="btn" onClick={loadExperiment}>
            {experiment.sequence ? 'Load Example' : 'Start custom sequence (clears input)'}
          </button>
        </Panel>

        <Panel title="Branch sequence" id="sequence">
          <div className="field">
            <label htmlFor="sequence-input">Branch outcomes, in execution order</label>
            <textarea
              id="sequence-input"
              ref={textareaRef}
              className="mono"
              rows={4}
              spellCheck={false}
              autoComplete="off"
              value={draft.text}
              aria-invalid={!parsed.ok}
              aria-describedby="sequence-help sequence-status"
              onChange={(e) => dispatch({ type: 'setText', text: e.target.value })}
            />
          </div>
          <div id="sequence-help" className="syntax-help">
            <p>
              <span className="mono">T</span> = taken, <span className="mono">N</span> = not taken, separated by spaces, commas or new lines. Case does not matter.
            </p>
            <p>
              Prefix an address to model several branches: <span className="mono">B1:T B2:N B1:N</span>. Addresses are names (<span className="mono">B1</span>,{' '}
              <span className="mono">loop_end</span>) or hex (<span className="mono">0x40A0</span>). Outcomes without an address belong to branch{' '}
              <span className="mono">{DEFAULT_ADDRESS}</span>.
            </p>
          </div>
          <div id="sequence-status" aria-live="polite">
            {parsed.ok ? (
              <p className="status status--ok">
                Valid: {parsed.events.length} branch execution{parsed.events.length === 1 ? '' : 's'}, {parsed.addresses.length} address
                {parsed.addresses.length === 1 ? '' : 'es'} ({parsed.addresses.slice(0, 6).join(', ')}
                {parsed.addresses.length > 6 ? ', …' : ''}).
              </p>
            ) : (
              <div className="status status--error" role="alert">
                <p>
                  {parsed.totalErrors === 1 ? 'The sequence has 1 problem:' : `The sequence has ${parsed.totalErrors} problems${parsed.totalErrors > parsed.errors.length ? ` (first ${parsed.errors.length} shown)` : ''}:`}
                </p>
                <ul>
                  {parsed.errors.map((e, i) => (
                    <li key={i}>
                      {e.tokenIndex > 0 && (
                        <>
                          Entry {e.tokenIndex} <span className="mono">"{e.token}"</span>:{' '}
                        </>
                      )}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn--quiet" onClick={() => dispatch({ type: 'clearInput' })} disabled={draft.text === ''}>
              Clear Input
            </button>
          </div>
        </Panel>

        <Panel title="Predictor" id="predictor">
          <fieldset className="segmented">
            <legend>Show results for</legend>
            {VIEW_OPTIONS.map((o) => (
              <label key={o.value} className={view === o.value ? 'is-checked' : ''}>
                <input type="radio" name="view" value={o.value} checked={view === o.value} onChange={() => setView(o.value)} />
                {o.label}
              </label>
            ))}
          </fieldset>
          <p className="hint">Both predictors always process the same events with separate tables, so switching views never changes the results.</p>

          <div className="field">
            <label htmlFor="init-one">1-bit initial prediction bit</label>
            <select
              id="init-one"
              value={draft.initOneBit}
              onChange={(e) => dispatch({ type: 'setInitOneBit', value: Number(e.target.value) as OneBitState })}
              aria-describedby="init-one-help"
            >
              <option value={0}>0: predict NOT TAKEN</option>
              <option value={1}>1: predict TAKEN</option>
            </select>
            <p className="hint" id="init-one-help">
              {ONE_BIT_INIT_TEXT[draft.initOneBit]}
            </p>
          </div>
          <div className="field">
            <label htmlFor="init-two">2-bit initial counter</label>
            <select
              id="init-two"
              value={draft.initTwoBit}
              onChange={(e) => dispatch({ type: 'setInitTwoBit', value: Number(e.target.value) as TwoBitState })}
              aria-describedby="init-two-help"
            >
              {getPredictor('two-bit').states.map((s) => (
                <option key={s} value={s}>
                  {getPredictor('two-bit').formatState(s)}: {getPredictor('two-bit').stateName(s)}
                </option>
              ))}
            </select>
            <p className="hint" id="init-two-help">
              {TWO_BIT_INIT_TEXT[draft.initTwoBit]}
            </p>
          </div>
        </Panel>

        <Panel title="Cycle model" id="model">
          <p className="formula">
            Cycles = I + (L − 1) + M × P &nbsp;·&nbsp; CPI = Cycles / I
          </p>
          <div className="field-grid">
            {(
              [
                ['instructions', 'Total instructions (I)', 'Dynamic instruction count, branches included'],
                ['pipelineDepth', 'Pipeline depth (L)', 'Stages; the pipeline fills once'],
                ['penalty', 'Penalty per misprediction (P)', 'Cycles lost per misprediction'],
              ] as const
            ).map(([key, label, help]) => (
              <div className="field" key={key}>
                <label htmlFor={`model-${key}`}>{label}</label>
                <input
                  id={`model-${key}`}
                  type="number"
                  inputMode="numeric"
                  className="mono"
                  min={key === 'penalty' ? 0 : 1}
                  step={1}
                  value={modelText[key]}
                  aria-invalid={Boolean(modelErrors[key])}
                  aria-describedby={`model-${key}-help`}
                  onChange={(e) => setModelText((m) => ({ ...m, [key]: e.target.value }))}
                />
                <p className={`hint ${modelErrors[key] ? 'hint--error' : ''}`} id={`model-${key}-help`}>
                  {modelErrors[key] ?? help}
                </p>
              </div>
            ))}
          </div>
          {modelErrors.instructions && total > 0 && Number.isFinite(model.instructions) && model.instructions < total && (
            <button type="button" className="btn btn--quiet" onClick={() => setModelText((m) => ({ ...m, instructions: String(total * 5) }))}>
              Set I = {total * 5} (branches are 20% of instructions)
            </button>
          )}
          {instructionsNote && <p className="hint">{instructionsNote}</p>}
          <details className="assumptions">
            <summary>Model assumptions</summary>
            <ul>
              <li>An ideal pipeline completes one instruction per cycle after a fill time of L − 1 cycles.</li>
              <li>Every misprediction costs exactly P cycles; correct predictions cost nothing.</li>
              <li>Data hazards, structural hazards, cache misses, branch target buffer misses and overlapping stalls are ignored.</li>
              <li>Real branch resolution stages and penalties vary by processor design. Results are estimates under this model, not hardware measurements.</li>
            </ul>
          </details>
        </Panel>
      </div>

      <div className="sim-results">
        {loaded && (
          <>
            <Panel title="Sequence" id="strip">
              <ol className="strip" aria-label="Branch sequence">
                {loaded.events.map((e, i) => {
                  const done = i < position;
                  const record = activeSim?.trace[i];
                  const miss = record ? !record.correct : false;
                  const status = !done ? (i === position ? 'next' : 'pending') : activeSim ? (miss ? 'mispredicted' : 'correct') : 'resolved';
                  return (
                    <li
                      key={i}
                      className={`strip__item strip__item--${status}`}
                      aria-label={`Step ${i + 1}: ${e.address} ${outcomeWord(e.outcome)}, ${status}`}
                      aria-current={i === position ? 'step' : undefined}
                    >
                      {e.address !== DEFAULT_ADDRESS && <span className="strip__addr">{e.address}</span>}
                      <span className="strip__outcome">{e.outcome}</span>
                      {done && activeSim && <span className="strip__mark">{miss ? '×' : '✓'}</span>}
                    </li>
                  );
                })}
              </ol>
              {nextEvent ? (
                <p className="next-event">
                  <strong>Next (step {position + 1}):</strong> branch <span className="mono">{nextEvent.address}</span>.{' '}
                  {(view === 'compare' ? [loaded.oneBit, loaded.twoBit] : [activeSim!]).map((sim) => {
                    const p = getPredictor(sim.kind);
                    const { state, seen } = entryFor(sim, nextEvent.address);
                    return (
                      <span key={sim.kind} className="next-event__item">
                        {sim.kind === 'one-bit' ? '1-bit' : '2-bit'} entry <span className="mono">{p.formatState(state)}</span>
                        {seen ? '' : ' (initial)'} will predict <OutcomeTag outcome={p.predict(state)} />.{' '}
                      </span>
                    );
                  })}
                  Actual outcome in the sequence: <OutcomeTag outcome={nextEvent.outcome} />.
                </p>
              ) : (
                <p className="next-event">All branches resolved. Use Re-run Simulation or Reset to start again.</p>
              )}
            </Panel>

            {view === 'compare' && comparison ? (
              <Panel title="Predictor comparison" id="comparison">
                <ComparisonPanel comparison={comparison} />
              </Panel>
            ) : (
              activeSim && (
                <Panel title={`Performance: ${getPredictor(activeSim.kind).label}`} id="metrics">
                  <MetricsPanel
                    metrics={computeMetrics(activeSim.trace, total, model)}
                    model={model}
                    label={getPredictor(activeSim.kind).label}
                  />
                </Panel>
              )
            )}

            <Panel
              title="Predictor state"
              id="state"
              description={
                <>
                  Arrows above the states are taken on an actual TAKEN outcome, arrows below on NOT TAKEN. The highlighted state is the selected branch's
                  current entry; the highlighted arrow is its most recent update.
                </>
              }
            >
              <PredictorStatePanel
                view={view}
                oneBit={loaded.oneBit}
                twoBit={loaded.twoBit}
                addresses={addresses}
                selectedAddress={selectedAddress}
                onSelectAddress={setSelectedAddress}
              />
            </Panel>

            <Panel
              title="Execution trace"
              id="trace"
              description="Each row is one branch: the prediction is made from the state before, then the entry is updated with the actual outcome."
            >
              {view === 'compare' ? (
                <CompareTraceTable oneBit={loaded.oneBit} twoBit={loaded.twoBit} selectedStep={shownStep} onSelectStep={setSelectedStep} />
              ) : (
                <TraceTable sim={activeSim!} selectedStep={shownStep} onSelectStep={setSelectedStep} />
              )}
            </Panel>

            <Panel
              title="Pipeline view"
              id="pipeline"
              actions={
                view === 'compare' ? (
                  <div className="field field--inline">
                    <label htmlFor="pipeline-predictor">Predictor</label>
                    <select id="pipeline-predictor" value={pipelinePredictor} onChange={(e) => setPipelinePredictor(e.target.value as 'one-bit' | 'two-bit')}>
                      <option value="one-bit">1-bit</option>
                      <option value="two-bit">2-bit</option>
                    </select>
                  </div>
                ) : undefined
              }
              description="Timing of the selected trace step (latest by default; select a step number in the trace to change it), using L and P from the cycle model."
            >
              {modelValid ? (
                <PipelineView
                  depth={model.pipelineDepth}
                  penalty={model.penalty}
                  step={
                    pipelineRecord
                      ? {
                          step: pipelineRecord.step,
                          address: pipelineRecord.address,
                          predicted: pipelineRecord.predicted,
                          actual: pipelineRecord.actual,
                          correct: pipelineRecord.correct,
                          predictorLabel: pipelineKind === 'one-bit' ? '1-bit' : '2-bit',
                        }
                      : null
                  }
                />
              ) : (
                <p className="notice notice--plain">Fix the cycle model parameters to draw the pipeline timing.</p>
              )}
            </Panel>
          </>
        )}

        {!loaded && (
          <div className="notice notice--plain">
            Nothing is loaded yet. Enter a valid branch sequence or load an example, then press Step Forward or Run Simulation.
          </div>
        )}
      </div>
    </div>
  );
}
