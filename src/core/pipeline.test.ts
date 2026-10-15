import { describe, expect, it } from 'vitest';
import { buildTimeline } from './pipeline';

function timeline(depth: number, penalty: number, mispredicted: boolean) {
  const r = buildTimeline({ depth, penalty, mispredicted, predictedTaken: true });
  if (!r.ok) throw new Error(r.reason);
  return r.timeline;
}

describe('pipeline timeline', () => {
  it('loses no cycles on a correct prediction', () => {
    const t = timeline(5, 2, false);
    expect(t.lostCycles).toBe(0);
    expect(t.rows.every((r) => r.flushedAfterCycle === null)).toBe(true);
    expect(t.rows[0].cells).toEqual(['IF', 'ID', 'EX', 'MEM', 'WB']);
  });

  it('flushes P wrong-path instructions and loses P cycles on a misprediction', () => {
    for (let p = 0; p <= 4; p++) {
      const t = timeline(5, p, true);
      expect(t.rows.filter((r) => r.role === 'wrong-path')).toHaveLength(p);
      expect(t.lostCycles).toBe(p);
      expect(t.resolveCycle).toBe(p + 1);
    }
  });

  it('resolves a P = 2 branch in EX and restarts fetch in cycle 4', () => {
    const t = timeline(5, 2, true);
    expect(t.resolveStage).toBe('EX');
    const firstCorrect = t.rows.find((r) => r.role === 'correct-path')!;
    expect(firstCorrect.fetchCycle).toBe(4);
    expect(firstCorrect.label).toBe('fall-through 1');
    expect(t.rows[1]).toMatchObject({ label: 'target 1', flushedAfterCycle: 3 });
  });

  it('refuses penalties that do not fit the pipeline depth', () => {
    expect(buildTimeline({ depth: 5, penalty: 5, mispredicted: true, predictedTaken: true }).ok).toBe(false);
    expect(buildTimeline({ depth: 1, penalty: 0, mispredicted: true, predictedTaken: true }).ok).toBe(false);
  });

  it('uses generic stage names for depths other than 5', () => {
    expect(timeline(7, 3, true).stages).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']);
  });
});
