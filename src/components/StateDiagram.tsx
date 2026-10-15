import { useId } from 'react';
import { getPredictor } from '../core/predictors';
import type { Outcome, PredictorKind, PredictorState } from '../core/types';

export interface Transition {
  readonly from: PredictorState;
  readonly to: PredictorState;
  readonly outcome: Outcome;
}

interface Props {
  kind: PredictorKind;
  /** State to highlight (the selected branch's current entry). */
  current: PredictorState | null;
  /** True when `current` is only the initial state of a branch not yet executed. */
  currentIsInitial?: boolean;
  /** The most recent update of the selected branch, highlighted as an arrow. */
  lastTransition: Transition | null;
}

const NODE_W = 116;
const NODE_H = 58;
const CY = 104;

/**
 * State-transition diagram for the 1-bit or 2-bit predictor.
 * TAKEN edges run left-to-right above the states; NOT TAKEN edges run right-to-left below.
 * Saturation is drawn as self-loops on the end states.
 */
export function StateDiagram({ kind, current, currentIsInitial = false, lastTransition }: Props) {
  const predictor = getPredictor(kind);
  const states = predictor.states;
  const markerId = useId().replace(/:/g, '');
  const width = kind === 'two-bit' ? 700 : 440;
  const gap = kind === 'two-bit' ? 160 : 220;
  const firstCx = (width - gap * (states.length - 1)) / 2;
  const cx = (i: number) => firstCx + i * gap;
  const halfW = NODE_W / 2;
  const halfH = NODE_H / 2;

  const isActive = (from: number, to: number, outcome: Outcome) =>
    lastTransition !== null && lastTransition.from === from && lastTransition.to === to && lastTransition.outcome === outcome;

  type Edge = { d: string; label: string; lx: number; ly: number; active: boolean; title: string };
  const edges: Edge[] = [];
  const name = (s: number) => `${predictor.formatState(s as PredictorState)} (${predictor.stateName(s as PredictorState)})`;

  for (let i = 0; i < states.length - 1; i++) {
    const x1 = cx(i) + 26;
    const x2 = cx(i + 1) - 26;
    const mid = (cx(i) + cx(i + 1)) / 2;
    edges.push({
      d: `M ${x1} ${CY - halfH} Q ${mid} ${CY - halfH - 52} ${x2} ${CY - halfH}`,
      label: 'T',
      lx: mid,
      ly: CY - halfH - 32,
      active: isActive(i, i + 1, 'T'),
      title: `TAKEN: ${name(i)} → ${name(i + 1)}`,
    });
    edges.push({
      d: `M ${x2} ${CY + halfH} Q ${mid} ${CY + halfH + 52} ${x1} ${CY + halfH}`,
      label: 'N',
      lx: mid,
      ly: CY + halfH + 40,
      active: isActive(i + 1, i, 'N'),
      title: `NOT TAKEN: ${name(i + 1)} → ${name(i)}`,
    });
  }
  const last = states.length - 1;
  const lx = cx(last);
  edges.push({
    d: `M ${lx + 20} ${CY - halfH} C ${lx + 30} ${CY - halfH - 52}, ${lx + halfW + 46} ${CY - halfH - 20}, ${lx + halfW} ${CY - 12}`,
    label: 'T',
    lx: lx + halfW + 26,
    ly: CY - halfH - 30,
    active: isActive(last, last, 'T'),
    title: `TAKEN: stays at ${name(last)}${kind === 'two-bit' ? ' (saturates)' : ''}`,
  });
  const fx = cx(0);
  edges.push({
    d: `M ${fx - 20} ${CY + halfH} C ${fx - 30} ${CY + halfH + 52}, ${fx - halfW - 46} ${CY + halfH + 20}, ${fx - halfW} ${CY + 12}`,
    label: 'N',
    lx: fx - halfW - 26,
    ly: CY + halfH + 40,
    active: isActive(0, 0, 'N'),
    title: `NOT TAKEN: stays at ${name(0)}${kind === 'two-bit' ? ' (saturates)' : ''}`,
  });

  // Prediction regions: states that predict NOT TAKEN vs TAKEN.
  const ntStates = states.filter((s) => predictor.predict(s) === 'N');
  const tStates = states.filter((s) => predictor.predict(s) === 'T');
  const region = (list: readonly number[], label: string) => {
    const x1 = cx(list[0]) - halfW;
    const x2 = cx(list[list.length - 1]) + halfW;
    const y = CY + halfH + 74;
    return (
      <g className="sd-region" key={label}>
        <path d={`M ${x1} ${y - 6} V ${y} H ${x2} V ${y - 6}`} />
        <text x={(x1 + x2) / 2} y={y + 16} textAnchor="middle">
          {label}
        </text>
      </g>
    );
  };

  const description =
    current === null
      ? `${predictor.label} state diagram.`
      : `${predictor.label} state diagram. Current state ${name(current)}${currentIsInitial ? ' (initial state, branch not executed yet)' : ''}.` +
        (lastTransition ? ` Last update: ${lastTransition.outcome === 'T' ? 'TAKEN' : 'NOT TAKEN'} moved ${name(lastTransition.from)} to ${name(lastTransition.to)}.` : '');

  return (
    <svg className="state-diagram" viewBox={`0 0 ${width} 222`} role="img" aria-label={description}>
      <defs>
        <marker id={`${markerId}-a`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="sd-arrowhead" />
        </marker>
        <marker id={`${markerId}-b`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="sd-arrowhead sd-arrowhead--active" />
        </marker>
      </defs>
      {region(ntStates, 'predicts NOT TAKEN')}
      {region(tStates, 'predicts TAKEN')}
      {edges.map((e, i) => (
        <g key={i} className={`sd-edge ${e.active ? 'sd-edge--active' : ''}`}>
          <title>{e.title}</title>
          <path d={e.d} markerEnd={`url(#${markerId}-${e.active ? 'b' : 'a'})`} />
          <text x={e.lx} y={e.ly} textAnchor="middle">
            {e.label}
          </text>
        </g>
      ))}
      {states.map((s, i) => {
        const active = current === s;
        const [line1, ...rest] = predictor.stateName(s).split(' ');
        return (
          <g key={s} className={`sd-node ${active ? 'sd-node--active' : ''} ${active && currentIsInitial ? 'sd-node--initial' : ''}`}>
            <rect x={cx(i) - halfW} y={CY - halfH} width={NODE_W} height={NODE_H} rx="5" />
            <text x={cx(i)} y={CY - 6} textAnchor="middle" className="sd-node__code">
              {predictor.formatState(s)}
            </text>
            <text x={cx(i)} y={CY + 16} textAnchor="middle" className="sd-node__name">
              {kind === 'two-bit' ? `${line1} ${rest.join(' ').replace('Not Taken', 'NT').replace('Taken', 'T')}` : predictor.stateName(s)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
