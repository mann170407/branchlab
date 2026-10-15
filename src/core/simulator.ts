import { getPredictor, isValidState } from './predictors';
import type { BranchEvent, PredictorKind, PredictorState, StepRecord } from './types';

/**
 * Immutable snapshot of one predictor working through a sequence.
 * Each step produces a new snapshot; nothing is shared with other simulations
 * except the (read-only) event list.
 */
export interface SimulationState {
  readonly kind: PredictorKind;
  /** State given to an address the first time it is seen. */
  readonly initialState: PredictorState;
  readonly events: readonly BranchEvent[];
  /** Number of events already processed (index of the next event). */
  readonly position: number;
  /** Per-address predictor table (one entry per branch address, no aliasing). */
  readonly table: ReadonlyMap<string, PredictorState>;
  readonly trace: readonly StepRecord[];
  readonly mispredictions: number;
}

export function createSimulation(
  kind: PredictorKind,
  initialState: PredictorState,
  events: readonly BranchEvent[],
): SimulationState {
  if (!isValidState(kind, initialState)) {
    throw new RangeError(`Invalid initial state ${initialState} for ${kind} predictor`);
  }
  return { kind, initialState, events, position: 0, table: new Map(), trace: [], mispredictions: 0 };
}

export function isComplete(sim: SimulationState): boolean {
  return sim.position >= sim.events.length;
}

/** Current table entry for `address`, falling back to the initial state for unseen branches. */
export function entryFor(sim: SimulationState, address: string): { state: PredictorState; seen: boolean } {
  const stored = sim.table.get(address);
  return stored === undefined ? { state: sim.initialState, seen: false } : { state: stored, seen: true };
}

/**
 * Process exactly one branch event:
 *   1. read this address's entry (old state),
 *   2. predict from the old state,
 *   3. compare with the actual outcome,
 *   4. update the entry with the actual outcome.
 * Returns `sim` unchanged when the sequence is already complete.
 */
export function stepSimulation(sim: SimulationState): SimulationState {
  if (isComplete(sim)) return sim;
  const predictor = getPredictor(sim.kind);
  const event = sim.events[sim.position];

  const { state: before, seen } = entryFor(sim, event.address);
  const predicted = predictor.predict(before);
  const correct = predicted === event.outcome;
  const after = predictor.update(before, event.outcome);
  const mispredictions = sim.mispredictions + (correct ? 0 : 1);

  const table = new Map(sim.table);
  table.set(event.address, after);

  const record: StepRecord = {
    step: sim.position + 1,
    address: event.address,
    actual: event.outcome,
    predicted,
    correct,
    stateBefore: before,
    stateAfter: after,
    cumulativeMispredictions: mispredictions,
    firstEncounter: !seen,
  };

  return { ...sim, position: sim.position + 1, table, trace: [...sim.trace, record], mispredictions };
}

/** Process all remaining events using the same step logic. */
export function runSimulation(sim: SimulationState): SimulationState {
  let current = sim;
  while (!isComplete(current)) current = stepSimulation(current);
  return current;
}

/** Fresh simulation with the same predictor, initial state and events. */
export function resetSimulation(sim: SimulationState): SimulationState {
  return createSimulation(sim.kind, sim.initialState, sim.events);
}

/** Convenience: simulate a whole sequence from a clean predictor. */
export function simulate(
  kind: PredictorKind,
  initialState: PredictorState,
  events: readonly BranchEvent[],
): SimulationState {
  return runSimulation(createSimulation(kind, initialState, events));
}
