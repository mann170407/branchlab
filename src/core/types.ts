/** Resolved direction of a conditional branch. */
export type Outcome = 'T' | 'N';

export type PredictorKind = 'one-bit' | 'two-bit';

/** 1-bit predictor: 0 = predict NOT TAKEN, 1 = predict TAKEN. */
export type OneBitState = 0 | 1;

/** 2-bit saturating counter: 0 = 00 (SNT), 1 = 01 (WNT), 2 = 10 (WT), 3 = 11 (ST). */
export type TwoBitState = 0 | 1 | 2 | 3;

export type PredictorState = OneBitState | TwoBitState;

/** One dynamic execution of a conditional branch, as read from the input sequence. */
export interface BranchEvent {
  /** 1-based position in the sequence. */
  readonly seq: number;
  /** Branch address / identifier (normalised, e.g. "B1" or "0x40A0"). */
  readonly address: string;
  /** Actual resolved outcome. */
  readonly outcome: Outcome;
}

/** Everything that happened when one branch event was predicted and then resolved. */
export interface StepRecord {
  /** 1-based step number. */
  readonly step: number;
  readonly address: string;
  readonly actual: Outcome;
  /** Prediction made from `stateBefore`, before the outcome was known. */
  readonly predicted: Outcome;
  readonly correct: boolean;
  /** Predictor entry for this address when the prediction was made. */
  readonly stateBefore: PredictorState;
  /** Predictor entry after updating with the actual outcome. */
  readonly stateAfter: PredictorState;
  /** Mispredictions so far, including this step. */
  readonly cumulativeMispredictions: number;
  /** True when this address had no entry yet, so `stateBefore` is the configured initial state. */
  readonly firstEncounter: boolean;
}
