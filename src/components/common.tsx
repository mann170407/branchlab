import type { ReactNode } from 'react';
import { getPredictor } from '../core/predictors';
import type { Outcome, PredictorKind, PredictorState } from '../core/types';

export function OutcomeTag({ outcome }: { outcome: Outcome }) {
  return (
    <span className={`outcome outcome--${outcome}`} title={outcome === 'T' ? 'TAKEN' : 'NOT TAKEN'}>
      {outcome}
    </span>
  );
}

export function ResultTag({ correct }: { correct: boolean }) {
  return <span className={`result ${correct ? 'result--ok' : 'result--bad'}`}>{correct ? 'CORRECT' : 'MISPREDICT'}</span>;
}

/** Binary state plus (optionally) its short name, e.g. "10 WT". */
export function StateValue({ kind, state, showName = true }: { kind: PredictorKind; state: PredictorState; showName?: boolean }) {
  const p = getPredictor(kind);
  return (
    <span className="state-value" title={`${p.formatState(state)}: ${p.stateName(state)}`}>
      <span className="mono">{p.formatState(state)}</span>
      {showName && <span className="state-value__name">{p.stateShort(state)}</span>}
    </span>
  );
}

export function Panel({
  title,
  id,
  actions,
  children,
  className = '',
  description,
}: {
  title: string;
  id?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={`panel ${className}`} id={id} aria-labelledby={headingId}>
      <div className="panel__head">
        <h2 className="panel__title" id={headingId}>
          {title}
        </h2>
        {actions && <div className="panel__actions">{actions}</div>}
      </div>
      {description && <div className="panel__desc">{description}</div>}
      {children}
    </section>
  );
}
