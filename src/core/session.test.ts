import { describe, expect, it } from 'vitest';
import { comparePredictors, isolatedReversals } from './analysis';
import { EXPERIMENTS } from './experiments';
import { parseSequence } from './parser';
import { initialSession, isFinished, isStale, progress, sessionReducer, type SessionState } from './session';
import { simulate } from './simulator';

function eventsOf(text: string) {
  const r = parseSequence(text);
  if (!r.ok) throw new Error('bad test input');
  return r.events;
}

const MODEL = { instructions: 40, pipelineDepth: 5, penalty: 2 };

function start(text = 'B1:T B2:N B1:T B1:N B2:T'): SessionState {
  return initialSession({ text, initOneBit: 0, initTwoBit: 1 });
}

describe('session reducer', () => {
  it('loads the initial draft at step 0', () => {
    const s = start();
    expect(s.loaded?.events).toHaveLength(5);
    expect(progress(s.loaded)).toBe(0);
    expect(isStale(s)).toBe(false);
  });

  it('step advances both predictors by exactly one branch', () => {
    const s = sessionReducer(start(), { type: 'step' });
    expect(s.loaded!.oneBit.position).toBe(1);
    expect(s.loaded!.twoBit.position).toBe(1);
  });

  it('both predictors receive the identical event array (case 15)', () => {
    const s = sessionReducer(start(), { type: 'run' });
    expect(s.loaded!.oneBit.events).toBe(s.loaded!.twoBit.events);
    expect(s.loaded!.oneBit.trace.map((r) => `${r.address}:${r.actual}`)).toEqual(
      s.loaded!.twoBit.trace.map((r) => `${r.address}:${r.actual}`),
    );
  });

  it('predictor tables are independent objects in comparison mode (case 15)', () => {
    const s = sessionReducer(start(), { type: 'run' });
    expect(s.loaded!.oneBit.table).not.toBe(s.loaded!.twoBit.table);
    // Each matches a stand-alone run, so neither influenced the other.
    expect(s.loaded!.oneBit.trace).toEqual(simulate('one-bit', 0, s.loaded!.events).trace);
    expect(s.loaded!.twoBit.trace).toEqual(simulate('two-bit', 1, s.loaded!.events).trace);
  });

  it('editing the input does not silently modify a completed run', () => {
    let s = sessionReducer(start(), { type: 'run' });
    const before = s.loaded;
    s = sessionReducer(s, { type: 'setText', text: 'N N N' });
    expect(s.loaded).toBe(before);
    expect(isStale(s)).toBe(true);
  });

  it('whitespace-only edits are not treated as a change', () => {
    let s = start('T N T');
    s = sessionReducer(s, { type: 'setText', text: '  t,  n\nT ' });
    expect(isStale(s)).toBe(false);
  });

  it('changing an initial state marks the run stale', () => {
    const s = sessionReducer(start(), { type: 'setInitTwoBit', value: 3 });
    expect(isStale(s)).toBe(true);
  });

  it('run after an edit starts over with the new input', () => {
    let s = sessionReducer(start(), { type: 'run' });
    s = sessionReducer(s, { type: 'setText', text: 'N N N' });
    s = sessionReducer(s, { type: 'run' });
    expect(s.loaded!.events.map((e) => e.outcome)).toEqual(['N', 'N', 'N']);
    expect(isFinished(s.loaded)).toBe(true);
    expect(isStale(s)).toBe(false);
  });

  it('step after an edit restarts from step 1 of the new input', () => {
    let s = sessionReducer(start(), { type: 'step' });
    s = sessionReducer(s, { type: 'step' });
    s = sessionReducer(s, { type: 'setInitOneBit', value: 1 });
    s = sessionReducer(s, { type: 'step' });
    expect(progress(s.loaded)).toBe(1);
    expect(s.loaded!.oneBit.trace[0].stateBefore).toBe(1);
  });

  it('reset restores the initial state and clears history (case 13)', () => {
    let s = sessionReducer(start(), { type: 'run' });
    s = sessionReducer(s, { type: 'reset' });
    expect(progress(s.loaded)).toBe(0);
    expect(s.loaded!.oneBit.trace).toHaveLength(0);
    expect(s.loaded!.twoBit.table.size).toBe(0);
  });

  it('re-running a finished sequence does not carry over state (case 16)', () => {
    const once = sessionReducer(start(), { type: 'run' });
    const twice = sessionReducer(once, { type: 'run' });
    expect(twice.loaded).not.toBe(once.loaded);
    expect(twice.loaded!.oneBit.trace).toEqual(once.loaded!.oneBit.trace);
    expect(twice.loaded!.twoBit.trace).toEqual(once.loaded!.twoBit.trace);
  });

  it('invalid input cannot be stepped or run', () => {
    let s = initialSession({ text: 'T Q', initOneBit: 0, initTwoBit: 1 });
    expect(s.loaded).toBeNull();
    s = sessionReducer(s, { type: 'step' });
    s = sessionReducer(s, { type: 'run' });
    expect(s.loaded).toBeNull();
  });

  it('revert restores the draft from the loaded run', () => {
    let s = sessionReducer(start('T N'), { type: 'setText', text: 'N N N N' });
    s = sessionReducer(s, { type: 'revert' });
    expect(s.draft.text).toBe('T N');
    expect(isStale(s)).toBe(false);
  });

  it('clear input empties the editor without touching the run', () => {
    const before = sessionReducer(start(), { type: 'run' });
    const s = sessionReducer(before, { type: 'clearInput' });
    expect(s.draft.text).toBe('');
    expect(s.loaded).toBe(before.loaded);
  });

  it('every built-in experiment parses', () => {
    for (const e of EXPERIMENTS.filter((x) => x.sequence)) expect(parseSequence(e.sequence).ok).toBe(true);
  });
});

describe('comparison analysis', () => {
  it('reports the measured winner deterministically', () => {
    const s = sessionReducer(start('T T T N T T T N T T T N'), { type: 'run' });
    const c = comparePredictors(s.loaded!.oneBit, s.loaded!.twoBit, MODEL);
    expect(c.oneBit.metrics.mispredictions).toBe(s.loaded!.oneBit.mispredictions);
    expect(c.twoBit.metrics.mispredictions).toBe(s.loaded!.twoBit.mispredictions);
    expect(c.oneBit.metrics.mispredictions).toBe(6);
    expect(c.twoBit.metrics.mispredictions).toBe(4);
    expect(c.findings[0]).toMatch(/2-bit predictor made 2 fewer mispredictions/);
    expect(c.accuracyDifference).toBeCloseTo((8 / 12 - 6 / 12) * 100);
  });

  it('says so when both predictors tie', () => {
    const s = sessionReducer(start('T T T T T T T N'), { type: 'run' });
    const c = comparePredictors(s.loaded!.oneBit, s.loaded!.twoBit, MODEL);
    expect(c.findings[0]).toMatch(/same number of mispredictions/);
  });

  it('has an empty state before any branch runs', () => {
    const s = start();
    const c = comparePredictors(s.loaded!.oneBit, s.loaded!.twoBit, MODEL);
    expect(c.accuracyDifference).toBeNull();
    expect(c.findings).toHaveLength(1);
  });

  it('refuses to compare runs on different sequences', () => {
    const a = simulate('one-bit', 0, eventsOf('T N'));
    const b = simulate('two-bit', 0, eventsOf('N N'));
    expect(() => comparePredictors(a, b, MODEL)).toThrow();
  });

  it('finds isolated reversals per address', () => {
    const sim = simulate('one-bit', 0, eventsOf('T T N T T'));
    expect(isolatedReversals(sim.trace)).toEqual([{ at: 2, next: 3 }]);
  });
});
