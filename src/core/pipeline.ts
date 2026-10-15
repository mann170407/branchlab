/**
 * Deterministic timing diagram for one branch in a simple in-order pipeline.
 *
 * Model (educational, not a specific processor):
 * - One instruction is fetched per cycle; each spends one cycle in each stage.
 * - The branch is fetched in cycle 1 and resolves in stage P + 1, at the end of cycle P + 1.
 * - The fetch unit keeps fetching along the *predicted* path until then.
 * - Correct prediction: those instructions are the right ones, so nothing is lost.
 * - Misprediction: the P wrong-path instructions are flushed and fetch restarts
 *   on the correct path in cycle P + 2, so P cycles are lost.
 */

export type RowRole = 'branch' | 'predicted-path' | 'wrong-path' | 'correct-path';

export interface PipelineRow {
  readonly label: string;
  readonly role: RowRole;
  /** Cycle (1-based) in which this instruction is fetched. */
  readonly fetchCycle: number;
  /** cells[c - 1] = stage occupied in cycle c, or null. */
  readonly cells: readonly (string | null)[];
  /** Cycle at the end of which this instruction is squashed, if flushed. */
  readonly flushedAfterCycle: number | null;
  /** Cycle in which this instruction completes, or null if flushed. */
  readonly completeCycle: number | null;
}

export interface PipelineTimeline {
  readonly stages: readonly string[];
  readonly cycles: number;
  readonly rows: readonly PipelineRow[];
  readonly mispredicted: boolean;
  readonly resolveCycle: number;
  readonly resolveStage: string;
  /** Cycle in which the first instruction after the branch (on the correct path) completes. */
  readonly firstUsefulComplete: number;
  /** Extra cycles compared with a correct prediction. */
  readonly lostCycles: number;
}

export type TimelineResult = { ok: true; timeline: PipelineTimeline } | { ok: false; reason: string };

export const FIVE_STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const;

export function stageNames(depth: number): string[] {
  if (depth === 5) return [...FIVE_STAGES];
  return Array.from({ length: depth }, (_, i) => `S${i + 1}`);
}

function row(label: string, role: RowRole, fetchCycle: number, stages: readonly string[], flushedAfter: number | null): PipelineRow {
  const lastCycle = flushedAfter ?? fetchCycle + stages.length - 1;
  const cells: (string | null)[] = [];
  for (let c = 1; c <= lastCycle; c++) {
    const s = c - fetchCycle;
    cells.push(s >= 0 && s < stages.length ? stages[s] : null);
  }
  return {
    label,
    role,
    fetchCycle,
    cells,
    flushedAfterCycle: flushedAfter,
    completeCycle: flushedAfter === null ? fetchCycle + stages.length - 1 : null,
  };
}

export function buildTimeline(options: {
  depth: number;
  penalty: number;
  mispredicted: boolean;
  /** Direction that was predicted (decides which path is labelled wrong / correct). */
  predictedTaken: boolean;
}): TimelineResult {
  const { depth, penalty, mispredicted, predictedTaken } = options;
  if (!Number.isInteger(depth) || depth < 2) {
    return { ok: false, reason: 'The timing diagram needs a pipeline depth of at least 2.' };
  }
  if (!Number.isInteger(penalty) || penalty < 0 || penalty > depth - 1) {
    return {
      ok: false,
      reason: `With L = ${depth} stages, a branch can resolve at most ${depth - 1} cycles after it is fetched, so the diagram cannot show P = ${penalty}. The cycle estimates still use P = ${penalty}.`,
    };
  }

  const stages = stageNames(depth);
  const resolveCycle = penalty + 1;
  const takenPath = 'target';
  const fallPath = 'fall-through';
  const predictedPath = predictedTaken ? takenPath : fallPath;
  const actualPath = mispredicted ? (predictedTaken ? fallPath : takenPath) : predictedPath;

  const rows: PipelineRow[] = [row('Branch', 'branch', 1, stages, null)];
  if (!mispredicted) {
    const following = Math.max(3, penalty + 2);
    for (let k = 1; k <= following; k++) {
      rows.push(row(`${predictedPath} ${k}`, 'predicted-path', 1 + k, stages, null));
    }
  } else {
    for (let k = 1; k <= penalty; k++) {
      rows.push(row(`${predictedPath} ${k}`, 'wrong-path', 1 + k, stages, resolveCycle));
    }
    for (let k = 1; k <= 2; k++) {
      rows.push(row(`${actualPath} ${k}`, 'correct-path', resolveCycle + k, stages, null));
    }
  }

  const cycles = Math.max(...rows.map((r) => r.cells.length));
  const firstUseful = rows.find((r) => r.role === 'predicted-path' || r.role === 'correct-path');
  const firstUsefulComplete = firstUseful?.completeCycle ?? 0;
  // A correct prediction lets the next instruction finish one cycle after the branch.
  const idealComplete = 1 + depth;

  return {
    ok: true,
    timeline: {
      stages,
      cycles,
      rows,
      mispredicted,
      resolveCycle,
      resolveStage: stages[penalty],
      firstUsefulComplete,
      lostCycles: firstUsefulComplete - idealComplete,
    },
  };
}
