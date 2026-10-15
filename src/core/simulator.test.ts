import { describe, expect, it } from 'vitest';
import { parseSequence } from './parser';
import {
  createSimulation,
  entryFor,
  isComplete,
  resetSimulation,
  runSimulation,
  simulate,
  stepSimulation,
} from './simulator';
import type { BranchEvent } from './types';

function ev(input: string): readonly BranchEvent[] {
  const r = parseSequence(input);
  if (!r.ok) throw new Error('bad test input');
  return r.events;
}

/** Compact trace rendering: "pred/actual before->after" per step. */
function compact(trace: { predicted: string; actual: string; stateBefore: number; stateAfter: number }[]) {
  return trace.map((r) => `${r.predicted}/${r.actual} ${r.stateBefore}->${r.stateAfter}`);
}

describe('1-bit simulation', () => {
  it('produces the textbook trace for T T N T', () => {
    const sim = simulate('one-bit', 0, ev('T T N T'));
    expect(compact([...sim.trace])).toEqual(['N/T 0->1', 'T/T 1->1', 'T/N 1->0', 'N/T 0->1']);
    expect(sim.mispredictions).toBe(3);
    expect(sim.trace.map((r) => r.cumulativeMispredictions)).toEqual([1, 1, 2, 3]);
  });

  it('reuses the stored state for the same branch address (case 3)', () => {
    const sim = simulate('one-bit', 0, ev('B1:T B1:T'));
    expect(sim.trace[1].stateBefore).toBe(sim.trace[0].stateAfter);
    expect(sim.trace[1].firstEncounter).toBe(false);
    expect(sim.trace[1].correct).toBe(true);
  });

  it('keeps independent state per address (case 4)', () => {
    const sim = simulate('one-bit', 0, ev('B1:T B2:N B1:T B2:N'));
    // B2's first execution must start from the initial state, unaffected by B1's update.
    expect(sim.trace[1]).toMatchObject({ address: 'B2', stateBefore: 0, firstEncounter: true });
    expect(sim.trace[2]).toMatchObject({ address: 'B1', stateBefore: 1 });
    expect(sim.trace[3]).toMatchObject({ address: 'B2', stateBefore: 0 });
    expect(sim.table.get('B1')).toBe(1);
    expect(sim.table.get('B2')).toBe(0);
  });

  it('uses the configured initial state for first encounters', () => {
    const sim = simulate('one-bit', 1, ev('B1:N B2:N'));
    expect(sim.trace.map((r) => r.predicted)).toEqual(['T', 'T']);
  });
});

describe('2-bit simulation', () => {
  it('produces the expected trace for T T N T from 01', () => {
    const sim = simulate('two-bit', 1, ev('T T N T'));
    expect(compact([...sim.trace])).toEqual(['N/T 1->2', 'T/T 2->3', 'T/N 3->2', 'T/T 2->3']);
    expect(sim.mispredictions).toBe(2);
  });

  it('keeps independent counters per address (case 4)', () => {
    const sim = simulate('two-bit', 1, ev('B1:T B2:N B1:T B2:N B1:N B2:T B1:T B2:N'));
    const b1 = sim.trace.filter((r) => r.address === 'B1');
    const b2 = sim.trace.filter((r) => r.address === 'B2');
    for (const list of [b1, b2]) {
      for (let i = 1; i < list.length; i++) expect(list[i].stateBefore).toBe(list[i - 1].stateAfter);
    }
    expect(b1.map((r) => r.stateAfter)).toEqual([2, 3, 2, 3]);
    expect(b2.map((r) => r.stateAfter)).toEqual([0, 0, 1, 0]);
  });

  it('predicts from the old state before updating (case 9)', () => {
    // From 01, TAKEN moves the counter to 10 (which would predict T),
    // but the prediction for this branch must come from 01 (N).
    const sim = stepSimulation(createSimulation('two-bit', 1, ev('T')));
    expect(sim.trace[0]).toMatchObject({ stateBefore: 1, predicted: 'N', stateAfter: 2, correct: false });
  });

  it('can be beaten by the 1-bit predictor on some patterns', () => {
    const events = ev('T T N N T T N N');
    expect(simulate('one-bit', 0, events).mispredictions).toBe(4);
    expect(simulate('two-bit', 1, events).mispredictions).toBe(6);
  });
});

describe('stepping and running', () => {
  const events = ev('B1:T B2:N B1:T B1:N B2:T B1:T B2:N N T T');

  it('Step Forward processes exactly one branch', () => {
    const start = createSimulation('two-bit', 2, events);
    const one = stepSimulation(start);
    expect(one.position).toBe(1);
    expect(one.trace).toHaveLength(1);
    expect(start.position).toBe(0); // input snapshot untouched
  });

  it('step-by-step, partial-then-run and full run give identical results (case 12)', () => {
    for (const kind of ['one-bit', 'two-bit'] as const) {
      const full = simulate(kind, 0, events);
      let stepped = createSimulation(kind, 0, events);
      while (!isComplete(stepped)) stepped = stepSimulation(stepped);
      let partial = createSimulation(kind, 0, events);
      for (let i = 0; i < 4; i++) partial = stepSimulation(partial);
      partial = runSimulation(partial);
      expect(stepped.trace).toEqual(full.trace);
      expect(partial.trace).toEqual(full.trace);
      expect([...stepped.table]).toEqual([...full.table]);
    }
  });

  it('stepping a finished simulation is a no-op', () => {
    const done = simulate('one-bit', 0, events);
    expect(stepSimulation(done)).toBe(done);
  });

  it('reset restores a clean initial state (case 13)', () => {
    const done = simulate('two-bit', 3, events);
    const reset = resetSimulation(done);
    expect(reset).toMatchObject({ position: 0, mispredictions: 0, initialState: 3, kind: 'two-bit' });
    expect(reset.trace).toHaveLength(0);
    expect(reset.table.size).toBe(0);
    expect(entryFor(reset, 'B1')).toEqual({ state: 3, seen: false });
  });

  it('re-running does not carry over state (case 16)', () => {
    const first = simulate('one-bit', 0, events);
    const second = runSimulation(resetSimulation(first));
    expect(second.trace).toEqual(first.trace);
    expect(second.trace[0].stateBefore).toBe(0);
  });

  it('treats addresses named like Object properties as ordinary branches', () => {
    const sim = simulate('one-bit', 0, ev('constructor:T constructor:T toString:N'));
    expect(sim.trace.map((r) => r.stateBefore)).toEqual([0, 1, 0]);
  });

  it('rejects invalid initial states', () => {
    expect(() => createSimulation('one-bit', 2 as never, events)).toThrow(RangeError);
    expect(() => createSimulation('two-bit', 4 as never, events)).toThrow(RangeError);
  });
});
