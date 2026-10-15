import { describe, expect, it } from 'vitest';
import { getPredictor, isValidState, oneBitPredictor, twoBitPredictor } from './predictors';
import type { TwoBitState } from './types';

describe('1-bit predictor', () => {
  it('predicts from the bit: 1 = TAKEN, 0 = NOT TAKEN', () => {
    expect(oneBitPredictor.predict(1)).toBe('T');
    expect(oneBitPredictor.predict(0)).toBe('N');
  });

  it('updates to 1 after a TAKEN outcome (case 1)', () => {
    expect(oneBitPredictor.update(0, 'T')).toBe(1);
    expect(oneBitPredictor.update(1, 'T')).toBe(1);
  });

  it('updates to 0 after a NOT TAKEN outcome (case 2)', () => {
    expect(oneBitPredictor.update(1, 'N')).toBe(0);
    expect(oneBitPredictor.update(0, 'N')).toBe(0);
  });

  it('flips its prediction after a single wrong outcome', () => {
    const after = oneBitPredictor.update(1, 'N');
    expect(oneBitPredictor.predict(after)).toBe('N');
  });
});

describe('2-bit saturating counter', () => {
  it('predicts TAKEN only for 10 and 11', () => {
    expect(twoBitPredictor.states.map((s) => twoBitPredictor.predict(s))).toEqual(['N', 'N', 'T', 'T']);
  });

  it('increments by one after TAKEN (case 5)', () => {
    expect(twoBitPredictor.update(0, 'T')).toBe(1);
    expect(twoBitPredictor.update(1, 'T')).toBe(2);
    expect(twoBitPredictor.update(2, 'T')).toBe(3);
  });

  it('decrements by one after NOT TAKEN (case 6)', () => {
    expect(twoBitPredictor.update(3, 'N')).toBe(2);
    expect(twoBitPredictor.update(2, 'N')).toBe(1);
    expect(twoBitPredictor.update(1, 'N')).toBe(0);
  });

  it('saturates at 11 (case 7)', () => {
    let s: TwoBitState = 3;
    for (let i = 0; i < 10; i++) s = twoBitPredictor.update(s, 'T');
    expect(s).toBe(3);
  });

  it('saturates at 00 (case 8)', () => {
    let s: TwoBitState = 0;
    for (let i = 0; i < 10; i++) s = twoBitPredictor.update(s, 'N');
    expect(s).toBe(0);
  });

  it('formats states in binary with names', () => {
    expect(twoBitPredictor.states.map((s) => twoBitPredictor.formatState(s))).toEqual(['00', '01', '10', '11']);
    expect(twoBitPredictor.stateName(0)).toBe('Strongly Not Taken');
    expect(twoBitPredictor.stateName(3)).toBe('Strongly Taken');
    expect(twoBitPredictor.stateShort(1)).toBe('WNT');
  });

  it('needs two consecutive wrong outcomes to change a strong prediction', () => {
    const once = twoBitPredictor.update(3, 'N');
    expect(twoBitPredictor.predict(once)).toBe('T');
    const twice = twoBitPredictor.update(once, 'N');
    expect(twoBitPredictor.predict(twice)).toBe('N');
  });
});

describe('state validation', () => {
  it('accepts only legal states', () => {
    expect(isValidState('one-bit', 1)).toBe(true);
    expect(isValidState('one-bit', 2)).toBe(false);
    expect(isValidState('two-bit', 3)).toBe(true);
    expect(isValidState('two-bit', 4)).toBe(false);
    expect(isValidState('two-bit', -1)).toBe(false);
    expect(getPredictor('two-bit').bits).toBe(2);
  });
});
