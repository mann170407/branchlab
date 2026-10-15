import type { OneBitState, Outcome, PredictorKind, PredictorState, TwoBitState } from './types';

/**
 * A branch predictor algorithm for a single table entry.
 * `predict` and `update` are pure: the simulator owns the per-address table.
 */
export interface PredictorAlgorithm<S extends PredictorState = PredictorState> {
  readonly kind: PredictorKind;
  readonly label: string;
  readonly bits: 1 | 2;
  /** All legal states, in ascending order. */
  readonly states: readonly S[];
  /** Prediction derived only from the current (old) state. */
  predict(state: S): Outcome;
  /** Next state after the branch resolves with `actual`. */
  update(state: S, actual: Outcome): S;
  /** Binary rendering of the state, e.g. "1" or "10". */
  formatState(state: S): string;
  /** Human-readable state name. */
  stateName(state: S): string;
  /** Short state name for compact tables. */
  stateShort(state: S): string;
}

export const oneBitPredictor: PredictorAlgorithm<OneBitState> = {
  kind: 'one-bit',
  label: '1-bit predictor',
  bits: 1,
  states: [0, 1],
  predict: (state) => (state === 1 ? 'T' : 'N'),
  // The bit simply records the most recent outcome of this branch.
  update: (_state, actual) => (actual === 'T' ? 1 : 0),
  formatState: (state) => String(state),
  stateName: (state) => (state === 1 ? 'Predict Taken' : 'Predict Not Taken'),
  stateShort: (state) => (state === 1 ? 'PT' : 'PNT'),
};

const TWO_BIT_NAMES = ['Strongly Not Taken', 'Weakly Not Taken', 'Weakly Taken', 'Strongly Taken'] as const;
const TWO_BIT_SHORT = ['SNT', 'WNT', 'WT', 'ST'] as const;

export const twoBitPredictor: PredictorAlgorithm<TwoBitState> = {
  kind: 'two-bit',
  label: '2-bit saturating counter',
  bits: 2,
  states: [0, 1, 2, 3],
  // 10 and 11 predict TAKEN; 00 and 01 predict NOT TAKEN.
  predict: (state) => (state >= 2 ? 'T' : 'N'),
  update: (state, actual) => {
    if (actual === 'T') return state === 3 ? 3 : ((state + 1) as TwoBitState); // saturate at 11
    return state === 0 ? 0 : ((state - 1) as TwoBitState); // saturate at 00
  },
  formatState: (state) => state.toString(2).padStart(2, '0'),
  stateName: (state) => TWO_BIT_NAMES[state],
  stateShort: (state) => TWO_BIT_SHORT[state],
};

export function getPredictor(kind: PredictorKind): PredictorAlgorithm {
  return (kind === 'one-bit' ? oneBitPredictor : twoBitPredictor) as PredictorAlgorithm;
}

export function isValidState(kind: PredictorKind, state: number): state is PredictorState {
  return (getPredictor(kind).states as readonly number[]).includes(state);
}

export function outcomeWord(outcome: Outcome): string {
  return outcome === 'T' ? 'TAKEN' : 'NOT TAKEN';
}
