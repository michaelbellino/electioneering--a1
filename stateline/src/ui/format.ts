/**
 * UI-only display formatting. The engine's `formatUsd` is exact (cents); for game UI we want
 * scannable numbers — whole dollars, signed deltas, descriptive position labels.
 */

/** Integer cents → "$5,000" (whole dollars; cents only matter to accountants). */
export function fmtUsd(cents: number): string {
  const neg = cents < 0
  const dollars = Math.round(Math.abs(cents) / 100)
  return `${neg ? '−' : ''}$${dollars.toLocaleString('en-US')}`
}

/** Signed money delta: positive gets a plus, negative an en-minus. */
export function fmtUsdDelta(cents: number): string {
  return cents > 0 ? `+${fmtUsd(cents)}` : fmtUsd(cents)
}

/** 0..1 attribute → "60". */
export function fmtScore(v: number): string {
  return String(Math.round(v * 100))
}

/** −1..+1 issue position → a phrase ("Center", "Lean progressive", "Strongly conservative"). */
export function fmtPosition(v: number): string {
  const mag = Math.abs(v)
  if (mag < 0.05) return 'Center'
  const dir = v > 0 ? 'progressive' : 'conservative'
  if (mag <= 0.35) return `Lean ${dir}`
  if (mag <= 0.7) return `Solidly ${dir}`
  return `Strongly ${dir}`
}
