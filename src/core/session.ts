import { parseSequence, sameEvents } from './parser';
import { createSimulation, isComplete, runSimulation, stepSimulation, type SimulationState } from './simulator';
import type { BranchEvent, OneBitState, TwoBitState } from './types';

/**
 * Simulator session: what the user is editing (draft) versus what is being
 * simulated (loaded). Both predictors always run in lockstep on the *same*
 * event array, each with its own independent table.
 */
export interface Draft {
  readonly text: string;
  readonly initOneBit: OneBitState;
  readonly initTwoBit: TwoBitState;
}

export interface Loaded {
  readonly text: string;
  readonly events: readonly BranchEvent[];
  readonly initOneBit: OneBitState;
  readonly initTwoBit: TwoBitState;
  readonly oneBit: SimulationState;
  readonly twoBit: SimulationState;
}

export interface SessionState {
  readonly draft: Draft;
  readonly loaded: Loaded | null;
}

export type SessionAction =
  | { type: 'setText'; text: string }
  | { type: 'setInitOneBit'; value: OneBitState }
  | { type: 'setInitTwoBit'; value: TwoBitState }
  | { type: 'clearInput' }
  /** Put a sequence in the editor and load it, ready at step 0. */
  | { type: 'loadSequence'; text: string }
  | { type: 'step' }
  | { type: 'run' }
  | { type: 'reset' }
  /** Discard edits and restore the draft from the loaded run. */
  | { type: 'revert' };

export function loadDraft(draft: Draft): Loaded | null {
  const parsed = parseSequence(draft.text);
  if (!parsed.ok) return null;
  return {
    text: draft.text,
    events: parsed.events,
    initOneBit: draft.initOneBit,
    initTwoBit: draft.initTwoBit,
    oneBit: createSimulation('one-bit', draft.initOneBit, parsed.events),
    twoBit: createSimulation('two-bit', draft.initTwoBit, parsed.events),
  };
}

export function initialSession(draft: Draft): SessionState {
  return { draft, loaded: loadDraft(draft) };
}

/** True when the editor no longer matches the sequence/initial states being simulated. */
export function isStale(state: SessionState): boolean {
  const { draft, loaded } = state;
  if (!loaded) return true;
  if (draft.initOneBit !== loaded.initOneBit || draft.initTwoBit !== loaded.initTwoBit) return true;
  if (draft.text === loaded.text) return false;
  const parsed = parseSequence(draft.text);
  return !parsed.ok || !sameEvents(parsed.events, loaded.events);
}

export function isFinished(loaded: Loaded | null): boolean {
  return loaded !== null && isComplete(loaded.oneBit) && isComplete(loaded.twoBit);
}

export function progress(loaded: Loaded | null): number {
  return loaded ? loaded.oneBit.position : 0;
}

/**
 * The run that Step/Run should operate on. Edits are never applied silently:
 * if the draft is stale, Step/Run/Reset explicitly start over from the draft.
 */
function activeRun(state: SessionState): Loaded | null {
  return isStale(state) ? loadDraft(state.draft) : state.loaded;
}

function advance(loaded: Loaded, fn: (s: SimulationState) => SimulationState): Loaded {
  return { ...loaded, oneBit: fn(loaded.oneBit), twoBit: fn(loaded.twoBit) };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'setText':
      return { ...state, draft: { ...state.draft, text: action.text } };
    case 'setInitOneBit':
      return { ...state, draft: { ...state.draft, initOneBit: action.value } };
    case 'setInitTwoBit':
      return { ...state, draft: { ...state.draft, initTwoBit: action.value } };
    case 'clearInput':
      return { ...state, draft: { ...state.draft, text: '' } };
    case 'loadSequence': {
      const draft = { ...state.draft, text: action.text };
      const loaded = loadDraft(draft);
      return { draft, loaded: loaded ?? state.loaded };
    }
    case 'step': {
      const run = activeRun(state);
      if (!run || isFinished(run)) return state;
      return { ...state, loaded: advance(run, stepSimulation) };
    }
    case 'run': {
      let run = activeRun(state);
      if (!run) return state;
      // A finished, unchanged run is re-run from a clean predictor.
      if (isFinished(run)) run = loadDraft({ text: run.text, initOneBit: run.initOneBit, initTwoBit: run.initTwoBit });
      if (!run) return state;
      return { ...state, loaded: advance(run, runSimulation) };
    }
    case 'reset': {
      const fromDraft = loadDraft(state.draft);
      if (fromDraft) return { ...state, loaded: fromDraft };
      if (!state.loaded) return state;
      const { text, initOneBit, initTwoBit } = state.loaded;
      return { ...state, loaded: loadDraft({ text, initOneBit, initTwoBit }) };
    }
    case 'revert': {
      if (!state.loaded) return state;
      const { text, initOneBit, initTwoBit } = state.loaded;
      return { ...state, draft: { text, initOneBit, initTwoBit } };
    }
  }
}
