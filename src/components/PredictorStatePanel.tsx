import { getPredictor, outcomeWord } from '../core/predictors';
import { entryFor, type SimulationState } from '../core/simulator';
import type { PredictorKind } from '../core/types';
import { OutcomeTag, StateValue } from './common';
import { StateDiagram, type Transition } from './StateDiagram';

export type ViewMode = PredictorKind | 'compare';

interface Props {
  view: ViewMode;
  oneBit: SimulationState;
  twoBit: SimulationState;
  addresses: readonly string[];
  /** Address chosen by the user, or null to follow the most recent step. */
  selectedAddress: string | null;
  onSelectAddress: (address: string | null) => void;
}

function lastTransition(sim: SimulationState, address: string): Transition | null {
  for (let i = sim.trace.length - 1; i >= 0; i--) {
    const r = sim.trace[i];
    if (r.address === address) return { from: r.stateBefore, to: r.stateAfter, outcome: r.actual };
  }
  return null;
}

function DiagramBlock({ sim, address }: { sim: SimulationState; address: string }) {
  const predictor = getPredictor(sim.kind);
  const { state, seen } = entryFor(sim, address);
  const transition = lastTransition(sim, address);
  const lastRecord = sim.trace[sim.trace.length - 1];
  const justUpdated = lastRecord?.address === address;
  return (
    <figure className="diagram-block">
      <figcaption>
        <span className="diagram-block__title">{sim.kind === 'one-bit' ? '1-bit predictor' : '2-bit saturating counter'}</span>
        <span className="diagram-block__status">
          Branch <span className="mono">{address}</span>: state <StateValue kind={sim.kind} state={state} showName={false} /> ({predictor.stateName(state)})
          {!seen && ' (initial, not executed yet)'} → next prediction <strong>{outcomeWord(predictor.predict(state))}</strong>
        </span>
      </figcaption>
      <StateDiagram kind={sim.kind} current={state} currentIsInitial={!seen} lastTransition={transition} />
      <p className="diagram-block__note">
        {transition
          ? `${justUpdated ? `Step ${lastRecord.step}` : `Last execution of ${address}`}: actual ${outcomeWord(transition.outcome)} moved the ${sim.kind === 'one-bit' ? 'bit' : 'counter'} ${predictor.formatState(transition.from)} → ${predictor.formatState(transition.to)} (highlighted arrow).`
          : `No execution of ${address} yet. Its entry will start at the configured initial state.`}
      </p>
    </figure>
  );
}

export function PredictorStatePanel({ view, oneBit, twoBit, addresses, selectedAddress, onSelectAddress }: Props) {
  const latest = oneBit.trace[oneBit.trace.length - 1];
  const address = selectedAddress ?? latest?.address ?? addresses[0];
  const showOne = view !== 'two-bit';
  const showTwo = view !== 'one-bit';
  const executions = (a: string) => oneBit.trace.filter((r) => r.address === a).length;

  if (!address) return null;

  return (
    <div className="state-panel">
      {addresses.length > 1 && (
        <div className="field field--inline">
          <label htmlFor="address-select">Branch shown in diagram</label>
          <select
            id="address-select"
            value={selectedAddress ?? ''}
            onChange={(e) => onSelectAddress(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Follow latest step{latest ? ` (${latest.address})` : ''}</option>
            {addresses.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={`diagram-grid ${showOne && showTwo ? 'diagram-grid--two' : ''}`}>
        {showOne && <DiagramBlock sim={oneBit} address={address} />}
        {showTwo && <DiagramBlock sim={twoBit} address={address} />}
      </div>

      <div className="table-scroll table-scroll--short">
        <table className="data-table">
          <caption className="caption">
            Predictor table: one independent entry per branch address. Entries are created with the initial state on first execution.
          </caption>
          <thead>
            <tr>
              <th scope="col">Branch</th>
              <th scope="col" className="num">Executions</th>
              {showOne && <th scope="col">1-bit entry</th>}
              {showOne && <th scope="col">1-bit next</th>}
              {showTwo && <th scope="col">2-bit entry</th>}
              {showTwo && <th scope="col">2-bit next</th>}
            </tr>
          </thead>
          <tbody>
            {addresses.map((a) => {
              const e1 = entryFor(oneBit, a);
              const e2 = entryFor(twoBit, a);
              return (
                <tr key={a} className={a === address ? 'row--selected' : ''}>
                  <th scope="row" className="mono">
                    {addresses.length > 1 ? (
                      <button type="button" className="link-btn mono" aria-pressed={selectedAddress === a} onClick={() => onSelectAddress(a)}>
                        {a}
                      </button>
                    ) : (
                      a
                    )}
                  </th>
                  <td className="num mono">{executions(a)}</td>
                  {showOne && (
                    <td>
                      {e1.seen ? <StateValue kind="one-bit" state={e1.state} showName={false} /> : <span className="muted">empty (init {e1.state})</span>}
                    </td>
                  )}
                  {showOne && (
                    <td>
                      <OutcomeTag outcome={getPredictor('one-bit').predict(e1.state)} />
                    </td>
                  )}
                  {showTwo && (
                    <td>
                      {e2.seen ? (
                        <StateValue kind="two-bit" state={e2.state} />
                      ) : (
                        <span className="muted">empty (init {getPredictor('two-bit').formatState(e2.state)})</span>
                      )}
                    </td>
                  )}
                  {showTwo && (
                    <td>
                      <OutcomeTag outcome={getPredictor('two-bit').predict(e2.state)} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
