import { describe, expect, it } from 'vitest';
import { formatCpi, formatPercent } from './format';
import { computeMetrics, estimatedCycles, penaltyCycles, percentage, validateCycleModel } from './metrics';
import { parseSequence } from './parser';
import { createSimulation, simulate, stepSimulation } from './simulator';

const events = (() => {
  const r = parseSequence('T T N T T T N T');
  if (!r.ok) throw new Error();
  return r.events;
})();

describe('accuracy (case 10)', () => {
  it('computes accuracy and misprediction rate from the trace', () => {
    const sim = simulate('one-bit', 0, events); // misses: steps 1, 3, 4, 7, 8 -> 5
    const m = computeMetrics(sim.trace, events.length, { instructions: 40, pipelineDepth: 5, penalty: 2 });
    expect(m).toMatchObject({ processed: 8, correct: 3, mispredictions: 5, complete: true });
    expect(m.accuracy).toBeCloseTo(37.5);
    expect(m.mispredictionRate).toBeCloseTo(62.5);
  });

  it('returns null rather than NaN when nothing is processed', () => {
    const m = computeMetrics([], 8, { instructions: 40, pipelineDepth: 5, penalty: 2 });
    expect(m.accuracy).toBeNull();
    expect(m.mispredictionRate).toBeNull();
    expect(formatPercent(m.accuracy)).toBe('—');
    expect(percentage(0, 0)).toBeNull();
  });
});

describe('cycle model (case 11)', () => {
  it('computes penalty cycles as M x P', () => {
    expect(penaltyCycles(5, 3)).toBe(15);
    expect(penaltyCycles(0, 3)).toBe(0);
  });

  it('computes I + (L - 1) + M x P and CPI = cycles / I', () => {
    const sim = simulate('two-bit', 1, events);
    const model = { instructions: 40, pipelineDepth: 5, penalty: 2 };
    const m = computeMetrics(sim.trace, events.length, model);
    const M = sim.mispredictions;
    expect(m.cycles).toEqual({
      instructions: 40,
      baseCycles: 44,
      penaltyCycles: 2 * M,
      estimatedCycles: 44 + 2 * M,
      cpi: (44 + 2 * M) / 40,
      idealCpi: 44 / 40,
    });
    expect(estimatedCycles(model, M)).toBe(44 + 2 * M);
  });

  it('uses the instruction count, not the branch count, for CPI', () => {
    const sim = simulate('one-bit', 0, events);
    const m = computeMetrics(sim.trace, events.length, { instructions: 100, pipelineDepth: 5, penalty: 3 });
    expect(m.cycles?.cpi).toBeCloseTo((104 + 15) / 100);
    expect(formatCpi(m.cycles!.cpi)).toBe('1.190');
  });

  it('updates metrics during step-by-step execution', () => {
    let sim = createSimulation('one-bit', 0, events);
    const model = { instructions: 40, pipelineDepth: 5, penalty: 2 };
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      sim = stepSimulation(sim);
      seen.push(computeMetrics(sim.trace, events.length, model).cycles!.penaltyCycles);
    }
    expect(seen).toEqual([2, 2, 4]);
    expect(computeMetrics(sim.trace, events.length, model).complete).toBe(false);
  });

  it('validates parameters and requires I >= number of branches', () => {
    expect(validateCycleModel({ instructions: 40, pipelineDepth: 5, penalty: 2 }, 8)).toEqual({});
    expect(validateCycleModel({ instructions: 4, pipelineDepth: 5, penalty: 2 }, 8).instructions).toMatch(/at least/);
    expect(validateCycleModel({ instructions: 40, pipelineDepth: 0, penalty: 2 }, 8).pipelineDepth).toBeDefined();
    expect(validateCycleModel({ instructions: 40, pipelineDepth: 5, penalty: -1 }, 8).penalty).toBeDefined();
    expect(validateCycleModel({ instructions: 40.5, pipelineDepth: 5, penalty: 1 }, 8).instructions).toMatch(/whole/);
    expect(validateCycleModel({ instructions: NaN, pipelineDepth: 5, penalty: 1 }, 8).instructions).toBeDefined();
  });

  it('omits cycle estimates when the model is invalid', () => {
    const sim = simulate('one-bit', 0, events);
    expect(computeMetrics(sim.trace, events.length, { instructions: 2, pipelineDepth: 5, penalty: 2 }).cycles).toBeNull();
  });
});
