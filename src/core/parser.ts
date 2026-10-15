import type { BranchEvent, Outcome } from './types';

/** Address used for outcomes written without an address prefix. */
export const DEFAULT_ADDRESS = 'B0';
/** Upper bound that keeps the trace table and diagrams responsive. */
export const MAX_EVENTS = 2000;
/** Number of individual token errors reported before summarising. */
const MAX_REPORTED_ERRORS = 8;

export interface ParseError {
  /** 1-based token position, or 0 for errors about the whole input. */
  readonly tokenIndex: number;
  readonly token: string;
  readonly message: string;
}

export type ParseResult =
  | { readonly ok: true; readonly events: readonly BranchEvent[]; readonly addresses: readonly string[] }
  | { readonly ok: false; readonly errors: readonly ParseError[]; readonly totalErrors: number };

const NAME_ADDRESS = /^[A-Za-z_][A-Za-z0-9_]*$/;
const HEX_ADDRESS = /^0[xX][0-9A-Fa-f]+$/;

function normaliseAddress(raw: string): string | null {
  if (HEX_ADDRESS.test(raw)) return '0x' + raw.slice(2).toUpperCase();
  if (NAME_ADDRESS.test(raw)) return raw.toUpperCase();
  return null;
}

function normaliseOutcome(raw: string): Outcome | null {
  const upper = raw.toUpperCase();
  if (upper === 'T') return 'T';
  if (upper === 'N') return 'N';
  return null;
}

/**
 * Parse a branch-outcome sequence.
 *
 * Grammar (tokens separated by whitespace, commas or semicolons):
 *   token   := outcome | address ":" outcome
 *   outcome := "T" | "N"                      (case-insensitive)
 *   address := letter (letter | digit | "_")*  |  "0x" hexdigits
 *
 * Outcomes without an address belong to branch {@link DEFAULT_ADDRESS}.
 * Addresses are case-insensitive and normalised to upper case.
 */
export function parseSequence(input: string): ParseResult {
  const tokens = input.split(/[\s,;]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return {
      ok: false,
      totalErrors: 1,
      errors: [{ tokenIndex: 0, token: '', message: 'The sequence is empty. Enter outcomes such as "T N T T" or "B1:T B2:N".' }],
    };
  }

  const errors: ParseError[] = [];
  const events: BranchEvent[] = [];
  const addresses: string[] = [];

  tokens.forEach((token, i) => {
    const index = i + 1;
    const fail = (message: string) => errors.push({ tokenIndex: index, token, message });
    const parts = token.split(':');

    if (parts.length > 2) {
      fail('Use exactly one colon per entry, e.g. "B1:T".');
      return;
    }

    let address = DEFAULT_ADDRESS;
    let rawOutcome = parts[0];
    if (parts.length === 2) {
      const [rawAddress, outcomePart] = parts;
      if (rawAddress === '') {
        fail('Missing branch address before ":". Write it like "B1:T".');
        return;
      }
      const normalised = normaliseAddress(rawAddress);
      if (normalised === null) {
        fail(`"${rawAddress}" is not a valid address. Use a name such as B1 or loop_exit, or a hex address such as 0x40A0.`);
        return;
      }
      if (outcomePart === '') {
        fail(`Missing outcome after "${rawAddress}:". Add T (taken) or N (not taken).`);
        return;
      }
      address = normalised;
      rawOutcome = outcomePart;
    }

    const outcome = normaliseOutcome(rawOutcome);
    if (outcome === null) {
      fail(`"${rawOutcome}" is not an outcome. Use T for TAKEN or N for NOT TAKEN.`);
      return;
    }

    if (!addresses.includes(address)) addresses.push(address);
    events.push({ seq: events.length + 1, address, outcome });
  });

  if (errors.length === 0 && events.length > MAX_EVENTS) {
    errors.push({
      tokenIndex: 0,
      token: '',
      message: `The sequence has ${events.length} branches; the limit is ${MAX_EVENTS}. Shorten the sequence.`,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors: errors.slice(0, MAX_REPORTED_ERRORS), totalErrors: errors.length };
  }
  return { ok: true, events, addresses };
}

/** Render events back into canonical input text. */
export function formatSequence(events: readonly BranchEvent[]): string {
  const single = events.every((e) => e.address === DEFAULT_ADDRESS);
  return events.map((e) => (single ? e.outcome : `${e.address}:${e.outcome}`)).join(' ');
}

export function sameEvents(a: readonly BranchEvent[], b: readonly BranchEvent[]): boolean {
  return a.length === b.length && a.every((e, i) => e.address === b[i].address && e.outcome === b[i].outcome);
}
