/** Display helpers. All return "—" for missing values so the UI never shows NaN or Infinity. */

export const EMPTY = '—';

function trimDecimals(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.?0+$/, '');
}

export function formatPercent(value: number | null, digits = 2): string {
  return value === null || !Number.isFinite(value) ? EMPTY : `${trimDecimals(value, digits)}%`;
}

export function formatPoints(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return EMPTY;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${trimDecimals(Math.abs(value), digits)} pp`;
}

export function formatInt(value: number | null): string {
  return value === null || !Number.isFinite(value) ? EMPTY : value.toLocaleString('en-US');
}

export function formatCpi(value: number | null): string {
  return value === null || !Number.isFinite(value) ? EMPTY : value.toFixed(3);
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}
