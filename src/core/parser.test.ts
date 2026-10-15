import { describe, expect, it } from 'vitest';
import { DEFAULT_ADDRESS, formatSequence, MAX_EVENTS, parseSequence } from './parser';

function events(input: string) {
  const r = parseSequence(input);
  if (!r.ok) throw new Error(`unexpected parse failure: ${JSON.stringify(r.errors)}`);
  return r;
}

function errors(input: string) {
  const r = parseSequence(input);
  if (r.ok) throw new Error('expected parse failure');
  return r;
}

describe('parseSequence', () => {
  it('parses plain T/N outcomes into the default branch', () => {
    const r = events('T N T T');
    expect(r.events.map((e) => e.outcome)).toEqual(['T', 'N', 'T', 'T']);
    expect(r.events.every((e) => e.address === DEFAULT_ADDRESS)).toBe(true);
    expect(r.events.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
  });

  it('ignores harmless whitespace, newlines, commas and case', () => {
    const r = events('  t,n ;\n\tT   n  ');
    expect(r.events.map((e) => e.outcome)).toEqual(['T', 'N', 'T', 'N']);
  });

  it('parses addressed outcomes and normalises addresses', () => {
    const r = events('b1:T B2:n B1:t 0x40a0:N');
    expect(r.events.map((e) => `${e.address}:${e.outcome}`)).toEqual(['B1:T', 'B2:N', 'B1:T', '0x40A0:N']);
    expect(r.addresses).toEqual(['B1', 'B2', '0x40A0']);
  });

  describe('rejects invalid sequences with understandable messages (case 14)', () => {
    it('empty input', () => {
      const r = errors('   \n ');
      expect(r.errors[0].message).toMatch(/empty/i);
    });

    it('unknown outcome', () => {
      const r = errors('T X N');
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]).toMatchObject({ tokenIndex: 2, token: 'X' });
      expect(r.errors[0].message).toMatch(/T for TAKEN or N for NOT TAKEN/);
    });

    it('full words are not accepted silently', () => {
      expect(errors('TAKEN').errors[0].message).toMatch(/not an outcome/);
    });

    it('missing address or outcome around the colon', () => {
      expect(errors(':T').errors[0].message).toMatch(/Missing branch address/);
      expect(errors('B1:').errors[0].message).toMatch(/Missing outcome/);
    });

    it('invalid address', () => {
      expect(errors('1B:T').errors[0].message).toMatch(/not a valid address/);
      expect(errors('B-1:T').errors[0].message).toMatch(/not a valid address/);
    });

    it('more than one colon', () => {
      expect(errors('B1:T:N').errors[0].message).toMatch(/one colon/);
    });

    it('reports every bad token with its position, capped', () => {
      const r = errors('X T Y N Z');
      expect(r.errors.map((e) => e.tokenIndex)).toEqual([1, 3, 5]);
      const many = errors(Array(20).fill('Q').join(' '));
      expect(many.totalErrors).toBe(20);
      expect(many.errors.length).toBeLessThan(20);
    });

    it('sequences above the length limit', () => {
      expect(errors(Array(MAX_EVENTS + 1).fill('T').join(' ')).errors[0].message).toMatch(/limit/);
    });
  });

  it('round-trips through formatSequence', () => {
    expect(formatSequence(events('t n  t').events)).toBe('T N T');
    expect(formatSequence(events('b1:t b2:N').events)).toBe('B1:T B2:N');
  });
});
