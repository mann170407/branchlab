import type { StepRecord } from './types';

/**
 * Parameters of the simplified pipeline cycle model.
 *
 *   Base cycles      = I + (L - 1)          ideal pipeline: fill once, then 1 instruction/cycle
 *   Penalty cycles   = M x P
 *   Estimated cycles = I + (L - 1) + M x P
 *   CPI              = Estimated cycles / I
 */
export interface CycleModel {
  /** I: total dynamic instruction count (branches and non-branches). */
  readonly instructions: number;
  /** L: pipeline depth in stages. */
  readonly pipelineDepth: number;
  /** P: cycles lost per mispredicted branch. */
  readonly penalty: number;
}

export const DEFAULT_CYCLE_MODEL: CycleModel = { instructions: 40, pipelineDepth: 5, penalty: 2 };

export const MODEL_LIMITS = {
  instructions: { min: 1, max: 100_000_000 },
  pipelineDepth: { min: 1, max: 40 },
  penalty: { min: 0, max: 100 },
} as const;

export type CycleModelErrors = Partial<Record<keyof CycleModel, string>>;

/**
 * Validate model parameters. `sequenceBranches` is the full length of the branch
 * sequence: every branch is itself an instruction, so I can never be smaller.
 */
export function validateCycleModel(model: CycleModel, sequenceBranches: number): CycleModelErrors {
  const errors: CycleModelErrors = {};
  const check = (key: keyof CycleModel, label: string) => {
    const value = model[key];
    const { min, max } = MODEL_LIMITS[key];
    if (!Number.isFinite(value) || !Number.isInteger(value)) errors[key] = `${label} must be a whole number.`;
    else if (value < min || value > max) errors[key] = `${label} must be between ${min} and ${max.toLocaleString('en-US')}.`;
  };
  check('instructions', 'Total instructions (I)');
  check('pipelineDepth', 'Pipeline depth (L)');
  check('penalty', 'Penalty (P)');
  if (!errors.instructions && model.instructions < sequenceBranches) {
    errors.instructions = `Total instructions (I) must be at least the number of branches in the sequence (${sequenceBranches}), because every branch is an instruction.`;
  }
  return errors;
}

export function hasErrors(errors: CycleModelErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Percentage, or null when nothing has been processed (avoids NaN). */
export function percentage(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

export function penaltyCycles(mispredictions: number, penalty: number): number {
  return mispredictions * penalty;
}

export function baseCycles(instructions: number, pipelineDepth: number): number {
  return instructions + (pipelineDepth - 1);
}

export function estimatedCycles(model: CycleModel, mispredictions: number): number {
  return baseCycles(model.instructions, model.pipelineDepth) + penaltyCycles(mispredictions, model.penalty);
}

export interface CycleEstimate {
  readonly instructions: number;
  readonly baseCycles: number;
  readonly penaltyCycles: number;
  readonly estimatedCycles: number;
  /** Estimated cycles / I. */
  readonly cpi: number;
  /** CPI with zero mispredictions: (I + L - 1) / I. */
  readonly idealCpi: number;
}

export interface Metrics {
  /** Branches processed so far. */
  readonly processed: number;
  /** Branches in the whole sequence. */
  readonly total: number;
  readonly complete: boolean;
  readonly correct: number;
  readonly mispredictions: number;
  readonly accuracy: number | null;
  readonly mispredictionRate: number | null;
  /** Null when the cycle model parameters are invalid. */
  readonly cycles: CycleEstimate | null;
}

export function computeMetrics(trace: readonly StepRecord[], totalBranches: number, model: CycleModel): Metrics {
  const processed = trace.length;
  const mispredictions = trace.reduce((n, r) => n + (r.correct ? 0 : 1), 0);
  const correct = processed - mispredictions;

  let cycles: CycleEstimate | null = null;
  if (!hasErrors(validateCycleModel(model, totalBranches))) {
    const base = baseCycles(model.instructions, model.pipelineDepth);
    const penalty = penaltyCycles(mispredictions, model.penalty);
    cycles = {
      instructions: model.instructions,
      baseCycles: base,
      penaltyCycles: penalty,
      estimatedCycles: base + penalty,
      cpi: (base + penalty) / model.instructions,
      idealCpi: base / model.instructions,
    };
  }

  return {
    processed,
    total: totalBranches,
    complete: processed === totalBranches,
    correct,
    mispredictions,
    accuracy: percentage(correct, processed),
    mispredictionRate: percentage(mispredictions, processed),
    cycles,
  };
}
