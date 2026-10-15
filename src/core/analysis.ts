import { formatCpi, formatInt, formatPoints, plural } from './format';
import { computeMetrics, type CycleModel, type Metrics } from './metrics';
import { sameEvents } from './parser';
import type { SimulationState } from './simulator';
import type { StepRecord } from './types';

export interface PredictorSummary {
  readonly metrics: Metrics;
  /** Mispredictions on a branch's first execution (decided only by the initial state). */
  readonly coldMispredictions: number;
}

export interface Comparison {
  readonly processed: number;
  readonly total: number;
  readonly oneBit: PredictorSummary;
  readonly twoBit: PredictorSummary;
  /** 2-bit accuracy minus 1-bit accuracy, in percentage points. */
  readonly accuracyDifference: number | null;
  /** Deterministic sentences derived from the measured numbers. */
  readonly findings: readonly string[];
}

function summarise(sim: SimulationState, model: CycleModel): PredictorSummary {
  return {
    metrics: computeMetrics(sim.trace, sim.events.length, model),
    coldMispredictions: sim.trace.filter((r) => r.firstEncounter && !r.correct).length,
  };
}

/**
 * An isolated reversal is an execution whose outcome differs from both the previous
 * and the next execution of the same branch (e.g. the single N in T T N T T).
 * Returns, for each processed reversal that also has a processed follow-up, the
 * trace index of the reversal and of the next execution of that branch.
 */
export function isolatedReversals(trace: readonly StepRecord[]): { at: number; next: number }[] {
  const byAddress = new Map<string, number[]>();
  trace.forEach((r, i) => {
    const list = byAddress.get(r.address) ?? [];
    list.push(i);
    byAddress.set(r.address, list);
  });
  const found: { at: number; next: number }[] = [];
  for (const indices of byAddress.values()) {
    for (let k = 1; k + 1 < indices.length; k++) {
      const prev = trace[indices[k - 1]].actual;
      const cur = trace[indices[k]].actual;
      const next = trace[indices[k + 1]].actual;
      if (cur !== prev && next === prev) found.push({ at: indices[k], next: indices[k + 1] });
    }
  }
  return found.sort((a, b) => a.at - b.at);
}

export function comparePredictors(oneBit: SimulationState, twoBit: SimulationState, model: CycleModel): Comparison {
  if (oneBit.kind !== 'one-bit' || twoBit.kind !== 'two-bit') {
    throw new Error('comparePredictors expects a 1-bit and a 2-bit simulation');
  }
  if (!sameEvents(oneBit.events, twoBit.events) || oneBit.position !== twoBit.position) {
    throw new Error('Both predictors must be at the same point of the same branch sequence');
  }

  const one = summarise(oneBit, model);
  const two = summarise(twoBit, model);
  const processed = oneBit.position;
  const total = oneBit.events.length;
  const accuracyDifference =
    one.metrics.accuracy === null || two.metrics.accuracy === null ? null : two.metrics.accuracy - one.metrics.accuracy;

  const findings: string[] = [];
  if (processed === 0) {
    findings.push('No branches have been processed yet. Press Step Forward or Run Simulation to compare the predictors.');
    return { processed, total, oneBit: one, twoBit: two, accuracyDifference, findings };
  }

  const scope = processed === total ? `For this sequence (${plural(total, 'branch', 'branches')})` : `After ${processed} of ${total} branches`;
  const m1 = one.metrics.mispredictions;
  const m2 = two.metrics.mispredictions;
  if (m1 === m2) {
    findings.push(`${scope}, both predictors made the same number of mispredictions (${m1}), so their accuracy is identical.`);
  } else {
    const better = m2 < m1 ? '2-bit' : '1-bit';
    const diff = Math.abs(m1 - m2);
    findings.push(
      `${scope}, the ${better} predictor made ${plural(diff, 'fewer misprediction', 'fewer mispredictions')} (1-bit: ${m1}, 2-bit: ${m2}). ` +
        `Accuracy difference (2-bit − 1-bit): ${formatPoints(accuracyDifference)}.`,
    );
  }

  const c1 = one.metrics.cycles;
  const c2 = two.metrics.cycles;
  if (c1 && c2) {
    if (model.penalty === 0) {
      findings.push('The misprediction penalty is set to 0 cycles, so mispredictions do not change the estimated cycle count.');
    } else if (m1 !== m2) {
      findings.push(
        `At P = ${model.penalty} cycles per misprediction, that is ${plural(Math.abs(c1.penaltyCycles - c2.penaltyCycles), 'cycle')} of difference ` +
          `(estimated ${formatInt(c1.estimatedCycles)} vs ${formatInt(c2.estimatedCycles)} cycles; CPI ${formatCpi(c1.cpi)} vs ${formatCpi(c2.cpi)} for I = ${formatInt(model.instructions)}).`,
      );
    }
  } else {
    findings.push('Cycle and CPI comparisons are unavailable until the cycle model parameters are valid.');
  }

  if (one.coldMispredictions + two.coldMispredictions > 0) {
    findings.push(
      `Mispredictions on a branch's first execution, where only the initial state decides the prediction: 1-bit ${one.coldMispredictions}, 2-bit ${two.coldMispredictions}.`,
    );
  }

  const reversals = isolatedReversals(oneBit.trace);
  if (reversals.length > 0) {
    const followUpMiss = (trace: readonly StepRecord[]) => reversals.filter((r) => !trace[r.next].correct).length;
    findings.push(
      `The processed part of the sequence contains ${plural(reversals.length, 'isolated reversal')} (a single outcome that differs from the executions of the same branch before and after it). ` +
        `The next execution of that branch was mispredicted after ${followUpMiss(oneBit.trace)} of them by the 1-bit predictor and after ${followUpMiss(twoBit.trace)} by the 2-bit predictor.`,
    );
  }

  findings.push('These numbers describe only this sequence and these initial states; a different pattern or initialization can change which predictor does better.');
  return { processed, total, oneBit: one, twoBit: two, accuracyDifference, findings };
}
